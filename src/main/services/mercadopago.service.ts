import { createHash, randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import http from 'http'
import { app, shell } from 'electron'
import {
  getAccessToken,
  getConnection,
  createOAuthConnection,
  saveOAuthTokens,
  getRefreshToken,
  updateConnectionStatus,
  createJob,
  getJob,
  updateJobStatus,
  upsertReportFile,
  getReportFileByHash,
  insertTransactionsBatch,
} from '../database/queries/mercadopago'
import { readEnvLocal } from '../database/powersync'
import type { MpReportConfig, MpSyncResult, MpTransaction, MpConnection, MpEnvironment } from '@shared/types'

// ─── Constantes ───────────────────────────────────────────────────────────────

const MP_API_BASE = 'https://api.mercadopago.com'
const ARGENTINA_TZ = 'America/Argentina/Buenos_Aires'

// ─── OAuth (Etapa 2) ────────────────────────────────────────────────────────
// Mismo patrón que drive.service.ts: servidor loopback local + navegador externo.
// Puerto distinto al de Drive (42813) para poder tener ambos flujos disponibles
// sin conflicto de puertos.
const MP_OAUTH_AUTHORIZE_URL = 'https://auth.mercadopago.com.ar/authorization'
const MP_OAUTH_TOKEN_URL     = `${MP_API_BASE}/oauth/token`
const OAUTH_REDIRECT_PORT    = 42814
const OAUTH_REDIRECT_URI     = `http://localhost:${OAUTH_REDIRECT_PORT}/mp/oauth/callback`

const DEFAULT_COLUMNS = [
  'TRANSACTION_DATE', 'SOURCE_ID', 'EXTERNAL_REFERENCE', 'TRANSACTION_TYPE',
  'TRANSACTION_AMOUNT', 'TRANSACTION_CURRENCY', 'SETTLEMENT_NET_AMOUNT',
  'SETTLEMENT_DATE', 'FEE_AMOUNT', 'TAXES_AMOUNT', 'PAYMENT_METHOD',
  'PAYMENT_METHOD_TYPE', 'INSTALLMENTS', 'DESCRIPTION', 'MONEY_RELEASE_DATE',
  'PAYER_NAME', 'PAYER_ID_TYPE', 'PAYER_ID_NUMBER', 'ORDER_ID',
  'STORE_ID', 'STORE_NAME', 'POS_ID', 'POS_NAME', 'SHIPPING_ID',
  'LAST_FOUR_DIGITS', 'AUTHORIZATION_CODE', 'APPLICATION_ID',
]

export const DEFAULT_REPORT_CONFIG: MpReportConfig = {
  file_name_prefix: 'summit_settlement',
  columns: DEFAULT_COLUMNS,
  display_timezone: ARGENTINA_TZ,
  header_language: 'es',
  separator: ';',
  include_withdraw: true,
  show_fee_prevision: true,
  show_chargeback_cancel: true,
  refund_detailed: true,
  coupon_detailed: true,
  shipping_detail: true,
  frequency: { hour: 3, type: 'daily' },
}

// ─── API client ───────────────────────────────────────────────────────────────

interface MpFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  maxRetries?: number
}

async function mpFetchInner<T>(
  token: string,
  endpoint: string,
  opts: MpFetchOptions = {}
): Promise<T> {
  const { method = 'GET', body, maxRetries = 3 } = opts
  const url = endpoint.startsWith('http') ? endpoint : `${MP_API_BASE}${endpoint}`

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body != null ? JSON.stringify(body) : undefined,
    })

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '10', 10)
      console.warn(`[MP] Rate limit — esperando ${retryAfter}s (intento ${attempt}/${maxRetries})`)
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, retryAfter * 1000))
        continue
      }
      throw new Error('Mercado Pago: rate limit alcanzado')
    }

    if (res.status === 401) throw new Error('Mercado Pago: token inválido o expirado (401)')
    if (res.status === 404) throw new Error(`Mercado Pago: recurso no encontrado (404) — ${url}`)

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`
      try { const e = await res.json(); errMsg = e.message ?? e.error ?? errMsg } catch {}
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, attempt * 2000))
        continue
      }
      throw new Error(`Mercado Pago: ${errMsg}`)
    }

    return res.json() as Promise<T>
  }

  throw new Error('Mercado Pago: máximo de reintentos alcanzado')
}

async function mpFetchRawInner(token: string, endpoint: string): Promise<string> {
  const url = endpoint.startsWith('http') ? endpoint : `${MP_API_BASE}${endpoint}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'text/csv, application/json' },
  })
  if (res.status === 401) throw new Error('Mercado Pago: token inválido o expirado (401)')
  if (res.status === 404) throw new Error(`Mercado Pago: archivo no encontrado (404)`)
  if (!res.ok) throw new Error(`Mercado Pago: HTTP ${res.status} al descargar archivo`)
  return res.text()
}

// Envoltorio de mpFetchInner/mpFetchRawInner: resuelve el token de la conexión
// y, si la llamada devuelve 401 y la conexión es OAuth, refresca el token una
// única vez y reintenta — sin esto, una conexión OAuth se rompe sola cada vez
// que el access_token vence (las conexiones con access_token manual no tienen
// refresh_token, así que un 401 ahí sigue siendo un error real).
async function withTokenRefresh<T>(
  connectionId: string,
  run: (token: string) => Promise<T>
): Promise<T> {
  const token = getAccessToken(connectionId)
  if (!token) throw new Error('No hay access token para esta conexión')

  try {
    return await run(token)
  } catch (err) {
    const isAuthError = (err as Error).message.includes('(401)')
    const conn = isAuthError ? await getConnection(connectionId) : null
    if (!isAuthError || conn?.auth_type !== 'oauth') throw err

    const freshToken = await refreshAccessToken(connectionId)
    return run(freshToken)
  }
}

async function mpFetch<T>(connectionId: string, endpoint: string, opts: MpFetchOptions = {}): Promise<T> {
  return withTokenRefresh(connectionId, (token) => mpFetchInner<T>(token, endpoint, opts))
}

async function mpFetchRaw(connectionId: string, endpoint: string): Promise<string> {
  return withTokenRefresh(connectionId, (token) => mpFetchRawInner(token, endpoint))
}

// ─── OAuth (Etapa 2) ────────────────────────────────────────────────────────

function getOAuthAppCredentials(): { clientId: string; clientSecret: string } {
  const env = readEnvLocal()
  return {
    clientId: env.MERCADOPAGO_CLIENT_ID ?? '',
    clientSecret: env.MERCADOPAGO_CLIENT_SECRET ?? '',
  }
}

/** Intercambia un refresh_token vigente por un access_token nuevo. Mercado
 *  Pago rota el refresh_token en cada uso — hay que guardar el que devuelve
 *  la respuesta, no reutilizar el viejo. */
export async function refreshAccessToken(connectionId: string): Promise<string> {
  const { clientId, clientSecret } = getOAuthAppCredentials()
  if (!clientId || !clientSecret) {
    throw new Error('Faltan MERCADOPAGO_CLIENT_ID/MERCADOPAGO_CLIENT_SECRET en .env.local')
  }
  const refreshToken = getRefreshToken(connectionId)
  if (!refreshToken) throw new Error('Esta conexión no tiene refresh_token — hay que reconectarla por OAuth')

  const res = await fetch(MP_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) {
    await updateConnectionStatus(connectionId, 'error')
    throw new Error(`Mercado Pago: no se pudo refrescar el token (HTTP ${res.status})`)
  }
  const data = await res.json() as { access_token: string; refresh_token: string }
  saveOAuthTokens(connectionId, data.access_token, data.refresh_token)
  return data.access_token
}

/** Flujo OAuth completo para conectar una cuenta nueva: abre el navegador,
 *  levanta un servidor local temporal para recibir el redirect (mismo patrón
 *  que drive.service.ts), canjea el code por tokens, y recién ahí crea la fila
 *  de conexión — así una cancelación a mitad de camino no deja una conexión
 *  a medio configurar. */
export async function startOAuthConnect(
  name: string,
  accountLabel: string,
  environment: MpEnvironment,
  createdBy: string
): Promise<{ connection: MpConnection; test: { ok: boolean; user_id?: string; error?: string } }> {
  const { clientId, clientSecret } = getOAuthAppCredentials()
  if (!clientId || !clientSecret) {
    throw new Error('Configurá MERCADOPAGO_CLIENT_ID y MERCADOPAGO_CLIENT_SECRET en .env.local antes de conectar con OAuth.')
  }

  const state = randomUUID()
  const authUrl = new URL(MP_OAUTH_AUTHORIZE_URL)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('platform_id', 'mp')
  authUrl.searchParams.set('redirect_uri', OAUTH_REDIRECT_URI)
  authUrl.searchParams.set('state', state)
  shell.openExternal(authUrl.toString())

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url?.startsWith('/mp/oauth/callback')) return
      const url = new URL(req.url, `http://localhost:${OAUTH_REDIRECT_PORT}`)
      const returnedState = url.searchParams.get('state')
      const authCode = url.searchParams.get('code')
      const err = url.searchParams.get('error')

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(err || !authCode
        ? '<h1>No se pudo conectar con Mercado Pago. Podés cerrar esta pestaña.</h1>'
        : '<h1>Summit conectado a Mercado Pago. Podés cerrar esta pestaña.</h1>')
      server.close()

      if (err) { reject(new Error(`Mercado Pago rechazó la autorización: ${err}`)); return }
      if (returnedState !== state) { reject(new Error('OAuth: state inválido (posible ataque CSRF)')); return }
      if (!authCode) { reject(new Error('OAuth: Mercado Pago no devolvió un código')); return }
      resolve(authCode)
    })
    server.listen(OAUTH_REDIRECT_PORT)
    setTimeout(() => { server.close(); reject(new Error('OAuth: tiempo de espera agotado')) }, 120_000)
  })

  const tokenRes = await fetch(MP_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: OAUTH_REDIRECT_URI,
    }),
  })
  if (!tokenRes.ok) {
    let msg = `HTTP ${tokenRes.status}`
    try { const e = await tokenRes.json(); msg = e.message ?? e.error_description ?? e.error ?? msg } catch { /* */ }
    throw new Error(`Mercado Pago: no se pudo canjear el código de autorización (${msg})`)
  }
  const tokenData = await tokenRes.json() as { access_token: string; refresh_token: string; user_id: number }

  const connection = await createOAuthConnection(name, accountLabel, environment, String(tokenData.user_id), createdBy)
  saveOAuthTokens(connection.id, tokenData.access_token, tokenData.refresh_token)

  const test = await testConnection(connection.id)
  return { connection, test }
}

// ─── Test de conexión ─────────────────────────────────────────────────────────

export async function testConnection(connectionId: string): Promise<{ ok: boolean; user_id?: string; email?: string; error?: string }> {
  if (!getAccessToken(connectionId)) return { ok: false, error: 'No hay access token guardado para esta conexión' }

  try {
    const data = await mpFetch<{ id: number; email: string }>(connectionId, '/v1/account/settlement_report/config', { maxRetries: 1 })
    const userId = String((data as { user_id?: number }).user_id ?? (data as { id?: number }).id ?? '')
    if (userId) await updateConnectionStatus(connectionId, 'active', userId)
    else await updateConnectionStatus(connectionId, 'active')
    return { ok: true, user_id: userId }
  } catch (err) {
    await updateConnectionStatus(connectionId, 'error')
    return { ok: false, error: (err as Error).message }
  }
}

// ─── Configuración de reportes ────────────────────────────────────────────────

export async function getSettlementReportConfig(connectionId: string): Promise<MpReportConfig | null> {
  if (!getAccessToken(connectionId)) throw new Error('No hay access token')

  try {
    const raw = await mpFetch<Record<string, unknown>>(connectionId, '/v1/account/settlement_report/config')
    return normalizeRemoteConfig(raw)
  } catch (err) {
    if ((err as Error).message.includes('404')) return null
    throw err
  }
}

export async function setSettlementReportConfig(
  connectionId: string,
  config: Partial<MpReportConfig>
): Promise<void> {
  if (!getAccessToken(connectionId)) throw new Error('No hay access token')

  const merged = { ...DEFAULT_REPORT_CONFIG, ...config }
  const body = {
    file_name_prefix: merged.file_name_prefix,
    columns: merged.columns,
    display_timezone: merged.display_timezone,
    header_language: merged.header_language,
    separator: merged.separator,
    include_withdraw: merged.include_withdraw,
    show_fee_prevision: merged.show_fee_prevision,
    show_chargeback_cancel: merged.show_chargeback_cancel,
    refund_detailed: merged.refund_detailed,
    coupon_detailed: merged.coupon_detailed,
    shipping_detail: merged.shipping_detail,
    frequency: merged.frequency,
  }

  try {
    await mpFetch(connectionId, '/v1/account/settlement_report/config', { method: 'PUT', body })
  } catch {
    await mpFetch(connectionId, '/v1/account/settlement_report/config', { method: 'POST', body })
  }
}

// ─── Solicitar reporte ────────────────────────────────────────────────────────

function toArgDatetime(dateStr: string, endOfDay = false): string {
  const time = endOfDay ? 'T23:59:59' : 'T00:00:00'
  return `${dateStr}${time}-03:00`
}

export async function requestSettlementReport(
  connectionId: string,
  dateFrom: string,
  dateTo: string,
  requestedBy: string
): Promise<string> {
  if (!getAccessToken(connectionId)) throw new Error('No hay access token')

  const job = await createJob(connectionId, dateFrom, dateTo, requestedBy)

  try {
    await mpFetch(connectionId, '/v1/account/settlement_report', {
      method: 'POST',
      body: {
        begin_date: toArgDatetime(dateFrom),
        end_date: toArgDatetime(dateTo, true),
      },
    })
    await updateJobStatus(job.id, 'requested')
  } catch (err) {
    await updateJobStatus(job.id, 'failed', { error_message: (err as Error).message })
    throw err
  }

  return job.id
}

// ─── Polling de reportes ──────────────────────────────────────────────────────

interface MpReportListItem {
  file_name: string
  begin_date: string
  end_date: string
  status: string
  date_created: string
}

export async function pollSettlementReports(connectionId: string): Promise<MpReportListItem[]> {
  if (!getAccessToken(connectionId)) throw new Error('No hay access token')
  return mpFetch<MpReportListItem[]>(connectionId, '/v1/account/settlement_report/list')
}

export async function checkJobReady(jobId: string): Promise<{ ready: boolean; file_name?: string }> {
  const job = await getJob(jobId)
  if (!job) return { ready: false }
  if (job.status === 'ready_to_download' && job.file_name) return { ready: true, file_name: job.file_name }
  if (job.status === 'completed') return { ready: false }
  if (job.status === 'failed') return { ready: false }

  try {
    const reports = await pollSettlementReports(job.connection_id)
    console.log(`[MP] checkJobReady: buscando date_from=${job.date_from} date_to=${job.date_to} — ${reports.length} reporte(s) en lista`)
    console.log('[MP] Lista:', JSON.stringify(reports.map(r => ({ file: r.file_name, begin: r.begin_date, end: r.end_date, status: r.status }))))
    const match = findMatchingReport(reports, job.date_from, job.date_to)
    if (match) {
      console.log(`[MP] Match encontrado: ${match.file_name}`)
      await updateJobStatus(jobId, 'ready_to_download', { file_name: match.file_name })
      return { ready: true, file_name: match.file_name }
    }
    console.log('[MP] Sin match todavía')
    return { ready: false }
  } catch (err) {
    console.error('[MP] Error chequeando estado de job:', (err as Error).message)
    return { ready: false }
  }
}

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

function findMatchingReport(
  reports: MpReportListItem[],
  dateFrom: string,
  dateTo: string
): MpReportListItem | undefined {
  const tFrom     = dateFrom.replace(/-/g, '')
  const tFromPrev = shiftDate(dateFrom, -1).replace(/-/g, '') // GMT-04: begin midnight -03:00 → día anterior en GMT-04
  const tTo       = dateTo.replace(/-/g, '')
  const tToNext   = shiftDate(dateTo, +1).replace(/-/g, '')   // UTC: end 23:59 -03:00 → 02:59Z día siguiente

  return reports.find(r => {
    const from = r.begin_date.slice(0, 10).replace(/-/g, '')
    const to   = r.end_date.slice(0, 10).replace(/-/g, '')
    return (from === tFrom || from === tFromPrev) &&
           (to === tTo || to === tToNext) &&
           r.status !== 'error' &&
           !!r.file_name   // tiene file_name = está listo para descargar
  })
}

// ─── Descarga y procesamiento ─────────────────────────────────────────────────

export async function downloadAndProcessJob(jobId: string): Promise<MpSyncResult> {
  const job = await getJob(jobId)
  if (!job) throw new Error(`Job ${jobId} no encontrado`)

  const fileName = job.file_name
  if (!fileName) {
    await updateJobStatus(jobId, 'failed', { error_message: 'Sin nombre de archivo: el reporte puede no estar en estado "generated" en MP' })
    throw new Error('El job no tiene file_name')
  }
  console.log(`[MP] Descargando: /v1/account/settlement_report/${fileName}`)

  await updateJobStatus(jobId, 'downloading')

  if (!getAccessToken(job.connection_id)) throw new Error('No hay access token')

  let csvContent: string
  try {
    csvContent = await mpFetchRaw(job.connection_id, `/v1/account/settlement_report/${fileName}`)
  } catch (err) {
    await updateJobStatus(jobId, 'failed', { error_message: (err as Error).message })
    throw err
  }

  await updateJobStatus(jobId, 'processing')

  const fileHash = createHash('sha256').update(csvContent).digest('hex')

  const existingFile = await getReportFileByHash(fileHash)
  if (existingFile) {
    await updateJobStatus(jobId, 'completed')
    return {
      job_id: jobId,
      status: 'completed',
      file_name: fileName,
      imported: 0,
      duplicated: existingFile.total_rows,
      errors: 0,
      error_message: null,
    }
  }

  const rawDir = path.join(app.getPath('userData'), 'mp-reports')
  if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir, { recursive: true })
  const rawFilePath = path.join(rawDir, fileName)
  fs.writeFileSync(rawFilePath, csvContent, 'utf-8')

  const { rows, errors } = parseSettlementCSV(csvContent)
  const fileId = `file-${fileHash}`

  const txRows: Omit<MpTransaction, 'id' | 'created_at' | 'updated_at'>[] = rows.map(row => ({
    workspace_id: 'd61a4071-1557-4f32-be5e-6443fb336bf5',
    connection_id: job.connection_id,
    report_file_id: fileId,
    raw_hash: createHash('sha256').update(JSON.stringify(row)).digest('hex'),
    raw_row_json: JSON.stringify(row),
    ...normalizeRow(row),
  }))

  const { imported, duplicated } = await insertTransactionsBatch(txRows)

  await upsertReportFile({
    id: fileId,
    connection_id: job.connection_id,
    job_id: jobId,
    file_name: fileName,
    file_hash: fileHash,
    raw_file_path: rawFilePath,
    total_rows: rows.length,
    imported_rows: imported,
    duplicated_rows: duplicated,
    error_rows: errors,
  })

  await updateJobStatus(jobId, 'completed')
  await updateConnectionStatus(job.connection_id, 'active', undefined, Date.now())

  return {
    job_id: jobId,
    status: 'completed',
    file_name: fileName,
    imported,
    duplicated,
    errors,
    error_message: null,
  }
}

// ─── Abrir archivo CSV descargado ────────────────────────────────────────────

export async function openJobFile(jobId: string): Promise<{ ok: boolean; error?: string }> {
  const job = await getJob(jobId)
  if (!job?.file_name) return { ok: false, error: 'El job no tiene archivo descargado' }
  const filePath = path.join(app.getPath('userData'), 'mp-reports', job.file_name)
  if (!fs.existsSync(filePath)) return { ok: false, error: `Archivo no encontrado: ${filePath}` }
  const err = await shell.openPath(filePath)
  return err ? { ok: false, error: err } : { ok: true }
}

export async function showJobFileInFolder(jobId: string): Promise<void> {
  const job = await getJob(jobId)
  if (!job?.file_name) return
  const filePath = path.join(app.getPath('userData'), 'mp-reports', job.file_name)
  shell.showItemInFolder(filePath)
}

// ─── Flujo completo de sincronización ────────────────────────────────────────

export async function runFullSync(
  connectionId: string,
  dateFrom: string,
  dateTo: string,
  requestedBy: string
): Promise<MpSyncResult> {
  const jobId = await requestSettlementReport(connectionId, dateFrom, dateTo, requestedBy)

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const { ready, file_name } = await checkJobReady(jobId)
    if (ready && file_name) {
      return downloadAndProcessJob(jobId)
    }
  }

  // No es un error real: Mercado Pago puede tardar bastante más de 100s en
  // generar el reporte (se vieron casos de hasta ~13 minutos). El job queda
  // en 'requested' — NO 'failed' — para que el auto-poll del cliente
  // (SincronizacionTab, cada 15s sin límite de tiempo) lo siga chequeando
  // solo hasta que esté listo. Marcarlo 'failed' acá lo dejaba huérfano: el
  // botón "Verificar" corta en seco ante un job 'failed' (ver checkJobReady)
  // y nunca vuelve a consultar a MP, aunque el reporte ya esté generado.
  return {
    job_id: jobId,
    status: 'requested',
    file_name: null,
    imported: 0,
    duplicated: 0,
    errors: 0,
    error_message: null,
  }
}

// ─── Parser CSV ───────────────────────────────────────────────────────────────

type CsvRow = Record<string, string>

export function parseSettlementCSV(content: string): { rows: CsvRow[]; errors: number } {
  const clean = content.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = clean.split('\n')

  let headerIdx = -1
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const upper = lines[i].toUpperCase()
    if (
      upper.includes('TRANSACTION_DATE') ||
      upper.includes('FECHA_TRANSACCION') ||
      upper.includes('FECHA DE TRANSACCION') ||
      upper.includes('SOURCE_ID')
    ) {
      headerIdx = i
      break
    }
  }

  if (headerIdx === -1) return { rows: [], errors: 0 }

  const sep = lines[headerIdx].includes(';') ? ';' : ','
  const headers = parseCsvLine(lines[headerIdx], sep).map(h => h.trim().toUpperCase().replace(/ /g, '_'))

  const rows: CsvRow[] = []
  let errors = 0

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    try {
      const values = parseCsvLine(line, sep)
      const row: CsvRow = {}
      headers.forEach((h, idx) => { row[h] = (values[idx] ?? '').trim() })
      rows.push(row)
    } catch {
      errors++
    }
  }

  return { rows, errors }
}

function parseCsvLine(line: string, sep: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === sep && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

// ─── Normalización de filas ───────────────────────────────────────────────────

// Mapas de columnas: clave interna → posibles nombres en el CSV (inglés y español)
const COL_MAP: Record<keyof Omit<MpTransaction, 'id' | 'workspace_id' | 'connection_id' | 'report_file_id' | 'raw_row_json' | 'raw_hash' | 'reconciliation_status' | 'created_at' | 'updated_at'>, string[]> = {
  source_id:             ['SOURCE_ID', 'ID_FUENTE'],
  external_reference:    ['EXTERNAL_REFERENCE', 'REFERENCIA_EXTERNA'],
  transaction_date:      ['TRANSACTION_DATE', 'FECHA_TRANSACCION', 'FECHA_DE_TRANSACCION'],
  transaction_type:      ['TRANSACTION_TYPE', 'TIPO_DE_TRANSACCION'],
  transaction_amount:    ['TRANSACTION_AMOUNT', 'MONTO_DE_TRANSACCION'],
  transaction_currency:  ['TRANSACTION_CURRENCY', 'MONEDA'],
  settlement_net_amount: ['SETTLEMENT_NET_AMOUNT', 'MONTO_NETO_DE_LIQUIDACION'],
  settlement_date:       ['SETTLEMENT_DATE', 'FECHA_LIQUIDACION', 'FECHA_DE_LIQUIDACION'],
  fee_amount:            ['FEE_AMOUNT', 'MONTO_DE_COMISION'],
  taxes_amount:          ['TAXES_AMOUNT', 'MONTO_DE_IMPUESTOS'],
  payment_method:        ['PAYMENT_METHOD', 'METODO_DE_PAGO'],
  payment_method_type:   ['PAYMENT_METHOD_TYPE', 'TIPO_DE_METODO_DE_PAGO'],
  installments:          ['INSTALLMENTS', 'CUOTAS'],
  description:           ['DESCRIPTION', 'DESCRIPCION'],
  money_release_date:    ['MONEY_RELEASE_DATE', 'FECHA_DE_LIBERACION_DEL_DINERO'],
  payer_name:            ['PAYER_NAME', 'NOMBRE_DEL_COMPRADOR'],
  payer_id_type:         ['PAYER_ID_TYPE', 'TIPO_DE_IDENTIFICACION_DEL_COMPRADOR'],
  payer_id_number:       ['PAYER_ID_NUMBER', 'NUMERO_DE_IDENTIFICACION_DEL_COMPRADOR'],
  order_id:              ['ORDER_ID', 'ID_DE_ORDEN'],
  store_id:              ['STORE_ID', 'ID_TIENDA'],
  store_name:            ['STORE_NAME', 'NOMBRE_DE_TIENDA'],
  pos_id:                ['POS_ID', 'ID_DE_CAJA'],
  pos_name:              ['POS_NAME', 'NOMBRE_DE_CAJA'],
  shipping_id:           ['SHIPPING_ID', 'ID_ENVIO'],
  last_four_digits:      ['LAST_FOUR_DIGITS', 'ULTIMOS_CUATRO_DIGITOS'],
  authorization_code:    ['AUTHORIZATION_CODE', 'CODIGO_DE_AUTORIZACION'],
  application_id:        ['APPLICATION_ID', 'ID_DE_APLICACION'],
}

function col(row: CsvRow, field: keyof typeof COL_MAP): string {
  for (const name of COL_MAP[field]) {
    if (name in row) return row[name] ?? ''
  }
  return ''
}

function toNum(v: string): number {
  if (!v) return 0
  const cleaned = v.replace(',', '.').replace(/[^0-9.\-]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

function toInt(v: string): number {
  const n = parseInt(v, 10)
  return isNaN(n) ? 1 : n
}

type NormalizedRow = Omit<MpTransaction, 'id' | 'workspace_id' | 'connection_id' | 'report_file_id' | 'raw_row_json' | 'raw_hash' | 'reconciliation_status' | 'created_at' | 'updated_at'>

function normalizeRow(row: CsvRow): NormalizedRow {
  return {
    source_id:             col(row, 'source_id'),
    external_reference:    col(row, 'external_reference'),
    transaction_date:      col(row, 'transaction_date'),
    transaction_type:      col(row, 'transaction_type'),
    transaction_amount:    toNum(col(row, 'transaction_amount')),
    transaction_currency:  col(row, 'transaction_currency') || 'ARS',
    settlement_net_amount: toNum(col(row, 'settlement_net_amount')),
    settlement_date:       col(row, 'settlement_date'),
    fee_amount:            toNum(col(row, 'fee_amount')),
    taxes_amount:          toNum(col(row, 'taxes_amount')),
    payment_method:        col(row, 'payment_method'),
    payment_method_type:   col(row, 'payment_method_type'),
    installments:          toInt(col(row, 'installments')),
    description:           col(row, 'description'),
    money_release_date:    col(row, 'money_release_date'),
    payer_name:            col(row, 'payer_name'),
    payer_id_type:         col(row, 'payer_id_type'),
    payer_id_number:       col(row, 'payer_id_number'),
    order_id:              col(row, 'order_id'),
    store_id:              col(row, 'store_id'),
    store_name:            col(row, 'store_name'),
    pos_id:                col(row, 'pos_id'),
    pos_name:              col(row, 'pos_name'),
    shipping_id:           col(row, 'shipping_id'),
    last_four_digits:      col(row, 'last_four_digits'),
    authorization_code:    col(row, 'authorization_code'),
    application_id:        col(row, 'application_id'),
  }
}

function normalizeRemoteConfig(raw: Record<string, unknown>): MpReportConfig {
  return {
    file_name_prefix:     String(raw.file_name_prefix ?? DEFAULT_REPORT_CONFIG.file_name_prefix),
    columns:              Array.isArray(raw.columns) ? raw.columns as string[] : DEFAULT_REPORT_CONFIG.columns,
    display_timezone:     String(raw.display_timezone ?? ARGENTINA_TZ),
    header_language:      String(raw.header_language ?? 'es'),
    separator:            String(raw.separator ?? ';'),
    include_withdraw:     Boolean(raw.include_withdraw ?? true),
    show_fee_prevision:   Boolean(raw.show_fee_prevision ?? true),
    show_chargeback_cancel: Boolean(raw.show_chargeback_cancel ?? true),
    refund_detailed:      Boolean(raw.refund_detailed ?? true),
    coupon_detailed:      Boolean(raw.coupon_detailed ?? true),
    shipping_detail:      Boolean(raw.shipping_detail ?? true),
    frequency:            (raw.frequency as { hour: number; type: string }) ?? DEFAULT_REPORT_CONFIG.frequency,
  }
}
