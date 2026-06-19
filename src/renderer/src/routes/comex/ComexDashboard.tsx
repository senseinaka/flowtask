import { useState } from 'react'
import { Globe2, Package, TrendingUp, AlertCircle, Calendar, ChevronRight, Clock, DollarSign, Ship, Maximize2, X, CheckCircle2, ShieldCheck, Mail, ShieldOff, ChevronDown } from 'lucide-react'
import { useComexImports, useComexPlannings } from '../../hooks/useComex'
import { PlanningDashboardPanel } from './ComexPlanningSummary'
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

const PIPELINE_PHASES: Array<{
  key: string
  label: string
  color: string
  statuses: ImportStatus[]
}> = [
  {
    key: 'pedido',
    label: 'Pedido',
    color: '#60a5fa',
    statuses: ['planning', 'ordered', 'paid', 'production'],
  },
  {
    key: 'pre_embarque',
    label: 'Pre-embarque',
    color: '#f97316',
    statuses: ['carga_armada', 'esperando_embarcar', 'forwarder', 'cotizacion_pedida', 'forwarder_seleccionado'],
  },
  {
    key: 'transito',
    label: 'Tránsito',
    color: '#8b5cf6',
    statuses: ['shipped', 'transit', 'arrived'],
  },
  {
    key: 'aduana',
    label: 'Aduana',
    color: '#06b6d4',
    statuses: ['customs', 'oficializado', 'carga_deposito'],
  },
  {
    key: 'entregado',
    label: 'Entregado',
    color: '#10b981',
    statuses: ['delivered'],
  },
]

function getBestETA(imp: ComexImport): number | null {
  return imp.eta_4 ?? imp.eta_3 ?? imp.eta_2 ?? imp.arrival_date ?? null
}

/** ETD: fecha real de salida si existe, sino estimada */
function getETD(imp: ComexImport): number | null {
  return imp.actual_ship_date ?? imp.ship_date ?? null
}

/** Inicio para calcular rango: fecha de pedido (no el ETD) */
function getOrderStart(imp: ComexImport): number {
  return imp.order_date ?? imp.created_at
}

// ── Pipeline card ─────────────────────────────────────────────────────────────

function PipelineCard({ imp }: { imp: ComexImport }) {
  const navigate = useNavigate()
  const eta      = getBestETA(imp)
  const value    = imp.actual_value ?? imp.estimated_value
  const statusColor = IMPORT_STATUS_COLORS[imp.status]

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
      <div className="flex items-center justify-between gap-1 mt-1.5">
        <div className="flex items-center gap-1 flex-wrap">
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
        {/* Sub-estado exacto dentro de la fase */}
        <span
          className="text-[8px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ color: statusColor, background: statusColor + '18', border: `1px solid ${statusColor}40` }}
        >
          {IMPORT_STATUS_LABELS[imp.status]}
        </span>
      </div>
    </button>
  )
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

function Pipeline({ imports }: { imports: ComexImport[] }) {
  const [deliveredOpen, setDeliveredOpen] = useState(false)

  const phases = PIPELINE_PHASES.map(phase => ({
    ...phase,
    items: imports.filter(i => phase.statuses.includes(i.status)),
    totalVal: imports
      .filter(i => phase.statuses.includes(i.status))
      .reduce((s, i) => s + (i.actual_value ?? i.estimated_value ?? 0), 0),
  }))

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <TrendingUp size={14} className="text-cyan-400" />
        Pipeline de importaciones
        <span className="ml-auto text-[10px] text-slate-500 font-normal">
          {imports.filter(i => i.status !== 'delivered').length} activas
        </span>
      </h2>
      <div className="overflow-x-auto -mx-1 px-1 pb-2">
        <div className="flex gap-2.5" style={{ minWidth: '760px' }}>
          {phases.map(phase => {
            const isDelivered = phase.key === 'entregado'
            const expanded    = isDelivered ? deliveredOpen : true

            return (
              <div key={phase.key} className="flex-1" style={{ minWidth: '148px' }}>
                {/* Phase header */}
                <div
                  className={cn(
                    'rounded-lg mb-2 px-2.5 py-2',
                    isDelivered && 'cursor-pointer hover:opacity-90 transition-opacity'
                  )}
                  style={{ backgroundColor: phase.color + '14', borderLeft: `3px solid ${phase.color}` }}
                  onClick={isDelivered ? () => setDeliveredOpen(o => !o) : undefined}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: phase.color }}
                    >
                      {phase.label}
                    </span>
                    <div className="flex items-center gap-1">
                      {phase.items.length > 0 && (
                        <span className="text-[10px] font-bold text-white bg-slate-700/80 px-1.5 py-0.5 rounded-full">
                          {phase.items.length}
                        </span>
                      )}
                      {isDelivered && (
                        <ChevronDown
                          size={12}
                          className="text-slate-500 transition-transform"
                          style={{ transform: deliveredOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        />
                      )}
                    </div>
                  </div>
                  {/* Sub-estado dots */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {phase.statuses.map(s => {
                      const cnt = imports.filter(i => i.status === s).length
                      return (
                        <span
                          key={s}
                          className="text-[8px] font-medium px-1 py-0.5 rounded"
                          style={{
                            color:      IMPORT_STATUS_COLORS[s],
                            background: IMPORT_STATUS_COLORS[s] + (cnt > 0 ? '20' : '0a'),
                            border:     `1px solid ${IMPORT_STATUS_COLORS[s]}${cnt > 0 ? '50' : '20'}`,
                            opacity:    cnt > 0 ? 1 : 0.4,
                          }}
                        >
                          {cnt > 0 ? `${cnt} ` : ''}{IMPORT_STATUS_LABELS[s]}
                        </span>
                      )
                    })}
                  </div>
                  {/* Total valor */}
                  {phase.totalVal > 0 && (
                    <p className="text-[9px] mt-1.5" style={{ color: phase.color + 'aa' }}>
                      USD {Math.round(phase.totalVal).toLocaleString('es-AR')}
                    </p>
                  )}
                </div>

                {/* Cards */}
                {expanded && (
                  <div className="space-y-1.5 min-h-[40px]">
                    {phase.items.map(imp => <PipelineCard key={imp.id} imp={imp} />)}
                    {phase.items.length === 0 && (
                      <div className="h-10 border border-dashed border-slate-700/40 rounded-lg flex items-center justify-center">
                        <span className="text-[10px] text-slate-700">—</span>
                      </div>
                    )}
                  </div>
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

type ScaleKey = '1M' | '3M' | '6M' | '1A' | 'auto'
const SCALES: { key: ScaleKey; label: string; pastDays: number; futureDays: number }[] = [
  { key: '1M',   label: '1 mes',   pastDays: 7,   futureDays: 23  },
  { key: '3M',   label: '3 meses', pastDays: 30,  futureDays: 60  },
  { key: '6M',   label: '6 meses', pastDays: 45,  futureDays: 135 },
  { key: '1A',   label: '1 año',   pastDays: 60,  futureDays: 305 },
  { key: 'auto', label: 'Auto',    pastDays: 0,   futureDays: 0   },
]

// ── Leyenda ───────────────────────────────────────────────────────────────────

function GanttLegend() {
  return (
    <div className="mt-3 pt-3 border-t border-slate-700/40 space-y-2">
      <p className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold">Leyenda</p>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[10px]">
        <span className="flex items-center gap-1.5 text-slate-400">
          <span className="inline-block w-6 h-2.5 rounded-sm bg-slate-400/80" />
          Período recorrido (ETD → hoy)
        </span>
        <span className="flex items-center gap-1.5 text-slate-400">
          <span className="inline-block w-6 h-2.5 rounded-sm bg-slate-600/60 border border-dashed border-slate-500" style={{ backgroundImage: 'repeating-linear-gradient(90deg,#475569 0,#475569 3px,transparent 3px,transparent 6px)' }} />
          Preparación (sin ETD)
        </span>
        <span className="flex items-center gap-1.5 text-slate-400">
          <span className="inline-block w-6 h-2.5 rounded-sm border-r-2 border-slate-400" style={{ background: 'rgba(100,116,139,0.25)' }} />
          Período pendiente (hoy → ETA)
        </span>
        <span className="flex items-center gap-1.5 text-slate-400">
          <span className="inline-block w-3 h-3 rotate-45 border-2 border-slate-400" />
          ETA estimada de llegada
        </span>
        <span className="flex items-center gap-1.5 text-slate-400">
          <span className="inline-block w-0.5 h-4 bg-cyan-500/70" />
          Hoy
        </span>
        <span className="flex items-center gap-1.5 text-slate-400">
          <CheckCircle2 size={11} className="text-emerald-500" />
          Entregada
        </span>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[10px] pt-0.5">
        <span className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-900/50 text-red-400">9d atrás</span>
          <span className="text-slate-500">= La ETA estimada ya pasó hace 9 días. Verificar si llegó o está demorada.</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-slate-500">77d</span>
          <span className="text-slate-500">= Faltan 77 días para la ETA estimada.</span>
        </span>
      </div>
    </div>
  )
}

// ── GanttBody: el gráfico puro (reutilizable en normal y modal) ───────────────

function GanttBody({
  imports, scale, isModal = false
}: {
  imports: ComexImport[]
  scale:   ScaleKey
  isModal?:boolean
}) {
  const navigate   = useNavigate()
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const today   = dayjs()
  const rowH    = isModal ? 44 : 36

  // Ventana temporal
  let windowStart: dayjs.Dayjs
  let windowEnd:   dayjs.Dayjs
  if (scale === 'auto') {
    const allStarts = imports.map(i => getOrderStart(i))
    const allEnds   = imports.map(i => getBestETA(i) ?? getBestETA(i)).filter((v): v is number => v != null)
    windowStart = dayjs(Math.min(...allStarts, today.subtract(1,'month').valueOf())).startOf('month')
    windowEnd   = dayjs(Math.max(...allEnds, today.add(3,'month').valueOf())).add(1,'month').startOf('month')
    if (windowEnd.diff(windowStart,'month') > 14) windowEnd = windowStart.add(14,'month')
  } else {
    const s = SCALES.find(s => s.key === scale)!
    windowStart = today.subtract(s.pastDays,'day').startOf('day')
    windowEnd   = today.add(s.futureDays,'day').endOf('day')
  }

  const totalMs  = windowEnd.diff(windowStart,'ms')
  const todayPct = Math.max(0, Math.min(100, today.diff(windowStart,'ms') / totalMs * 100))
  const toPct    = (ts: number) => Math.max(0, Math.min(100, (ts - windowStart.valueOf()) / totalMs * 100))

  const totalDays = windowEnd.diff(windowStart,'day')
  const tickUnit  = totalDays <= 35 ? 'week' : 'month'
  const ticks: { label: string; pct: number; isMajor: boolean }[] = []
  let cur = windowStart.clone()
  if (tickUnit === 'week') {
    cur = cur.startOf('week')
    while (cur.isBefore(windowEnd)) {
      const pct = toPct(cur.valueOf())
      if (pct >= 0 && pct <= 100) ticks.push({ label: cur.format('DD/MM'), pct, isMajor: cur.date() <= 7 })
      cur = cur.add(1,'week')
    }
  } else {
    cur = cur.startOf('month')
    while (cur.isBefore(windowEnd)) {
      ticks.push({ label: cur.format('MMM'), pct: toPct(cur.valueOf()), isMajor: cur.month() === 0 })
      cur = cur.add(1,'month')
    }
  }

  // Ordenar: activas por ETA más próxima primero, luego entregadas
  const active    = imports.filter(i => i.status !== 'delivered').sort((a,b) => (getBestETA(a)??Infinity)-(getBestETA(b)??Infinity))
  const delivered = imports.filter(i => i.status === 'delivered').sort((a,b) => (b.actual_arrival_date??0)-(a.actual_arrival_date??0))
  const sorted    = [...active, ...delivered]

  const hoveredImp = hoveredId ? sorted.find(i => i.id === hoveredId) : null

  const LABEL_W = isModal ? '10rem' : '9rem'
  const RIGHT_W = isModal ? '7rem' : '6rem'

  return (
    <div>
      {/* Eje temporal */}
      <div className="flex mb-1">
        <div style={{ width: LABEL_W }} className="flex-shrink-0 pr-2" />
        <div className="flex-1 relative h-5 overflow-hidden">
          {ticks.map((t,i) => (
            <div key={i} className={cn('absolute select-none', t.isMajor ? 'text-[9px] text-slate-300 font-semibold' : 'text-[8px] text-slate-600')}
              style={{ left:`${t.pct}%`, transform:'translateX(-50%)' }}>{t.label}</div>
          ))}
        </div>
        <div style={{ width: RIGHT_W }} className="flex-shrink-0" />
      </div>

      {/* Filas */}
      <div className="space-y-1.5 overflow-y-auto" style={isModal ? { maxHeight: '60vh' } : {}}>
        {sorted.map(imp => {
          const isDelivered = imp.status === 'delivered'
          const etd   = getETD(imp)
          const eta   = getBestETA(imp)
          const color = isDelivered ? '#10b981' : IMPORT_STATUS_COLORS[imp.status as ImportStatus]
          const orderTs  = getOrderStart(imp)
          const daysLeft = eta ? dayjs(eta).diff(today,'day') : null
          const isHovered = hoveredId === imp.id

          const orderPct = toPct(orderTs)
          const etdPct   = etd ? toPct(etd) : null
          const etaPct   = eta ? toPct(eta) : null
          const barStart = etd ?? orderTs
          const barEnd   = eta ?? today.add(3,'day').valueOf()
          const sp = toPct(barStart), ep = toPct(barEnd)
          const w  = Math.max(ep - sp, 0.3)
          const traveledEnd = Math.min(todayPct, ep)
          const traveledW   = Math.max(0, traveledEnd - sp)
          const pendingW    = Math.max(0, w - traveledW)
          const traveledPct = w > 0 ? (traveledW/w)*100 : 0
          const pendingPct  = w > 0 ? (pendingW/w)*100 : 0
          const showPrepLine = !!(etd && etd > orderTs && orderPct >= 0)

          return (
            <div key={imp.id} className={cn('flex items-center', isDelivered && 'opacity-60')}
              onMouseEnter={() => setHoveredId(imp.id)}
              onMouseLeave={() => setHoveredId(null)}>

              {/* Label */}
              <button onClick={() => navigate(`/comex/imports/${imp.id}`)} style={{ width: LABEL_W }}
                className="flex-shrink-0 pr-2 text-right">
                <p className={cn('text-[11px] font-medium truncate transition-colors', isHovered ? 'text-white' : isDelivered ? 'text-slate-500' : 'text-slate-300')}>
                  {imp.title}
                </p>
                <p className="text-[9px] text-slate-600 truncate">{imp.supplier?.name ?? ''}</p>
              </button>

              {/* Barra */}
              <div className={cn('flex-1 relative cursor-pointer transition-colors rounded', isHovered && 'bg-slate-700/30')}
                style={{ height: `${rowH}px` }}
                onClick={() => navigate(`/comex/imports/${imp.id}`)}>

                {/* Grilla */}
                {ticks.map((t,i) => (
                  <div key={i} className={cn('absolute top-0 bottom-0 w-px', t.isMajor ? 'bg-slate-600/30' : 'bg-slate-700/20')}
                    style={{ left:`${t.pct}%` }} />
                ))}
                {/* Hoy */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-cyan-500/70 z-20" style={{ left:`${todayPct}%` }} />

                {/* Línea prep punteada */}
                {showPrepLine && orderPct >= 0 && orderPct <= 100 && (
                  <div className="absolute top-1/2 -translate-y-0.5 h-0.5 z-5"
                    style={{ left:`${orderPct}%`, width:`${Math.max((etdPct??0)-orderPct,0)}%`,
                      background:'repeating-linear-gradient(90deg,#475569 0,#475569 4px,transparent 4px,transparent 8px)' }} />
                )}

                {/* Barra ETD → ETA */}
                {sp <= 100 && ep >= 0 && (
                  <div className="absolute rounded overflow-hidden flex"
                    style={{ top:'8px', bottom:'8px', left:`${Math.max(sp,0)}%`, width:`${w}%` }}>
                    {traveledPct > 0 && <div style={{ width:`${traveledPct}%`, backgroundColor: color+'cc' }} />}
                    {pendingPct > 0 && <div style={{ width:`${pendingPct}%`, backgroundColor: color+'40', borderRight: eta ? `2.5px solid ${color}` : 'none' }} />}
                  </div>
                )}

                {/* Label estado dentro de la barra */}
                {sp <= 90 && w > 5 && (
                  <div className="absolute top-1/2 -translate-y-1/2 text-[9px] font-bold px-1 pointer-events-none z-5 whitespace-nowrap"
                    style={{ left:`${Math.max(sp+0.5,0)}%`, color: color+'ee' }}>
                    {isDelivered ? '✓ Entregada' : IMPORT_STATUS_LABELS[imp.status as ImportStatus]}
                  </div>
                )}

                {/* Marcador ETD */}
                {etdPct != null && etdPct >= 0 && etdPct <= 100 && isHovered && (
                  <div className="absolute top-0 bottom-0 flex flex-col items-center z-10" style={{ left:`${etdPct}%` }}>
                    <div className="w-0.5 h-2 mt-1" style={{ backgroundColor: color+'cc' }} />
                    <span className="absolute top-0 text-[7px] whitespace-nowrap -translate-x-1/2 translate-y-0.5" style={{ color }}>ETD {dayjs(etd!).format('DD/MM')}</span>
                  </div>
                )}

                {/* Marcador ETA diamante */}
                {etaPct != null && etaPct >= 0 && etaPct <= 100 && (
                  <div className="absolute top-1/2 -translate-y-1/2 z-10" style={{ left:`${etaPct}%` }}>
                    <div className="w-2.5 h-2.5 rotate-45 border-2" style={{ borderColor: color, marginLeft:'-5px' }} />
                    {isHovered && (
                      <span className="absolute text-[7px] whitespace-nowrap translate-y-3 -translate-x-1/2" style={{ color }}>
                        ETA {dayjs(eta!).format('DD/MM')}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Columna derecha */}
              <div style={{ width: RIGHT_W }} className="flex-shrink-0 pl-2 text-right">
                {isDelivered ? (
                  <div>
                    <span className="text-[10px] text-emerald-500 flex items-center justify-end gap-1">
                      <CheckCircle2 size={10} /> Entregada
                    </span>
                    {imp.actual_arrival_date && (
                      <p className="text-[8px] text-slate-600">{dayjs(imp.actual_arrival_date).format('DD/MM/YY')}</p>
                    )}
                  </div>
                ) : eta ? (
                  <div>
                    <span className={cn('inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                      daysLeft == null  ? 'text-slate-500' :
                      daysLeft < 0      ? 'bg-red-900/50 text-red-400' :
                      daysLeft === 0    ? 'bg-orange-900/80 text-orange-300 animate-pulse' :
                      daysLeft <= 7     ? 'bg-orange-900/50 text-orange-400' :
                      daysLeft <= 21    ? 'bg-amber-900/50 text-amber-400' : 'text-slate-500')}>
                      {daysLeft == null ? '—' : daysLeft < 0 ? `${Math.abs(daysLeft)}d atrás` : daysLeft === 0 ? '¡Hoy!' : `${daysLeft}d`}
                    </span>
                    <p className="text-[8px] text-slate-600 mt-0.5">{dayjs(eta).format('DD/MM/YY')}</p>
                  </div>
                ) : (
                  <span className="text-[9px] text-slate-700">Sin ETA</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Etiqueta hoy */}
      <div className="flex mt-1">
        <div style={{ width: LABEL_W }} className="flex-shrink-0" />
        <div className="flex-1 relative h-4">
          <span className="absolute text-[9px] text-cyan-500 font-medium"
            style={{ left:`${todayPct}%`, transform:'translateX(-50%)' }}>hoy</span>
        </div>
        <div style={{ width: RIGHT_W }} />
      </div>

      {/* Tooltip hover */}
      {hoveredImp && (() => {
        const etd      = getETD(hoveredImp)
        const eta      = getBestETA(hoveredImp)
        const daysLeft = eta ? dayjs(eta).diff(today,'day') : null
        const transit  = etd && eta ? dayjs(eta).diff(dayjs(etd),'day') : null
        const elapsed  = etd ? Math.max(0, today.diff(dayjs(etd),'day')) : null
        const color    = hoveredImp.status === 'delivered' ? '#10b981' : IMPORT_STATUS_COLORS[hoveredImp.status as ImportStatus]
        return (
          <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-start gap-4 text-[11px]">
            <div className="flex-1">
              <p className="font-semibold text-white mb-1">{hoveredImp.title}</p>
              <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 text-slate-400">
                <span>Estado</span><span className="col-span-2 font-medium" style={{ color }}>{IMPORT_STATUS_LABELS[hoveredImp.status as ImportStatus]}</span>
                {etd && <><span>ETD</span><span className="col-span-2 text-slate-300">{dayjs(etd).format('DD/MM/YYYY')}</span></>}
                {eta && <><span>ETA</span><span className="col-span-2 text-slate-300">{dayjs(eta).format('DD/MM/YYYY')}</span></>}
                {transit != null && <><span>Tránsito</span><span className="col-span-2 text-slate-300">{transit} días en total</span></>}
                {elapsed != null && transit != null && <><span>Progreso</span><span className="col-span-2 text-slate-300">{elapsed}d de {transit}d ({Math.round(elapsed/transit*100)}%)</span></>}
                {daysLeft != null && <><span>{daysLeft < 0 ? 'Atraso' : 'Faltan'}</span><span className={cn('col-span-2 font-bold', daysLeft <= 0 ? 'text-red-400' : daysLeft <= 7 ? 'text-orange-400' : 'text-amber-400')}>{daysLeft <= 0 ? `ETA pasó hace ${Math.abs(daysLeft)} días` : `${daysLeft} días para la ETA`}</span></>}
              </div>
            </div>
            {(hoveredImp.actual_value ?? hoveredImp.estimated_value) && (
              <div className="text-right">
                <p className="text-[9px] text-slate-500">Valor</p>
                <p className="text-cyan-400 font-bold">{hoveredImp.currency} {(hoveredImp.actual_value ?? hoveredImp.estimated_value ?? 0).toLocaleString('es-AR',{maximumFractionDigits:0})}</p>
                {hoveredImp.cost_pct != null && <p className="text-[9px] text-slate-400">{hoveredImp.cost_pct.toFixed(1)}% costo</p>}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

// ── GanttTimeline: contenedor con filtros + leyenda + botón ampliar ────────────

function GanttTimeline({ imports }: { imports: ComexImport[] }) {
  const [scale,      setScale]      = useState<ScaleKey>('3M')
  const [showAll,    setShowAll]    = useState<'active' | 'delivered' | 'all'>('active')
  const [filterSupp, setFilterSupp] = useState<string>('all')
  const [showModal,  setShowModal]  = useState(false)

  if (imports.length === 0) return null

  // Filtrar por tab (activas/entregadas/todas)
  const baseFiltered = showAll === 'active'    ? imports.filter(i => i.status !== 'delivered')
                     : showAll === 'delivered' ? imports.filter(i => i.status === 'delivered')
                     : imports

  // Filtrar por proveedor
  const suppliers = [...new Set(imports.map(i => i.supplier?.name).filter(Boolean) as string[])]
  const filtered  = filterSupp === 'all' ? baseFiltered : baseFiltered.filter(i => i.supplier?.name === filterSupp)

  return (
    <>
    {/* Modal fullscreen */}
    {showModal && (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ width:'96vw', height:'92vh' }}>
          {/* Modal header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 flex-shrink-0">
            <div className="flex items-center gap-3">
              <Calendar size={16} className="text-cyan-400" />
              <h2 className="font-semibold text-white">Mapa de Importaciones</h2>
              <span className="text-[10px] text-slate-500">ETD → ETA — {filtered.length} importaciones</span>
            </div>
            <button onClick={() => setShowModal(false)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              <X size={16} />
            </button>
          </div>
          {/* Modal filtros */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-700/50 flex-shrink-0 flex-wrap">
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              {(['active','delivered','all'] as const).map(t => (
                <button key={t} onClick={() => setShowAll(t)}
                  className={cn('px-3 py-1 rounded-md text-[11px] font-medium transition-colors',
                    showAll === t ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white')}>
                  {t === 'active' ? 'Activas' : t === 'delivered' ? 'Entregadas' : 'Todas'}
                </button>
              ))}
            </div>
            <select value={filterSupp} onChange={e => setFilterSupp(e.target.value)}
              className="appearance-none bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-cyan-600">
              <option value="all">Todos los proveedores</option>
              {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="ml-auto flex items-center gap-1">
              {SCALES.map(s => (
                <button key={s.key} onClick={() => setScale(s.key)}
                  className={cn('px-2.5 py-1 rounded text-[11px] font-medium transition-colors',
                    scale === s.key ? 'bg-cyan-700/60 text-cyan-300 border border-cyan-700/60' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50')}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {/* Modal body */}
          <div className="flex-1 overflow-auto p-5">
            <GanttBody imports={filtered} scale={scale} isModal />
            <GanttLegend />
          </div>
        </div>
      </div>
    )}

    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Calendar size={14} className="text-cyan-400" />
          Línea de tiempo
          <span className="text-[10px] text-slate-500 font-normal">ETD → ETA</span>
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tab activas/entregadas/todas */}
          <div className="flex items-center bg-slate-900/60 rounded-lg p-0.5 border border-slate-700/50">
            {(['active','delivered','all'] as const).map(t => (
              <button key={t} onClick={() => setShowAll(t)}
                className={cn('px-2.5 py-1 rounded text-[10px] font-medium transition-colors',
                  showAll === t ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300')}>
                {t === 'active' ? `Activas (${imports.filter(i=>i.status!=='delivered').length})` : t === 'delivered' ? `Entregadas (${imports.filter(i=>i.status==='delivered').length})` : `Todas (${imports.length})`}
              </button>
            ))}
          </div>
          {/* Filtro proveedor */}
          {suppliers.length > 1 && (
            <select value={filterSupp} onChange={e => setFilterSupp(e.target.value)}
              className="appearance-none bg-slate-900/60 border border-slate-700/50 rounded-lg px-2 py-1 text-[10px] text-slate-400 focus:outline-none focus:border-cyan-600">
              <option value="all">Todos los prov.</option>
              {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {/* Escala */}
          {SCALES.map(s => (
            <button key={s.key} onClick={() => setScale(s.key)}
              className={cn('px-2 py-1 rounded text-[10px] font-medium transition-colors',
                scale === s.key ? 'bg-cyan-700/60 text-cyan-300 border border-cyan-700/60' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50')}>
              {s.label}
            </button>
          ))}
          {/* Botón ampliar */}
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors border border-slate-600"
            title="Ver mapa completo">
            <Maximize2 size={11} /> Ampliar
          </button>
        </div>
      </div>

      {/* Gráfico + Leyenda */}
      <GanttBody imports={filtered} scale={scale} />
      <GanttLegend />
    </div>
    </>
  )
}


// ── INAL Panel ────────────────────────────────────────────────────────────────

const INAL_BADGE_CONFIG: Record<string, { label: string; color: string; dot: string; Icon: React.ElementType }> = {
  pendiente:    { label: 'Pendiente',       color: 'text-amber-400',  dot: 'bg-amber-400',   Icon: ShieldOff },
  mail_enviado: { label: 'Mail enviado',    color: 'text-blue-400',   dot: 'bg-blue-400',    Icon: Mail },
  en_tramite:   { label: 'En trámite',      color: 'text-orange-400', dot: 'bg-orange-400',  Icon: Clock },
  finalizado:   { label: 'Finalizado ✓',    color: 'text-emerald-400',dot: 'bg-emerald-400', Icon: CheckCircle2 },
}

function InalUrgencyLabel({ days, lcStatus }: { days: number | null; lcStatus: string }) {
  if (lcStatus === 'finalizado') return <span className="text-[9px] text-emerald-600">LC lista</span>
  if (days === null) return <span className="text-[9px] text-slate-600">Sin ETA</span>
  if (days < 0)  return <span className="text-[9px] font-bold text-red-400 animate-pulse">⚡ Llegó hace {Math.abs(days)}d</span>
  if (days === 0) return <span className="text-[9px] font-bold text-red-400 animate-pulse">⚡ Hoy</span>
  if (days <= 7)  return <span className="text-[9px] font-bold text-orange-400">⚠ {days}d</span>
  if (days <= 15) return <span className="text-[9px] text-amber-400">{days}d</span>
  return <span className="text-[9px] text-slate-500">{days}d</span>
}

function InalPanel({ imports }: { imports: ComexImport[] }) {
  const navigate = useNavigate()
  const today    = dayjs()

  const inalImports = imports
    .filter(i => i.inal_required === 1)
    .map(i => ({
      imp:     i,
      eta:     getBestETA(i),
      days:    getBestETA(i) ? dayjs(getBestETA(i)!).diff(today, 'day') : null,
      lcStatus: (i.inal_lc_status ?? 'pendiente') as string,
    }))
    .sort((a, b) => {
      // Finalizado al final; el resto por urgencia (días ASC)
      if (a.lcStatus === 'finalizado' && b.lcStatus !== 'finalizado') return 1
      if (b.lcStatus === 'finalizado' && a.lcStatus !== 'finalizado') return -1
      const da = a.days ?? 9999, db = b.days ?? 9999
      return da - db
    })

  if (inalImports.length === 0) return null

  const pending   = inalImports.filter(i => i.lcStatus !== 'finalizado')
  const urgent    = pending.filter(i => i.days !== null && i.days <= 7)
  const finalized = inalImports.filter(i => i.lcStatus === 'finalizado')

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-emerald-950/30 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">INAL — Libre Circulación</h2>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          {pending.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-400 border border-amber-700/40 font-medium">
              {pending.length} en proceso
            </span>
          )}
          {urgent.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-900/50 text-red-400 border border-red-700/40 font-bold animate-pulse">
              {urgent.length} urgente{urgent.length !== 1 ? 's' : ''}
            </span>
          )}
          {finalized.length > 0 && (
            <span className="text-emerald-600">{finalized.length} lista{finalized.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="divide-y divide-slate-700/30">
        {inalImports.map(({ imp, days, lcStatus }) => {
          const cfg   = INAL_BADGE_CONFIG[lcStatus] ?? INAL_BADGE_CONFIG.pendiente
          const Icon  = cfg.Icon
          const isUrgent = lcStatus !== 'finalizado' && days !== null && days <= 7
          const isLate   = lcStatus !== 'finalizado' && days !== null && days < 0

          return (
            <button
              key={imp.id}
              onClick={() => navigate(`/comex/imports/${imp.id}`)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/30 transition-colors text-left group',
                isLate   && 'bg-red-950/10',
                isUrgent && !isLate && 'bg-amber-950/10'
              )}
            >
              {/* Dot de estado */}
              <span className={cn('w-2 h-2 rounded-full flex-shrink-0', cfg.dot)} />

              {/* Nombre + proveedor */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate group-hover:text-white">{imp.title}</p>
                <p className="text-[9px] text-slate-600 truncate">{imp.supplier?.name}</p>
              </div>

              {/* Estado LC */}
              <span className={cn('text-[10px] font-medium flex-shrink-0 flex items-center gap-1', cfg.color)}>
                <Icon size={10} />
                {cfg.label}
              </span>

              {/* Urgencia ETA */}
              <div className="flex-shrink-0 text-right min-w-[55px]">
                <InalUrgencyLabel days={days} lcStatus={lcStatus} />
                {getBestETA(imp) && (
                  <p className="text-[8px] text-slate-700">{dayjs(getBestETA(imp)!).format('DD/MM/YY')}</p>
                )}
              </div>

              <ChevronRight size={11} className="text-slate-700 group-hover:text-slate-400 flex-shrink-0" />
            </button>
          )
        })}
      </div>

      {/* Leyenda compacta */}
      <div className="px-4 py-2 border-t border-slate-700/30 bg-slate-900/20 flex items-center gap-4 flex-wrap">
        <span className="text-[9px] text-slate-600 font-medium uppercase tracking-wider">Estado LC:</span>
        {Object.entries(INAL_BADGE_CONFIG).map(([k, v]) => (
          <span key={k} className={cn('flex items-center gap-1 text-[9px]', v.color)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', v.dot)} />
            {v.label}
          </span>
        ))}
        <span className="ml-auto text-[9px] text-orange-500">⚠ = ETA ≤ 7 días sin LC finalizada</span>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ComexDashboard() {
  const { data: imports = [] } = useComexImports()
  const { data: plannings = [] } = useComexPlannings({})
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
            {alertCount === 0 ? 'Sin alertas de ETA' :
             [overdue.length > 0 && `${overdue.length} ETA vencida`,
              inalPending.filter(i => { const d = getBestETA(i); return d && dayjs(d).diff(dayjs(), 'day') <= 7 }).length > 0 &&
              `${inalPending.filter(i => { const d = getBestETA(i); return d && dayjs(d).diff(dayjs(), 'day') <= 7 }).length} INAL urgente`
             ].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      {/* ── Programación de pedidos ── */}
      {plannings.length > 0 && <PlanningDashboardPanel plannings={plannings} />}

      {/* ── Pipeline ── */}
      <Pipeline imports={imports} />

      {/* ── Panel INAL ── */}
      <InalPanel imports={imports} />

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

      {/* ── Alertas de ETA vencida ── */}
      {overdue.length > 0 && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-4 space-y-2">
          <h2 className="text-sm font-semibold text-red-300 flex items-center gap-2">
            <AlertCircle size={14} /> ETA vencida sin entregar
          </h2>
          {overdue.map(imp => {
            const eta  = getBestETA(imp)
            const days = eta ? Math.abs(dayjs(eta).diff(dayjs(), 'day')) : 0
            return (
              <button key={imp.id} onClick={() => navigate(`/comex/imports/${imp.id}`)}
                className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors w-full text-left">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                <span className="flex-1 truncate">{imp.title}</span>
                <span className="text-red-500 font-semibold flex-shrink-0">
                  ETA {eta ? dayjs(eta).format('DD/MM') : '—'} · hace {days}d
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
