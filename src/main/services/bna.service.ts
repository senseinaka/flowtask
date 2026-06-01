/**
 * Servicio de cotizaciones BNA (Banco Nación Argentina)
 * Fuente: api.argentinadatos.com — agrega datos oficiales del BNA
 */

interface ArgentinaDatosRate {
  fecha: string   // "YYYY-MM-DD"
  compra: number
  venta:  number
}

const BASE = 'https://api.argentinadatos.com/v1/cotizaciones'
const TIMEOUT_MS = 12_000

async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    const resp = await fetch(url, {
      signal:  ctrl.signal,
      headers: { Accept: 'application/json' }
    })
    clearTimeout(timer)
    if (!resp.ok) return null
    return (await resp.json()) as T
  } catch {
    return null
  }
}

/**
 * Busca la cotización EUR/ARS del BNA para una fecha dada (o la más cercana anterior).
 * Devuelve { compra, venta } en ARS por EUR, o null si no se pudo obtener.
 */
export async function getEurArsRate(dateStr: string): Promise<{ compra: number; venta: number } | null> {
  // 1. Intentar con la fecha exacta
  const exact = await fetchJSON<ArgentinaDatosRate>(`${BASE}/euro/${dateStr}`)
  if (exact?.venta) return { compra: exact.compra, venta: exact.venta }

  // 2. Fallback: obtener todo el histórico y buscar el registro más cercano anterior
  const all = await fetchJSON<ArgentinaDatosRate[]>(`${BASE}/euro/`)
  if (!all?.length) return null

  const target = new Date(dateStr).getTime()
  const valid  = all
    .filter(r => new Date(r.fecha).getTime() <= target)
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

  if (!valid.length) return null
  const hit = valid[0]
  return { compra: hit.compra, venta: hit.venta, fecha: hit.fecha } as { compra: number; venta: number }
}

/**
 * Calcula el TC EUR/USD usando la cotización BNA EUR/ARS y el TC USD/ARS del despacho.
 * Formula: EUR/USD = EUR/ARS_BNA / USD/ARS_despacho
 */
export async function getEurUsdRate(
  dateStr: string,
  cotizUsdArs: number
): Promise<{ eurUsd: number; eurArs: number; fechaBNA: string } | null> {
  const rate = await getEurArsRate(dateStr)
  if (!rate || cotizUsdArs <= 0) return null

  const eurUsd = rate.venta / cotizUsdArs

  return {
    eurUsd,                    // EUR/USD (ej: 1.183)
    eurArs: rate.venta,        // EUR/ARS BNA venta (ej: 1.670)
    fechaBNA: dateStr
  }
}
