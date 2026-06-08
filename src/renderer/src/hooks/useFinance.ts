import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  FinanceAccount, FinanceCategory, FinancePaymentMethodEntity, FinanceConcept, FinanceMovement, FinanceMonthSummary,
  FinanceMovementEntry,
  CreateFinanceAccountInput, CreateFinanceCategoryInput, CreateFinancePaymentMethodInput,
  CreateFinanceConceptInput, CreateFinanceMovementInput,
  CreateFinanceMovementEntryInput, UpdateFinanceMovementEntryInput,
  FinanceMovementStatus,
  FinanceCategoryBreakdownItem, FinanceHistoryEntry, FinanceRankingConcept, FinanceRankingIncrease,
  FinanceImportPreviewResult, FinanceImportConfirmItem, FinanceImportResult, FinanceSecurityStatus
} from '@shared/types'
import {
  FINANCE_STATUS_CYCLE_RECURRING, FINANCE_STATUS_CYCLE_NON_RECURRING, FINANCE_PAYMENT_METHOD_LABELS
} from '@shared/types'
import dayjs from 'dayjs'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Color según el % de variación mes a mes (umbrales acordados con el usuario). */
export function getDiffColor(percent: number | null): string {
  if (percent === null) return '#64748b'   // slate — sin datos del mes anterior
  if (percent <= 0)   return '#10b981'     // verde   — bajó o igual
  if (percent <= 20)  return '#f59e0b'     // amarillo — subió 10–20%
  if (percent <= 50)  return '#f97316'     // naranja  — subió 20–50%
  return '#ef4444'                         // rojo     — subió más de 50%
}

export function formatCurrency(amount: number | null | undefined): string {
  const value = amount ?? 0
  return value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

export function formatFinanceDate(ts: number | null): string {
  if (!ts) return '—'
  return dayjs(ts).format('DD/MM/YYYY')
}

export function getMonthLabel(month: number, year: number): string {
  return dayjs(new Date(year, month - 1, 1)).format('MMMM YYYY')
}

/** Nombre del mes (1-12) en español, sin año — ej: "marzo". Usado para conceptos anuales. */
export function getMonthName(month: number): string {
  return dayjs(new Date(2000, month - 1, 1)).format('MMMM')
}

/** Lista de meses 1-12 con su nombre en español, para selects de "mes del año". */
export const MONTH_OPTIONS: { value: number; label: string }[] =
  Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: getMonthName(i + 1) }))

export function getEffectiveAmount(m: FinanceMovement): number {
  return m.amount_actual ?? m.amount_estimated
}

// ── Urgencia de vencimientos (computada al vuelo, igual que getExpiryUrgency) ────
//
// No se persiste en la base — se recalcula siempre a partir de due_date y la fecha
// actual, para evitar desincronizaciones (mismo patrón que el módulo de Vencimientos).

export type FinanceMovementUrgency = 'overdue' | 'today' | 'week' | 'fortnight' | 'month' | 'later'

/** Orden de exposición en la vista "Próximos pagos", de más a menos urgente. */
export const FINANCE_URGENCY_ORDER: FinanceMovementUrgency[] = ['overdue', 'today', 'week', 'fortnight', 'month', 'later']

export const FINANCE_URGENCY_LABELS: Record<FinanceMovementUrgency, string> = {
  overdue:   'Vencidos',
  today:     'Vencen hoy',
  week:      'Esta semana',
  fortnight: 'Próximos 15 días',
  month:     'Este mes',
  later:     'Más adelante',
}

export const FINANCE_URGENCY_COLORS: Record<FinanceMovementUrgency, string> = {
  overdue:   '#ef4444',  // rojo
  today:     '#f97316',  // naranja
  week:      '#f59e0b',  // ámbar
  fortnight: '#eab308',  // amarillo
  month:     '#10b981',  // verde
  later:     '#64748b',  // slate
}

/** Días que faltan (negativo si ya venció), redondeado a días completos por fecha calendario. */
export function getDaysUntilDue(due_date: number): number {
  return dayjs(due_date).startOf('day').diff(dayjs().startOf('day'), 'day')
}

/**
 * Bucket de urgencia de un movimiento pendiente/vencido según su fecha de vencimiento.
 * Devuelve null si ya está pagado o no tiene fecha de vencimiento (no aplica agruparlo).
 */
export function getMovementUrgency(m: FinanceMovement): FinanceMovementUrgency | null {
  if (m.status === 'paid' || m.due_date === null) return null
  const days = getDaysUntilDue(m.due_date)
  if (days < 0)   return 'overdue'
  if (days === 0) return 'today'
  if (days <= 7)  return 'week'
  if (days <= 15) return 'fortnight'
  if (days <= 31) return 'month'
  return 'later'
}

export function getUrgencyColor(urgency: FinanceMovementUrgency): string {
  return FINANCE_URGENCY_COLORS[urgency]
}

// ── Estado "mostrado" y ciclo de estados al click ────────────────────────────
//
// El estado "vencido" NO se persiste nunca (igual que la urgencia, arriba):
// se deriva siempre de due_date vs. la fecha actual, comparándolo en caliente.
// Así evitamos que quede una copia desincronizada en la base si el usuario
// cambia la fecha de vencimiento o si pasan los días sin abrir la app.

/**
 * Estado que se muestra en pantalla, superponiendo "Vencido" sobre el estado
 * persistido cuando corresponde (no pagado + tiene vencimiento + ya pasó).
 * En cualquier otro caso, se respeta el estado real guardado en la base.
 */
export function getDisplayStatus(m: FinanceMovement): FinanceMovementStatus {
  if (m.status === 'paid' || m.due_date === null) return m.status
  return getDaysUntilDue(m.due_date) < 0 ? 'overdue' : m.status
}

/**
 * Próximo estado al hacer click sobre el badge de estado de un movimiento.
 *
 * - Si se está mostrando como "Vencido" → salta directo a "Pagado" (atajo;
 *   no forma parte de ningún ciclo, se resuelve con un solo click).
 * - Si el concepto es recurrente (mensual/quincenal/anual) → cicla
 *   Pendiente ⇄ Pagado (se sabe que el pago va a ocurrir).
 * - Si es puntual/variable → cicla Sin estado → Pendiente → Pagado → ...
 *   (puede no llegar a ocurrir, por eso arranca en "sin estado").
 */
export function getNextStatusOnClick(m: FinanceMovement): FinanceMovementStatus {
  if (getDisplayStatus(m) === 'overdue') return 'paid'

  const isRecurring = m.concept ? m.concept.recurrence !== 'one_time' : true
  const cycle = isRecurring ? FINANCE_STATUS_CYCLE_RECURRING : FINANCE_STATUS_CYCLE_NON_RECURRING
  const idx = cycle.indexOf(m.status)
  // Si el estado actual no pertenece a este ciclo (datos viejos, importados, o
  // un cambio de recurrencia posterior a la generación), arrancamos de cero.
  return idx === -1 ? cycle[0] : cycle[(idx + 1) % cycle.length]
}

/** Texto corto "Venció hace 3 días" / "Vence hoy" / "Vence en 5 días", para las cards. */
export function getDueLabel(due_date: number): string {
  const days = getDaysUntilDue(due_date)
  if (days < 0)  return `Venció hace ${Math.abs(days)} ${Math.abs(days) === 1 ? 'día' : 'días'}`
  if (days === 0) return 'Vence hoy'
  if (days === 1) return 'Vence mañana'
  return `Vence en ${days} días`
}

/** Agrupa movimientos no pagados por bucket de urgencia, ordenados por fecha dentro de cada uno. */
export function groupMovementsByUrgency(movements: FinanceMovement[]): Record<FinanceMovementUrgency, FinanceMovement[]> {
  const groups: Record<FinanceMovementUrgency, FinanceMovement[]> = {
    overdue: [], today: [], week: [], fortnight: [], month: [], later: []
  }
  for (const m of movements) {
    const urgency = getMovementUrgency(m)
    if (urgency) groups[urgency].push(m)
  }
  for (const key of FINANCE_URGENCY_ORDER) {
    groups[key].sort((a, b) => (a.due_date ?? 0) - (b.due_date ?? 0))
  }
  return groups
}

// ── Alertas inteligentes (basadas en reglas, no IA) ──────────────────────────────
//
// Igual que con getExpiryUrgency: reglas calculadas sobre los datos ya cargados
// (vencidos, vencimientos próximos, variaciones de gasto vs. el mes anterior, etc.)
// en vez de IA — más rápido, gratis, 100% confiable y predecible.

export type FinanceAlertSeverity = 'danger' | 'warning' | 'info'
export type FinanceAlertKind = 'overdue' | 'due_today' | 'due_soon' | 'increase' | 'no_movements'

export interface FinanceAlert {
  id:       string
  kind:     FinanceAlertKind
  severity: FinanceAlertSeverity
  title:    string
  message:  string
}

export function getFinanceAlerts(opts: {
  upcoming: FinanceMovement[]
  summary?: FinanceMonthSummary
}): FinanceAlert[] {
  const { upcoming, summary } = opts
  const alerts: FinanceAlert[] = []

  const overdue  = upcoming.filter(m => getMovementUrgency(m) === 'overdue')
  const dueToday = upcoming.filter(m => getMovementUrgency(m) === 'today')
  const dueWeek  = upcoming.filter(m => getMovementUrgency(m) === 'week')

  if (overdue.length > 0) {
    const total = overdue.reduce((acc, m) => acc + getEffectiveAmount(m), 0)
    alerts.push({
      id: 'overdue', kind: 'overdue', severity: 'danger',
      title:   `${overdue.length} ${overdue.length === 1 ? 'pago vencido' : 'pagos vencidos'}`,
      message: `Suman ${formatCurrency(total)}. Marcalos como pagados o posponé la fecha desde "Próximos pagos".`
    })
  }

  if (dueToday.length > 0) {
    const total = dueToday.reduce((acc, m) => acc + getEffectiveAmount(m), 0)
    alerts.push({
      id: 'due-today', kind: 'due_today', severity: 'warning',
      title:   `${dueToday.length} ${dueToday.length === 1 ? 'pago vence' : 'pagos vencen'} hoy`,
      message: `Suman ${formatCurrency(total)}.`
    })
  }

  if (dueWeek.length > 0) {
    const total = dueWeek.reduce((acc, m) => acc + getEffectiveAmount(m), 0)
    alerts.push({
      id: 'due-week', kind: 'due_soon', severity: 'info',
      title:   `${dueWeek.length} ${dueWeek.length === 1 ? 'pago vence' : 'pagos vencen'} esta semana`,
      message: `Suman ${formatCurrency(total)}. Revisalos en "Próximos pagos" para anticiparte.`
    })
  }

  if (summary?.biggestIncrease && summary.biggestIncrease.diffPercent !== null && summary.biggestIncrease.diffPercent > 20) {
    const { conceptName, diffAmount, diffPercent } = summary.biggestIncrease
    alerts.push({
      id: 'increase', kind: 'increase', severity: diffPercent > 50 ? 'danger' : 'warning',
      title:   `"${conceptName}" subió ${diffPercent.toFixed(0)}% este mes`,
      message: `Aumentó ${formatCurrency(diffAmount)} respecto al mes anterior — vale la pena revisarlo.`
    })
  }

  if (summary && summary.totalEstimated === 0) {
    alerts.push({
      id: 'no-movements', kind: 'no_movements', severity: 'info',
      title:   'Todavía no hay movimientos cargados este mes',
      message: 'Usá "Generar del mes" para crearlos automáticamente a partir de tus conceptos activos.'
    })
  }

  return alerts
}

// ── Accounts ──────────────────────────────────────────────────────────────────

export function useFinanceAccounts() {
  return useQuery({
    queryKey: ['finance-accounts'],
    queryFn:  (): Promise<FinanceAccount[]> => window.api.finance.accounts.list(),
    staleTime: 60_000
  })
}

export function useCreateFinanceAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateFinanceAccountInput) => window.api.finance.accounts.create(data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['finance-accounts'] })
  })
}

export function useUpdateFinanceAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateFinanceAccountInput> }) =>
      window.api.finance.accounts.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance-accounts'] })
  })
}

export function useDeleteFinanceAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.finance.accounts.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['finance-accounts'] })
  })
}

// ── Categories ────────────────────────────────────────────────────────────────

export function useFinanceCategories() {
  return useQuery({
    queryKey: ['finance-categories'],
    queryFn:  (): Promise<FinanceCategory[]> => window.api.finance.categories.list(),
    staleTime: 60_000
  })
}

export function useCreateFinanceCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateFinanceCategoryInput) => window.api.finance.categories.create(data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['finance-categories'] })
  })
}

export function useUpdateFinanceCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateFinanceCategoryInput> }) =>
      window.api.finance.categories.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-categories'] })
      qc.invalidateQueries({ queryKey: ['finance-concepts'] })
      qc.invalidateQueries({ queryKey: ['finance-movements'] })
    }
  })
}

export function useDeleteFinanceCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.finance.categories.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-categories'] })
      qc.invalidateQueries({ queryKey: ['finance-concepts'] })
    }
  })
}

// ── Payment methods ───────────────────────────────────────────────────────────
// Mismo patrón que cuentas/categorías. A diferencia de esas, `payment_method`
// no es una FK (es un id de texto libre guardado tal cual en concepts/movements),
// así que borrar/editar un método no dispara cascada — pero sí invalidamos
// concepts/movements para que las celdas que muestran su nombre se actualicen.

export function useFinancePaymentMethods() {
  return useQuery({
    queryKey: ['finance-payment-methods'],
    queryFn:  (): Promise<FinancePaymentMethodEntity[]> => window.api.finance.paymentMethods.list(),
    staleTime: 60_000
  })
}

export function useCreateFinancePaymentMethod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateFinancePaymentMethodInput) => window.api.finance.paymentMethods.create(data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['finance-payment-methods'] })
  })
}

export function useUpdateFinancePaymentMethod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateFinancePaymentMethodInput> }) =>
      window.api.finance.paymentMethods.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-payment-methods'] })
      qc.invalidateQueries({ queryKey: ['finance-concepts'] })
      qc.invalidateQueries({ queryKey: ['finance-movements'] })
    }
  })
}

export function useDeleteFinancePaymentMethod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.finance.paymentMethods.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-payment-methods'] })
      qc.invalidateQueries({ queryKey: ['finance-concepts'] })
      qc.invalidateQueries({ queryKey: ['finance-movements'] })
    }
  })
}

/**
 * Etiqueta de un método de pago — busca primero en la lista dinámica (que
 * incluye los personalizados) y cae al mapa estático de los 6 "de fábrica"
 * como fallback (p.ej. mientras la query todavía está cargando, o un id huérfano).
 */
export function getPaymentMethodLabel(
  methods: FinancePaymentMethodEntity[] | undefined, id: string
): string {
  return methods?.find(m => m.id === id)?.name ?? FINANCE_PAYMENT_METHOD_LABELS[id] ?? id
}

// ── Concepts ──────────────────────────────────────────────────────────────────

export function useFinanceConcepts(opts?: { activeOnly?: boolean }) {
  return useQuery({
    queryKey: ['finance-concepts', opts?.activeOnly ?? false],
    queryFn:  (): Promise<FinanceConcept[]> => window.api.finance.concepts.list(opts),
    staleTime: 60_000
  })
}

export function useCreateFinanceConcept() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateFinanceConceptInput) => window.api.finance.concepts.create(data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['finance-concepts'] })
  })
}

export function useUpdateFinanceConcept() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateFinanceConceptInput> & { is_active?: number } }) =>
      window.api.finance.concepts.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-concepts'] })
      qc.invalidateQueries({ queryKey: ['finance-movements'] })
    }
  })
}

export function useDeleteFinanceConcept() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.finance.concepts.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-concepts'] })
      qc.invalidateQueries({ queryKey: ['finance-movements'] })
    }
  })
}

// ── Movements ─────────────────────────────────────────────────────────────────

export function useFinanceMovements(month: number, year: number) {
  return useQuery({
    queryKey: ['finance-movements', month, year],
    queryFn:  (): Promise<FinanceMovement[]> => window.api.finance.movements.list(month, year),
    staleTime: 30_000
  })
}

/** Movimientos pendientes/vencidos de TODOS los períodos, para "Próximos pagos" y alertas. */
export function useUpcomingFinanceMovements() {
  return useQuery({
    queryKey: ['finance-movements-upcoming'],
    queryFn:  (): Promise<FinanceMovement[]> => window.api.finance.movements.listUpcoming(),
    staleTime: 30_000
  })
}

/** Helper para invalidar todas las queries de movimientos (mes actual + próximos pagos + resumen). */
function invalidateFinanceMovements(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['finance-movements'] })
  qc.invalidateQueries({ queryKey: ['finance-movements-upcoming'] })
  qc.invalidateQueries({ queryKey: ['finance-summary'] })
}

export function useCreateFinanceMovement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateFinanceMovementInput) => window.api.finance.movements.create(data),
    onSuccess:  () => invalidateFinanceMovements(qc)
  })
}

export function useUpdateFinanceMovement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateFinanceMovementInput> }) =>
      window.api.finance.movements.update(id, data),
    onSuccess: () => invalidateFinanceMovements(qc)
  })
}

/** Edición rápida en línea desde la tabla principal (optimista). */
export function useQuickUpdateFinanceMovement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: {
      id: string
      data: {
        amount_actual?: number | null
        status?:        FinanceMovementStatus
        payment_date?:  number | null
        due_date?:      number | null
        notes?:         string
      }
    }) => window.api.finance.movements.quickUpdate(id, data),
    onSuccess: () => invalidateFinanceMovements(qc)
  })
}

export function useDeleteFinanceMovement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.finance.movements.delete(id),
    onSuccess: () => invalidateFinanceMovements(qc)
  })
}

export function useGenerateMovementsForMonth() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ month, year }: { month: number; year: number }) =>
      window.api.finance.movements.generateForMonth(month, year),
    onSuccess: () => invalidateFinanceMovements(qc)
  })
}

/**
 * "Crear nuevo mes desde mes anterior" (Fase 4): genera los movimientos del
 * período usando como estimación inicial el monto real (o estimado) del mismo
 * concepto en el mes inmediatamente anterior, en vez del monto fijo del
 * concepto — más útil para proyectar gastos variables con cifras realistas.
 */
export function useGenerateMovementsFromPreviousMonth() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ month, year }: { month: number; year: number }) =>
      window.api.finance.movements.generateFromPreviousMonth(month, year),
    onSuccess: () => invalidateFinanceMovements(qc)
  })
}

// ── Registro de cargas — conceptos multi-carga (Opción C) ────────────────────
//
// Sub-ledger de "cargas" por movimiento: un concepto marcado con
// `tracks_multiple_entries` mantiene UN solo movimiento por mes/año, pero
// puede acumular varias entradas (p. ej. 3 cargas de nafta) cuya suma
// recalcula automáticamente `amount_actual`, `status` y `payment_date` del
// movimiento. Reemplaza el viejo workaround de "Nafta 1/2/3".

export function useMovementEntries(movementId: string | null | undefined) {
  return useQuery({
    queryKey: ['finance-movement-entries', movementId],
    queryFn:  (): Promise<FinanceMovementEntry[]> =>
      window.api.finance.movementEntries.list(movementId as string),
    enabled:   !!movementId,
    staleTime: 10_000
  })
}

/** Invalida las entradas de un movimiento puntual + listas de movimientos/resumen (porque cambian montos/estado derivados). */
function invalidateMovementEntries(qc: ReturnType<typeof useQueryClient>, movementId: string) {
  qc.invalidateQueries({ queryKey: ['finance-movement-entries', movementId] })
  invalidateFinanceMovements(qc)
}

export function useAddMovementEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateFinanceMovementEntryInput) => window.api.finance.movementEntries.add(data),
    onSuccess:  (_entry, variables) => invalidateMovementEntries(qc, variables.movement_id)
  })
}

export function useUpdateMovementEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; movementId: string; data: UpdateFinanceMovementEntryInput }) =>
      window.api.finance.movementEntries.update(vars.id, vars.data),
    onSuccess:  (_entry, variables) => invalidateMovementEntries(qc, variables.movementId)
  })
}

export function useRemoveMovementEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; movementId: string }) => window.api.finance.movementEntries.remove(id),
    onSuccess:  (_void, variables) => invalidateMovementEntries(qc, variables.movementId)
  })
}

// ── Resumen / dashboard ───────────────────────────────────────────────────────

export function useFinanceMonthSummary(month: number, year: number) {
  return useQuery({
    queryKey: ['finance-summary', month, year],
    queryFn:  (): Promise<FinanceMonthSummary> => window.api.finance.summary.get(month, year),
    staleTime: 30_000
  })
}

// ── Visualización / análisis (Fase 3) ─────────────────────────────────────────
//
// Todo se calcula al vuelo en el proceso principal a partir de los movimientos
// crudos del período pedido (mismo criterio que el resumen del mes) — nunca se
// guarda nada derivado, así los gráficos siempre reflejan los datos actuales.

/** Cuántos meses de historial mostrar por defecto en "Evolución" y "Vista histórica". */
export const FINANCE_HISTORY_MONTHS = 6

export function useFinanceCategoryBreakdown(month: number, year: number) {
  return useQuery({
    queryKey: ['finance-analytics-category-breakdown', month, year],
    queryFn:  (): Promise<FinanceCategoryBreakdownItem[]> => window.api.finance.analytics.categoryBreakdown(month, year),
    staleTime: 30_000
  })
}

export function useFinanceHistory(month: number, year: number, monthsBack: number = FINANCE_HISTORY_MONTHS) {
  return useQuery({
    queryKey: ['finance-analytics-history', month, year, monthsBack],
    queryFn:  (): Promise<FinanceHistoryEntry[]> => window.api.finance.analytics.history(month, year, monthsBack),
    staleTime: 30_000
  })
}

export function useFinanceTopConcepts(month: number, year: number, limit?: number) {
  return useQuery({
    queryKey: ['finance-analytics-top-concepts', month, year, limit],
    queryFn:  (): Promise<FinanceRankingConcept[]> => window.api.finance.analytics.topConcepts(month, year, limit),
    staleTime: 30_000
  })
}

export function useFinanceTopIncreases(month: number, year: number, limit?: number) {
  return useQuery({
    queryKey: ['finance-analytics-top-increases', month, year, limit],
    queryFn:  (): Promise<FinanceRankingIncrease[]> => window.api.finance.analytics.topIncreases(month, year, limit),
    staleTime: 30_000
  })
}

/** Texto corto del signo de variación, para listas de ranking ("+12,5%" / "−3,0%"). */
export function formatSignedPercent(percent: number | null): string {
  if (percent === null) return '—'
  const sign = percent > 0 ? '+' : percent < 0 ? '−' : ''
  return `${sign}${Math.abs(percent).toFixed(1)}%`
}

// ── Importación con preview (Fase 5) ─────────────────────────────────────────
//
// Dos pasos separados a propósito: `selectFile` abre el diálogo, parsea y arma
// la previsualización (sin escribir nada); `confirm` recién ahí inserta/actualiza
// lo que el usuario decidió. Cada uno invalida lo necesario para que la tabla del
// mes se actualice sola tras confirmar.

/** Abre el selector de archivo, parsea Excel/CSV y devuelve la previsualización (o null si se canceló). */
export function useFinanceImportSelectFile() {
  return useMutation({
    mutationFn: ({ month, year }: { month: number; year: number }): Promise<FinanceImportPreviewResult | null> =>
      window.api.finance.import.selectFile(month, year)
  })
}

/**
 * Modo "pegar datos": le pasa texto libre a la IA (tabla de Excel pegada, lista
 * de WhatsApp, notas sueltas) para que lo interprete y devuelva la MISMA forma
 * de previsualización que `useFinanceImportSelectFile` — así reutiliza sin
 * cambios el matching de conceptos, la detección de duplicados y toda la UI
 * de revisión de filas.
 */
export function useFinanceImportParseText() {
  return useMutation({
    mutationFn: ({ rawText, month, year }: { rawText: string; month: number; year: number }): Promise<FinanceImportPreviewResult> =>
      window.api.finance.import.parseText(rawText, month, year)
  })
}

export function useConfirmFinanceImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ items, month, year }: { items: FinanceImportConfirmItem[]; month: number; year: number }): Promise<FinanceImportResult> =>
      window.api.finance.import.confirm(items, month, year),
    onSuccess: () => invalidateFinanceMovements(qc)
  })
}

// ── Exportación: Excel / CSV / PDF resumen (Fase 5) ──────────────────────────
//
// Cada una abre un diálogo "Guardar como"; si el usuario cancela, devuelven null
// y no pasa nada. Si se guarda, el proceso principal además abre el explorador
// de archivos en la carpeta destino para que sea fácil encontrarlo.

export function useExportFinanceMovements() {
  return useMutation({
    mutationFn: ({ month, year, format }: { month: number; year: number; format: 'xlsx' | 'csv' }): Promise<{ filePath: string } | null> =>
      window.api.finance.export.movements(month, year, format)
  })
}

/** Exporta solo los movimientos seleccionados a mano en la tabla (acciones en lote). */
export function useExportFinanceMovementsSelection() {
  return useMutation({
    mutationFn: ({ movements, format }: { movements: FinanceMovement[]; format: 'xlsx' | 'csv' }): Promise<{ filePath: string } | null> =>
      window.api.finance.export.selection(movements, format)
  })
}

export function useExportFinanceSummaryPdf() {
  return useMutation({
    mutationFn: ({ month, year }: { month: number; year: number }): Promise<{ filePath: string } | null> =>
      window.api.finance.export.summaryPdf(month, year)
  })
}

// ── Bloqueo por PIN (Fase 5) ─────────────────────────────────────────────────
//
// El estado (`enabled`) se consulta al montar el módulo para decidir si mostrar
// la pantalla de bloqueo. La verificación/():boolean nunca expone el PIN ni su
// hash — solo dice si lo que tipeó el usuario coincide.

export function useFinanceSecurityStatus() {
  return useQuery({
    queryKey: ['finance-security-status'],
    queryFn:  (): Promise<FinanceSecurityStatus> => window.api.finance.security.status(),
    staleTime: 0   // siempre fresco: es la base de la decisión "mostrar bloqueo o no"
  })
}

export function useSetupFinancePin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (pin: string): Promise<FinanceSecurityStatus> => window.api.finance.security.setup(pin),
    onSuccess: (status) => qc.setQueryData(['finance-security-status'], status)
  })
}

export function useVerifyFinancePin() {
  return useMutation({
    mutationFn: (pin: string): Promise<boolean> => window.api.finance.security.verify(pin)
  })
}

export function useDisableFinancePin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (currentPin: string): Promise<boolean> => window.api.finance.security.disable(currentPin),
    onSuccess: (ok) => { if (ok) qc.invalidateQueries({ queryKey: ['finance-security-status'] }) }
  })
}

export function useChangeFinancePin() {
  return useMutation({
    mutationFn: ({ currentPin, newPin }: { currentPin: string; newPin: string }): Promise<boolean> =>
      window.api.finance.security.change(currentPin, newPin)
  })
}
