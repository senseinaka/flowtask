/**
 * Servicio de cotizaciones BCRA.
 * Obtiene la cotización "Divisa Venta" de USD y EUR desde la API pública del BCRA
 * y la cachea en bcra_rates_cache (flowtask.db, local, sin sync).
 *
 * API: https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/{moneda}
 *      ?fechadesde=YYYY-MM-DD&fechahasta=YYYY-MM-DD
 */

import { getDb } from '../database/db'
import type { BcraRateEntry, ComexMoneda } from '@shared/types'

const BCRA_BASE = 'https://api.bcra.gob.ar/estadisticascambiarias/v1.0'

// ── Tipos internos de respuesta BCRA ─────────────────────────────────────────

// Estructura real del endpoint /Cotizaciones/{moneda}?fechadesde=&fechahasta=
// results es un ARRAY de días; cada día trae un detalle por moneda con el valor
// en `tipoCotizacion` (NÚMERO, cotización en ARS). No existe compra/venta acá.
interface BcraDetalleDia {
  fecha: string
  detalle: Array<{
    codigoMoneda: string
    descripcion: string
    tipoPase: number
    tipoCotizacion: number
  }>
}

interface BcraResponse {
  status: number
  metadata?: { resultset?: { count: number; offset: number; limit: number } }
  results: BcraDetalleDia[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  // Fecha en hora LOCAL, no UTC. toISOString() devuelve UTC y en Argentina (UTC-3)
  // de noche salta al día siguiente → el BCRA rechaza fechas "mayores al día actual".
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
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

// ── Fetch desde la API del BCRA ───────────────────────────────────────────────

async function fetchFromBcra(
  moneda: ComexMoneda,
  fechaDesde: string,
  fechaHasta: string
): Promise<BcraRateEntry[]> {
  // El rango histórico va por el endpoint CON la moneda en el path. El endpoint
  // sin moneda (/Cotizaciones) NO acepta fechadesde/fechahasta → 400. El valor de
  // la cotización (ARS) está en `tipoCotizacion` (número), no en venta/compra.
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

  const json: BcraResponse = await res.json()
  const dias = json.results ?? []
  console.log(`[BCRA] ${moneda}: ${dias.length} días recibidos`)

  const entries: BcraRateEntry[] = []
  for (const dia of dias) {
    const fecha = dia.fecha.slice(0, 10)
    const item = dia.detalle?.find(d => d.codigoMoneda === moneda) ?? dia.detalle?.[0]
    if (item && item.tipoCotizacion != null && item.tipoCotizacion > 0) {
      entries.push({ moneda, fecha, valor: item.tipoCotizacion })
    }
  }
  console.log(`[BCRA] ${moneda}: ${entries.length} entradas extraídas`)
  return entries
}

// ── Cache local (bcra_rates_cache en flowtask.db) ────────────────────────────

function upsertCacheEntries(entries: BcraRateEntry[]): void {
  const db   = getDb()
  const stmt = db.prepare(`
    INSERT INTO bcra_rates_cache (moneda, fecha, valor, fetched_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (moneda, fecha) DO UPDATE SET valor = excluded.valor, fetched_at = excluded.fetched_at
  `)
  const now = Date.now()
  const tx = db.transaction(() => {
    for (const e of entries) stmt.run(e.moneda, e.fecha, e.valor, now)
  })
  tx()
}

function readCacheEntries(moneda: ComexMoneda, fechaDesde: string): BcraRateEntry[] {
  const db = getDb()
  return db.prepare(
    `SELECT moneda, fecha, valor FROM bcra_rates_cache
     WHERE moneda = ? AND fecha >= ?
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

// ── API pública del servicio ──────────────────────────────────────────────────

/**
 * Devuelve cotizaciones BCRA (Divisa Venta) para los últimos 6 meses.
 * Usa la caché local y solo hace fetch de los días que faltan.
 */
export async function getBcraRates(moneda: ComexMoneda): Promise<BcraRateEntry[]> {
  const desde = sixMonthsAgo()
  const hasta = today()

  const ultimaCacheada = latestCachedDate(moneda)

  // Si la caché no tiene datos de hoy, fetcheamos los días que faltan
  if (ultimaCacheada !== hasta) {
    const fetchDesde = ultimaCacheada
      ? (() => { const d = new Date(ultimaCacheada); d.setDate(d.getDate() + 1); return toDateStr(d) })()
      : desde
    try {
      const fresh = await fetchFromBcra(moneda, fetchDesde, hasta)
      if (fresh.length) upsertCacheEntries(fresh)
    } catch (e) {
      console.warn(`[BCRA] No se pudo actualizar ${moneda}:`, e)
      // Si hay error, devolvemos lo que tenemos en caché
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
