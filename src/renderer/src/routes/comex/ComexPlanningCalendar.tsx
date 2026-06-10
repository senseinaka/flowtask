import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import dayjs, { Dayjs } from 'dayjs'
import 'dayjs/locale/es'
dayjs.locale('es')

import { PLANNING_MILESTONE_LABELS, PLANNING_RISK_COLORS } from '@shared/types'
import type { ImportOrderPlanning } from '@shared/types'
import { cn } from '../../components/ui/utils'

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

interface CalendarEvent {
  planningId: string
  brandName: string
  label: string
  color: string
}

export default function ComexPlanningCalendar({ plannings }: { plannings: ImportOrderPlanning[] }) {
  const navigate = useNavigate()
  const [month, setMonth] = useState<Dayjs>(() => dayjs().startOf('month'))

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const planning of plannings) {
      const color = PLANNING_RISK_COLORS[planning.risk_status]
      const brandName = planning.brand?.name ?? '—'
      for (const milestone of planning.milestones ?? []) {
        if (!milestone.calculated_date) continue
        const key = dayjs(milestone.calculated_date).format('YYYY-MM-DD')
        const list = map.get(key) ?? []
        list.push({
          planningId: planning.id,
          brandName,
          label: PLANNING_MILESTONE_LABELS[milestone.milestone_type],
          color
        })
        map.set(key, list)
      }
    }
    return map
  }, [plannings])

  const days = useMemo(() => {
    const start = month.startOf('month')
    const end = month.endOf('month')
    const startOffset = (start.day() + 6) % 7 // lunes = 0
    const endOffset = (7 - ((end.day() + 6) % 7) - 1 + 7) % 7
    const gridStart = start.subtract(startOffset, 'day')
    const gridEnd = end.add(endOffset, 'day')

    const result: Dayjs[] = []
    let cursor = gridStart
    while (cursor.isBefore(gridEnd) || cursor.isSame(gridEnd, 'day')) {
      result.push(cursor)
      cursor = cursor.add(1, 'day')
    }
    return result
  }, [month])

  const today = dayjs().format('YYYY-MM-DD')

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <CalendarDays size={15} className="text-cyan-400" />
          <h3 className="text-sm font-semibold text-white capitalize">{month.format('MMMM YYYY')}</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonth((m) => m.subtract(1, 'month'))}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setMonth(dayjs().startOf('month'))}
            className="px-2.5 py-1 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={() => setMonth((m) => m.add(1, 'month'))}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-slate-700/60">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-500 text-center">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = day.format('YYYY-MM-DD')
          const events = eventsByDay.get(key) ?? []
          const isCurrentMonth = day.isSame(month, 'month')
          const isToday = key === today

          return (
            <div
              key={key}
              className={cn(
                'min-h-[6.5rem] border-b border-r border-slate-700/40 p-1.5 last-of-type:border-r-0',
                !isCurrentMonth && 'bg-slate-900/40'
              )}
            >
              <span
                className={cn(
                  'inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px]',
                  isToday ? 'bg-cyan-500 text-white font-semibold' : isCurrentMonth ? 'text-slate-300' : 'text-slate-600'
                )}
              >
                {day.format('D')}
              </span>
              <div className="mt-1 space-y-1">
                {events.slice(0, 3).map((ev, i) => (
                  <button
                    key={i}
                    onClick={() => navigate(`/comex/plannings/${ev.planningId}`)}
                    title={`${ev.brandName} — ${ev.label}`}
                    className="block w-full text-left px-1.5 py-0.5 rounded text-[10px] truncate hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: `${ev.color}22`, color: ev.color }}
                  >
                    {ev.brandName} · {ev.label}
                  </button>
                ))}
                {events.length > 3 && (
                  <span className="block px-1.5 text-[10px] text-slate-500">+{events.length - 3} más</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
