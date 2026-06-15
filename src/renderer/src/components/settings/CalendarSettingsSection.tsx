import { useState } from 'react'
import { CalendarDays, Check, Loader2, CalendarPlus, Unlink, RefreshCw } from 'lucide-react'
import {
  useCalendarStatus, useConnectGoogle, useDisconnectGoogle, useSyncNow, useSetEnabledCalendars
} from '../../hooks/useCalendar'

export default function CalendarSettingsSection() {
  const { data: status, isLoading } = useCalendarStatus()
  const connect = useConnectGoogle()
  const disconnect = useDisconnectGoogle()
  const syncNow = useSyncNow()
  const setEnabledCalendars = useSetEnabledCalendars()

  const [calendars, setCalendars] = useState<{ id: string; summary: string }[] | null>(null)
  const [loadingCalendars, setLoadingCalendars] = useState(false)

  async function loadCalendars() {
    setLoadingCalendars(true)
    try {
      const list = await window.api.calendar.listCalendars()
      setCalendars(list)
    } finally {
      setLoadingCalendars(false)
    }
  }

  function toggleCalendar(id: string) {
    if (!status) return
    const current = new Set(status.enabledCalendarIds)
    if (current.has(id)) current.delete(id)
    else current.add(id)
    setEnabledCalendars.mutate(Array.from(current))
  }

  return (
    <section className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays size={18} className="text-indigo-400" />
        <h2 className="font-semibold">Calendario / Agenda</h2>
        {status?.connected && (
          <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400">
            <Check size={12} /> Conectado ({status.googleEmail})
          </span>
        )}
      </div>

      {isLoading ? (
        <Loader2 size={16} className="animate-spin text-slate-500" />
      ) : !status?.connected ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            Conectá tu cuenta de Google Calendar para ver tus eventos en la sección Calendario,
            junto con vencimientos de Finanzas y la programación de pedidos de Comex.
          </p>
          <button
            onClick={() => connect.mutate()}
            disabled={connect.isPending}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {connect.isPending ? <Loader2 size={13} className="animate-spin" /> : <CalendarPlus size={13} />}
            Conectar Google Calendar
          </button>
          {connect.isError && (
            <p className="text-red-400 text-xs">{(connect.error as Error).message}</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => syncNow.mutate()}
              disabled={syncNow.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {syncNow.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Sincronizar ahora
            </button>
            <button
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-300 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {disconnect.isPending ? <Loader2 size={13} className="animate-spin" /> : <Unlink size={13} />}
              Desconectar
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">Calendarios a mostrar</p>
              <button
                onClick={loadCalendars}
                disabled={loadingCalendars}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
              >
                {loadingCalendars ? 'Cargando...' : 'Cargar lista de calendarios'}
              </button>
            </div>

            {calendars && (
              <div className="space-y-1">
                {calendars.map((cal) => (
                  <label key={cal.id} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={status.enabledCalendarIds.includes(cal.id)}
                      onChange={() => toggleCalendar(cal.id)}
                      className="accent-indigo-500"
                    />
                    {cal.summary}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
