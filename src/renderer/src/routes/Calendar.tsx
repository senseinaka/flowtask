import { useMemo, useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, RefreshCw, Loader2, CalendarPlus, ChevronLeft, ChevronRight, List, Plus, Trash2, X, MapPin, Navigation, Copy, Maximize2, Minimize2 } from 'lucide-react'
import dayjs, { Dayjs } from 'dayjs'
import 'dayjs/locale/es'
dayjs.locale('es')

import type { UnifiedCalendarEvent, CalendarEventSource, CalendarEventInput, GoogleCalendarInfo, CalendarWaReminder } from '@shared/types'
import {
  useCalendarStatus, useCalendarEvents, useConnectGoogle, useSyncNow, useEnabledCalendars,
  useCreateManualEvent, useUpdateManualEvent, useDeleteManualEvent
} from '../hooks/useCalendar'
import { useContacts } from '../hooks/useContacts'
import { usePersonalContact } from '../hooks/useSettings'
import { cn } from '../components/ui/utils'

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] // 0=Lun … 6=Dom

type ViewMode = 'month' | 'week' | 'day' | 'agenda'

const SOURCE_COLORS: Record<CalendarEventSource, string> = {
  google: '#3b82f6',
  finance: '#10b981',
  company_finance: '#f59e0b',
  comex_planning: '#06b6d4'
}

const SOURCE_LABELS: Record<CalendarEventSource, string> = {
  google: 'Google Calendar',
  finance: 'Contable',
  company_finance: 'Finanzas Empresa',
  comex_planning: 'Comex - Programación Pedidos'
}

function getEventColor(ev: UnifiedCalendarEvent, calendarColorMap: Map<string, string>): string {
  if (ev.source === 'google') return calendarColorMap.get(ev.category) ?? SOURCE_COLORS.google
  return SOURCE_COLORS[ev.source] ?? '#64748b'
}

function formatLastSync(ts: number | null): string {
  if (!ts) return 'Nunca'
  return dayjs(ts).format('DD/MM HH:mm')
}

type ModalState =
  | { mode: 'create'; date: Dayjs }
  | { mode: 'edit'; event: UnifiedCalendarEvent }
  | { mode: 'day-zoom'; date: Dayjs }

export default function Calendar() {
  const navigate = useNavigate()
  const { data: status, isLoading: statusLoading } = useCalendarStatus()
  const connectGoogle = useConnectGoogle()
  const syncNow = useSyncNow()
  const { data: calendars = [] } = useEnabledCalendars(!!status?.connected)
  const [modal, setModal] = useState<ModalState | null>(null)

  const [view, setView] = useState<ViewMode>('month')
  const [cursor, setCursor] = useState<Dayjs>(() => dayjs().startOf('month'))
  const [activeFilters, setActiveFilters] = useState<Set<CalendarEventSource>>(
    new Set(['google', 'finance', 'company_finance', 'comex_planning'])
  )
  const [activeGoogleCalendars, setActiveGoogleCalendars] = useState<Set<string>>(new Set())
  const googleCalendarsInitialized = useRef(false)

  useEffect(() => {
    if (calendars.length > 0 && !googleCalendarsInitialized.current) {
      setActiveGoogleCalendars(new Set(calendars.map((c) => c.id)))
      googleCalendarsInitialized.current = true
    }
  }, [calendars])

  const lastWheelRef = useRef(0)
  const calendarGridRef = useRef<HTMLDivElement>(null)

  const navBlocked = modal?.mode === 'create' || modal?.mode === 'edit'

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (navBlocked) return
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if (e.key === 'ArrowLeft')  { e.preventDefault(); goPrev() }
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext() }
      if (e.key === 'ArrowUp')    { e.preventDefault(); goPrev() }
      if (e.key === 'ArrowDown')  { e.preventDefault(); goNext() }
      if (e.key === 't' || e.key === 'T') goToday()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navBlocked, view])

  useEffect(() => {
    const el = calendarGridRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      if (navBlocked) return
      const now = Date.now()
      if (now - lastWheelRef.current < 300) return
      lastWheelRef.current = now
      e.preventDefault()
      if (e.deltaY > 0) goNext()
      else goPrev()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [navBlocked, view])

  const calendarColorMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const cal of calendars) {
      if (cal.backgroundColor) map.set(cal.id, cal.backgroundColor)
    }
    return map
  }, [calendars])

  function soloGoogleCalendar(calId: string) {
    if (!activeFilters.has('google')) {
      setActiveFilters((prev) => { const n = new Set(prev); n.add('google'); return n })
    }
    setActiveGoogleCalendars((prev) => {
      // Already solo on this calendar → restore all
      if (prev.size === 1 && prev.has(calId)) return new Set(calendars.map((c) => c.id))
      return new Set([calId])
    })
  }

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
    () => events.filter((ev) => {
      if (!activeFilters.has(ev.source)) return false
      if (ev.source === 'google') return activeGoogleCalendars.has(ev.category)
      return true
    }),
    [events, activeFilters, activeGoogleCalendars]
  )

  const eventsByDay = useMemo(() => {
    const map = new Map<string, UnifiedCalendarEvent[]>()
    for (const ev of filteredEvents) {
      const startDay = dayjs(ev.start_at).startOf('day')
      let endDay = startDay
      if (ev.end_at) {
        const raw = dayjs(ev.end_at)
        // All-day events from Google use exclusive end (day after last), subtract 1
        endDay = ev.all_day ? raw.startOf('day').subtract(1, 'day') : raw.startOf('day')
        if (endDay.isBefore(startDay)) endDay = startDay
      }
      let cur = startDay
      let safety = 0
      while (!cur.isAfter(endDay) && safety < 60) {
        const k = cur.format('YYYY-MM-DD')
        const list = map.get(k) ?? []
        list.push(ev)
        map.set(k, list)
        cur = cur.add(1, 'day')
        safety++
      }
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
    if (ev.source === 'google') setModal({ mode: 'edit', event: ev })
    else if (ev.link) navigate(ev.link)
  }

  function handleDayClick(day: Dayjs) {
    setModal({ mode: 'day-zoom', date: day })
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
          <button
            onClick={() => setModal({ mode: 'create', date: dayjs() })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Plus size={13} />
            Nuevo evento
          </button>
        </div>
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
      <div className="flex-1 flex gap-4 min-h-0">
        <CalendarSidebar
          calendars={calendars}
          activeFilters={activeFilters}
          activeGoogleCalendars={activeGoogleCalendars}
          onToggleFilter={toggleFilter}
          onSoloGoogleCalendar={soloGoogleCalendar}
        />
        <div ref={calendarGridRef} className="flex-1 overflow-auto">
          {eventsLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 size={20} className="animate-spin text-slate-500" />
            </div>
          ) : view === 'agenda' ? (
            <AgendaView events={filteredEvents} onEventClick={handleEventClick} calendarColorMap={calendarColorMap} />
          ) : (
            <MonthGrid days={days} eventsByDay={eventsByDay} onEventClick={handleEventClick} onDayClick={handleDayClick} cursor={cursor} view={view} calendarColorMap={calendarColorMap} />
          )}
        </div>
      </div>

      {modal?.mode === 'day-zoom' && (
        <DayZoomModal
          date={modal.date}
          events={eventsByDay.get(modal.date.format('YYYY-MM-DD')) ?? []}
          calendarColorMap={calendarColorMap}
          onClose={() => setModal(null)}
          onCreateEvent={(d) => setModal({ mode: 'create', date: d })}
          onEventClick={handleEventClick}
        />
      )}
      {(modal?.mode === 'create' || modal?.mode === 'edit') && (
        <EventModal
          modal={modal}
          calendars={calendars}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

// ── Month/Week/Day grid ──────────────────────────────────────────────────────

function MonthGrid({
  days, eventsByDay, onEventClick, onDayClick, cursor, view, calendarColorMap
}: {
  days: Dayjs[]
  eventsByDay: Map<string, UnifiedCalendarEvent[]>
  onEventClick: (ev: UnifiedCalendarEvent) => void
  onDayClick: (day: Dayjs) => void
  cursor: Dayjs
  view: ViewMode
  calendarColorMap: Map<string, string>
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
              onClick={() => onDayClick(day)}
              className={cn(
                'border-b border-r border-slate-700/40 p-2 min-h-[100px] cursor-pointer hover:bg-slate-700/20',
                !inMonth && 'bg-slate-900/40',
                isToday && 'ring-1 ring-inset ring-indigo-500/70 bg-indigo-950/25'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <div className={cn(
                  'text-xs font-semibold inline-flex items-center justify-center w-5 h-5 rounded-full',
                  isToday ? 'bg-indigo-600 text-white' : (inMonth ? 'text-slate-400' : 'text-slate-600')
                )}>
                  {day.format('D')}
                </div>
                {isToday && (
                  <span className="text-[9px] font-bold tracking-widest text-indigo-400 uppercase">HOY</span>
                )}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, view === 'day' ? undefined : 4).map((ev) => {
                  const clickable = !!ev.link || ev.source === 'google'
                  const isStart = dayjs(ev.start_at).format('YYYY-MM-DD') === key
                  const spansDays = !!ev.end_at && dayjs(ev.end_at).startOf('day').isAfter(dayjs(ev.start_at).startOf('day'))
                  return (
                    <button
                      key={ev.id}
                      onClick={(e) => { e.stopPropagation(); onEventClick(ev) }}
                      title={ev.title}
                      disabled={!clickable}
                      className={cn(
                        'block w-full text-left text-[11px] px-1.5 py-0.5 rounded truncate text-white',
                        clickable && 'cursor-pointer hover:opacity-80',
                        !isStart && spansDays && 'rounded-l-none opacity-75'
                      )}
                      style={{ backgroundColor: getEventColor(ev, calendarColorMap) }}
                    >
                      {isStart ? (
                        <>
                          {!ev.all_day && `${dayjs(ev.start_at).format('HH:mm')} `}
                          {ev.title}
                          {spansDays && ' →'}
                        </>
                      ) : (
                        `↦ ${ev.title}`
                      )}
                    </button>
                  )
                })}
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

function AgendaView({ events, onEventClick, calendarColorMap }: { events: UnifiedCalendarEvent[]; onEventClick: (ev: UnifiedCalendarEvent) => void; calendarColorMap: Map<string, string> }) {
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
            {dayEvents.map((ev) => {
              const clickable = !!ev.link || ev.source === 'google'
              return (
              <button
                key={ev.id}
                onClick={() => onEventClick(ev)}
                disabled={!clickable}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
                  clickable && 'hover:bg-slate-700/40 cursor-pointer'
                )}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getEventColor(ev, calendarColorMap) }} />
                <span className="text-xs text-slate-500 w-12 flex-shrink-0">
                  {ev.all_day ? 'Todo el día' : dayjs(ev.start_at).format('HH:mm')}
                </span>
                <span className="text-sm text-slate-200 truncate">{ev.title}</span>
              </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Calendar sidebar ─────────────────────────────────────────────────────────

const SUMMIT_SOURCES: { source: CalendarEventSource; label: string; color: string }[] = [
  { source: 'finance',         label: 'Contable',                     color: SOURCE_COLORS.finance },
  { source: 'company_finance', label: 'Finanzas Empresa',             color: SOURCE_COLORS.company_finance },
  { source: 'comex_planning',  label: 'Comex - Prog. Pedidos',        color: SOURCE_COLORS.comex_planning },
]

function CalendarSidebar({
  calendars,
  activeFilters,
  activeGoogleCalendars,
  onToggleFilter,
  onSoloGoogleCalendar,
}: {
  calendars: GoogleCalendarInfo[]
  activeFilters: Set<CalendarEventSource>
  activeGoogleCalendars: Set<string>
  onToggleFilter: (source: CalendarEventSource) => void
  onSoloGoogleCalendar: (calId: string) => void
}) {
  return (
    <div className="w-44 flex-shrink-0 flex flex-col gap-4 overflow-y-auto">
      {/* Google Calendar section */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-3">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Google Calendar
        </p>
        <div className="space-y-1.5">
          {calendars.map((cal) => {
            const active = activeGoogleCalendars.has(cal.id) && activeFilters.has('google')
            const isSolo = activeGoogleCalendars.size === 1 && activeGoogleCalendars.has(cal.id) && activeFilters.has('google')
            return (
              <button
                key={cal.id}
                onClick={() => onSoloGoogleCalendar(cal.id)}
                title={isSolo ? 'Click para mostrar todos' : 'Click para mostrar solo este'}
                className="flex items-center gap-2 w-full text-left group"
              >
                <span
                  className={cn(
                    'w-3 h-3 rounded-sm flex-shrink-0 border transition-opacity',
                    active ? 'opacity-100' : 'opacity-20'
                  )}
                  style={{ backgroundColor: cal.backgroundColor ?? SOURCE_COLORS.google, borderColor: cal.backgroundColor ?? SOURCE_COLORS.google }}
                />
                <span className={cn(
                  'text-xs truncate transition-colors flex-1',
                  active ? 'text-slate-200' : 'text-slate-500 group-hover:text-slate-400'
                )}>
                  {cal.summary}{cal.primary ? ' ★' : ''}
                </span>
                {isSolo && (
                  <span className="text-[9px] text-indigo-400 font-medium flex-shrink-0">SOLO</span>
                )}
              </button>
            )
          })}
          {calendars.length === 0 && (
            <p className="text-xs text-slate-600 italic">Sin calendarios</p>
          )}
        </div>
      </div>

      {/* Summit section */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-3">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Summit
        </p>
        <div className="space-y-1.5">
          {SUMMIT_SOURCES.map(({ source, label, color }) => {
            const active = activeFilters.has(source)
            return (
              <button
                key={source}
                onClick={() => onToggleFilter(source)}
                className="flex items-center gap-2 w-full text-left group"
              >
                <span
                  className={cn(
                    'w-3 h-3 rounded-sm flex-shrink-0 border transition-opacity',
                    active ? 'opacity-100' : 'opacity-30'
                  )}
                  style={{ backgroundColor: color, borderColor: color }}
                />
                <span className={cn(
                  'text-xs truncate transition-colors',
                  active ? 'text-slate-200' : 'text-slate-500 group-hover:text-slate-400'
                )}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Mini calendario para previsualización multi-día ──────────────────────────

function CalendarStrip({ startDate, endDate }: { startDate: string; endDate: string }) {
  const start = dayjs(startDate)
  const end = dayjs(endDate)
  if (!start.isValid() || !end.isValid()) return null
  if (end.isBefore(start, 'day')) {
    return <p className="text-xs text-red-400">La fecha fin debe ser igual o posterior al inicio</p>
  }
  const totalDays = end.diff(start, 'day') + 1
  if (totalDays <= 1) return null

  const daysInMonth = start.daysInMonth()
  const firstDow = start.startOf('month').day() // 0=Dom
  const DOW = ['D','L','M','X','J','V','S']

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
      <p className="text-[11px] text-slate-400 mb-2 capitalize">{start.format('MMMM YYYY')}</p>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DOW.map(d => <div key={d} className="text-center text-[9px] text-slate-600">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstDow }, (_, i) => <div key={`p${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const d = start.startOf('month').add(i, 'day')
          const inRange = (d.isAfter(start, 'day') || d.isSame(start, 'day')) && (d.isBefore(end, 'day') || d.isSame(end, 'day'))
          const isEdge = d.isSame(start, 'day') || d.isSame(end, 'day')
          return (
            <div key={i} className={cn(
              'text-center text-[10px] py-0.5 rounded-sm',
              isEdge ? 'bg-indigo-600 text-white font-medium' : inRange ? 'bg-indigo-900/40 text-indigo-300' : 'text-slate-600'
            )}>
              {i + 1}
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-slate-400 mt-2">
        {totalDays} días · {start.format('D MMM')} → {end.format('D MMM')}
      </p>
    </div>
  )
}

// ── Modal zoom de día ───────────────────────────────────────────────────────

function DayZoomModal({
  date, events, calendarColorMap, onClose, onCreateEvent, onEventClick
}: {
  date: Dayjs
  events: UnifiedCalendarEvent[]
  calendarColorMap: Map<string, string>
  onClose: () => void
  onCreateEvent: (date: Dayjs) => void
  onEventClick: (ev: UnifiedCalendarEvent) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const sorted = [...events].sort((a, b) => {
    const aAllDay = a.all_day ? 1 : 0
    const bAllDay = b.all_day ? 1 : 0
    if (aAllDay !== bAllDay) return bAllDay - aAllDay
    return a.start_at - b.start_at
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-slate-800 border border-slate-700 rounded-xl shadow-2xl flex flex-col transition-all duration-200',
          expanded
            ? 'w-[calc(100vw-2rem)] h-[calc(100vh-2rem)]'
            : 'w-full max-w-xl mx-4 max-h-[80vh]'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div>
            <p className="text-xs text-slate-500 capitalize">{date.format('dddd')}</p>
            <h2 className="text-lg font-semibold text-white capitalize">
              {date.format('D [de] MMMM [de] YYYY')}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-slate-700"
              title={expanded ? 'Reducir' : 'Ampliar'}
            >
              {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-slate-700"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-700/50">
          {sorted.length === 0 ? (
            <p className="py-10 text-center text-slate-500 text-sm">Sin eventos para este día</p>
          ) : sorted.map((ev) => {
            const color = getEventColor(ev, calendarColorMap)
            const time = ev.all_day ? 'Todo el día' : dayjs(ev.start_at).format('HH:mm')
            const endTime = (!ev.all_day && ev.end_at) ? dayjs(ev.end_at).format('HH:mm') : null
            const clickable = !!ev.link || ev.source === 'google'
            return (
              <button
                key={ev.id}
                disabled={!clickable}
                onClick={() => { if (clickable) { onEventClick(ev); onClose() } }}
                className="w-full text-left px-5 py-3.5 flex items-start gap-3 hover:bg-slate-700/40 transition-colors disabled:cursor-default"
              >
                <div
                  className="flex-shrink-0 w-1 self-stretch rounded-full"
                  style={{ backgroundColor: color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white leading-tight">{ev.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-slate-400">
                      {time}{endTime ? ` - ${endTime}` : ''}
                    </span>
                    <span className="text-[10px] text-slate-500">{SOURCE_LABELS[ev.source]}</span>
                  </div>
                  {ev.description && (
                    <p className="text-xs text-slate-500 mt-1 truncate">{ev.description}</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        <div className="px-5 py-3 border-t border-slate-700">
          <button
            onClick={() => onCreateEvent(date)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={15} />
            Nuevo evento en este día
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal crear/editar/borrar evento manual ─────────────────────────────────

function EventModal({
  modal, calendars, onClose
}: {
  modal: ModalState
  calendars: GoogleCalendarInfo[]
  onClose: () => void
}) {
  const isEdit = modal.mode === 'edit'
  type EventMode = 'standard' | 'multiday' | 'recurring'

  const initial = useMemo(() => {
    if (modal.mode === 'edit') {
      const start = dayjs(modal.event.start_at)
      const end = modal.event.end_at ? dayjs(modal.event.end_at) : start.add(1, 'hour')
      const idParts = modal.event.id.split(':')
      const startDateStr = start.format('YYYY-MM-DD')
      const endDateStr = end.format('YYYY-MM-DD')
      return {
        title: modal.event.title,
        description: modal.event.description ?? '',
        location: modal.event.location ?? '',
        allDay: modal.event.all_day,
        date: startDateStr,
        endDate: endDateStr,
        startTime: start.format('HH:mm'),
        endTime: end.format('HH:mm'),
        calendarId: modal.event.category,
        googleEventId: idParts.slice(1).join(':'),
        mode: (endDateStr !== startDateStr ? 'multiday' : 'standard') as EventMode
      }
    }
    return {
      title: '',
      description: '',
      location: '',
      allDay: false,
      date: modal.date.format('YYYY-MM-DD'),
      endDate: modal.date.format('YYYY-MM-DD'),
      startTime: '09:00',
      endTime: '10:00',
      calendarId: calendars.find((c) => c.primary)?.id ?? calendars[0]?.id ?? '',
      googleEventId: '',
      mode: 'standard' as EventMode
    }
  }, [modal, calendars])

  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [location, setLocation] = useState(initial.location)
  const [allDay, setAllDay] = useState(initial.allDay)
  const [date, setDate] = useState(initial.date)
  const [endDate, setEndDate] = useState(initial.endDate)
  const [startTime, setStartTime] = useState(initial.startTime)
  const [endTime, setEndTime] = useState(initial.endTime)
  const [calendarId, setCalendarId] = useState(initial.calendarId)
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null)
  const [waPhone, setWaPhone] = useState('')
  const [waCustomPhone, setWaCustomPhone] = useState('')
  const [waReminderMinutes, setWaReminderMinutes] = useState<number | null>(null)
  const [existingWaReminder, setExistingWaReminder] = useState<CalendarWaReminder | null>(null)
  const [eventMode, setEventMode] = useState<EventMode>(initial.mode)

  // Estado modo recurrente
  const [recDays, setRecDays] = useState<Set<number>>(new Set())
  const [recStartTime, setRecStartTime] = useState('09:00')
  const [recEndTime, setRecEndTime] = useState('18:00')
  const [recFromDate, setRecFromDate] = useState(initial.date)
  const [recWeeks, setRecWeeks] = useState(4)

  const { data: contacts = [] } = useContacts()
  const { data: personalContact } = usePersonalContact()

  const waContactName = useMemo(() => {
    if (!existingWaReminder) return null
    const phone = existingWaReminder.phone
    if (personalContact?.whatsapp_number === phone) return personalContact.name || phone
    return contacts.find(c => c.phone === phone)?.name ?? phone
  }, [existingWaReminder?.phone, contacts, personalContact])

  useEffect(() => {
    if (personalContact?.whatsapp_number && !waPhone) {
      setWaPhone(personalContact.whatsapp_number)
    }
  }, [personalContact?.whatsapp_number])

  useEffect(() => {
    if (!isEdit || modal.mode !== 'edit') return
    window.api.calendar.getWaReminder(modal.event.id).then(setExistingWaReminder)
  }, [])

  const recurringInstances = useMemo(() => {
    if (recDays.size === 0 || recWeeks < 1) return []
    // Use noon to avoid any midnight DST edge cases
    const fromDate = new Date(recFromDate + 'T12:00:00')
    const fromDow = (fromDate.getDay() + 6) % 7 // 0=Lun…6=Dom
    const instances: Date[] = []
    for (const dayIndex of [...recDays].sort()) {
      // Days until first occurrence of this weekday on or after recFromDate
      const offset = (dayIndex - fromDow + 7) % 7
      const first = new Date(fromDate)
      first.setDate(fromDate.getDate() + offset)
      for (let w = 0; w < recWeeks; w++) {
        const d = new Date(first)
        d.setDate(first.getDate() + w * 7)
        instances.push(d)
      }
    }
    return instances.sort((a, b) => a.getTime() - b.getTime())
  }, [recDays, recFromDate, recWeeks])

  function toggleRecDay(i: number) {
    setRecDays(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  const effectiveWaPhone = waPhone === '__custom__' ? waCustomPhone : waPhone

  const waFeedback = useMemo(() => {
    if (!effectiveWaPhone.trim() || waReminderMinutes === null) return null
    const startAt = allDay
      ? dayjs(date).startOf('day').valueOf()
      : dayjs(`${date} ${startTime}`).valueOf()
    const sendAt = startAt - waReminderMinutes * 60_000
    if (sendAt <= Date.now()) return { ok: false, msg: 'El evento ya pasó, no se enviará el recordatorio WA' }
    const sendTime = dayjs(sendAt).format('DD/MM HH:mm')
    return { ok: true, msg: `WA se enviará el ${sendTime} a ${effectiveWaPhone}` }
  }, [effectiveWaPhone, waReminderMinutes, allDay, date, startTime])

  const createEvent = useCreateManualEvent()
  const updateEvent = useUpdateManualEvent()
  const deleteEvent = useDeleteManualEvent()
  const [isBatchCreating, setIsBatchCreating] = useState(false)

  const isSaving = createEvent.isPending || updateEvent.isPending || isBatchCreating
  const error = createEvent.error || updateEvent.error || deleteEvent.error

  function buildInput(): CalendarEventInput {
    const startAt = allDay
      ? dayjs(date).startOf('day').valueOf()
      : dayjs(`${date} ${startTime}`).valueOf()
    const endAt = allDay
      ? null
      : eventMode === 'multiday'
        ? dayjs(`${endDate} ${endTime}`).valueOf()
        : dayjs(`${date} ${endTime}`).valueOf()
    return {
      summary: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      startAt,
      endAt,
      allDay,
      reminderMinutes
    }
  }

  async function handleSave() {
    if (!title.trim() || !calendarId) return

    if (eventMode === 'recurring') {
      if (recurringInstances.length === 0) return
      const [sh, sm] = recStartTime.split(':').map(Number)
      const [eh, em] = recEndTime.split(':').map(Number)
      setIsBatchCreating(true)
      try {
        for (const inst of recurringInstances) {
          const startAt = dayjs(inst).hour(sh).minute(sm).second(0).valueOf()
          const endAt   = dayjs(inst).hour(eh).minute(em).second(0).valueOf()
          await createEvent.mutateAsync({
            calendarId,
            input: {
              summary: title.trim(),
              description: description.trim() || null,
              location: location.trim() || null,
              startAt,
              endAt,
              allDay: false,
              reminderMinutes
            }
          })
        }
      } finally {
        setIsBatchCreating(false)
      }
      onClose()
      return
    }

    const input = buildInput()
    if (isEdit && modal.mode === 'edit') {
      await updateEvent.mutateAsync({ calendarId, googleEventId: initial.googleEventId, input })
      if (effectiveWaPhone.trim() && waReminderMinutes !== null) {
        const sendAt = input.startAt - waReminderMinutes * 60_000
        const timeLabel = waReminderMinutes === 0
          ? 'ahora'
          : waReminderMinutes >= 60
            ? `${waReminderMinutes / 60}h`
            : `${waReminderMinutes}min`
        const msg = `🗓 Recordatorio: *${title.trim()}*\nEn ${timeLabel}${location.trim() ? `\n📍 ${location.trim()}` : ''}`
        await window.api.calendar.scheduleWaReminder(modal.event.id, effectiveWaPhone.trim(), msg, sendAt)
      }
    } else {
      const ev = await createEvent.mutateAsync({ calendarId, input })
      if (effectiveWaPhone.trim() && waReminderMinutes !== null) {
        const sendAt = input.startAt - waReminderMinutes * 60_000
        const timeLabel = waReminderMinutes === 0
          ? 'ahora'
          : waReminderMinutes >= 60
            ? `${waReminderMinutes / 60}h`
            : `${waReminderMinutes}min`
        const msg = `🗓 Recordatorio: *${title.trim()}*\nEn ${timeLabel}${location.trim() ? `\n📍 ${location.trim()}` : ''}`
        await window.api.calendar.scheduleWaReminder(ev.id, effectiveWaPhone.trim(), msg, sendAt)
      }
    }
    onClose()
  }

  async function handleDelete() {
    if (!isEdit || modal.mode !== 'edit') return
    await deleteEvent.mutateAsync({ calendarId: initial.calendarId, googleEventId: initial.googleEventId })
    onClose()
  }

  const isSaveDisabled = isSaving || !title.trim() || !calendarId
    || (eventMode === 'recurring' && recurringInstances.length === 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h2 className="text-sm font-semibold text-white">
            {isEdit ? 'Editar evento' : 'Nuevo evento'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-700 text-slate-400">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Selector de modo — solo en crear */}
          {!isEdit && (
            <div className="flex gap-1 bg-slate-900 border border-slate-700 rounded-lg p-1">
              {(['standard', 'multiday', 'recurring'] as EventMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setEventMode(m)}
                  className={cn(
                    'flex-1 px-2 py-1 text-xs font-medium rounded-md transition-colors',
                    eventMode === m ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  {m === 'standard' ? 'Estándar' : m === 'multiday' ? 'Multi-día' : 'Recurrente'}
                </button>
              ))}
            </div>
          )}

          {/* Título */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título del evento"
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
              autoFocus
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Ubicación */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Ubicación</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            {location.trim() && (
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => window.api.shell.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.trim())}`)}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 text-[11px] rounded-md transition-colors"
                >
                  <MapPin size={11} /> Google Maps
                </button>
                <button
                  type="button"
                  onClick={() => window.api.shell.open(`https://waze.com/ul?q=${encodeURIComponent(location.trim())}`)}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-400 text-[11px] rounded-md transition-colors"
                >
                  <Navigation size={11} /> Waze
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.trim())}`
                    const waze = `https://waze.com/ul?q=${encodeURIComponent(location.trim())}`
                    navigator.clipboard.writeText(`📍 ${location.trim()}\n🗺 Maps: ${maps}\n🔵 Waze: ${waze}`)
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-400 text-[11px] rounded-md transition-colors"
                >
                  <Copy size={11} /> Copiar para WA
                </button>
              </div>
            )}
          </div>

          {/* ── Sección fecha/hora ── */}
          {eventMode === 'recurring' ? (
            <>
              {/* Días de la semana */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Días de la semana</label>
                <div className="flex gap-1.5">
                  {DAY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleRecDay(i)}
                      className={cn(
                        'w-8 h-8 rounded-full text-xs font-medium transition-colors border',
                        recDays.has(i)
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hora inicio - fin */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Hora inicio</label>
                  <input
                    type="time"
                    value={recStartTime}
                    onChange={(e) => setRecStartTime(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Hora fin</label>
                  <input
                    type="time"
                    value={recEndTime}
                    onChange={(e) => setRecEndTime(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Desde + semanas */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Desde</label>
                  <input
                    type="date"
                    value={recFromDate}
                    onChange={(e) => setRecFromDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Semanas</label>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={recWeeks}
                    onChange={(e) => setRecWeeks(Math.max(1, Math.min(52, Number(e.target.value) || 1)))}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Preview instancias */}
              {recurringInstances.length > 0 ? (
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
                  <p className="text-xs font-medium text-slate-300 mb-1.5">
                    Se crearán {recurringInstances.length} eventos en Google Calendar
                  </p>
                  <div className="max-h-64 overflow-y-auto space-y-0.5 pr-1">
                    {recurringInstances.map((d, i) => (
                      <p key={i} className="text-[11px] text-slate-500 capitalize">
                        {i + 1}. {dayjs(d).format('dddd D [de] MMMM')}
                      </p>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-amber-400">Seleccioná al menos un día de la semana.</p>
              )}
            </>
          ) : (
            // Estándar o Multi-día
            <>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="event-allday"
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900"
                />
                <label htmlFor="event-allday" className="text-xs text-slate-300">Todo el día</label>
              </div>

              {eventMode === 'standard' ? (
                <div className="grid grid-cols-3 gap-2">
                  <div className={allDay ? 'col-span-3' : ''}>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Fecha</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  {!allDay && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Inicio</label>
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) => {
                            const newStart = e.target.value
                            setStartTime(newStart)
                            const [h, m] = newStart.split(':').map(Number)
                            setEndTime(dayjs().hour(h).minute(m).add(1, 'hour').format('HH:mm'))
                          }}
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Fin</label>
                        <input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </>
                  )}
                </div>
              ) : (
                // Multi-día
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Fecha inicio</label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Fecha fin</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  {!allDay && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Hora inicio</label>
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) => {
                            const newStart = e.target.value
                            setStartTime(newStart)
                            const [h, m] = newStart.split(':').map(Number)
                            setEndTime(dayjs().hour(h).minute(m).add(1, 'hour').format('HH:mm'))
                          }}
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Hora fin</label>
                        <input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  )}
                  <CalendarStrip startDate={date} endDate={endDate} />
                </>
              )}
            </>
          )}

          {/* Recordatorio push — siempre */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Recordatorio</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {[
                { label: 'En el evento', value: 0 },
                { label: '10 min', value: 10 },
                { label: '30 min', value: 30 },
                { label: '1 hora', value: 60 },
                { label: '2 horas', value: 120 },
                { label: '1 día', value: 1440 },
              ].map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setReminderMinutes(reminderMinutes === value ? null : value)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-full border transition-colors',
                    reminderMinutes === value
                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Recordatorio WA — solo para estándar y multi-día */}
          {eventMode !== 'recurring' && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Recordatorio WhatsApp
                <span className="ml-1.5 text-slate-600 font-normal">(Evolution API)</span>
              </label>
              <div className="flex gap-2 mt-1">
                <select
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-emerald-500/60 truncate"
                >
                  <option value="">— sin destinatario —</option>
                  {personalContact?.whatsapp_number && (
                    <option value={personalContact.whatsapp_number}>
                      Yo — {personalContact.name || personalContact.whatsapp_number}
                    </option>
                  )}
                  {contacts
                    .filter((c) => c.phone)
                    .map((c) => (
                      <option key={c.id} value={c.phone}>{c.name}</option>
                    ))}
                  <option value="__custom__">Otro (ingresar número)...</option>
                </select>
                <select
                  value={waReminderMinutes ?? ''}
                  onChange={(e) => setWaReminderMinutes(e.target.value !== '' ? Number(e.target.value) : null)}
                  className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-emerald-500/60"
                >
                  <option value="">— sin recordatorio —</option>
                  <option value="0">En el evento</option>
                  <option value="30">30 min antes</option>
                  <option value="60">1 hora antes</option>
                  <option value="120">2 horas antes</option>
                  <option value="1440">1 día antes</option>
                </select>
              </div>
              {waPhone === '__custom__' && (
                <input
                  type="tel"
                  value={waCustomPhone}
                  onChange={(e) => setWaCustomPhone(e.target.value)}
                  placeholder="+54 9 11 1234 5678"
                  className="mt-1.5 w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60"
                />
              )}
              {waFeedback && (
                <p className={cn('text-[11px] mt-1', waFeedback.ok ? 'text-emerald-400' : 'text-amber-400')}>
                  {waFeedback.msg}
                </p>
              )}
              {existingWaReminder && (existingWaReminder.sent_at !== null || !waFeedback) && (
                <div className={cn(
                  'mt-2 px-3 py-2 rounded-lg border flex items-start justify-between gap-2',
                  existingWaReminder.sent_at === null
                    ? 'bg-slate-900 border-amber-800/50'
                    : existingWaReminder.success === 1
                      ? 'bg-slate-900 border-emerald-800/50'
                      : 'bg-slate-900 border-red-800/50'
                )}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-[11px] text-slate-300 font-medium">Recordatorio WA</p>
                      {existingWaReminder.sent_at === null
                        ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-400">Pendiente</span>
                        : existingWaReminder.success === 1
                          ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-400">Enviado</span>
                          : <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/50 text-red-400">Error al enviar</span>
                      }
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {waContactName} — {dayjs(existingWaReminder.send_at).format('DD/MM HH:mm')}
                    </p>
                    {existingWaReminder.sent_at !== null && (
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {existingWaReminder.success === 1 ? 'Enviado' : 'Intentado'} a las {dayjs(existingWaReminder.sent_at).format('HH:mm')}
                      </p>
                    )}
                  </div>
                  {existingWaReminder.sent_at === null && (
                    <button
                      type="button"
                      onClick={async () => {
                        await window.api.calendar.cancelWaReminder(existingWaReminder.event_id)
                        setExistingWaReminder(null)
                      }}
                      className="text-[11px] text-red-400 hover:text-red-300 shrink-0 mt-0.5"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Calendario */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Calendario</label>
            <select
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              disabled={isEdit}
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
            >
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>{c.summary}{c.primary ? ' (principal)' : ''}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-red-400 text-xs">{(error as Error).message}</p>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
          {isEdit ? (
            <button
              onClick={handleDelete}
              disabled={deleteEvent.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {deleteEvent.isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Eliminar
            </button>
          ) : <span />}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaveDisabled}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving && <Loader2 size={13} className="animate-spin" />}
              {eventMode === 'recurring'
                ? `Crear ${recurringInstances.length} evento${recurringInstances.length !== 1 ? 's' : ''}`
                : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
