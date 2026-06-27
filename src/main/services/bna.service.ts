/**
 * Servicio de cotizaciones BNA (Banco Nación Argentina)
 * Fuente: api.argentinadatos.com
 *
 * El endpoint devuelve todas las cotizaciones de todas las monedas.
 * Se filtra por EUR y se busca el día hábil más cercano anterior a la fecha pedida.
 *
 * Caché en memoria: el listado se descarga una sola vez por sesión (TTL 30 min)
 * para evitar llamadas repetidas cuando el usuario consulta varias importaciones.
 */

interface CotizacionRow {
  moneda: string  // 'USD' | 'EUR' | 'BRL' | ...
  casa:   string  // 'oficial'
  compra: number
  venta:  number
  fecha:  string  // "YYYY-MM-DD"
}

const ENDPOINT   = 'https://api.argentinadatos.com/v1/cotizaciones/'
const TIMEOUT_MS = 15_000
const CACHE_TTL  = 30 * 60 * 1000  // 30 minutos

let _cache: CotizacionRow[] | null = null
let _cacheAt = 0

async function fetchAllRates(): Promise<CotizacionRow[]> {
  // Usar caché si está fresco
  if (_cache && Date.now() - _cacheAt < CACHE_TTL) return _cache

  try {
    const ctrl  = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    const resp  = await fetch(ENDPOINT, {
      signal:  ctrl.signal,
      headers: { Accept: 'application/json' }
    })
    clearTimeout(timer)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

    const data = (await resp.json()) as CotizacionRow[]
    _cache   = data
    _cacheAt = Date.now()
    return data
  } catch (err) {
    // Si falla y hay caché vieja, usarla igual (mejor que nada)
    if (_cache) return _cache
    throw err
  }
}

/**
 * Devuelve la cotización EUR/ARS (venta BNA) para una fecha dada.
 * Si la fecha es fin de semana o feriado, usa el día hábil anterior más cercano.
 * Incluye la fecha real del registro y si coincide con la fecha pedida.
 */
export async function getEurArsRateDirect(
  dateStr: string
): Promise<{ eurArs: number; fechaBNA: string; esFechaExacta: boolean } | null> {
  const all = await fetchAllRates()

  // Filtrar EUR y ordenar descendente por fecha
  const eurRates = all
    .filter(r => r.moneda === 'EUR' && r.venta > 0)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))

  if (!eurRates.length) return null

  // Buscar el registro más reciente cuya fecha sea ≤ la pedida
  const hit = eurRates.find(r => r.fecha <= dateStr)
  if (!hit) return null

  return {
    eurArs:        hit.venta,
    fechaBNA:      hit.fecha,
    esFechaExacta: hit.fecha === dateStr
  }
}

/**
 * Devuelve la cotización BNA billete venta para USD y EUR del último día hábil disponible.
 */
export async function getBnaBilleteHoy(): Promise<Array<{ moneda: 'USD' | 'EUR'; venta: number; fecha: string }>> {
  const all = await fetchAllRates()
  const result: Array<{ moneda: 'USD' | 'EUR'; venta: number; fecha: string }> = []

  for (const moneda of ['USD', 'EUR'] as const) {
    const latest = all
      .filter(r => r.moneda === moneda && r.venta > 0)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
    if (latest) result.push({ moneda, venta: latest.venta, fecha: latest.fecha })
  }
  return result
}

/** Invalida el caché (útil en tests o si el usuario lo pide explícitamente) */
export function invalidateBnaCache(): void {
  _cache   = null
  _cacheAt = 0
}
