import { Ship, TrendingUp, Clock, CheckCircle2 } from 'lucide-react'
import { useComexImports } from '../../hooks/useComex'
import { IMPORT_STATUS_LABELS, IMPORT_STATUS_COLORS } from '@shared/types'
import type { ImportStatus } from '@shared/types'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
dayjs.locale('es')

// Panel that shows all active imports with their logistics status
function ActiveShipmentsPanel() {
  const navigate = useNavigate()
  const { data: imports = [] } = useComexImports()

  const inTransit = imports.filter((i) =>
    ['shipped', 'transit', 'customs'].includes(i.status)
  )

  if (inTransit.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Ship size={14} className="text-cyan-400" />
          En tránsito
        </h2>
        <p className="text-xs text-slate-500">No hay embarques activos en este momento.</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <Ship size={14} className="text-cyan-400" />
        En tránsito ({inTransit.length})
      </h2>
      <div className="space-y-3">
        {inTransit.map((imp) => {
          const color = IMPORT_STATUS_COLORS[imp.status as ImportStatus]
          const label = IMPORT_STATUS_LABELS[imp.status as ImportStatus]
          return (
            <button
              key={imp.id}
              onClick={() => navigate(`/comex/imports/${imp.id}`)}
              className="w-full text-left p-3 bg-slate-900/50 rounded-lg hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{imp.title}</p>
                  {imp.supplier && (
                    <p className="text-[10px] text-slate-500">{imp.supplier.name}</p>
                  )}
                </div>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color + '22', color }}
                >
                  {label}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500">
                {imp.tracking_number && <span>📦 {imp.tracking_number}</span>}
                {imp.arrival_date && (
                  <span>
                    ETA: {dayjs(imp.arrival_date).format('DD/MM/YY')}
                  </span>
                )}
                {imp.customs_agent && <span>🛃 {imp.customs_agent}</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Stats overview
function LogisticsStats() {
  const { data: imports = [] } = useComexImports()

  const stats = {
    ordered: imports.filter((i) => i.status === 'ordered').length,
    inProd: imports.filter((i) => ['preparacion_embarque', 'listo_para_embarcar'].includes(i.status)).length,
    inTransit: imports.filter((i) => ['shipped', 'transit'].includes(i.status)).length,
    customs: imports.filter((i) => i.status === 'customs').length,
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Pedido enviado</p>
        <p className="text-2xl font-bold text-blue-400">{stats.ordered}</p>
      </div>
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Preparación embarque</p>
        <p className="text-2xl font-bold text-yellow-400">{stats.inProd}</p>
      </div>
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">En tránsito</p>
        <p className="text-2xl font-bold text-violet-400">{stats.inTransit}</p>
      </div>
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">En aduana</p>
        <p className="text-2xl font-bold text-orange-400">{stats.customs}</p>
      </div>
    </div>
  )
}

// Recent arrivals
function RecentArrivals() {
  const navigate = useNavigate()
  const { data: imports = [] } = useComexImports()

  const recent = imports
    .filter((i) => i.status === 'delivered' && i.actual_arrival_date)
    .sort((a, b) => (b.actual_arrival_date ?? 0) - (a.actual_arrival_date ?? 0))
    .slice(0, 5)

  if (recent.length === 0) return null

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <CheckCircle2 size={14} className="text-emerald-400" />
        Últimas entregas
      </h2>
      <div className="space-y-2">
        {recent.map((imp) => (
          <button
            key={imp.id}
            onClick={() => navigate(`/comex/imports/${imp.id}`)}
            className="w-full text-left flex items-center gap-3 py-2 border-b border-slate-700/50 last:border-0 hover:bg-slate-700/30 rounded px-2 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-200 truncate">{imp.title}</p>
              {imp.supplier && <p className="text-[10px] text-slate-500">{imp.supplier.name}</p>}
            </div>
            <p className="text-[10px] text-slate-500 flex-shrink-0">
              {dayjs(imp.actual_arrival_date).format('DD/MM/YY')}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}

// Upcoming arrivals
function UpcomingArrivals() {
  const navigate = useNavigate()
  const { data: imports = [] } = useComexImports()

  const upcoming = imports
    .filter((i) => i.arrival_date && i.arrival_date > Date.now() && i.status !== 'delivered')
    .sort((a, b) => (a.arrival_date ?? 0) - (b.arrival_date ?? 0))

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <Clock size={14} className="text-cyan-400" />
        Próximas llegadas
      </h2>
      {upcoming.length === 0 ? (
        <p className="text-xs text-slate-500">Sin fechas de llegada programadas.</p>
      ) : (
        <div className="space-y-2">
          {upcoming.map((imp) => {
            const daysLeft = dayjs(imp.arrival_date).diff(dayjs(), 'day')
            const color = daysLeft <= 7 ? 'text-orange-400' : daysLeft <= 30 ? 'text-yellow-400' : 'text-slate-400'
            return (
              <button
                key={imp.id}
                onClick={() => navigate(`/comex/imports/${imp.id}`)}
                className="w-full text-left flex items-center gap-3 py-2 border-b border-slate-700/50 last:border-0 hover:bg-slate-700/30 rounded px-2 transition-colors"
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: IMPORT_STATUS_COLORS[imp.status as ImportStatus] }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200 truncate">{imp.title}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-slate-500">{dayjs(imp.arrival_date).format('DD/MM/YY')}</p>
                  <p className={`text-[10px] font-medium ${color}`}>
                    {daysLeft === 0 ? 'Hoy' : daysLeft > 0 ? `en ${daysLeft}d` : `${Math.abs(daysLeft)}d atrás`}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main View ─────────────────────────────────────────────────────────────────

export default function ComexLogistics() {
  const { data: imports = [] } = useComexImports()

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Ship size={22} className="text-cyan-400" />
        <div>
          <h1 className="text-lg font-bold text-white">Logística</h1>
          <p className="text-xs text-slate-400">Seguimiento de embarques y operadores logísticos</p>
        </div>
      </div>

      {imports.length === 0 ? (
        <div className="text-center py-16">
          <TrendingUp size={40} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Sin operaciones activas</p>
          <p className="text-slate-500 text-sm mt-1">
            Los datos logísticos aparecerán cuando tengas importaciones cargadas.
          </p>
        </div>
      ) : (
        <>
          <LogisticsStats />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <UpcomingArrivals />
            <ActiveShipmentsPanel />
          </div>

          <RecentArrivals />
        </>
      )}
    </div>
  )
}
