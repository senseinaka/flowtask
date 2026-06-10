import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, AlertCircle, Info, Tag, ListChecks, CalendarClock, Clock, ChevronRight, CalendarRange } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
dayjs.locale('es')

import { PLANNING_RISK_LABELS, PLANNING_RISK_COLORS } from '@shared/types'
import type { ImportOrderPlanning, PlanningRiskStatus } from '@shared/types'
import { cn } from '../../components/ui/utils'

const RISK_ORDER: PlanningRiskStatus[] = ['late', 'at_risk', 'tight', 'on_time']
const ALERT_WINDOW_DAYS = 7
const ACTIVE_STATUSES = ['draft', 'analysis', 'ai_recommended', 'pending_approval', 'approved']

// ── KPI panel ─────────────────────────────────────────────────────────────────

export function PlanningSummaryPanel({ plannings }: { plannings: ImportOrderPlanning[] }) {
  const today = dayjs()

  const counts = useMemo(() => {
    const map: Record<PlanningRiskStatus, number> = { on_time: 0, tight: 0, at_risk: 0, late: 0 }
    for (const p of plannings) map[p.risk_status]++
    return map
  }, [plannings])

  const upcomingApprovals = useMemo(
    () => plannings.filter((p) => {
      if (!p.approval_deadline_date || !ACTIVE_STATUSES.includes(p.status)) return false
      const days = dayjs(p.approval_deadline_date).diff(today, 'day')
      return days <= 14
    }).length,
    [plannings] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const upcomingOrders = useMemo(
    () => plannings.filter((p) => {
      if (!p.recommended_order_date || !ACTIVE_STATUSES.includes(p.status)) return false
      const days = dayjs(p.recommended_order_date).diff(today, 'day')
      return days <= 14
    }).length,
    [plannings] // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Total */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <ListChecks size={13} className="text-cyan-400" />
          <p className="text-[11px] text-slate-400 uppercase tracking-wider">Total programaciones</p>
        </div>
        <p className="text-3xl font-bold text-white">{plannings.length}</p>
      </div>

      {/* Risk distribution */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 lg:col-span-2">
        <div className="flex items-center gap-1.5 mb-2">
          <AlertTriangle size={13} className="text-cyan-400" />
          <p className="text-[11px] text-slate-400 uppercase tracking-wider">Distribución de riesgo</p>
        </div>
        <div className="flex items-center gap-4">
          {RISK_ORDER.map((status) => (
            <div key={status} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PLANNING_RISK_COLORS[status] }} />
              <span className="text-lg font-bold text-white">{counts[status]}</span>
              <span className="text-[10px] text-slate-500">{PLANNING_RISK_LABELS[status]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Próximos vencimientos */}
      <div className={cn(
        'border rounded-xl p-4',
        (upcomingApprovals + upcomingOrders) > 0 ? 'bg-amber-900/20 border-amber-800/50' : 'bg-slate-800 border-slate-700'
      )}>
        <div className="flex items-center gap-1.5 mb-2">
          <Clock size={13} className={(upcomingApprovals + upcomingOrders) > 0 ? 'text-amber-400' : 'text-slate-500'} />
          <p className={cn('text-[11px] uppercase tracking-wider', (upcomingApprovals + upcomingOrders) > 0 ? 'text-amber-400' : 'text-slate-400')}>
            Próximos 14 días
          </p>
        </div>
        <p className={cn('text-3xl font-bold', (upcomingApprovals + upcomingOrders) > 0 ? 'text-amber-400' : 'text-emerald-400')}>
          {upcomingApprovals + upcomingOrders}
        </p>
        <p className="text-[11px] text-slate-500 mt-1">
          {upcomingApprovals} aprobaciones · {upcomingOrders} pedidos
        </p>
      </div>
    </div>
  )
}

// ── Alerts ────────────────────────────────────────────────────────────────────

interface PlanningAlert {
  id: string
  planning: ImportOrderPlanning
  severity: 'critical' | 'warning' | 'info'
  message: string
  date: number | null
}

function buildAlerts(plannings: ImportOrderPlanning[]): PlanningAlert[] {
  const today = dayjs()
  const alerts: PlanningAlert[] = []

  for (const p of plannings) {
    const brandName = p.brand?.name ?? '—'

    if (p.risk_status === 'late') {
      alerts.push({
        id: `${p.id}-late`,
        planning: p,
        severity: 'critical',
        message: `${brandName}: programación atrasada`,
        date: p.recommended_order_date
      })
    } else if (p.risk_status === 'at_risk') {
      alerts.push({
        id: `${p.id}-at-risk`,
        planning: p,
        severity: 'warning',
        message: `${brandName}: en riesgo de no llegar a tiempo`,
        date: p.recommended_order_date
      })
    }

    if (p.approval_deadline_date && ACTIVE_STATUSES.includes(p.status)) {
      const days = dayjs(p.approval_deadline_date).diff(today, 'day')
      if (days <= ALERT_WINDOW_DAYS) {
        alerts.push({
          id: `${p.id}-approval`,
          planning: p,
          severity: days < 0 ? 'critical' : 'warning',
          message: days < 0
            ? `${brandName}: límite de aprobación vencido hace ${Math.abs(days)}d`
            : days === 0
              ? `${brandName}: límite de aprobación es hoy`
              : `${brandName}: límite de aprobación en ${days}d`,
          date: p.approval_deadline_date
        })
      }
    }

    if (p.recommended_order_date && ACTIVE_STATUSES.includes(p.status)) {
      const days = dayjs(p.recommended_order_date).diff(today, 'day')
      if (days <= ALERT_WINDOW_DAYS) {
        alerts.push({
          id: `${p.id}-order`,
          planning: p,
          severity: days < 0 ? 'critical' : 'info',
          message: days < 0
            ? `${brandName}: pedido recomendado hace ${Math.abs(days)}d sin realizar`
            : days === 0
              ? `${brandName}: pedido recomendado para hoy`
              : `${brandName}: pedido recomendado en ${days}d`,
          date: p.recommended_order_date
        })
      }
    }
  }

  const severityOrder = { critical: 0, warning: 1, info: 2 }
  return alerts.sort((a, b) => {
    const sev = severityOrder[a.severity] - severityOrder[b.severity]
    if (sev !== 0) return sev
    return (a.date ?? Infinity) - (b.date ?? Infinity)
  })
}

const SEVERITY_CONFIG: Record<PlanningAlert['severity'], { color: string; bg: string; Icon: React.ElementType }> = {
  critical: { color: 'text-red-400', bg: 'bg-red-950/10', Icon: AlertCircle },
  warning:  { color: 'text-amber-400', bg: 'bg-amber-950/10', Icon: AlertTriangle },
  info:     { color: 'text-cyan-400', bg: '', Icon: Info }
}

export function PlanningAlertsPanel({ plannings }: { plannings: ImportOrderPlanning[] }) {
  const navigate = useNavigate()
  const alerts = useMemo(() => buildAlerts(plannings), [plannings])

  if (alerts.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-2">
        <Info size={14} className="text-emerald-400" />
        <p className="text-xs text-slate-400">Sin alertas activas. Todas las programaciones están en buen camino.</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/60">
        <AlertTriangle size={14} className="text-amber-400" />
        <h2 className="text-sm font-semibold text-white">Alertas</h2>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-medium">
          {alerts.length}
        </span>
      </div>
      <div className="divide-y divide-slate-700/30">
        {alerts.map((alert) => {
          const cfg = SEVERITY_CONFIG[alert.severity]
          const Icon = cfg.Icon
          return (
            <button
              key={alert.id}
              onClick={() => navigate(`/comex/plannings/${alert.planning.id}`)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/30 transition-colors text-left group',
                cfg.bg
              )}
            >
              <Icon size={13} className={cn('shrink-0', cfg.color)} />
              <Tag size={11} className="text-cyan-400 shrink-0" />
              <span className="flex-1 text-xs text-slate-300 group-hover:text-white truncate">{alert.message}</span>
              {alert.date && (
                <span className="flex items-center gap-1 text-[10px] text-slate-500 shrink-0">
                  <CalendarClock size={10} />
                  {dayjs(alert.date).format('DD/MM/YY')}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Panel compacto para el dashboard general de Comex ──────────────────────────

export function PlanningDashboardPanel({ plannings }: { plannings: ImportOrderPlanning[] }) {
  const navigate = useNavigate()

  const counts = useMemo(() => {
    const map: Record<PlanningRiskStatus, number> = { on_time: 0, tight: 0, at_risk: 0, late: 0 }
    for (const p of plannings) map[p.risk_status]++
    return map
  }, [plannings])

  const alerts = useMemo(() => buildAlerts(plannings).slice(0, 4), [plannings])

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => navigate('/comex/plannings')}
        className="w-full flex items-center gap-2 px-4 py-3 border-b border-slate-700/60 hover:bg-slate-700/30 transition-colors text-left group"
      >
        <CalendarRange size={14} className="text-cyan-400" />
        <h2 className="text-sm font-semibold text-white">Programación de pedidos</h2>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-medium">
          {plannings.length}
        </span>
        <ChevronRight size={14} className="ml-auto text-slate-500 group-hover:text-white transition-colors" />
      </button>

      <div className="px-4 py-3 flex items-center gap-4">
        {RISK_ORDER.map((status) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PLANNING_RISK_COLORS[status] }} />
            <span className="text-base font-bold text-white">{counts[status]}</span>
            <span className="text-[10px] text-slate-500">{PLANNING_RISK_LABELS[status]}</span>
          </div>
        ))}
      </div>

      {alerts.length > 0 && (
        <div className="divide-y divide-slate-700/30 border-t border-slate-700/60">
          {alerts.map((alert) => {
            const cfg = SEVERITY_CONFIG[alert.severity]
            const Icon = cfg.Icon
            return (
              <button
                key={alert.id}
                onClick={() => navigate(`/comex/plannings/${alert.planning.id}`)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-700/30 transition-colors text-left group',
                  cfg.bg
                )}
              >
                <Icon size={12} className={cn('shrink-0', cfg.color)} />
                <span className="flex-1 text-[11px] text-slate-300 group-hover:text-white truncate">{alert.message}</span>
                {alert.date && (
                  <span className="flex items-center gap-1 text-[10px] text-slate-500 shrink-0">
                    <CalendarClock size={10} />
                    {dayjs(alert.date).format('DD/MM/YY')}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
