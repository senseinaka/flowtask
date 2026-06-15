// ═══════════════════════════════════════════════════════════════════════════
// Calendario / Agenda — Fase 1: integración OAuth de solo lectura con Google
// Calendar.
// ═══════════════════════════════════════════════════════════════════════════
//
// Sigue el mismo patrón que drive.service.ts (OAuth2Client + servidor HTTP
// loopback efímero para capturar el código), pero con scope de solo lectura
// (calendar.readonly) y tokens namespaced por `user_id` de la sesión activa
// de Supabase Auth — así cada usuario de la app guarda su propia conexión a
// Google Calendar, igual que auth.service.ts persiste la sesión de Supabase.
//
// listCalendars() devuelve TODOS los calendarios visibles para la cuenta
// conectada — Google ya incluye automáticamente los calendarios compartidos
// (ej. el calendario familiar compartido por la esposa) en calendarList.list,
// no se necesita lógica adicional para "compartidos".

import { google } from 'googleapis'
import { shell } from 'electron'
import http from 'http'
import { randomUUID } from 'crypto'
import ConfigStore from './config-store'
import { getSession } from './auth.service'
import { getDb } from '../database/db'
import type { calendar_v3 } from 'googleapis'
import type { CalendarConnectionStatus, GoogleCalendarInfo } from '@shared/types'

const store = new ConfigStore('google-calendar')
const REDIRECT_PORT = 42814
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/oauth2callback`
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']

// Reutilizamos las credenciales OAuth (Client ID/Secret) ya configuradas para
// Google Drive — son credenciales de la misma app de Google Cloud, solo el
// scope/consent difiere por sesión.
const driveStore = new ConfigStore('drive-config')

interface GoogleTokens {
  access_token?: string | null
  refresh_token?: string | null
  expiry_date?: number | null
  scope?: string
  token_type?: string | null
}

interface StoredConnection {
  email: string
  tokens: GoogleTokens
}

function getCredentials(): { clientId: string; clientSecret: string } {
  return {
    clientId: (driveStore.get('clientId', '') as string),
    clientSecret: (driveStore.get('clientSecret', '') as string)
  }
}

function hasCredentials(): boolean {
  const { clientId, clientSecret } = getCredentials()
  return !!(clientId && clientSecret)
}

function getOAuth2Client() {
  const { clientId, clientSecret } = getCredentials()
  return new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI)
}

async function getActiveUserId(): Promise<string | null> {
  const session = await getSession()
  return session?.userId ?? null
}

function tokenKey(userId: string): string {
  return `tokens:${userId}`
}

function getStoredConnection(userId: string): StoredConnection | null {
  return store.get<StoredConnection | null>(tokenKey(userId), null)
}

function saveStoredConnection(userId: string, conn: StoredConnection): void {
  store.set(tokenKey(userId), conn)
}

function deleteStoredConnection(userId: string): void {
  store.delete(tokenKey(userId))
}

/**
 * Devuelve un OAuth2Client con credenciales cargadas para el usuario activo,
 * refrescando el access_token automáticamente si está vencido (la librería
 * googleapis lo hace sola al detectar `refresh_token`, y persistimos el
 * resultado vía el listener `tokens`).
 */
async function getAuthorizedClient(userId: string): Promise<{ client: InstanceType<typeof google.auth.OAuth2>; conn: StoredConnection } | null> {
  const conn = getStoredConnection(userId)
  if (!conn) return null

  const client = getOAuth2Client()
  client.setCredentials(conn.tokens)

  // Persistir tokens refrescados automáticamente.
  client.on('tokens', (newTokens) => {
    const merged: GoogleTokens = { ...conn.tokens, ...newTokens }
    saveStoredConnection(userId, { email: conn.email, tokens: merged })
  })

  return { client, conn }
}

// ── Estado de conexión ───────────────────────────────────────────────────────

export async function getConnectionStatus(): Promise<CalendarConnectionStatus> {
  const userId = await getActiveUserId()
  if (!userId) return { connected: false, googleEmail: null, enabledCalendarIds: [], lastSyncAt: null }

  const conn = getStoredConnection(userId)
  if (!conn) return { connected: false, googleEmail: null, enabledCalendarIds: [], lastSyncAt: null }

  const row = getDb()
    .prepare('SELECT enabled_calendar_ids, last_sync_at FROM calendar_connections WHERE user_id = ?')
    .get(userId) as { enabled_calendar_ids: string; last_sync_at: number | null } | undefined

  let enabledCalendarIds: string[] = []
  try {
    enabledCalendarIds = row ? JSON.parse(row.enabled_calendar_ids) : []
  } catch {
    enabledCalendarIds = []
  }

  return {
    connected: true,
    googleEmail: conn.email,
    enabledCalendarIds,
    lastSyncAt: row?.last_sync_at ?? null
  }
}

// ── OAuth flow ───────────────────────────────────────────────────────────────

/**
 * Abre el navegador del sistema para el consentimiento de Google y levanta
 * un servidor HTTP loopback efímero en 127.0.0.1 para capturar el código de
 * autorización (flujo estándar de apps de escritorio).
 */
export async function startOAuth(): Promise<CalendarConnectionStatus> {
  if (!hasCredentials()) {
    throw new Error('Configurá el Client ID y Client Secret de Google (sección Drive/Backup en Configuración) antes de conectar el Calendario.')
  }

  const userId = await getActiveUserId()
  if (!userId) throw new Error('No hay sesión activa.')

  const oauth2Client = getOAuth2Client()
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES
  })
  shell.openExternal(authUrl)

  const tokens = await new Promise<GoogleTokens>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      if (!req.url?.startsWith('/oauth2callback')) return
      const url = new URL(req.url, `http://127.0.0.1:${REDIRECT_PORT}`)
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<h1>Summit conectado a Google Calendar. Podés cerrar esta pestaña.</h1>')
      server.close()

      if (error) { reject(new Error(error)); return }
      if (!code) { reject(new Error('No code')); return }
      try {
        const { tokens: t } = await oauth2Client.getToken(code)
        resolve(t)
      } catch (err) {
        reject(err)
      }
    })
    server.listen(REDIRECT_PORT, '127.0.0.1')
    setTimeout(() => { server.close(); reject(new Error('OAuth timeout')) }, 120_000)
  })

  oauth2Client.setCredentials(tokens)
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
  const userInfo = await oauth2.userinfo.get()
  const email = userInfo.data.email ?? 'desconocido'

  saveStoredConnection(userId, { email, tokens })

  const now = Date.now()
  getDb().prepare(`
    INSERT INTO calendar_connections (user_id, google_email, connected_at, last_sync_at, enabled_calendar_ids)
    VALUES (?, ?, ?, NULL, '[]')
    ON CONFLICT(user_id) DO UPDATE SET google_email = excluded.google_email, connected_at = excluded.connected_at
  `).run(userId, email, now)

  return getConnectionStatus()
}

export async function disconnect(): Promise<void> {
  const userId = await getActiveUserId()
  if (!userId) return
  deleteStoredConnection(userId)
  getDb().prepare('DELETE FROM calendar_connections WHERE user_id = ?').run(userId)
  getDb().prepare('DELETE FROM calendar_events_cache').run()
}

// ── Calendars ────────────────────────────────────────────────────────────────

/** Devuelve todos los calendarios visibles para la cuenta conectada (incluye compartidos). */
export async function listCalendars(): Promise<GoogleCalendarInfo[]> {
  const userId = await getActiveUserId()
  if (!userId) throw new Error('No hay sesión activa.')

  const authorized = await getAuthorizedClient(userId)
  if (!authorized) throw new Error('Google Calendar no está conectado.')

  const calendar = google.calendar({ version: 'v3', auth: authorized.client })
  const res = await calendar.calendarList.list({ maxResults: 250 })

  return (res.data.items ?? []).map((c) => ({
    id: c.id ?? '',
    summary: c.summary ?? c.id ?? '',
    description: c.description ?? null,
    backgroundColor: c.backgroundColor ?? null,
    primary: c.primary ?? false,
    accessRole: c.accessRole ?? null
  }))
}

export async function setEnabledCalendars(calendarIds: string[]): Promise<void> {
  const userId = await getActiveUserId()
  if (!userId) throw new Error('No hay sesión activa.')

  getDb().prepare('UPDATE calendar_connections SET enabled_calendar_ids = ? WHERE user_id = ?')
    .run(JSON.stringify(calendarIds), userId)
}

// ── Sync de eventos ──────────────────────────────────────────────────────────

interface UpsertEventRow {
  google_event_id: string
  google_calendar_id: string
  summary: string
  description: string | null
  location: string | null
  start_at: number
  end_at: number | null
  all_day: number
  status: string | null
  color_id: string | null
  updated_at: number
}

function eventToRow(calendarId: string, event: calendar_v3.Schema$Event): UpsertEventRow | null {
  if (!event.id) return null

  const startRaw = event.start?.dateTime ?? event.start?.date
  const endRaw = event.end?.dateTime ?? event.end?.date
  if (!startRaw) return null

  const allDay = !event.start?.dateTime
  const start_at = new Date(startRaw).getTime()
  const end_at = endRaw ? new Date(endRaw).getTime() : null
  const updated_at = event.updated ? new Date(event.updated).getTime() : Date.now()

  return {
    google_event_id: event.id,
    google_calendar_id: calendarId,
    summary: event.summary ?? '(Sin título)',
    description: event.description ?? null,
    location: event.location ?? null,
    start_at,
    end_at,
    all_day: allDay ? 1 : 0,
    status: event.status ?? null,
    color_id: event.colorId ?? null,
    updated_at
  }
}

/** Sincroniza eventos de los calendarios indicados dentro del rango dado. */
export async function syncEvents(calendarIds: string[], timeMin: number, timeMax: number): Promise<{ synced: number }> {
  const userId = await getActiveUserId()
  if (!userId) throw new Error('No hay sesión activa.')

  const authorized = await getAuthorizedClient(userId)
  if (!authorized) throw new Error('Google Calendar no está conectado.')

  const calendar = google.calendar({ version: 'v3', auth: authorized.client })
  const db = getDb()
  const now = Date.now()

  const upsert = db.prepare(`
    INSERT INTO calendar_events_cache
      (id, google_event_id, google_calendar_id, summary, description, location, start_at, end_at, all_day, status, color_id, updated_at, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(google_calendar_id, google_event_id) DO UPDATE SET
      summary = excluded.summary,
      description = excluded.description,
      location = excluded.location,
      start_at = excluded.start_at,
      end_at = excluded.end_at,
      all_day = excluded.all_day,
      status = excluded.status,
      color_id = excluded.color_id,
      updated_at = excluded.updated_at,
      fetched_at = excluded.fetched_at
  `)

  const deleteCancelled = db.prepare(`
    DELETE FROM calendar_events_cache WHERE google_calendar_id = ? AND google_event_id = ?
  `)

  let synced = 0

  for (const calendarId of calendarIds) {
    let pageToken: string | undefined
    do {
      const res = await calendar.events.list({
        calendarId,
        timeMin: new Date(timeMin).toISOString(),
        timeMax: new Date(timeMax).toISOString(),
        singleEvents: true,
        maxResults: 250,
        pageToken
      })

      for (const event of res.data.items ?? []) {
        if (event.status === 'cancelled') {
          if (event.id) deleteCancelled.run(calendarId, event.id)
          continue
        }
        const row = eventToRow(calendarId, event)
        if (!row) continue
        upsert.run(
          randomUUID(),
          row.google_event_id, row.google_calendar_id, row.summary, row.description, row.location,
          row.start_at, row.end_at, row.all_day, row.status, row.color_id, row.updated_at, now
        )
        synced++
      }

      pageToken = res.data.nextPageToken ?? undefined
    } while (pageToken)
  }

  db.prepare('UPDATE calendar_connections SET last_sync_at = ? WHERE user_id = ?').run(now, userId)

  return { synced }
}

/** Sincroniza usando los calendarios habilitados guardados, en una ventana de ±90 días. */
export async function syncEnabledCalendars(): Promise<{ synced: number } | null> {
  const userId = await getActiveUserId()
  if (!userId) return null

  const conn = getStoredConnection(userId)
  if (!conn) return null

  const row = getDb()
    .prepare('SELECT enabled_calendar_ids FROM calendar_connections WHERE user_id = ?')
    .get(userId) as { enabled_calendar_ids: string } | undefined
  if (!row) return null

  let calendarIds: string[] = []
  try {
    calendarIds = JSON.parse(row.enabled_calendar_ids)
  } catch {
    calendarIds = []
  }
  if (calendarIds.length === 0) return { synced: 0 }

  const now = Date.now()
  const DAY = 24 * 60 * 60 * 1000
  return syncEvents(calendarIds, now - 90 * DAY, now + 90 * DAY)
}
