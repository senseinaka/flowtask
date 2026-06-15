// ═══════════════════════════════════════════════════════════════════════════
// Calendario / Agenda — Fase 1: consultas locales (calendar_events_cache,
// calendar_connections — tablas LOCAL-ONLY, no PowerSync) + agregación de
// "eventos unificados" desde Finanzas Personal, Finanzas Empresa y Comex -
// Programación de Pedidos.
// ═══════════════════════════════════════════════════════════════════════════

import { randomUUID } from 'crypto'
import { getDb } from '../db'
import { getPowerSyncDb } from '../powersync'
import * as googleCalendar from '../../services/google-calendar.service'
import { getSession } from '../../services/auth.service'
import type {
  UnifiedCalendarEvent,
  CalendarEventCache,
  CalendarEventInput,
  CalendarEventLink,
  LinkEntityInput
} from '@shared/types'

const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'

// ── calendar_events_cache ─────────────────────────────────────────────────────

export function listCachedEvents(startAt: number, endAt: number): CalendarEventCache[] {
  return getDb()
    .prepare(`
      SELECT * FROM calendar_events_cache
      WHERE start_at <= ? AND (end_at IS NULL OR end_at >= ?)
      ORDER BY start_at ASC
    `)
    .all(endAt, startAt) as CalendarEventCache[]
}

// ── Finanzas Personal / Empresa ─────────────────────────────────────────────
// Mismo modelado en ambas (finance_movements / company_finance_movements):
// `due_date` (timestamp ms, opcional) es la fecha de vencimiento del
// movimiento. Solo se incluyen movimientos no pagados con due_date en rango.

interface DueMovementRow {
  id: string
  due_date: number
  concept_name: string
  status: string
}

async function getFinanceDueEvents(
  table: 'finance_movements' | 'company_finance_movements',
  conceptsTable: 'finance_concepts' | 'company_finance_concepts',
  startAt: number, endAt: number
): Promise<DueMovementRow[]> {
  const db = getPowerSyncDb()
  return db.getAll<DueMovementRow>(`
    SELECT m.id as id, m.due_date as due_date, c.name as concept_name, m.status as status
    FROM ${table} m
    JOIN ${conceptsTable} c ON c.id = m.concept_id
    WHERE m.due_date IS NOT NULL AND m.due_date >= ? AND m.due_date <= ? AND m.status != 'paid'
  `, [startAt, endAt])
}

// ── Comex - Programación de Pedidos (hitos) ─────────────────────────────────
// import_order_planning_milestones.calculated_date es la fecha estimada de
// cada hito (análisis interno, aprobación, embarque, etc.) — ver comex.ts.

interface PlanningMilestoneRow {
  id: string
  planning_id: string
  milestone_type: string
  calculated_date: number
  brand_name: string | null
}

async function getComexPlanningMilestoneEvents(startAt: number, endAt: number): Promise<PlanningMilestoneRow[]> {
  const db = getPowerSyncDb()
  return db.getAll<PlanningMilestoneRow>(`
    SELECT ms.id as id, ms.planning_id as planning_id, ms.milestone_type as milestone_type,
           ms.calculated_date as calculated_date, b.name as brand_name
    FROM import_order_planning_milestones ms
    JOIN import_order_plannings p ON p.id = ms.planning_id
    LEFT JOIN comex_brands b ON b.id = p.brand_id
    WHERE ms.calculated_date IS NOT NULL AND ms.calculated_date >= ? AND ms.calculated_date <= ?
  `, [startAt, endAt])
}

// ── Milestone labels (evita import circular pesado — duplicado mínimo) ─────

const MILESTONE_LABELS: Record<string, string> = {
  internal_analysis: 'Análisis interno',
  approval: 'Aprobación',
  supplier_order: 'Pedido al proveedor',
  preparation: 'Preparación',
  production: 'Producción',
  inspection: 'Inspección',
  shipping: 'Embarque',
  arrival: 'Arribo',
  customs: 'Nacionalización',
  reception: 'Recepción',
  commercial_availability: 'Disponibilidad comercial'
}

// ── Unified events ───────────────────────────────────────────────────────────

export async function getUnifiedEvents(startDate: number, endDate: number): Promise<UnifiedCalendarEvent[]> {
  const events: UnifiedCalendarEvent[] = []

  // Google Calendar (cache local)
  for (const ev of listCachedEvents(startDate, endDate)) {
    events.push({
      id: `google:${ev.google_event_id}`,
      source: 'google',
      title: ev.summary,
      start_at: ev.start_at,
      end_at: ev.end_at,
      all_day: !!ev.all_day,
      category: ev.google_calendar_id,
      link: null
    })
  }

  // Finanzas Personal
  const personalDue = await getFinanceDueEvents('finance_movements', 'finance_concepts', startDate, endDate)
  for (const m of personalDue) {
    events.push({
      id: `finance:${m.id}`,
      source: 'finance',
      title: `Vencimiento: ${m.concept_name}`,
      start_at: m.due_date,
      end_at: null,
      all_day: true,
      category: 'finance',
      link: `/finance?movement=${m.id}`
    })
  }

  // Finanzas Empresa
  const companyDue = await getFinanceDueEvents('company_finance_movements', 'company_finance_concepts', startDate, endDate)
  for (const m of companyDue) {
    events.push({
      id: `company_finance:${m.id}`,
      source: 'company_finance',
      title: `Vencimiento: ${m.concept_name}`,
      start_at: m.due_date,
      end_at: null,
      all_day: true,
      category: 'company_finance',
      link: `/company-finance?movement=${m.id}`
    })
  }

  // Comex - Programación de Pedidos (hitos)
  const milestones = await getComexPlanningMilestoneEvents(startDate, endDate)
  for (const ms of milestones) {
    const label = MILESTONE_LABELS[ms.milestone_type] ?? ms.milestone_type
    const brand = ms.brand_name ? ` — ${ms.brand_name}` : ''
    events.push({
      id: `comex_planning:${ms.id}`,
      source: 'comex_planning',
      title: `${label}${brand}`,
      start_at: ms.calculated_date,
      end_at: null,
      all_day: true,
      category: 'comex_planning',
      link: `/comex/plannings/${ms.planning_id}`
    })
  }

  events.sort((a, b) => a.start_at - b.start_at)
  return events
}

// ── Escritura manual de eventos de Google Calendar (Fase 2) ────────────────
// calendar_events_cache es local-only (no PowerSync): se actualiza de
// inmediato para que la UI refleje los cambios sin esperar el próximo
// syncNow().

function upsertEventCache(
  calendarId: string,
  googleEventId: string,
  input: CalendarEventInput
): void {
  const now = Date.now()
  getDb().prepare(`
    INSERT INTO calendar_events_cache
      (id, google_event_id, google_calendar_id, summary, description, location, start_at, end_at, all_day, status, color_id, updated_at, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', NULL, ?, ?)
    ON CONFLICT(google_calendar_id, google_event_id) DO UPDATE SET
      summary = excluded.summary,
      description = excluded.description,
      location = excluded.location,
      start_at = excluded.start_at,
      end_at = excluded.end_at,
      all_day = excluded.all_day,
      updated_at = excluded.updated_at,
      fetched_at = excluded.fetched_at
  `).run(
    randomUUID(), googleEventId, calendarId,
    input.summary, input.description ?? null, input.location ?? null,
    input.startAt, input.endAt, input.allDay ? 1 : 0, now, now
  )
}

/** Crea un evento manual en Google Calendar y lo refleja en la caché local. */
export async function createManualEvent(
  calendarId: string, input: CalendarEventInput
): Promise<UnifiedCalendarEvent> {
  const { googleEventId, googleCalendarId } = await googleCalendar.createEvent(calendarId, input)
  upsertEventCache(googleCalendarId, googleEventId, input)
  return {
    id: `google:${googleEventId}`,
    source: 'google',
    title: input.summary,
    start_at: input.startAt,
    end_at: input.endAt,
    all_day: input.allDay,
    category: googleCalendarId,
    link: null
  }
}

/** Actualiza un evento de Google Calendar y la caché local. */
export async function updateManualEvent(
  calendarId: string, googleEventId: string, input: CalendarEventInput
): Promise<void> {
  await googleCalendar.updateEvent(calendarId, googleEventId, input)
  upsertEventCache(calendarId, googleEventId, input)
}

/** Elimina un evento de Google Calendar y de la caché local. */
export async function deleteManualEvent(calendarId: string, googleEventId: string): Promise<void> {
  await googleCalendar.deleteEvent(calendarId, googleEventId)
  getDb().prepare(`
    DELETE FROM calendar_events_cache WHERE google_calendar_id = ? AND google_event_id = ?
  `).run(calendarId, googleEventId)
}

// ── Links de Finanzas/Comex con Google Calendar (opt-in, Fase 2) ────────────
// calendar_event_links SÍ viaja por PowerSync (tabla compartida entre
// dispositivos para saber qué ítems ya están agendados y por quién).

async function getActiveUserId(): Promise<string> {
  const session = await getSession()
  if (!session?.userId) throw new Error('No hay sesión activa.')
  return session.userId
}

/** Devuelve los links existentes para un conjunto de ítems de un módulo. */
export async function getEventLinks(
  sourceModule: CalendarEventLink['source_module'], sourceEventIds: string[]
): Promise<CalendarEventLink[]> {
  if (sourceEventIds.length === 0) return []
  const placeholders = sourceEventIds.map(() => '?').join(', ')
  return getPowerSyncDb().getAll<CalendarEventLink>(`
    SELECT * FROM calendar_event_links
    WHERE source_module = ? AND source_event_id IN (${placeholders})
  `, [sourceModule, ...sourceEventIds])
}

/** Crea un evento de día completo en Google Calendar y guarda el link (opt-in). */
export async function linkEntityToCalendar(input: LinkEntityInput): Promise<CalendarEventLink> {
  const userId = await getActiveUserId()
  const calendarId = await googleCalendar.getPrimaryCalendarId()

  const { googleEventId, googleCalendarId } = await googleCalendar.createEvent(calendarId, {
    summary: input.title,
    startAt: input.dueAtMs,
    endAt: null,
    allDay: true
  })

  const db = getPowerSyncDb()
  const id = randomUUID()
  const now = Date.now()
  await db.execute(`
    INSERT INTO calendar_event_links
      (id, owner_user_id, source_module, source_type, source_event_id, google_calendar_id, google_event_id, title, created_at, updated_at, workspace_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, userId, input.sourceModule, input.sourceType, input.sourceEventId, googleCalendarId, googleEventId, input.title, now, now, WORKSPACE_ID])

  return (await db.getOptional<CalendarEventLink>('SELECT * FROM calendar_event_links WHERE id = ?', [id]))!
}

/** Elimina el evento de Google Calendar y el link. Solo el dueño del link puede hacerlo. */
export async function unlinkEntity(linkId: string): Promise<void> {
  const userId = await getActiveUserId()
  const db = getPowerSyncDb()
  const link = await db.getOptional<CalendarEventLink>('SELECT * FROM calendar_event_links WHERE id = ?', [linkId])
  if (!link) return
  if (link.owner_user_id !== userId) {
    throw new Error('Este evento está agendado en otra cuenta de Google y solo se puede quitar desde ese dispositivo.')
  }

  await googleCalendar.deleteEvent(link.google_calendar_id, link.google_event_id)
  await db.execute('DELETE FROM calendar_event_links WHERE id = ?', [linkId])
}

/** Actualiza el evento de Google Calendar vinculado con el título/fecha actuales. */
export async function refreshLinkedEvent(
  linkId: string, input: { title: string; dueAtMs: number }
): Promise<CalendarEventLink> {
  const userId = await getActiveUserId()
  const db = getPowerSyncDb()
  const link = await db.getOptional<CalendarEventLink>('SELECT * FROM calendar_event_links WHERE id = ?', [linkId])
  if (!link) throw new Error('El link ya no existe.')
  if (link.owner_user_id !== userId) {
    throw new Error('Este evento está agendado en otra cuenta de Google y solo se puede actualizar desde ese dispositivo.')
  }

  await googleCalendar.updateEvent(link.google_calendar_id, link.google_event_id, {
    summary: input.title,
    startAt: input.dueAtMs,
    endAt: null,
    allDay: true
  })

  const now = Date.now()
  await db.execute('UPDATE calendar_event_links SET title = ?, updated_at = ? WHERE id = ?', [input.title, now, linkId])
  return (await db.getOptional<CalendarEventLink>('SELECT * FROM calendar_event_links WHERE id = ?', [linkId]))!
}
