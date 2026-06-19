import { useMemo, useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, RefreshCw, Loader2, CalendarPlus, ChevronLeft, ChevronRight, List, Plus, Trash2, X, MapPin, Navigation, Copy } from 'lucide-react'
import dayjs, { Dayjs } from 'dayjs'
import 'dayjs/locale/es'
dayjs.locale('es')

import type { UnifiedCalendarEvent, CalendarEventSource, CalendarEventInput, GoogleCalendarInfo } from '@shared/types'
import {
  useCalendarStatus, useCalendarEvents, useConnectGoogle, useSyncNow, useEnabledCalendars,
  useCreateManualEvent, useUpdateManualEvent, useDeleteManualEvent
} from '../hooks/useCalendar'
import { useContacts } from '../hooks/useContacts'
import { usePersonalContact } from '../hooks/useSettings'
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

  const calendarColorMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const cal of calendars) {
      if (cal.backgroundColor) map.set(cal.id, cal.backgroundColor)
    }
    return map
  }, [calendars])

  function toggleGoogleCalendar(calId: string) {
    setActiveGoogleCalendars((prev) => {
      const next = new Set(prev)
      if (next.has(calId)) next.delete(calId)
      else next.add(calId)
      return next
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
    if (ev.source === 'google') setModal({ mode: 'edit', event: ev })
    else if (ev.link) navigate(ev.link)
  }

  function handleDayClick(day: Dayjs) {
    setModal({ mode: 'create', date: day })
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
          onToggleGoogleCalendar={toggleGoogleCalendar}
        />
        <div className="flex-1 overflow-auto">
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

      {modal && (
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
                  return (
                    <button
                      key={ev.id}
                      onClick={(e) => { e.stopPropagation(); onEventClick(ev) }}
                      title={ev.title}
                      disabled={!clickable}
                      className={cn(
                        'block w-full text-left text-[11px] px-1.5 py-0.5 rounded truncate text-white',
                        clickable && 'cursor-pointer hover:opacity-80'
                      )}
                      style={{ backgroundColor: getEventColor(ev, calendarColorMap) }}
                    >
                      {!ev.all_day && `${dayjs(ev.start_at).format('HH:mm')} `}
                      {ev.title}
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
  { source: 'finance',         label: 'Finanzas Personal',            color: SOURCE_COLORS.finance },
  { source: 'company_finance', label: 'Finanzas Empresa',             color: SOURCE_COLORS.company_finance },
  { source: 'comex_planning',  label: 'Comex - Prog. Pedidos',        color: SOURCE_COLORS.comex_planning },
]

function CalendarSidebar({
  calendars,
  activeFilters,
  activeGoogleCalendars,
  onToggleFilter,
  onToggleGoogleCalendar,
}: {
  calendars: GoogleCalendarInfo[]
  activeFilters: Set<CalendarEventSource>
  activeGoogleCalendars: Set<string>
  onToggleFilter: (source: CalendarEventSource) => void
  onToggleGoogleCalendar: (calId: string) => void
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
            return (
              <button
                key={cal.id}
                onClick={() => {
                  if (!activeFilters.has('google')) onToggleFilter('google')
                  onToggleGoogleCalendar(cal.id)
                }}
                className="flex items-center gap-2 w-full text-left group"
              >
                <span
                  className={cn(
                    'w-3 h-3 rounded-sm flex-shrink-0 border transition-opacity',
                    active ? 'opacity-100' : 'opacity-30'
                  )}
                  style={{ backgroundColor: cal.backgroundColor ?? SOURCE_COLORS.google, borderColor: cal.backgroundColor ?? SOURCE_COLORS.google }}
                />
                <span className={cn(
                  'text-xs truncate transition-colors',
                  active ? 'text-slate-200' : 'text-slate-500 group-hover:text-slate-400'
                )}>
                  {cal.summary}{cal.primary ? ' ★' : ''}
                </span>
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

// ── Modal crear/editar/borrar evento manual ─────────────────────────────────

function EventModal({
  modal, calendars, onClose
}: {
  modal: ModalState
  calendars: GoogleCalendarInfo[]
  onClose: () => void
}) {
  const isEdit = modal.mode === 'edit'
  const initial = useMemo(() => {
    if (modal.mode === 'edit') {
      const start = dayjs(modal.event.start_at)
      const end = modal.event.end_at ? dayjs(modal.event.end_at) : start.add(1, 'hour')
      const idParts = modal.event.id.split(':')
      return {
        title: modal.event.title,
        description: modal.event.description ?? '',
        location: modal.event.location ?? '',
        allDay: modal.event.all_day,
        date: start.format('YYYY-MM-DD'),
        startTime: start.format('HH:mm'),
        endTime: end.format('HH:mm'),
        calendarId: modal.event.category,
        googleEventId: idParts.slice(1).join(':')
      }
    }
    return {
      title: '',
      description: '',
      location: '',
      allDay: false,
      date: modal.date.format('YYYY-MM-DD'),
      startTime: '09:00',
      endTime: '10:00',
      calendarId: calendars.find((c) => c.primary)?.id ?? calendars[0]?.id ?? '',
      googleEventId: ''
    }
  }, [modal, calendars])

  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [location, setLocation] = useState(initial.location)
  const [allDay, setAllDay] = useState(initial.allDay)
  const [date, setDate] = useState(initial.date)
  const [startTime, setStartTime] = useState(initial.startTime)
  const [endTime, setEndTime] = useState(initial.endTime)
  const [calendarId, setCalendarId] = useState(initial.calendarId)
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null)
  const [waPhone, setWaPhone] = useState('') // phone number or '__custom__'
  const [waCustomPhone, setWaCustomPhone] = useState('')
  const [waReminderMinutes, setWaReminderMinutes] = useState<number | null>(null)

  const { data: contacts = [] } = useContacts()
  const { data: personalContact } = usePersonalContact()

  useEffect(() => {
    if (personalContact?.whatsapp_number && !waPhone) {
      setWaPhone(personalContact.whatsapp_number)
    }
  }, [personalContact?.whatsapp_number])

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

  const isSaving = createEvent.isPending || updateEvent.isPending
  const error = createEvent.error || updateEvent.error || deleteEvent.error

  function buildInput(): CalendarEventInput {
    const startAt = allDay
      ? dayjs(date).startOf('day').valueOf()
      : dayjs(`${date} ${startTime}`).valueOf()
    const endAt = allDay
      ? null
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
    const input = buildInput()
    if (isEdit && modal.mode === 'edit') {
      await updateEvent.mutateAsync({ calendarId, googleEventId: initial.googleEventId, input })
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

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

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
                    onChange={(e) => setStartTime(e.target.value)}
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
          </div>

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
              disabled={isSaving || !title.trim() || !calendarId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving && <Loader2 size={13} className="animate-spin" />}
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
