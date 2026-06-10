import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { GanttChartSquare, Tag } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
dayjs.locale('es')

import { PLANNING_MILESTONE_LABELS, PLANNING_RISK_COLORS } from '@shared/types'
import type { ImportOrderPlanning, PlanningMilestoneStatus } from '@shared/types'

const STATUS_COLORS: Record<PlanningMilestoneStatus, string> = {
  pending: '#64748b',
  in_progress: '#3b82f6',
  done: '#22c55e',
  delayed: '#ef4444'
}

export default function ComexPlanningTimeline({ plannings }: { plannings: ImportOrderPlanning[] }) {
  const navigate = useNavigate()

  const withMilestones = useMemo(
    () => plannings.filter((p) => (p.milestones ?? []).some((m) => m.calculated_date)),
    [plannings]
  )

  const { rangeStart, rangeEnd } = useMemo(() => {
    let min = Infinity
    let max = -Infinity
    for (const p of withMilestones) {
      for (const m of p.milestones ?? []) {
        if (!m.calculated_date) continue
        if (m.calculated_date < min) min = m.calculated_date
        if (m.calculated_date > max) max = m.calculated_date
      }
    }
    const now = dayjs().valueOf()
    if (min === Infinity) { min = now; max = now }
    min = Math.min(min, now)
    max = Math.max(max, now)
    return {
      rangeStart: dayjs(min).subtract(3, 'day'),
      rangeEnd: dayjs(max).add(3, 'day')
    }
  }, [withMilestones])

  const totalDays = Math.max(1, rangeEnd.diff(rangeStart, 'day'))

  const months = useMemo(() => {
    const result: { label: string; left: number; width: number }[] = []
    let cursor = rangeStart.startOf('month')
    while (cursor.isBefore(rangeEnd)) {
      const segStart = cursor.isAfter(rangeStart) ? cursor : rangeStart
      const segEndCandidate = cursor.add(1, 'month')
      const segEnd = segEndCandidate.isBefore(rangeEnd) ? segEndCandidate : rangeEnd
      const left = (segStart.diff(rangeStart, 'day') / totalDays) * 100
      const width = (segEnd.diff(segStart, 'day') / totalDays) * 100
      result.push({ label: cursor.format('MMM YYYY'), left, width })
      cursor = segEndCandidate
    }
    return result
  }, [rangeStart, rangeEnd, totalDays])

  const todayPct = (dayjs().diff(rangeStart, 'day') / totalDays) * 100

  if (withMilestones.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
        <GanttChartSquare size={36} className="text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 font-medium">Sin hitos calculados</p>
        <p className="text-slate-500 text-sm mt-1">Las programaciones necesitan hitos para mostrarse en la línea de tiempo.</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-700/60">
        <GanttChartSquare size={15} className="text-cyan-400" />
        <h3 className="text-sm font-semibold text-white">Línea de tiempo de hitos</h3>
      </div>

      <div className="overflow-x-auto">
        <div className="relative min-w-[900px]">
          {/* Today line */}
          <div
            className="absolute top-0 bottom-0 w-px bg-cyan-500/70 z-[1]"
            style={{ left: `calc(12rem + (100% - 12rem) * ${todayPct / 100})` }}
          />

          {/* Months header */}
          <div className="flex">
            <div className="w-48 shrink-0 border-r border-slate-700/60" />
            <div className="relative flex-1 h-7 border-b border-slate-700/60">
              {months.map((m, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full flex items-center px-2 text-[10px] uppercase tracking-wider text-slate-500 border-l border-slate-700/40 capitalize"
                  style={{ left: `${m.left}%`, width: `${m.width}%` }}
                >
                  {m.label}
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          {withMilestones.map((planning) => {
            const milestones = (planning.milestones ?? []).filter((m) => m.calculated_date)
            const riskColor = PLANNING_RISK_COLORS[planning.risk_status]

            return (
              <div key={planning.id} className="flex border-b border-slate-700/40 last:border-0">
                <button
                  onClick={() => navigate(`/comex/plannings/${planning.id}`)}
                  className="w-48 shrink-0 flex items-center gap-2 px-3 py-3 text-left hover:bg-slate-700/30 transition-colors border-r border-slate-700/60"
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: riskColor }} />
                  <Tag size={12} className="text-cyan-400 shrink-0" />
                  <span className="text-xs font-medium text-white truncate">{planning.brand?.name ?? '—'}</span>
                </button>
                <div className="relative flex-1 py-3">
                  {/* Connecting line */}
                  <div className="absolute left-0 right-0 top-1/2 h-px bg-slate-700/60" />
                  {milestones.map((m) => {
                    const pct = (dayjs(m.calculated_date!).diff(rangeStart, 'day') / totalDays) * 100
                    return (
                      <div
                        key={m.id}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group"
                        style={{ left: `${pct}%` }}
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full border-2 border-slate-800 cursor-pointer"
                          style={{ backgroundColor: STATUS_COLORS[m.status] }}
                        />
                        <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-white z-10">
                          {PLANNING_MILESTONE_LABELS[m.milestone_type]} · {dayjs(m.calculated_date).format('DD/MM/YY')}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-5 py-2.5 border-t border-slate-700/60 text-[10px] text-slate-400">
        {(Object.entries(STATUS_COLORS) as [PlanningMilestoneStatus, string][]).map(([status, color]) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            {{ pending: 'Pendiente', in_progress: 'En curso', done: 'Hecho', delayed: 'Demorado' }[status]}
          </span>
        ))}
      </div>
    </div>
  )
}
