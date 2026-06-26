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

interface BcraDetalleDia {
  fecha: string
  detalle: Array<{
    codigoMoneda: string
    descripcion: string
    tipoCotizacion: string
    compra: number | null
    venta: number | null
  }>
}

interface BcraResponse {
  status: number
  results: {
    detalle?: BcraDetalleDia[]
    cantidadResultados?: number
    totalPaginas?: number
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
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
  // La API de BCRA devuelve TODAS las monedas; filtramos por codigoMoneda localmente.
  // No hay sub-path /{moneda} — el endpoint es siempre /Cotizaciones con params de fecha.
  const url = `${BCRA_BASE}/Cotizaciones?fechadesde=${fechaDesde}&fechahasta=${fechaHasta}`
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
  const detalle = json.results?.detalle ?? []
  console.log(`[BCRA] ${moneda}: ${detalle.length} días recibidos`)

  const entries: BcraRateEntry[] = []
  for (const dia of detalle) {
    const fecha = dia.fecha.slice(0, 10)
    for (const item of dia.detalle) {
      if (item.codigoMoneda === moneda && item.tipoCotizacion === 'Divisa' && item.venta != null) {
        entries.push({ moneda, fecha, valor: item.venta })
        break
      }
    }
  }
  console.log(`[BCRA] ${moneda}: ${entries.length} entradas Divisa Venta extraídas`)
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
