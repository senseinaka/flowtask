import { Globe2, Package, TrendingUp, AlertCircle, Calendar, ChevronRight, Clock, DollarSign, Ship } from 'lucide-react'
import { useComexImports } from '../../hooks/useComex'
import { IMPORT_STATUS_LABELS, IMPORT_STATUS_COLORS } from '@shared/types'
import type { ImportStatus, ComexImport } from '@shared/types'
import { cn } from '../../components/ui/utils'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/es'
dayjs.extend(relativeTime)
dayjs.locale('es')

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_ORDER: ImportStatus[] = [
  'planning','ordered','paid','production','shipped','transit','customs','delivered'
]

function getBestETA(imp: ComexImport): number | null {
  return imp.eta_4 ?? imp.eta_3 ?? imp.eta_2 ?? imp.arrival_date ?? null
}

function getBarStart(imp: ComexImport): number {
  return imp.order_date ?? imp.created_at
}

// ── Pipeline card ─────────────────────────────────────────────────────────────

function PipelineCard({ imp }: { imp: ComexImport }) {
  const navigate = useNavigate()
  const eta = getBestETA(imp)
  const value = imp.actual_value ?? imp.estimated_value

  return (
    <button
      onClick={() => navigate(`/comex/imports/${imp.id}`)}
      className="w-full text-left bg-slate-900/50 border border-slate-700/60 rounded-lg p-2 hover:border-slate-500/80 hover:bg-slate-700/40 transition-all group"
    >
      <p className="text-[11px] font-semibold text-slate-200 truncate group-hover:text-white leading-tight">
        {imp.title}
      </p>
      {imp.supplier && (
        <p className="text-[10px] text-slate-500 truncate mt-0.5">{imp.supplier.name}</p>
      )}
      <div className="mt-1.5 flex items-center justify-between gap-1">
        {value != null && value > 0 && (
          <span className="text-[10px] text-cyan-400 font-medium truncate">
            {imp.currency} {Math.round(value).toLocaleString('es-AR')}
          </span>
        )}
        {eta && (
          <span className="text-[10px] text-slate-500 flex-shrink-0">
            {dayjs(eta).format('DD/MM')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 mt-1 flex-wrap">
        {imp.inal_required === 1 && (
          <span className="text-[9px] font-semibold px-1 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 border border-emerald-800/50">
            INAL
          </span>
        )}
        {imp.cost_pct != null && (
          <span className={cn('text-[9px] font-medium px-1 py-0.5 rounded-full',
            imp.cost_pct < 20 ? 'bg-emerald-900/30 text-emerald-500' :
            imp.cost_pct < 28 ? 'bg-amber-900/30 text-amber-500' : 'bg-red-900/30 text-red-500'
          )}>
            {imp.cost_pct.toFixed(1)}%
          </span>
        )}
      </div>
    </button>
  )
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

function Pipeline({ imports }: { imports: ComexImport[] }) {
  const byStatus = STATUS_ORDER.reduce<Record<string, ComexImport[]>>((acc, s) => {
    acc[s] = imports.filter(i => i.status === s)
    return acc
  }, {})

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <TrendingUp size={14} className="text-cyan-400" />
        Pipeline de importaciones
      </h2>
      <div className="overflow-x-auto -mx-1 px-1 pb-2">
        <div className="flex gap-2.5" style={{ minWidth: `${STATUS_ORDER.length * 160}px` }}>
          {STATUS_ORDER.map(status => {
            const cols = byStatus[status] ?? []
            const color = IMPORT_STATUS_COLORS[status]
            const totalVal = cols.reduce((s, i) => s + (i.actual_value ?? i.estimated_value ?? 0), 0)

            return (
              <div key={status} className="flex-1" style={{ minWidth: '150px' }}>
                {/* Column header */}
                <div
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg mb-2"
                  style={{ backgroundColor: color + '18', borderLeft: `3px solid ${color}` }}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider truncate" style={{ color }}>
                    {IMPORT_STATUS_LABELS[status]}
                  </span>
                  {cols.length > 0 && (
                    <span className="text-[10px] font-bold text-white bg-slate-700/80 px-1.5 py-0.5 rounded-full ml-1 flex-shrink-0">
                      {cols.length}
                    </span>
                  )}
                </div>

                {/* Cards */}
                <div className="space-y-1.5 min-h-[50px]">
                  {cols.map(imp => <PipelineCard key={imp.id} imp={imp} />)}
                  {cols.length === 0 && (
                    <div className="h-10 border border-dashed border-slate-700/40 rounded-lg flex items-center justify-center">
                      <span className="text-[10px] text-slate-700">—</span>
                    </div>
                  )}
                </div>

                {/* Footer value */}
                {totalVal > 0 && (
                  <p className="mt-1.5 text-[10px] text-slate-600 text-right px-1">
                    USD {Math.round(totalVal).toLocaleString('es-AR')}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Gantt timeline ────────────────────────────────────────────────────────────

function GanttTimeline({ imports }: { imports: ComexImport[] }) {
  const navigate = useNavigate()
  const active = imports.filter(i => i.status !== 'delivered')
  if (active.length === 0) return null

  const today = dayjs()

  // Compute time range
  const allStarts = active.map(i => getBarStart(i))
  const allEnds   = active.map(i => getBestETA(i)).filter((v): v is number => v != null)

  const rangeStart = dayjs(
    Math.min(...allStarts, today.subtract(1, 'month').valueOf())
  ).startOf('month')

  const rangeEnd = dayjs(
    Math.max(...allEnds, today.add(3, 'month').valueOf())
  ).add(1, 'month').startOf('month')

  // Clamp: max 12 months total
  const clampedStart = rangeStart.isAfter(today.subtract(5, 'month')) ? rangeStart : today.subtract(5, 'month').startOf('month')
  const clampedEnd   = rangeEnd.isBefore(today.add(8, 'month'))      ? rangeEnd   : today.add(8, 'month').startOf('month')

  const totalMs  = clampedEnd.diff(clampedStart, 'ms')
  const todayPct = Math.max(0, Math.min(100, (today.diff(clampedStart, 'ms') / totalMs) * 100))

  const toPct = (ts: number) =>
    Math.max(0, Math.min(100, (ts - clampedStart.valueOf()) / totalMs * 100))

  // Month labels
  const months: { label: string; pct: number }[] = []
  let cur = clampedStart.clone()
  while (cur.isBefore(clampedEnd)) {
    months.push({ label: cur.format('MMM'), pct: toPct(cur.valueOf()) })
    cur = cur.add(1, 'month')
  }

  const sorted = [...active].sort((a, b) => getBarStart(a) - getBarStart(b))

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <Calendar size={14} className="text-cyan-400" />
        Línea de tiempo
      </h2>

      {/* Month header */}
      <div className="flex mb-2">
        <div className="w-36 flex-shrink-0 pr-3" />
        <div className="flex-1 relative h-5">
          {months.map((m, i) => (
            <div
              key={i}
              className="absolute text-[9px] text-slate-500 select-none"
              style={{ left: `${m.pct}%`, transform: 'translateX(-50%)' }}
            >
              {m.label}
            </div>
          ))}
        </div>
        <div className="w-14 flex-shrink-0" />
      </div>

      {/* Rows */}
      <div className="space-y-1.5">
        {sorted.map(imp => {
          const startTs  = getBarStart(imp)
          const endTs    = getBestETA(imp)
          const color    = IMPORT_STATUS_COLORS[imp.status as ImportStatus]

          const sp = toPct(startTs)
          const ep = endTs ? toPct(endTs) : Math.min(todayPct + 2, 100)
          const w  = Math.max(ep - sp, 0.5)

          // Past vs future split within the bar
          const pastW   = Math.max(0, Math.min(todayPct, ep) - sp)
          const futureW = Math.max(0, w - pastW)

          const eta      = getBestETA(imp)
          const daysLeft = eta ? dayjs(eta).diff(today, 'day') : null

          return (
            <div key={imp.id} className="flex items-center gap-0 group">
              {/* Label */}
              <button
                onClick={() => navigate(`/comex/imports/${imp.id}`)}
                className="w-36 flex-shrink-0 pr-3 text-right group-hover:opacity-100 transition-opacity"
              >
                <p className="text-[11px] font-medium text-slate-300 truncate group-hover:text-white">{imp.title}</p>
                <p className="text-[9px] text-slate-600 truncate">{imp.supplier?.name ?? ''}</p>
              </button>

              {/* Bar area */}
              <div
                className="flex-1 relative h-7 rounded cursor-pointer hover:bg-slate-700/20 transition-colors"
                onClick={() => navigate(`/comex/imports/${imp.id}`)}
              >
                {/* Grid lines */}
                {months.map((m, i) => (
                  <div key={i} className="absolute top-0 bottom-0 w-px bg-slate-700/25" style={{ left: `${m.pct}%` }} />
                ))}

                {/* Today line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-cyan-500/60 z-10"
                  style={{ left: `${todayPct}%` }}
                />

                {/* Bar */}
                <div
                  className="absolute top-1.5 bottom-1.5 rounded-full overflow-hidden flex"
                  style={{ left: `${sp}%`, width: `${w}%` }}
                >
                  {pastW > 0 && (
                    <div style={{ width: `${(pastW / w) * 100}%`, backgroundColor: color + '70' }} />
                  )}
                  {futureW > 0 && (
                    <div
                      style={{ width: `${(futureW / w) * 100}%`, backgroundColor: color + '35', borderRight: `2px solid ${color}` }}
                    />
                  )}
                </div>

                {/* Label inside bar */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 text-[9px] font-bold px-1.5 pointer-events-none z-20 whitespace-nowrap"
                  style={{ left: `${sp + 0.3}%`, color }}
                >
                  {IMPORT_STATUS_LABELS[imp.status as ImportStatus]}
                </div>
              </div>

              {/* ETA badge */}
              <div className="w-14 flex-shrink-0 pl-2 text-right">
                {eta ? (
                  <span className={cn(
                    'inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                    daysLeft == null    ? 'text-slate-500' :
                    daysLeft < 0        ? 'bg-red-900/50 text-red-400' :
                    daysLeft <= 7       ? 'bg-orange-900/50 text-orange-400' :
                    daysLeft <= 21      ? 'bg-amber-900/50 text-amber-400' :
                    'text-slate-500'
                  )}>
                    {daysLeft == null   ? dayjs(eta).format('DD/MM') :
                     daysLeft < 0      ? `${Math.abs(daysLeft)}d` :
                     daysLeft === 0    ? 'Hoy' :
                     `${daysLeft}d`}
                  </span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      {/* Today label */}
      <div className="flex mt-1">
        <div className="w-36 flex-shrink-0" />
        <div className="flex-1 relative h-4">
          <span
            className="absolute text-[9px] text-cyan-500 font-medium"
            style={{ left: `${todayPct}%`, transform: 'translateX(-50%)' }}
          >
            hoy
          </span>
        </div>
        <div className="w-14" />
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ComexDashboard() {
  const { data: imports = [] } = useComexImports()
  const navigate = useNavigate()
  const today = dayjs()

  if (imports.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Package size={40} className="text-slate-600" />
        <p className="text-slate-400 font-medium">Sin importaciones registradas</p>
        <button onClick={() => navigate('/comex/imports')} className="text-xs text-cyan-400 hover:underline">
          Ir a Importaciones →
        </button>
      </div>
    )
  }

  const active    = imports.filter(i => i.status !== 'delivered')
  const inTransit = imports.filter(i => ['shipped', 'transit'].includes(i.status))
  const inCustoms = imports.filter(i => i.status === 'customs')

  // Alerts
  const overdue = active.filter(i => {
    const eta = getBestETA(i)
    return eta && dayjs(eta).isBefore(today)
  })
  const inalPending = active.filter(i =>
    i.inal_required === 1 && i.inal_lc_status !== 'finalizado'
  )

  // Value
  const totalValue = active.reduce((s, i) => s + (i.actual_value ?? i.estimated_value ?? 0), 0)

  // Average cost %
  const withCost   = active.filter(i => i.cost_pct != null && i.cost_pct > 0)
  const avgCostPct = withCost.length > 0
    ? withCost.reduce((s, i) => s + (i.cost_pct ?? 0), 0) / withCost.length
    : null

  // Upcoming arrivals
  const upcoming = [...active]
    .filter(i => { const eta = getBestETA(i); return eta && dayjs(eta).isAfter(today) })
    .sort((a, b) => (getBestETA(a) ?? 0) - (getBestETA(b) ?? 0))
    .slice(0, 6)

  // Top by cost %
  const topByCost = [...active]
    .filter(i => i.cost_pct != null)
    .sort((a, b) => (b.cost_pct ?? 0) - (a.cost_pct ?? 0))
    .slice(0, 5)

  const alertCount = overdue.length + inalPending.length

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe2 size={20} className="text-cyan-400" />
          <div>
            <h1 className="text-lg font-bold text-white">Dashboard Comex</h1>
            <p className="text-xs text-slate-400">Operaciones de comercio exterior</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/comex/imports')}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
        >
          Ver todas <ChevronRight size={13} />
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* En curso */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Ship size={13} className="text-cyan-400" />
            <p className="text-[11px] text-slate-400 uppercase tracking-wider">En curso</p>
          </div>
          <p className="text-3xl font-bold text-white">{active.length}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            {inTransit.length} tránsito · {inCustoms.length} aduana
          </p>
        </div>

        {/* Valor activo */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <DollarSign size={13} className="text-cyan-400" />
            <p className="text-[11px] text-slate-400 uppercase tracking-wider">Valor activo</p>
          </div>
          <p className="text-2xl font-bold text-cyan-400 truncate">
            {totalValue > 0 ? `USD ${Math.round(totalValue).toLocaleString('es-AR')}` : '—'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">factura + estimado</p>
        </div>

        {/* Costo promedio */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp size={13} className="text-cyan-400" />
            <p className="text-[11px] text-slate-400 uppercase tracking-wider">Costo promedio</p>
          </div>
          <p className={cn('text-3xl font-bold',
            avgCostPct == null   ? 'text-slate-500' :
            avgCostPct < 20      ? 'text-emerald-400' :
            avgCostPct < 28      ? 'text-amber-400' : 'text-red-400'
          )}>
            {avgCostPct != null ? `${avgCostPct.toFixed(1)}%` : '—'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">sobre valor factura</p>
        </div>

        {/* Alertas */}
        <div className={cn('border rounded-xl p-4',
          alertCount > 0 ? 'bg-red-900/20 border-red-800/50' : 'bg-slate-800 border-slate-700'
        )}>
          <div className="flex items-center gap-1.5 mb-2">
            <AlertCircle size={13} className={alertCount > 0 ? 'text-red-400' : 'text-slate-500'} />
            <p className={cn('text-[11px] uppercase tracking-wider', alertCount > 0 ? 'text-red-400' : 'text-slate-400')}>
              Alertas
            </p>
          </div>
          <p className={cn('text-3xl font-bold', alertCount > 0 ? 'text-red-400' : 'text-emerald-400')}>
            {alertCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {alertCount === 0 ? 'Sin alertas activas' :
             [overdue.length > 0 && `${overdue.length} ETA vencida`,
              inalPending.length > 0 && `${inalPending.length} INAL`].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      {/* ── Pipeline ── */}
      <Pipeline imports={imports} />

      {/* ── Gantt ── */}
      <GanttTimeline imports={imports} />

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Próximas llegadas */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Clock size={14} className="text-cyan-400" />
            Próximas llegadas
          </h2>
          {upcoming.length === 0 ? (
            <p className="text-xs text-slate-500">Sin ETAs registradas</p>
          ) : (
            <div className="space-y-1.5">
              {upcoming.map(imp => {
                const eta      = getBestETA(imp)
                const daysLeft = eta ? dayjs(eta).diff(today, 'day') : null
                const urgent   = daysLeft != null && daysLeft <= 7
                const soon     = daysLeft != null && daysLeft > 7 && daysLeft <= 21

                return (
                  <button
                    key={imp.id}
                    onClick={() => navigate(`/comex/imports/${imp.id}`)}
                    className="w-full flex items-center gap-3 text-left hover:bg-slate-700/40 rounded-lg px-2 py-2 transition-colors group"
                  >
                    <div className={cn('w-1 h-9 rounded-full flex-shrink-0',
                      urgent ? 'bg-red-500' : soon ? 'bg-amber-500' : 'bg-emerald-500'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-slate-200 truncate group-hover:text-white">{imp.title}</p>
                      <p className="text-[10px] text-slate-500 truncate">{imp.supplier?.name}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={cn('text-xs font-bold',
                        urgent ? 'text-red-400' : soon ? 'text-amber-400' : 'text-slate-300'
                      )}>
                        {daysLeft == null   ? '—' :
                         daysLeft === 0     ? 'Hoy' :
                         daysLeft === 1     ? 'Mañana' :
                         `${daysLeft}d`}
                      </p>
                      {eta && <p className="text-[10px] text-slate-600">{dayjs(eta).format('DD/MM/YY')}</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Top por costo */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <DollarSign size={14} className="text-cyan-400" />
            Costo de importación
          </h2>
          {topByCost.length === 0 ? (
            <p className="text-xs text-slate-500">
              Sin datos de costo — abrí una importación para calcular
            </p>
          ) : (
            <div className="space-y-3">
              {topByCost.map(imp => {
                const pct = imp.cost_pct ?? 0
                const barColor = pct < 20 ? 'bg-emerald-500' : pct < 28 ? 'bg-amber-500' : 'bg-red-500'
                const txtColor = pct < 20 ? 'text-emerald-400' : pct < 28 ? 'text-amber-400' : 'text-red-400'

                return (
                  <button
                    key={imp.id}
                    onClick={() => navigate(`/comex/imports/${imp.id}`)}
                    className="w-full text-left group"
                  >
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <p className="text-[11px] font-medium text-slate-300 truncate group-hover:text-white">
                        {imp.title}
                      </p>
                      <span className={cn('text-[11px] font-bold flex-shrink-0', txtColor)}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', barColor)}
                        style={{ width: `${Math.min(pct / 40 * 100, 100)}%` }}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Alertas ── */}
      {alertCount > 0 && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-4 space-y-2">
          <h2 className="text-sm font-semibold text-red-300 flex items-center gap-2">
            <AlertCircle size={14} /> Alertas activas
          </h2>
          {overdue.map(imp => {
            const eta = getBestETA(imp)
            return (
              <button key={imp.id} onClick={() => navigate(`/comex/imports/${imp.id}`)}
                className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                {imp.title} — ETA {eta ? dayjs(eta).format('DD/MM/YYYY') : '—'} vencida
              </button>
            )
          })}
          {inalPending.map(imp => (
            <button key={imp.id} onClick={() => navigate(`/comex/imports/${imp.id}`)}
              className="flex items-center gap-2 text-xs text-amber-400 hover:text-amber-300 transition-colors">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
              {imp.title} — Libre Circulación INAL pendiente
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
