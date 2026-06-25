import dayjs from 'dayjs'
import type {
  ServiceCategory, ServiceStatus, BillingFrequency, ServicePaymentMethod,
} from '@shared/types'

// ─── Categorías ─────────────────────────────────────────────────────────────────

export const CATEGORY_OPTIONS: { value: ServiceCategory; label: string }[] = [
  { value: 'software',        label: 'Software y SaaS' },
  { value: 'seguro',          label: 'Seguro' },
  { value: 'dominio_hosting', label: 'Dominio o hosting' },
  { value: 'profesional',     label: 'Servicio profesional' },
  { value: 'bancario',        label: 'Servicio bancario' },
  { value: 'administrativo',  label: 'Servicio administrativo' },
  { value: 'mantenimiento',   label: 'Mantenimiento' },
  { value: 'suscripcion',     label: 'Suscripción' },
  { value: 'otro',            label: 'Otro' },
]
export const CATEGORY_LABEL = Object.fromEntries(
  CATEGORY_OPTIONS.map(o => [o.value, o.label])
) as Record<ServiceCategory, string>

// ─── Estados ────────────────────────────────────────────────────────────────────

export const STATUS_OPTIONS: { value: ServiceStatus; label: string }[] = [
  { value: 'activo',    label: 'Activo' },
  { value: 'pausado',   label: 'Pausado' },
  { value: 'cancelado', label: 'Cancelado' },
]
export const STATUS_LABEL = Object.fromEntries(
  STATUS_OPTIONS.map(o => [o.value, o.label])
) as Record<ServiceStatus, string>
export const STATUS_BADGE: Record<ServiceStatus, string> = {
  activo:    'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  pausado:   'bg-amber-500/15 text-amber-300 border-amber-500/30',
  cancelado: 'bg-slate-600/20 text-slate-400 border-slate-600/40',
}

// ─── Frecuencias ────────────────────────────────────────────────────────────────

export const FREQUENCY_OPTIONS: { value: BillingFrequency; label: string }[] = [
  { value: 'mensual',    label: 'Mensual' },
  { value: 'bimestral',  label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral',  label: 'Semestral' },
  { value: 'anual',      label: 'Anual' },
  { value: 'pago_unico', label: 'Pago único con vencimiento' },
  { value: 'otro',       label: 'Otro' },
]
export const FREQUENCY_LABEL = Object.fromEntries(
  FREQUENCY_OPTIONS.map(o => [o.value, o.label])
) as Record<BillingFrequency, string>

/** Meses que cubre cada período. null = no recurrente (pago único / otro). */
export const MONTHS_PER_PERIOD: Record<BillingFrequency, number | null> = {
  mensual: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12, pago_unico: null, otro: null,
}

// ─── Medios de pago ─────────────────────────────────────────────────────────────

export const PAYMENT_METHOD_OPTIONS: { value: ServicePaymentMethod; label: string }[] = [
  { value: '',                  label: '—' },
  { value: 'tarjeta_credito',   label: 'Tarjeta de crédito' },
  { value: 'transferencia',     label: 'Transferencia' },
  { value: 'debito_automatico', label: 'Débito automático' },
  { value: 'mercadopago',       label: 'Mercado Pago' },
  { value: 'paypal',            label: 'PayPal' },
  { value: 'banco',             label: 'Banco' },
  { value: 'efectivo',          label: 'Efectivo' },
  { value: 'otro',              label: 'Otro' },
]
export const PAYMENT_METHOD_LABEL = Object.fromEntries(
  PAYMENT_METHOD_OPTIONS.map(o => [o.value, o.label])
) as Record<ServicePaymentMethod, string>

export const CURRENCY_OPTIONS = ['ARS', 'USD', 'EUR']

// ─── Helpers ────────────────────────────────────────────────────────────────────

export type DueKey = 'overdue' | 'd7' | 'd15' | 'd30' | 'ok' | 'none'

export interface DueInfo { key: DueKey; days: number | null; label: string; badge: string }

/** Estado de vencimiento de una fecha YYYY-MM-DD respecto de hoy. */
export function dueStatus(dateStr: string): DueInfo {
  if (!dateStr) return { key: 'none', days: null, label: '—', badge: 'text-slate-500' }
  const due = dayjs(dateStr)
  if (!due.isValid()) return { key: 'none', days: null, label: dateStr, badge: 'text-slate-500' }
  const diff = due.startOf('day').diff(dayjs().startOf('day'), 'day')
  const fecha = due.format('DD-MM-YYYY')
  if (diff < 0)   return { key: 'overdue', days: diff, label: `Vencido (${fecha})`, badge: 'bg-red-500/15 text-red-300 border-red-500/30' }
  if (diff <= 7)  return { key: 'd7',  days: diff, label: `Vence en ${diff}d`, badge: 'bg-red-500/15 text-red-300 border-red-500/30' }
  if (diff <= 15) return { key: 'd15', days: diff, label: `Vence en ${diff}d`, badge: 'bg-orange-500/15 text-orange-300 border-orange-500/30' }
  if (diff <= 30) return { key: 'd30', days: diff, label: `Vence en ${diff}d`, badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30' }
  return { key: 'ok', days: diff, label: fecha, badge: 'text-slate-300' }
}

export function fmtMoney(amount: number, currency: string): string {
  const n = (amount ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${currency} ${n}`
}
