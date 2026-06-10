import dayjs from 'dayjs'
import type {
  ComexBrand, ComexSupplier, ImportOrderPlanning,
  PlanningRiskStatus, PlanningMilestoneType,
  CreateImportOrderPlanningMilestoneInput
} from '@shared/types'
import { PLANNING_MILESTONE_TYPES } from '@shared/types'

// ── Defaults para inicializar una nueva planificación ───────────────────────────

export const DEFAULT_INTERNAL_APPROVAL_DAYS = 3
export const DEFAULT_INSPECTION_DAYS = 0
export const DEFAULT_SAFETY_DAYS = 5

// ── Lead times efectivos ─────────────────────────────────────────────────────────

export interface PlanningLeadTimes {
  internal_approval_days: number
  supplier_preparation_days: number
  production_days: number
  inspection_days: number
  shipping_days: number
  customs_days: number
  local_delivery_days: number
  safety_days: number
}

/** Deriva el desglose inicial de lead time de una planificación a partir del proveedor (Fase 1). */
export function getDefaultLeadTimesFromSupplier(supplier: ComexSupplier | null | undefined): PlanningLeadTimes {
  return {
    internal_approval_days: DEFAULT_INTERNAL_APPROVAL_DAYS,
    supplier_preparation_days: supplier?.preparation_days ?? 0,
    production_days: supplier?.production_days ?? 0,
    inspection_days: DEFAULT_INSPECTION_DAYS,
    shipping_days: supplier?.transit_days ?? 0,
    customs_days: supplier?.customs_days ?? 0,
    local_delivery_days: supplier?.local_delivery_days ?? 0,
    safety_days: DEFAULT_SAFETY_DAYS,
  }
}

/** Suma de todos los componentes de lead time. */
export function calculateTotalLeadTimeDays(leadTimes: PlanningLeadTimes): number {
  return (
    leadTimes.internal_approval_days +
    leadTimes.supplier_preparation_days +
    leadTimes.production_days +
    leadTimes.inspection_days +
    leadTimes.shipping_days +
    leadTimes.customs_days +
    leadTimes.local_delivery_days +
    leadTimes.safety_days
  )
}

// ── Fechas de hitos ───────────────────────────────────────────────────────────────

export type PlanningMilestoneDates = Record<PlanningMilestoneType, number>

/**
 * Calcula las fechas de cada hito hacia atrás a partir de
 * `target_commercial_availability_date`, recorriendo la cadena:
 * análisis interno -> aprobación -> pedido al proveedor -> preparación ->
 * producción -> inspección -> embarque -> arribo -> nacionalización ->
 * recepción -> disponibilidad comercial.
 */
export function calculateMilestoneDates(
  targetCommercialAvailabilityDate: number,
  leadTimes: PlanningLeadTimes
): PlanningMilestoneDates {
  const subDays = (date: number, days: number) => dayjs(date).subtract(days, 'day').valueOf()

  const commercial_availability = targetCommercialAvailabilityDate
  const reception = subDays(commercial_availability, leadTimes.safety_days)
  const customs = subDays(reception, leadTimes.local_delivery_days)
  const arrival = subDays(customs, leadTimes.customs_days)
  const shipping = subDays(arrival, leadTimes.shipping_days)
  const inspection = subDays(shipping, leadTimes.inspection_days)
  const production = subDays(inspection, leadTimes.production_days)
  const preparation = subDays(production, leadTimes.supplier_preparation_days)
  const supplier_order = preparation
  const approval = supplier_order
  const internal_analysis = subDays(approval, leadTimes.internal_approval_days)

  return {
    internal_analysis, approval, supplier_order, preparation, production,
    inspection, shipping, arrival, customs, reception, commercial_availability
  }
}

/** Construye los registros de hitos a partir de las fechas calculadas, listos para insertar. */
export function buildMilestoneRecords(
  planningId: string,
  dates: PlanningMilestoneDates
): CreateImportOrderPlanningMilestoneInput[] {
  return PLANNING_MILESTONE_TYPES.map((type, index) => ({
    planning_id: planningId,
    milestone_type: type,
    estimated_date: dates[type],
    calculated_date: dates[type],
    real_date: null,
    status: 'pending',
    notes: '',
    sort_order: index
  }))
}

// ── Clasificación de riesgo ──────────────────────────────────────────────────────

/**
 * Clasifica el riesgo comparando la fecha de hoy contra la fecha de recepción
 * que se obtendría si el proceso arrancara hoy mismo.
 * - on_time: arrancando hoy, llega con margen de seguridad de sobra
 * - tight: arrancando hoy, llega justo a la disponibilidad comercial (sin margen)
 * - at_risk: ya no llega a la disponibilidad comercial, pero sí dentro del período de cobertura
 * - late: ni siquiera llega dentro del período de cobertura
 */
export function calculateRiskStatus(
  dates: PlanningMilestoneDates,
  leadTimes: PlanningLeadTimes,
  targetCoverageEndDate: number | null,
  today: number
): PlanningRiskStatus {
  const totalLeadTimeDays = calculateTotalLeadTimeDays(leadTimes)
  const earliestReception = dayjs(today).add(totalLeadTimeDays, 'day').valueOf()

  if (earliestReception <= dates.reception) return 'on_time'
  if (earliestReception <= dates.commercial_availability) return 'tight'
  if (targetCoverageEndDate !== null && earliestReception <= targetCoverageEndDate) return 'at_risk'
  return 'late'
}

// ── Demanda y cobertura ───────────────────────────────────────────────────────────

/** Demanda mensual estimada para un mes (1-12), con fallback a demanda anual / 12. */
function getMonthlyDemand(brand: ComexBrand, month: number): number {
  let monthly: Record<string, number> = {}
  try { monthly = JSON.parse(brand.demand_monthly_json || '{}') } catch { /* ignore */ }
  if (monthly[String(month)] != null) return monthly[String(month)]
  if (brand.demand_annual != null) return brand.demand_annual / 12
  return 0
}

/** Suma la demanda estimada prorrateada día a día entre dos fechas (inclusive). */
export function calculateDemandForPeriod(
  brand: ComexBrand,
  startDate: number | null,
  endDate: number | null
): number | null {
  if (!startDate || !endDate || endDate <= startDate) return null

  let total = 0
  let cursor = dayjs(startDate)
  const end = dayjs(endDate)

  while (cursor.isBefore(end)) {
    const monthStart = cursor.startOf('month')
    const monthEnd = monthStart.add(1, 'month')
    const segmentEnd = end.isBefore(monthEnd) ? end : monthEnd
    const daysInMonth = monthEnd.diff(monthStart, 'day')
    const daysInSegment = segmentEnd.diff(cursor, 'day')
    total += getMonthlyDemand(brand, cursor.month() + 1) * (daysInSegment / daysInMonth)
    cursor = monthEnd
  }

  return Math.round(total)
}

/** Cantidad de meses (con un decimal) que cubre el período objetivo. */
export function calculateDesiredCoverageMonths(
  startDate: number | null,
  endDate: number | null
): number | null {
  if (!startDate || !endDate || endDate <= startDate) return null
  return Math.round(dayjs(endDate).diff(dayjs(startDate), 'month', true) * 10) / 10
}

// ── Cálculo integral de una planificación ──────────────────────────────────────────

export interface PlanningCalculationResult {
  milestoneDates: PlanningMilestoneDates | null
  recommended_order_date: number | null
  approval_deadline_date: number | null
  estimated_reception_date: number | null
  total_lead_time_days: number
  risk_status: PlanningRiskStatus
  demand_for_period: number | null
  desired_coverage_months: number | null
}

/**
 * Calcula todas las fechas, demanda y riesgo de una planificación.
 * `today` es inyectable para tests (default: ahora).
 */
export function calculatePlanning(
  planning: ImportOrderPlanning,
  brand: ComexBrand | null,
  today: number = Date.now()
): PlanningCalculationResult {
  const leadTimes: PlanningLeadTimes = {
    internal_approval_days: planning.internal_approval_days,
    supplier_preparation_days: planning.supplier_preparation_days,
    production_days: planning.production_days,
    inspection_days: planning.inspection_days,
    shipping_days: planning.shipping_days,
    customs_days: planning.customs_days,
    local_delivery_days: planning.local_delivery_days,
    safety_days: planning.safety_days,
  }
  const total_lead_time_days = calculateTotalLeadTimeDays(leadTimes)

  const demand_for_period = brand
    ? calculateDemandForPeriod(brand, planning.target_coverage_start_date, planning.target_coverage_end_date)
    : null
  const desired_coverage_months = calculateDesiredCoverageMonths(
    planning.target_coverage_start_date, planning.target_coverage_end_date
  )

  if (!planning.target_commercial_availability_date) {
    return {
      milestoneDates: null,
      recommended_order_date: null,
      approval_deadline_date: null,
      estimated_reception_date: null,
      total_lead_time_days,
      risk_status: 'on_time',
      demand_for_period,
      desired_coverage_months
    }
  }

  const milestoneDates = calculateMilestoneDates(planning.target_commercial_availability_date, leadTimes)
  const risk_status = calculateRiskStatus(
    milestoneDates, leadTimes, planning.target_coverage_end_date, today
  )

  return {
    milestoneDates,
    recommended_order_date: milestoneDates.internal_analysis,
    approval_deadline_date: milestoneDates.approval,
    estimated_reception_date: milestoneDates.reception,
    total_lead_time_days,
    risk_status,
    demand_for_period,
    desired_coverage_months
  }
}
