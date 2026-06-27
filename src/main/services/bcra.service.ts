/**
 * Servicio de cotizaciones BCRA.
 * Almacena billete y divisa por separado en bcra_rates_cache (flowtask.db, local, sin sync).
 *
 * Endpoints:
 *   Histórico: /estadisticascambiarias/v1.0/Cotizaciones/{moneda}?fechadesde=...&fechahasta=...
 *   Hoy:       /estadisticascambiarias/v1.0/Cotizaciones  (sin moneda ni fechas)
 */

import { getDb } from '../database/db'
import type { BcraRateEntry, BcraCotizacionHoy, ComexMoneda } from '@shared/types'

const BCRA_BASE = 'https://api.bcra.gob.ar/estadisticascambiarias/v1.0'

// ── Tipos internos de respuesta BCRA ─────────────────────────────────────────

interface BcraDetalleItem {
  codigoMoneda: string
  descripcion:  string
  tipoPase:     number
  tipoCotizacion: number
}

interface BcraDetalleDia {
  fecha:   string
  detalle: BcraDetalleItem[]
}

interface BcraHistoricoResponse {
  status:   number
  results:  BcraDetalleDia[]
}

// El endpoint /Cotizaciones (sin moneda) puede devolver:
// { fecha, results: [...items] }  o  { fecha, detalle: [...items] }
interface BcraHoyResponse {
  status:    number
  results?:  BcraDetalleItem[] | { fecha: string; detalle: BcraDetalleItem[] }[]
  detalle?:  BcraDetalleItem[]
  fecha?:    string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  const y   = d.getFullYear()
  const m   = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function sixMonthsAgo(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 6)
  return toDateStr(d)
}

function today(): string {
  return toDateStr(new Date())
}

function tipoDesdDescripcion(desc: string): 'billete' | 'divisa' {
  return desc.toLowerCase().includes('billete') ? 'billete' : 'divisa'
}

// ── Cache local ───────────────────────────────────────────────────────────────

interface CacheRow { moneda: ComexMoneda; tipo: string; valor: number }

function upsertCacheEntries(entries: Array<{ moneda: ComexMoneda; fecha: string; tipo: string; valor: number }>): void {
  const db   = getDb()
  const stmt = db.prepare(`
    INSERT INTO bcra_rates_cache (moneda, fecha, tipo, valor, fetched_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (moneda, fecha, tipo) DO UPDATE SET valor = excluded.valor, fetched_at = excluded.fetched_at
  `)
  const now = Date.now()
  db.transaction(() => {
    for (const e of entries) stmt.run(e.moneda, e.fecha, e.tipo, e.valor, now)
  })()
}

function readCacheEntries(moneda: ComexMoneda, fechaDesde: string): BcraRateEntry[] {
  const db = getDb()
  return db.prepare(
    `SELECT moneda, fecha, tipo, valor FROM bcra_rates_cache
     WHERE moneda = ? AND fecha >= ? AND tipo = 'divisa'
     ORDER BY fecha ASC`
  ).all(moneda, fechaDesde) as BcraRateEntry[]
}

function latestCachedDate(moneda: ComexMoneda): string | null {
  const db  = getDb()
  const row = db.prepare(
    `SELECT MAX(fecha) AS last FROM bcra_rates_cache WHERE moneda = ?`
  ).get(moneda) as { last: string | null }
  return row?.last ?? null
}

// ── Fetch histórico desde la API del BCRA ─────────────────────────────────────

async function fetchFromBcra(
  moneda: ComexMoneda,
  fechaDesde: string,
  fechaHasta: string
): Promise<Array<{ moneda: ComexMoneda; fecha: string; tipo: string; valor: number }>> {
  const url = `${BCRA_BASE}/Cotizaciones/${moneda}?fechadesde=${fechaDesde}&fechahasta=${fechaHasta}`
  console.log(`[BCRA] fetch ${moneda}: ${url}`)
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`BCRA API error ${res.status} para ${moneda}: ${body}`)
  }

  const json: BcraHistoricoResponse = await res.json()
  const dias = json.results ?? []
  console.log(`[BCRA] ${moneda}: ${dias.length} días recibidos`)

  const entries: Array<{ moneda: ComexMoneda; fecha: string; tipo: string; valor: number }> = []
  for (const dia of dias) {
    const fecha = dia.fecha.slice(0, 10)
    const items = dia.detalle?.filter(d => d.codigoMoneda === moneda) ?? []
    if (!items.length && dia.detalle?.length) {
      // Fallback: usar primer item si no matchea por código
      const fb = dia.detalle[0]
      if (fb.tipoCotizacion > 0) {
        entries.push({ moneda, fecha, tipo: tipoDesdDescripcion(fb.descripcion ?? ''), valor: fb.tipoCotizacion })
      }
      continue
    }
    for (const item of items) {
      if (item.tipoCotizacion > 0) {
        entries.push({ moneda, fecha, tipo: tipoDesdDescripcion(item.descripcion ?? ''), valor: item.tipoCotizacion })
      }
    }
  }
  console.log(`[BCRA] ${moneda}: ${entries.length} entradas extraídas`)
  return entries
}

// ── Fetch de hoy (billete + divisa para todas las monedas) ───────────────────

async function fetchHoyFromBcra(): Promise<Array<{ moneda: ComexMoneda; fecha: string; tipo: string; valor: number }>> {
  const url = `${BCRA_BASE}/Cotizaciones`
  console.log(`[BCRA] fetch hoy: ${url}`)
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`BCRA API error ${res.status} (hoy): ${body}`)
  }

  const json: BcraHoyResponse = await res.json()
  const fecha = today()

  let items: BcraDetalleItem[] = []

  if (Array.isArray(json.results)) {
    // Puede ser BcraDetalleItem[] directo o BcraDetalleDia[]
    const first = json.results[0] as BcraDetalleItem | BcraDetalleDia
    if ('detalle' in first) {
      // Es array de días → tomamos el último
      const dia = (json.results as BcraDetalleDia[]).at(-1)
      items = dia?.detalle ?? []
    } else {
      items = json.results as BcraDetalleItem[]
    }
  } else if (json.detalle) {
    items = json.detalle
  }

  const entries: Array<{ moneda: ComexMoneda; fecha: string; tipo: string; valor: number }> = []
  for (const item of items) {
    const moneda = item.codigoMoneda as ComexMoneda
    if (moneda !== 'USD' && moneda !== 'EUR') continue
    if (!item.tipoCotizacion || item.tipoCotizacion <= 0) continue
    entries.push({ moneda, fecha, tipo: tipoDesdDescripcion(item.descripcion ?? ''), valor: item.tipoCotizacion })
  }

  console.log(`[BCRA] hoy: ${entries.length} entradas extraídas`)
  return entries
}

// ── Helpers de construcción de BcraCotizacionHoy ──────────────────────────────

function buildCotizacionHoy(rows: CacheRow[], fecha: string): BcraCotizacionHoy[] {
  return (['USD', 'EUR'] as ComexMoneda[]).map(moneda => ({
    moneda,
    fecha,
    billete_venta: rows.find(r => r.moneda === moneda && r.tipo === 'billete')?.valor ?? null,
    divisa_venta:  rows.find(r => r.moneda === moneda && r.tipo === 'divisa')?.valor  ?? null,
  }))
}

// ── API pública del servicio ──────────────────────────────────────────────────

/**
 * Devuelve cotizaciones BCRA Divisa Venta para los últimos 6 meses.
 * Usa la caché local y solo hace fetch de los días que faltan.
 */
export async function getBcraRates(moneda: ComexMoneda): Promise<BcraRateEntry[]> {
  const desde = sixMonthsAgo()
  const hasta = today()

  const ultimaCacheada = latestCachedDate(moneda)

  if (ultimaCacheada !== hasta) {
    const fetchDesde = ultimaCacheada
      ? (() => { const d = new Date(ultimaCacheada); d.setDate(d.getDate() + 1); return toDateStr(d) })()
      : desde
    try {
      const fresh = await fetchFromBcra(moneda, fetchDesde, hasta)
      if (fresh.length) upsertCacheEntries(fresh)
    } catch (e) {
      console.warn(`[BCRA] No se pudo actualizar ${moneda}:`, e)
    }
  }

  return readCacheEntries(moneda, desde)
}

/**
 * Fuerza un refetch completo de los últimos 6 meses (ignora caché).
 */
export async function refreshBcraRates(moneda: ComexMoneda): Promise<BcraRateEntry[]> {
  const desde = sixMonthsAgo()
  const hasta = today()
  const fresh = await fetchFromBcra(moneda, desde, hasta)
  if (fresh.length) upsertCacheEntries(fresh)
  return readCacheEntries(moneda, desde)
}

/**
 * Devuelve cotización billete y divisa para USD y EUR del día de hoy.
 * Primero intenta fetchear del endpoint /Cotizaciones; si falla, usa la caché existente.
 */
export async function getBcraCotizacionHoy(): Promise<BcraCotizacionHoy[]> {
  const db  = getDb()
  const hoy = today()

  // Si ya tenemos datos de hoy en cache, los usamos
  const cached = db.prepare(
    `SELECT moneda, tipo, valor FROM bcra_rates_cache WHERE fecha = ? AND moneda IN ('USD','EUR')`
  ).all(hoy) as CacheRow[]

  if (cached.length >= 2) {
    return buildCotizacionHoy(cached, hoy)
  }

  // Fetch del endpoint de hoy
  try {
    const fresh = await fetchHoyFromBcra()
    if (fresh.length) upsertCacheEntries(fresh)
    const updated = db.prepare(
      `SELECT moneda, tipo, valor FROM bcra_rates_cache WHERE fecha = ? AND moneda IN ('USD','EUR')`
    ).all(hoy) as CacheRow[]
    // Si hay datos para hoy, usarlos; si no (fin de semana / feriado), caer al fallback
    if (updated.length >= 2) {
      return buildCotizacionHoy(updated, hoy)
    }
  } catch (e) {
    console.warn('[BCRA] No se pudo obtener cotización hoy:', e)
  }

  // Fallback: última fecha disponible en cache
  const fallback = db.prepare(
    `SELECT moneda, tipo, valor FROM bcra_rates_cache
     WHERE moneda IN ('USD','EUR')
     GROUP BY moneda, tipo HAVING fecha = MAX(fecha)`
  ).all() as CacheRow[]
  const lastFecha = db.prepare(
    `SELECT MAX(fecha) AS f FROM bcra_rates_cache WHERE moneda IN ('USD','EUR')`
  ).get() as { f: string | null }
  return buildCotizacionHoy(fallback, lastFecha?.f ?? hoy)
}
