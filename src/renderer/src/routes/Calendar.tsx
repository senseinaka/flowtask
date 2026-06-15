import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, RefreshCw, Loader2, CalendarPlus, ChevronLeft, ChevronRight, List } from 'lucide-react'
import dayjs, { Dayjs } from 'dayjs'
import 'dayjs/locale/es'
dayjs.locale('es')

import type { UnifiedCalendarEvent, CalendarEventSource } from '@shared/types'
import { useCalendarStatus, useCalendarEvents, useConnectGoogle, useSyncNow } from '../hooks/useCalendar'
import { cn } from '../components/ui/utils'

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

type ViewMode = 'month' | 'week' | 'day' | 'agenda'

const SOURCE_COLORS: Record<CalendarEventSource, string> = {
  google: '#3b82f6',
  finance: '#10b981',
  company_finance: '#f59e0b',
  comex_planning: '#06b6d4'
}

const SOURCE_LABELS: Record<CalendarEventSource, string> = {
  google: 'Google Calendar',
  finance: 'Finanzas Personal',
  company_finance: 'Finanzas Empresa',
  comex_planning: 'Comex - Programación Pedidos'
}

function eventColor(ev: UnifiedCalendarEvent): string {
  return SOURCE_COLORS[ev.source] ?? '#64748b'
}

function formatLastSync(ts: number | null): string {
  if (!ts) return 'Nunca'
  return dayjs(ts).format('DD/MM HH:mm')
}

export default function Calendar() {
  const navigate = useNavigate()
  const { data: status, isLoading: statusLoading } = useCalendarStatus()
  const connectGoogle = useConnectGoogle()
  const syncNow = useSyncNow()

  const [view, setView] = useState<ViewMode>('month')
  const [cursor, setCursor] = useState<Dayjs>(() => dayjs().startOf('month'))
  const [activeFilters, setActiveFilters] = useState<Set<CalendarEventSource>>(
    new Set(['google', 'finance', 'company_finance', 'comex_planning'])
  )

  const { rangeStart, rangeEnd, days } = useMemo(() => {
    if (view === 'month') {
      const start = cursor.startOf('month')
      const end = cursor.endOf('month')
      const startOffset = (start.day() + 6) % 7
      const endOffset = (7 - ((end.day() + 6) % 7) - 1 + 7) % 7
      const gridStart = start.subtract(startOffset, 'day')
      const gridEnd = end.add(endOffset, 'day')
      const result: Dayjs[] = []
      let c = gridStart
      while (c.isBefore(gridEnd) || c.isSame(gridEnd, 'day')) {
        result.push(c)
        c = c.add(1, 'day')
      }
      return { rangeStart: gridStart, rangeEnd: gridEnd, days: result }
    }
    if (view === 'week') {
      const start = cursor.startOf('week').add(1, 'day') // lunes
      const result = Array.from({ length: 7 }, (_, i) => start.add(i, 'day'))
      return { rangeStart: start, rangeEnd: start.add(6, 'day'), days: result }
    }
    if (view === 'day') {
      return { rangeStart: cursor, rangeEnd: cursor, days: [cursor] }
    }
    // agenda: próximos 30 días
    const start = cursor.startOf('day')
    const end = start.add(30, 'day')
    return { rangeStart: start, rangeEnd: end, days: [] }
  }, [view, cursor])

  const { data: events = [], isLoading: eventsLoading, isFetching } = useCalendarEvents({
    start: rangeStart.startOf('day').valueOf(),
    end: rangeEnd.endOf('day').valueOf()
  })

  const filteredEvents = useMemo(
    () => events.filter((ev) => activeFilters.has(ev.source)),
    [events, activeFilters]
  )

  const eventsByDay = useMemo(() => {
    const map = new Map<string, UnifiedCalendarEvent[]>()
    for (const ev of filteredEvents) {
      const key = dayjs(ev.start_at).format('YYYY-MM-DD')
      const list = map.get(key) ?? []
      list.push(ev)
      map.set(key, list)
    }
    return map
  }, [filteredEvents])

  function toggleFilter(source: CalendarEventSource) {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(source)) next.delete(source)
      else next.add(source)
      return next
    })
  }

  function handleEventClick(ev: UnifiedCalendarEvent) {
    if (ev.link) navigate(ev.link)
  }

  function goPrev() {
    if (view === 'month') setCursor((c) => c.subtract(1, 'month'))
    else if (view === 'week') setCursor((c) => c.subtract(1, 'week'))
    else setCursor((c) => c.subtract(1, 'day'))
  }

  function goNext() {
    if (view === 'month') setCursor((c) => c.add(1, 'month'))
    else if (view === 'week') setCursor((c) => c.add(1, 'week'))
    else setCursor((c) => c.add(1, 'day'))
  }

  function goToday() {
    setCursor(dayjs().startOf('month'))
  }

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-slate-500" />
      </div>
    )
  }

  // ── Empty state: no conectado ────────────────────────────────────────────
  if (!status?.connected) {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center max-w-md">
          <CalendarDays size={40} className="text-slate-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">Calendario / Agenda</h2>
          <p className="text-slate-400 text-sm mb-6">
            Conectá tu cuenta de Google Calendar para ver tus eventos junto con
            vencimientos de Finanzas y la programación de pedidos de Comex,
            todo en un solo lugar.
          </p>
          <button
            onClick={() => connectGoogle.mutate()}
            disabled={connectGoogle.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {connectGoogle.isPending
              ? <Loader2 size={16} className="animate-spin" />
              : <CalendarPlus size={16} />}
            Conectar Google Calendar
          </button>
          {connectGoogle.isError && (
            <p className="text-red-400 text-xs mt-3">
              {(connectGoogle.error as Error).message}
            </p>
          )}
        </div>
      </div>
    )
  }

  // ── Conectado ─────────────────────────────────────────────────────────────
  return (
    <div className="p-6 h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={20} className="text-indigo-400" />
          <h1 className="text-lg font-semibold text-white">Calendario</h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            Última sincronización: {formatLastSync(status.lastSyncAt)}
          </span>
          <button
            onClick={() => syncNow.mutate()}
            disabled={syncNow.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {(syncNow.isPending || isFetching)
              ? <Loader2 size={13} className="animate-spin" />
              : <RefreshCw size={13} />}
            Sincronizar ahora
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {(Object.keys(SOURCE_LABELS) as CalendarEventSource[]).map((source) => (
          <button
            key={source}
            onClick={() => toggleFilter(source)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
              activeFilters.has(source)
                ? 'border-transparent text-white'
                : 'border-slate-700 text-slate-500 bg-transparent'
            )}
            style={activeFilters.has(source) ? { backgroundColor: SOURCE_COLORS[source] } : undefined}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: activeFilters.has(source) ? 'rgba(255,255,255,0.7)' : SOURCE_COLORS[source] }}
            />
            {SOURCE_LABELS[source]}
          </button>
        ))}
      </div>

      {/* View selector + navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={goPrev} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400">
            <ChevronLeft size={16} />
          </button>
          <button onClick={goToday} className="px-2 py-1 text-xs rounded-lg hover:bg-slate-700 text-slate-400">
            Hoy
          </button>
          <button onClick={goNext} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400">
            <ChevronRight size={16} />
          </button>
          <span className="ml-2 text-sm font-medium text-white capitalize">
            {view === 'agenda' ? 'Próximos 30 días' : cursor.format('MMMM YYYY')}
          </span>
        </div>

        <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1">
          {(['month', 'week', 'day', 'agenda'] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-colors capitalize',
                view === v ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              {v === 'month' ? 'Mes' : v === 'week' ? 'Semana' : v === 'day' ? 'Día' : 'Agenda'}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {eventsLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={20} className="animate-spin text-slate-500" />
          </div>
        ) : view === 'agenda' ? (
          <AgendaView events={filteredEvents} onEventClick={handleEventClick} />
        ) : (
          <MonthGrid days={days} eventsByDay={eventsByDay} onEventClick={handleEventClick} cursor={cursor} view={view} />
        )}
      </div>
    </div>
  )
}

// ── Month/Week/Day grid ──────────────────────────────────────────────────────

function MonthGrid({
  days, eventsByDay, onEventClick, cursor, view
}: {
  days: Dayjs[]
  eventsByDay: Map<string, UnifiedCalendarEvent[]>
  onEventClick: (ev: UnifiedCalendarEvent) => void
  cursor: Dayjs
  view: ViewMode
}) {
  const cols = view === 'day' ? 1 : 7

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      {cols === 7 && (
        <div className="grid grid-cols-7 border-b border-slate-700/60">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-xs font-semibold text-slate-500 text-center">{d}</div>
          ))}
        </div>
      )}
      <div className={cn('grid', cols === 7 ? 'grid-cols-7' : 'grid-cols-1')}>
        {days.map((day) => {
          const key = day.format('YYYY-MM-DD')
          const dayEvents = eventsByDay.get(key) ?? []
          const isToday = day.isSame(dayjs(), 'day')
          const inMonth = view !== 'month' || day.isSame(cursor, 'month')

          return (
            <div
              key={key}
              className={cn(
                'border-b border-r border-slate-700/40 p-2 min-h-[100px]',
                !inMonth && 'bg-slate-900/40'
              )}
            >
              <div className={cn(
                'text-xs font-medium mb-1 inline-flex items-center justify-center',
                isToday ? 'bg-indigo-600 text-white rounded-full w-5 h-5' : (inMonth ? 'text-slate-400' : 'text-slate-600')
              )}>
                {day.format('D')}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, view === 'day' ? undefined : 4).map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick(ev)}
                    title={ev.title}
                    disabled={!ev.link}
                    className={cn(
                      'block w-full text-left text-[11px] px-1.5 py-0.5 rounded truncate text-white',
                      ev.link && 'cursor-pointer hover:opacity-80'
                    )}
                    style={{ backgroundColor: eventColor(ev) }}
                  >
                    {!ev.all_day && `${dayjs(ev.start_at).format('HH:mm')} `}
                    {ev.title}
                  </button>
                ))}
                {view !== 'day' && dayEvents.length > 4 && (
                  <p className="text-[10px] text-slate-500 px-1.5">+{dayEvents.length - 4} más</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Agenda (list) view ───────────────────────────────────────────────────────

function AgendaView({ events, onEventClick }: { events: UnifiedCalendarEvent[]; onEventClick: (ev: UnifiedCalendarEvent) => void }) {
  const byDay = useMemo(() => {
    const map = new Map<string, UnifiedCalendarEvent[]>()
    for (const ev of events) {
      const key = dayjs(ev.start_at).format('YYYY-MM-DD')
      const list = map.get(key) ?? []
      list.push(ev)
      map.set(key, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [events])

  if (byDay.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
        <List size={32} className="text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 font-medium">Sin eventos en los próximos 30 días</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {byDay.map(([date, dayEvents]) => (
        <div key={date} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-700/60 text-sm font-medium text-white capitalize">
            {dayjs(date).format('dddd D [de] MMMM')}
          </div>
          <div className="divide-y divide-slate-700/40">
            {dayEvents.map((ev) => (
              <button
                key={ev.id}
                onClick={() => onEventClick(ev)}
                disabled={!ev.link}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
                  ev.link && 'hover:bg-slate-700/40 cursor-pointer'
                )}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: eventColor(ev) }} />
                <span className="text-xs text-slate-500 w-12 flex-shrink-0">
                  {ev.all_day ? 'Todo el día' : dayjs(ev.start_at).format('HH:mm')}
                </span>
                <span className="text-sm text-slate-200 truncate">{ev.title}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
