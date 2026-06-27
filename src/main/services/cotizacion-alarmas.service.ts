import { getBcraCotizacionHoy } from './bcra.service'
import { whatsappService } from './whatsapp.service'
import {
  listAlarmasCotizacionActivas,
  setUltimaAlertaAt,
  getLatestCotizacionByMoneda
} from '../database/queries/comex'
import type { ComexAlarmaCotizacion } from '@shared/types'

const CHECK_INTERVAL_MS = 15 * 60 * 1000  // 15 minutos

let interval: ReturnType<typeof setInterval> | null = null

export function startAlarmasCotizacion(): void {
  checkAlarmas().catch(e => console.warn('[AlarmasTC] error inicial:', e))
  interval = setInterval(() => {
    checkAlarmas().catch(e => console.warn('[AlarmasTC] error chequeo:', e))
  }, CHECK_INTERVAL_MS)
}

export function stopAlarmasCotizacion(): void {
  if (interval) { clearInterval(interval); interval = null }
}

async function checkAlarmas(): Promise<void> {
  const alarmas = listAlarmasCotizacionActivas()
  if (!alarmas.length) return

  const [bcraHoy, cotizacionesNaka] = await Promise.all([
    getBcraCotizacionHoy(),
    getLatestCotizacionByMoneda(),
  ])

  for (const alarma of alarmas) {
    await evaluarAlarma(alarma, bcraHoy, cotizacionesNaka)
  }
}

async function evaluarAlarma(
  alarma: ComexAlarmaCotizacion,
  bcraHoy: Awaited<ReturnType<typeof getBcraCotizacionHoy>>,
  cotizacionesNaka: Record<string, number>
): Promise<void> {
  const bcraMoneda = bcraHoy.find(h => h.moneda === alarma.moneda)
  if (!bcraMoneda) return

  const valorNaka = cotizacionesNaka[alarma.moneda]
  if (!valorNaka) return

  // Determinar qué valor BCRA comparar
  let valorBcra: number | null = null
  if (alarma.tipo_cotizacion === 'billete') {
    valorBcra = bcraMoneda.billete_venta
  } else if (alarma.tipo_cotizacion === 'divisa') {
    valorBcra = bcraMoneda.divisa_venta
  } else {
    // 'cualquiera': usar el mayor
    const b = bcraMoneda.billete_venta ?? 0
    const d = bcraMoneda.divisa_venta ?? 0
    valorBcra = Math.max(b, d) || null
  }

  if (!valorBcra) return

  // Chequear cooldown
  if (alarma.ultima_alerta_at) {
    const cooldownMs = alarma.cooldown_horas * 60 * 60 * 1000
    if (Date.now() - alarma.ultima_alerta_at < cooldownMs) return
  }

  // Calcular si se cumple la condición
  const disparar = condicionCumplida(alarma, valorBcra, valorNaka)
  if (!disparar) return

  // Enviar WhatsApp
  if (alarma.whatsapp_numero) {
    const tipoCot   = alarma.tipo_cotizacion === 'cualquiera' ? 'mayor' : alarma.tipo_cotizacion
    const diffPct   = ((valorBcra - valorNaka) / valorNaka * 100).toFixed(1)
    const signo     = parseFloat(diffPct) >= 0 ? '+' : ''
    const moneda    = alarma.moneda
    const mensaje   = `*Alerta ${moneda} - tipo de cambio*\n` +
      `BCRA ${tipoCot}: $${fmtVal(valorBcra)}\n` +
      `${moneda} Naka: $${fmtVal(valorNaka)}\n` +
      `Diferencia: ${signo}${diffPct}%`

    const ok = await whatsappService.sendMessage(alarma.whatsapp_numero, mensaje)
    if (ok) {
      console.log(`[AlarmasTC] Alerta enviada: ${moneda} ${tipoCot} = ${valorBcra}`)
      setUltimaAlertaAt(alarma.id, Date.now())
    }
  }
}

function condicionCumplida(
  alarma: ComexAlarmaCotizacion,
  valorBcra: number,
  valorNaka: number
): boolean {
  const { tipo_umbral, umbral, direccion } = alarma

  if (tipo_umbral === 'porcentaje') {
    const diffPct = (valorBcra - valorNaka) / valorNaka * 100
    return direccion === 'supera' ? diffPct >= umbral : diffPct <= -umbral
  } else {
    return direccion === 'supera' ? valorBcra >= umbral : valorBcra <= umbral
  }
}

function fmtVal(v: number): string {
  return v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
