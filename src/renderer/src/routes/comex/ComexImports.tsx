import { useState, useCallback, useMemo } from 'react'
import {
  Package, Plus, Search, X, ChevronRight, Sparkles,
  LayoutGrid, List, Clock,
  FileX, Ship, Calendar, CheckCircle, Mail, ShieldCheck,
  TrendingUp, ChevronDown, Anchor
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
dayjs.locale('es')

import {
  useComexImports,
  useCreateComexImport,
  useComexSuppliers
} from '../../hooks/useComex'
import {
  IMPORT_STATUS_LABELS,
  IMPORT_STATUS_COLORS,
  INCOTERMS
} from '@shared/types'
import type { ImportStatus, CreateComexImportInput, ComexImport } from '@shared/types'
import { cn } from '../../components/ui/utils'

const ALL_STATUSES       = Object.keys(IMPORT_STATUS_LABELS) as ImportStatus[]
const ACTIVE_STATUSES    = ALL_STATUSES.filter(s => s !== 'delivered')
const CURRENCIES         = ['USD', 'EUR', 'CNY', 'GBP', 'JPY']

const EUR_COUNTRIES = new Set([
  'italia','italy','alemania','germany','deutschland','austria','österreich',
  'francia','france','españa','spain','holanda','netherlands','países bajos',
  'bélgica','belgium','belgique','portugal','grecia','greece','eslovenia',
  'slovenia','eslovaquia','slovakia','irlanda','ireland','luxemburgo','luxembourg',
  'finlandia','finland','suecia','sweden',
])

function inferCurrencyFromCountry(country: string): string {
  return EUR_COUNTRIES.has(country.toLowerCase().trim()) ? 'EUR' : 'USD'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getEta(imp: ComexImport): number | null {
  return imp.eta_4 ?? imp.eta_3 ?? imp.eta_2 ?? imp.arrival_date ?? null
}

function getDaysUntil(ts: number | null): number | null {
  if (!ts) return null
  return Math.ceil((ts - Date.now()) / 86_400_000)
}

function fmtValue(imp: ComexImport): string {
  const v = imp.actual_value ?? imp.estimated_value
  if (v == null) return '—'
  return `${imp.currency} ${v.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
}

// ── ETA Badge ─────────────────────────────────────────────────────────────────

function EtaBadge({ imp }: { imp: ComexImport }) {
  const eta  = getEta(imp)
  const days = getDaysUntil(eta)
  if (!eta) return <span className="text-[10px] text-slate-600">Sin ETA</span>

  const label = dayjs(eta).format('DD/MM/YY')

  if (days == null) return <span className="text-[10px] text-slate-500">{label}</span>
  if (days < 0)     return <span className="text-[10px] text-slate-500">{label} <span className="text-red-400 font-semibold">({Math.abs(days)}d atrás)</span></span>
  if (days === 0)   return <span className="text-[10px] font-bold text-red-400 animate-pulse">HOY ⚡</span>
  if (days <= 3)    return <span className="text-[10px] text-red-400 font-semibold">{label} <span className="text-red-400">({days}d) ⚡</span></span>
  if (days <= 7)    return <span className="text-[10px] text-orange-400 font-semibold">{label} <span className="text-orange-500">({days}d)</span></span>
  if (days <= 30)   return <span className="text-[10px] text-amber-400">{label} <span className="text-amber-600">({days}d)</span></span>
  return <span className="text-[10px] text-slate-400">{label} <span className="text-slate-600">({days}d)</span></span>
}

// ── Checklist de documentos ───────────────────────────────────────────────────

type DocState = 'ok' | 'missing' | 'na'

function DocBadge({ label, state }: { label: string; state: DocState }) {
  if (state === 'ok')      return <span className="inline-flex items-center gap-0.5 text-[9px] text-emerald-500"><CheckCircle size={9} />{label}</span>
  if (state === 'missing') return <span className="inline-flex items-center gap-0.5 text-[9px] text-rose-500"><FileX size={9} />{label}</span>
  return null
}

function DocChecklist({ imp }: { imp: ComexImport }) {
  const docs: Array<{ label: string; state: DocState }> = [
    { label: 'Proforma', state: imp.estimated_value != null ? 'ok' : 'missing' },
    { label: 'Factura',  state: imp.actual_value    != null ? 'ok' : 'missing' },
    { label: 'PL',       state: imp.pl_stored_name ? 'ok' : 'missing' },
    { label: 'BL',       state: (imp.bl_stored_name || imp.bl_number) ? 'ok' : 'missing' },
    { label: 'Despacho', state: imp._despacho_number ? 'ok' : imp.despacho_stored_name ? 'ok' : 'missing' },
    { label: 'Costos',   state: imp.cost_pct != null ? 'ok' : 'missing' },
  ]

  const isEarly   = ['planning','ordered','paid','production'].includes(imp.status)
  const isShipped = ['shipped','transit','customs','delivered'].includes(imp.status)

  const visible = docs.filter(d => {
    if (isEarly   && ['BL','Despacho','Costos'].includes(d.label)) return d.state === 'ok'
    if (!isShipped && ['Costos'].includes(d.label))                return d.state === 'ok'
    return true
  })

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {visible.map(d => <DocBadge key={d.label} {...d} />)}
    </div>
  )
}

// ── Barra de costo ────────────────────────────────────────────────────────────

function CostBar({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-[10px] text-slate-600">Sin costo</span>
  const color = pct < 15 ? 'bg-emerald-500' : pct < 25 ? 'bg-amber-500' : pct < 40 ? 'bg-orange-500' : 'bg-red-500'
  const textColor = pct < 15 ? 'text-emerald-400' : pct < 25 ? 'text-amber-400' : pct < 40 ? 'text-orange-400' : 'text-red-400'
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden w-16">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.min(pct / 50 * 100, 100)}%` }} />
      </div>
      <span className={cn('text-[10px] font-semibold', textColor)}>{pct.toFixed(1)}%</span>
    </div>
  )
}

// ── InalBadge ─────────────────────────────────────────────────────────────────

const INAL_LC_BADGE: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pendiente:    { label: 'INAL — Pendiente',       cls: 'bg-amber-900/40 text-amber-400 border-amber-700/50',    icon: <ShieldCheck size={9}/> },
  mail_enviado: { label: 'INAL — Mail enviado',    cls: 'bg-blue-900/40 text-blue-400 border-blue-700/50',      icon: <Mail size={9}/> },
  en_tramite:   { label: 'INAL — En trámite',      cls: 'bg-orange-900/40 text-orange-400 border-orange-700/50',icon: <Clock size={9}/> },
  finalizado:   { label: 'INAL ✓',                 cls: 'bg-emerald-900/30 text-emerald-500 border-emerald-700/30', icon: <CheckCircle size={9}/> },
}

function InalBadge({ lcStatus, etaDays }: { lcStatus: string; etaDays: number | null }) {
  const badge   = INAL_LC_BADGE[lcStatus] ?? INAL_LC_BADGE.pendiente
  const urgente = lcStatus !== 'finalizado' && etaDays != null && etaDays <= 7
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border',
      badge.cls,
      urgente && 'ring-1 ring-orange-500/50'
    )}>
      {badge.icon}
      {badge.label}
      {urgente && <span className="text-orange-400">⚡</span>}
    </span>
  )
}

// ── SupplierAvatar ────────────────────────────────────────────────────────────

function SupplierAvatar({ storedName, supplierName, size = 40 }: {
  storedName?: string | null; supplierName?: string; size?: number
}) {
  const { data: dataUrl } = useQuery({
    queryKey:  ['logo-url', storedName],
    queryFn:   () => storedName ? window.api.comex.logo.getDataUrl(storedName) : null,
    enabled:   !!storedName, staleTime: Infinity, gcTime: Infinity,
  })
  const initials  = (supplierName ?? '?').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const COLORS    = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6']
  const bg        = COLORS[(supplierName ?? '').charCodeAt(0) % COLORS.length]
  const dim       = `${size}px`
  if (dataUrl) return (
    <div className="flex-shrink-0 rounded-xl overflow-hidden border border-slate-600/50 bg-slate-900/50"
      style={{ width: dim, height: dim }}>
      <img src={dataUrl} alt={supplierName} className="w-full h-full object-contain p-1" />
    </div>
  )
  return (
    <div className="flex-shrink-0 rounded-xl flex items-center justify-center font-bold text-white"
      style={{ width: dim, height: dim, backgroundColor: bg + '33', border: `1.5px solid ${bg}55` }}>
      <span style={{ color: bg, fontSize: size * 0.32 }}>{initials}</span>
    </div>
  )
}

// ── KPI Bar ───────────────────────────────────────────────────────────────────

function KPIBar({ imports }: { imports: ComexImport[] }) {
  const now          = Date.now()
  const weekAhead    = now + 7 * 86_400_000
  const active       = imports.filter(i => i.status !== 'delivered')
  const delivered    = imports.filter(i => i.status === 'delivered')


  const comingSoon   = active.filter(i => { const e = getEta(i); return e && e >= now && e <= weekAhead })
  const inCustoms    = active.filter(i => i.status === 'customs')
  const inTransit    = active.filter(i => ['shipped','transit'].includes(i.status))
  const withInal     = active.filter(i => i.inal_required && i.inal_lc_status !== 'finalizado')
  const avgCost      = (() => {
    const withCost = imports.filter(i => i.cost_pct != null)
    return withCost.length > 0 ? withCost.reduce((s, i) => s + (i.cost_pct ?? 0), 0) / withCost.length : null
  })()

  const kpis = [
    {
      label: 'Importaciones activas',
      value: active.length.toString(),
      sub:   `${delivered.length} entregadas`,
      icon:  <Package size={16} className="text-cyan-400" />,
      accent:'border-cyan-800/40 bg-cyan-950/20',
    },
    {
      label: 'En tránsito / aduana',
      value: (inTransit.length + inCustoms.length).toString(),
      sub:   inCustoms.length > 0 ? `${inCustoms.length} en aduana` : 'Sin urgencias',
      icon:  <Ship size={16} className="text-blue-400" />,
      accent: inCustoms.length > 0 ? 'border-blue-700/50 bg-blue-950/20' : 'border-slate-700/40',
    },
    {
      label: 'Llegan esta semana',
      value: comingSoon.length.toString(),
      sub:   comingSoon.length > 0 ? comingSoon.map(i => i.title).join(', ') : 'Sin llegadas próximas',
      icon:  <Clock size={16} className={comingSoon.length > 0 ? 'text-orange-400' : 'text-slate-500'} />,
      accent: comingSoon.length > 0 ? 'border-orange-700/50 bg-orange-950/20' : 'border-slate-700/40',
    },
    {
      label: 'Costo prom. histórico',
      value: avgCost != null ? `${avgCost.toFixed(1)}%` : '—',
      sub:   withInal.length > 0 ? `⚠ ${withInal.length} INAL pendiente` : 'Sin alertas INAL',
      icon:  <TrendingUp size={16} className={avgCost != null && avgCost > 35 ? 'text-red-400' : 'text-emerald-400'} />,
      accent: withInal.length > 0 ? 'border-amber-700/50 bg-amber-950/10' : 'border-slate-700/40',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {kpis.map(k => (
        <div key={k.label} className={cn('rounded-xl border px-4 py-3 space-y-1', k.accent)}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{k.label}</p>
            {k.icon}
          </div>
          <p className="text-2xl font-bold text-white leading-none">{k.value}</p>
          <p className="text-[10px] text-slate-500 truncate">{k.sub}</p>
        </div>
      ))}
    </div>
  )
}

// ── Status Pipeline ───────────────────────────────────────────────────────────

function StatusPipeline({
  imports, activeFilter, onFilter
}: {
  imports: ComexImport[]
  activeFilter: ImportStatus | 'all'
  onFilter: (s: ImportStatus | 'all') => void
}) {
  const counts = ACTIVE_STATUSES.reduce((acc, s) => {
    acc[s] = imports.filter(i => i.status === s).length
    return acc
  }, {} as Record<ImportStatus, number>)

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-4">
      <button
        onClick={() => onFilter('all')}
        className={cn(
          'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
          activeFilter === 'all' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
        )}
      >
        Todas
      </button>
      {ACTIVE_STATUSES.map((s, idx) => {
        const count = counts[s] ?? 0
        const color = IMPORT_STATUS_COLORS[s]
        const isActive = activeFilter === s
        return (
          <div key={s} className="flex items-center gap-0.5 flex-shrink-0">
            {idx > 0 && <ChevronRight size={12} className="text-slate-700 flex-shrink-0" />}
            <button
              onClick={() => onFilter(isActive ? 'all' : s)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                isActive ? 'text-white' : count > 0 ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-700 cursor-default'
              )}
              style={isActive ? { backgroundColor: color + 'cc' } : {}}
              disabled={count === 0}
            >
              {count > 0 && (
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : color }}
                >
                  {count}
                </span>
              )}
              {IMPORT_STATUS_LABELS[s]}
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── Import Card (mejorada) ────────────────────────────────────────────────────

function ImportCard({ imp }: { imp: ComexImport }) {
  const navigate = useNavigate()
  const color    = IMPORT_STATUS_COLORS[imp.status as ImportStatus]
  const label    = IMPORT_STATUS_LABELS[imp.status as ImportStatus]
  const eta      = getEta(imp)
  const days     = getDaysUntil(eta)

  // Urgencias para borde de la card
  const isUrgent    = days != null && days >= 0 && days <= 3
  const isUpcoming  = days != null && days >= 0 && days <= 7

  return (
    <button
      onClick={() => navigate(`/comex/imports/${imp.id}`)}
      className={cn(
        'w-full text-left bg-slate-800 rounded-xl overflow-hidden transition-all hover:scale-[1.01] hover:shadow-lg group',
        isUrgent   ? 'border-2 border-red-600/70 shadow-red-900/20 shadow-md'
        : isUpcoming ? 'border-2 border-orange-600/50'
        : 'border border-slate-700 hover:border-slate-600'
      )}
    >
      {/* Barra de estado superior */}
      <div className="h-0.5 w-full" style={{ backgroundColor: color }} />

      <div className="p-3.5 space-y-3">
        {/* ── ZONA 1: Identificación ── */}
        <div className="flex items-start gap-2.5">
          <SupplierAvatar storedName={imp._supplier_logo} supplierName={imp.supplier?.name} size={40} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: color + '25', color }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                {label}
              </span>
              {imp.incoterm && (
                <span className="text-[10px] text-slate-500 bg-slate-700/60 px-1.5 py-0.5 rounded">{imp.incoterm}</span>
              )}
              {imp.inal_required === 1 && (
                <InalBadge lcStatus={imp.inal_lc_status ?? 'pendiente'} etaDays={getDaysUntil(getEta(imp))} />
              )}
              {imp._canal_despacho && (
                <span className={cn(
                  'text-[9px] font-bold px-1.5 py-0.5 rounded uppercase',
                  imp._canal_despacho.includes('ROJO') ? 'bg-red-900/40 text-red-400' :
                  imp._canal_despacho.includes('VERDE') ? 'bg-emerald-900/40 text-emerald-400' :
                  'bg-amber-900/40 text-amber-400'
                )}>
                  {imp._canal_despacho.split(' ')[0]}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-white truncate leading-tight">{imp.title}</p>
            {imp.supplier && (
              <p className="text-[11px] text-slate-400 truncate">{imp.supplier.name}</p>
            )}
          </div>
          <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0 mt-1" />
        </div>

        {/* ── ZONA 2: Financiero ── */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-cyan-400">{fmtValue(imp)}</span>
          <CostBar pct={imp.cost_pct} />
        </div>

        {/* BL + Despacho + Carga física */}
        {(imp.bl_number || imp.forwarder_ref_mail || imp._despacho_number || imp._peso_bruto_kg != null) && (
          <div className="space-y-0.5">
            {(imp.bl_number || imp.forwarder_ref_mail) && (
              <div className="flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
                {imp.bl_number       && <span><span className="text-slate-600">BL: </span><span className="font-mono text-slate-400">{imp.bl_number}</span></span>}
                {imp.bl_number && imp.forwarder_ref_mail && <span className="text-slate-700">·</span>}
                {imp.forwarder_ref_mail && <span><span className="text-slate-600">Ref: </span><span className="text-slate-400 truncate max-w-[130px] inline-block align-bottom">{imp.forwarder_ref_mail}</span></span>}
              </div>
            )}
            {imp._despacho_number && (
              <p className="text-[10px] text-slate-400 font-mono truncate">
                <span className="text-slate-600">Desp.: </span>{imp._despacho_number}
              </p>
            )}
            {(imp._peso_bruto_kg != null || imp._volumen_m3 != null) && (
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                {imp._peso_bruto_kg != null && <span><span className="text-slate-400 font-medium">{imp._peso_bruto_kg.toLocaleString('es-AR', {maximumFractionDigits:0})}</span> kg</span>}
                {imp._peso_bruto_kg != null && imp._volumen_m3 != null && <span className="text-slate-700">·</span>}
                {imp._volumen_m3 != null && <span><span className="text-slate-400 font-medium">{imp._volumen_m3.toLocaleString('es-AR', {maximumFractionDigits:2})}</span> m³</span>}
              </div>
            )}
          </div>
        )}

        {/* ── ZONA 3: Checklist documentos ── */}
        <DocChecklist imp={imp} />

        {/* ── ZONA 4: Oficializada + ETA + Forwarder ── */}
        <div className="pt-1 border-t border-slate-700/40 space-y-1">
          {/* Fila oficialización */}
          {imp._oficializacion_date && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="text-slate-600">Oficializada:</span>
              <span className="text-slate-300 font-medium">
                {dayjs(imp._oficializacion_date).format('DD/MM/YYYY')}
              </span>
            </div>
          )}
          {/* Fila ETA + forwarder */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Calendar size={10} className="text-slate-600" />
              <EtaBadge imp={imp} />
            </div>
            {imp._freight_operator_name && (
              <span className="text-[9px] text-slate-600 truncate max-w-[120px]">{imp._freight_operator_name}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

// ── Mini Card para Kanban ─────────────────────────────────────────────────────

function MiniCard({ imp }: { imp: ComexImport }) {
  const navigate = useNavigate()
  const days     = getDaysUntil(getEta(imp))
  const isUrgent = days != null && days >= 0 && days <= 7

  return (
    <button
      onClick={() => navigate(`/comex/imports/${imp.id}`)}
      className={cn(
        'w-full text-left bg-slate-800 rounded-lg p-2.5 border transition-all hover:border-slate-600 group',
        isUrgent ? 'border-orange-700/60' : 'border-slate-700'
      )}
    >
      <div className="flex items-start gap-2">
        <SupplierAvatar storedName={imp._supplier_logo} supplierName={imp.supplier?.name} size={28} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate leading-tight">{imp.title}</p>
          <p className="text-[10px] text-cyan-400 font-medium mt-0.5">{fmtValue(imp)}</p>
          {imp.cost_pct != null && (
            <p className={cn('text-[10px] font-semibold',
              imp.cost_pct < 25 ? 'text-emerald-500' : imp.cost_pct < 35 ? 'text-amber-500' : 'text-red-500'
            )}>
              {imp.cost_pct.toFixed(1)}% costo
            </p>
          )}
          <div className="flex items-center gap-1 mt-1">
            <EtaBadge imp={imp} />
          </div>
        </div>
      </div>
    </button>
  )
}

// ── Kanban View ───────────────────────────────────────────────────────────────

function KanbanBoard({ imports }: { imports: ComexImport[] }) {
  const [showDelivered, setShowDelivered] = useState(false)
  const active    = imports.filter(i => i.status !== 'delivered')
  const delivered = imports.filter(i => i.status === 'delivered')

  const columns = ACTIVE_STATUSES.map(s => ({
    status: s,
    label:  IMPORT_STATUS_LABELS[s],
    color:  IMPORT_STATUS_COLORS[s],
    items:  active.filter(i => i.status === s),
  }))

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3 min-w-max">
        {columns.map(col => (
          <div key={col.status} className="w-56 flex-shrink-0">
            {/* Column header */}
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide truncate">{col.label}</span>
              {col.items.length > 0 && (
                <span className="ml-auto text-[10px] font-bold text-white bg-slate-700 rounded-full px-1.5 py-0.5 flex-shrink-0">
                  {col.items.length}
                </span>
              )}
            </div>
            {/* Cards */}
            <div className="space-y-2">
              {col.items.length === 0 ? (
                <div className="h-16 rounded-lg border border-dashed border-slate-700/40 flex items-center justify-center">
                  <span className="text-[10px] text-slate-700">Vacío</span>
                </div>
              ) : (
                col.items.map(imp => <MiniCard key={imp.id} imp={imp} />)
              )}
            </div>
          </div>
        ))}

        {/* Delivered column */}
        {delivered.length > 0 && (
          <div className="w-56 flex-shrink-0">
            <button
              onClick={() => setShowDelivered(v => !v)}
              className="flex items-center gap-2 mb-2 px-1 w-full text-left"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Entregado</span>
              <span className="ml-auto text-[10px] font-bold text-white bg-slate-700 rounded-full px-1.5 py-0.5">
                {delivered.length}
              </span>
              <ChevronDown size={12} className={cn('text-slate-600 transition-transform', showDelivered && 'rotate-180')} />
            </button>
            {showDelivered && (
              <div className="space-y-2">
                {delivered.slice(0, 10).map(imp => <MiniCard key={imp.id} imp={imp} />)}
                {delivered.length > 10 && (
                  <p className="text-[10px] text-slate-600 text-center">+{delivered.length - 10} más</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Timeline View ─────────────────────────────────────────────────────────────

function TimelineView({ imports }: { imports: ComexImport[] }) {
  const active  = imports.filter(i => i.status !== 'delivered')
  const withEta = active.filter(i => getEta(i) != null).sort((a, b) => (getEta(a) ?? 0) - (getEta(b) ?? 0))
  const noEta   = active.filter(i => getEta(i) == null)

  const groups = [
    { key: 'urgent', label: '⚡ Hoy — 3 días',    color: 'border-red-700/50 bg-red-950/10',    items: withEta.filter(i => { const d = getDaysUntil(getEta(i)); return d != null && d >= 0 && d <= 3 }) },
    { key: 'week',   label: '🔜 Esta semana',      color: 'border-orange-700/50 bg-orange-950/10', items: withEta.filter(i => { const d = getDaysUntil(getEta(i)); return d != null && d > 3 && d <= 7 }) },
    { key: 'month',  label: '📅 Próximo mes',      color: 'border-amber-700/40 bg-amber-950/10', items: withEta.filter(i => { const d = getDaysUntil(getEta(i)); return d != null && d > 7 && d <= 30 }) },
    { key: 'future', label: '🗓 Más adelante',     color: 'border-slate-700/40',                items: withEta.filter(i => { const d = getDaysUntil(getEta(i)); return d == null || d > 30 }) },
    { key: 'past',   label: '⬅ ETA ya pasada',    color: 'border-slate-700/30',                items: withEta.filter(i => { const d = getDaysUntil(getEta(i)); return d != null && d < 0 }) },
  ]

  return (
    <div className="space-y-4">
      {groups.filter(g => g.items.length > 0).map(g => (
        <div key={g.key} className={cn('rounded-xl border p-4', g.color)}>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{g.label}</p>
          <div className="space-y-2">
            {g.items.map(imp => {
              const eta  = getEta(imp)
              const days = getDaysUntil(eta)
              const color = IMPORT_STATUS_COLORS[imp.status as ImportStatus]
              return (
                <button
                  key={imp.id}
                  onClick={() => { /* navigate handled below */ }}
                  className="w-full text-left"
                >
                  <TimelineRow imp={imp} eta={eta} days={days} color={color} />
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {noEta.length > 0 && (
        <div className="rounded-xl border border-slate-700/30 p-4">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">📦 Sin fecha de llegada</p>
          <div className="space-y-2">
            {noEta.map(imp => (
              <TimelineRow key={imp.id} imp={imp} eta={null} days={null}
                color={IMPORT_STATUS_COLORS[imp.status as ImportStatus]} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TimelineRow({ imp, eta, days, color }: {
  imp: ComexImport; eta: number | null; days: number | null; color: string
}) {
  const navigate = useNavigate()
  return (
    <div
      onClick={() => navigate(`/comex/imports/${imp.id}`)}
      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-700/30 transition-colors cursor-pointer group"
    >
      {/* Estado dot */}
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />

      {/* Logo */}
      <SupplierAvatar storedName={imp._supplier_logo} supplierName={imp.supplier?.name} size={28} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white truncate">{imp.title}</p>
          {imp.inal_required === 1 && (
            <InalBadge lcStatus={imp.inal_lc_status ?? 'pendiente'} etaDays={getDaysUntil(getEta(imp))} />
          )}
        </div>
        <p className="text-[10px] text-slate-500">{imp.supplier?.name} · <span className="text-cyan-400">{fmtValue(imp)}</span> {imp.cost_pct != null && `· ${imp.cost_pct.toFixed(1)}%`}</p>
      </div>

      {/* ETA */}
      <div className="text-right flex-shrink-0">
        {eta ? (
          <>
            <p className="text-xs font-semibold text-slate-200">{dayjs(eta).format('DD/MM/YYYY')}</p>
            {days != null && (
              <p className={cn('text-[10px]',
                days <= 0 ? 'text-slate-500' :
                days <= 3 ? 'text-red-400 font-bold' :
                days <= 7 ? 'text-orange-400 font-semibold' :
                days <= 30 ? 'text-amber-400' : 'text-slate-500'
              )}>
                {days <= 0 ? `${Math.abs(days)}d atrás` : `en ${days}d`}
              </p>
            )}
          </>
        ) : (
          <p className="text-[10px] text-slate-600">Sin ETA</p>
        )}
      </div>

      <ChevronRight size={12} className="text-slate-700 group-hover:text-slate-400 transition-colors flex-shrink-0" />
    </div>
  )
}

// ── AutoBadge ─────────────────────────────────────────────────────────────────

function AutoBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-violet-900/40 border border-violet-700/40 text-violet-400 font-medium">
      <Sparkles size={8} />auto
    </span>
  )
}

// ── Create Form ───────────────────────────────────────────────────────────────

function CreateImportModal({ onClose }: { onClose: () => void }) {
  const { data: suppliers  = [] } = useComexSuppliers()
  const { data: allImports = [] } = useComexImports()
  const create = useCreateComexImport()

  const [form, setForm] = useState<Partial<CreateComexImportInput>>({
    status: 'planning', currency: 'USD', incoterm: 'FOB',
    origin_country: '', title: '', notes: '', tracking_number: '', customs_agent: ''
  })
  const [autoFilled, setAutoFilled]             = useState<Set<string>>(new Set())
  const [supplierCurrencies, setSupplierCurrencies] = useState<string[]>([])

  const setField = (k: keyof CreateComexImportInput, v: unknown, manual = false) => {
    setForm(prev => ({ ...prev, [k]: v }))
    if (manual) setAutoFilled(prev => { const n = new Set(prev); n.delete(k as string); return n })
  }

  const handleSupplierChange = useCallback((supplierId: string) => {
    setField('supplier_id', supplierId || null)
    if (!supplierId) { setAutoFilled(new Set()); setSupplierCurrencies([]); return }
    const supplier = suppliers.find(s => s.id === supplierId)
    if (!supplier) return
    const filled = new Set<string>()
    if (supplier.country?.trim())            { setField('origin_country', supplier.country); filled.add('origin_country') }
    if (supplier.incoterms_preferred?.trim()) { setField('incoterm', supplier.incoterms_preferred); filled.add('incoterm') }
    const prevCurrencies = [...new Set(allImports.filter(i => i.supplier_id === supplierId).sort((a,b) => b.created_at - a.created_at).map(i => i.currency).filter(Boolean))] as string[]
    const defaultCurrency = prevCurrencies.length >= 1 ? prevCurrencies[0] : inferCurrencyFromCountry(supplier.country ?? '')
    setField('currency', defaultCurrency); filled.add('currency')
    setSupplierCurrencies(prevCurrencies.length > 1 ? prevCurrencies : [])
    setAutoFilled(filled)
  }, [suppliers, allImports])

  const set = (k: keyof CreateComexImportInput, v: unknown) => setField(k, v, true)

  const dateToTs = (s: string) => (s ? dayjs(s).valueOf() : null)
  const tsToDate = (n: number | null | undefined) => n ? dayjs(n).format('YYYY-MM-DD') : ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title?.trim()) return
    await create.mutateAsync({
      title: form.title, supplier_id: form.supplier_id ?? null,
      status: form.status ?? 'planning', incoterm: form.incoterm ?? '',
      origin_country: form.origin_country ?? '', currency: form.currency ?? 'USD',
      estimated_value: form.estimated_value ?? null, actual_value: null,
      order_date: form.order_date ?? null, payment_date: form.payment_date ?? null,
      ship_date: form.ship_date ?? null, arrival_date: form.arrival_date ?? null,
      actual_ship_date: null, actual_arrival_date: null,
      tracking_number: form.tracking_number ?? '', customs_agent: form.customs_agent ?? '',
      drive_folder_id: null, notes: form.notes ?? ''
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="font-semibold text-white">Nueva importación</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Título *</label>
            <input autoFocus value={form.title ?? ''} onChange={e => set('title', e.target.value)}
              placeholder="ej. Edelrid #53 — Verano 2026"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Estado</label>
              <select value={form.status} onChange={e => set('status', e.target.value as ImportStatus)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                {ALL_STATUSES.map(s => <option key={s} value={s}>{IMPORT_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Proveedor</label>
              <select value={form.supplier_id ?? ''} onChange={e => handleSupplierChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                <option value="">Sin proveedor</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">País origen {autoFilled.has('origin_country') && <AutoBadge />}</label>
              <input value={form.origin_country ?? ''} onChange={e => set('origin_country', e.target.value)} placeholder="China"
                className={cn('w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500', autoFilled.has('origin_country') ? 'border-violet-600/60' : 'border-slate-600')} />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">Incoterm {autoFilled.has('incoterm') && <AutoBadge />}</label>
              <select value={form.incoterm ?? 'FOB'} onChange={e => set('incoterm', e.target.value)}
                className={cn('w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500', autoFilled.has('incoterm') ? 'border-violet-600/60' : 'border-slate-600')}>
                {INCOTERMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">Moneda {autoFilled.has('currency') && <AutoBadge />}</label>
              <select value={form.currency ?? 'USD'} onChange={e => set('currency', e.target.value)}
                className={cn('w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500', autoFilled.has('currency') ? 'border-violet-600/60' : 'border-slate-600')}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {supplierCurrencies.length > 1 && (
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="text-[10px] text-slate-500">Usados:</span>
                  {supplierCurrencies.map(cur => (
                    <button key={cur} type="button" onClick={() => set('currency', cur)}
                      className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors',
                        form.currency === cur ? 'bg-violet-600/30 border-violet-500 text-violet-300' : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-white')}>
                      {cur}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Valor estimado</label>
            <input type="number" min="0" step="0.01" value={form.estimated_value ?? ''}
              onChange={e => set('estimated_value', e.target.value ? Number(e.target.value) : null)}
              placeholder="0.00"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Fecha de pedido</label>
              <input type="date" value={tsToDate(form.order_date)} onChange={e => set('order_date', dateToTs(e.target.value))}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">ETA estimada</label>
              <input type="date" value={tsToDate(form.arrival_date)} onChange={e => set('arrival_date', dateToTs(e.target.value))}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notas</label>
            <textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} rows={2}
              placeholder="Información adicional..."
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors">Cancelar</button>
            <button type="submit" disabled={create.isPending || !form.title?.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 transition-colors">
              {create.isPending ? 'Creando...' : 'Crear importación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main View ─────────────────────────────────────────────────────────────────

type ViewMode   = 'cards' | 'kanban' | 'timeline'
type TabFilter  = 'active' | 'delivered' | 'all'

export default function ComexImports() {
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<ImportStatus | 'all'>('all')
  const [tabFilter,    setTabFilter]    = useState<TabFilter>('active')
  const [viewMode,     setViewMode]     = useState<ViewMode>('cards')
  const [showCreate,   setShowCreate]   = useState(false)
  // Filtro por rango de fecha de oficialización
  const [oficFrom,     setOficFrom]     = useState('')  // YYYY-MM-DD
  const [oficTo,       setOficTo]       = useState('')  // YYYY-MM-DD
  const [showDateFilter, setShowDateFilter] = useState(false)

  const { data: imports = [], isLoading } = useComexImports()

  // Tab filtering
  const tabFiltered = useMemo(() => {
    if (tabFilter === 'active')    return imports.filter(i => i.status !== 'delivered')
    if (tabFilter === 'delivered') return imports.filter(i => i.status === 'delivered')
    return imports
  }, [imports, tabFilter])

  // Status + search + date range filtering → sorted by oficialización DESC, then created_at DESC
  const filtered = useMemo(() => {
    const fromTs = oficFrom ? dayjs(oficFrom).valueOf() : null
    const toTs   = oficTo   ? dayjs(oficTo).endOf('day').valueOf() : null

    return tabFiltered
      .filter(i => {
        if (statusFilter !== 'all' && i.status !== statusFilter) return false

        // Filtro por rango de fecha de oficialización
        if (fromTs || toTs) {
          const ofic = i._oficializacion_date ?? null
          if (!ofic) return false   // sin oficialización no entra en el filtro de fecha
          if (fromTs && ofic < fromTs) return false
          if (toTs   && ofic > toTs)   return false
        }

        if (!search) return true
        const q = search.toLowerCase()
        return (
          i.title.toLowerCase().includes(q) ||
          (i.supplier?.name ?? '').toLowerCase().includes(q) ||
          (i.origin_country ?? '').toLowerCase().includes(q) ||
          (i.bl_number ?? '').toLowerCase().includes(q) ||
          (i._despacho_number ?? '').toLowerCase().includes(q) ||
          // búsqueda por fecha de oficialización (DD/MM/YYYY o YYYY-MM-DD)
          (i._oficializacion_date ? dayjs(i._oficializacion_date).format('DD/MM/YYYY').includes(q) : false) ||
          (i._oficializacion_date ? dayjs(i._oficializacion_date).format('YYYY-MM-DD').includes(q) : false)
        )
      })
      .sort((a, b) => {
        // Importaciones con fecha de oficialización primero, las más recientes arriba
        const oa = a._oficializacion_date ?? 0
        const ob = b._oficializacion_date ?? 0
        if (oa !== ob) return ob - oa   // desc: más reciente primero
        return b.created_at - a.created_at
      })
  }, [tabFiltered, statusFilter, search, oficFrom, oficTo])

  const activeCount    = imports.filter(i => i.status !== 'delivered').length
  const deliveredCount = imports.filter(i => i.status === 'delivered').length

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Anchor size={20} className="text-cyan-400" />
          <div>
            <h1 className="text-lg font-bold text-white">Importaciones</h1>
            <p className="text-xs text-slate-500">Gestión de compras al exterior · NAKA OUTDOORS</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Nueva importación
        </button>
      </div>

      {/* ── KPI Bar ── */}
      <KPIBar imports={imports} />

      {/* ── Pipeline de estados ── */}
      {tabFilter !== 'delivered' && (
        <StatusPipeline
          imports={tabFiltered}
          activeFilter={statusFilter}
          onFilter={setStatusFilter}
        />
      )}

      {/* ── Controles: tabs + search + vista ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Tabs */}
        <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
          {([
            { key: 'active',    label: `Activas (${activeCount})` },
            { key: 'delivered', label: `Entregadas (${deliveredCount})` },
            { key: 'all',       label: 'Todas' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => { setTabFilter(t.key); setStatusFilter('all') }}
              className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                tabFilter === t.key ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white')}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, proveedor, BL..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><X size={12} /></button>}
        </div>

        {/* Filtro por fecha de oficialización */}
        <button
          onClick={() => setShowDateFilter(v => !v)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors',
            showDateFilter || oficFrom || oficTo
              ? 'bg-violet-700/30 border-violet-600/60 text-violet-300'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
          )}
        >
          <Calendar size={13} />
          Oficializada
          {(oficFrom || oficTo) && <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />}
        </button>

        {/* View Toggle */}
        <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 ml-auto">
          {([
            { mode: 'cards'    as ViewMode, icon: <LayoutGrid size={14} />, title: 'Cards' },
            { mode: 'kanban'   as ViewMode, icon: <List size={14} />,       title: 'Kanban' },
            { mode: 'timeline' as ViewMode, icon: <Clock size={14} />,      title: 'Timeline' },
          ]).map(v => (
            <button key={v.mode} onClick={() => setViewMode(v.mode)} title={v.title}
              className={cn('p-2 rounded-md transition-colors',
                viewMode === v.mode ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-white')}>
              {v.icon}
            </button>
          ))}
        </div>
      </div>

      {/* ── Panel filtro por fecha de oficialización ── */}
      {showDateFilter && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/80 border border-violet-700/30 flex-wrap">
          <span className="text-xs text-violet-300 font-medium flex-shrink-0">Fecha oficialización:</span>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-slate-500">Desde</label>
            <input
              type="date"
              value={oficFrom}
              onChange={e => setOficFrom(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-slate-500">Hasta</label>
            <input
              type="date"
              value={oficTo}
              onChange={e => setOficTo(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
            />
          </div>
          {(oficFrom || oficTo) && (
            <button
              onClick={() => { setOficFrom(''); setOficTo('') }}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
            >
              <X size={12} /> Limpiar
            </button>
          )}
          {filtered.length > 0 && (
            <span className="text-[10px] text-slate-500 ml-auto">
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* ── Contenido ── */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Cargando importaciones...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <Package size={40} className="text-slate-700 mx-auto" />
          <p className="text-slate-400 font-medium">
            {search || statusFilter !== 'all' ? 'Sin resultados para este filtro' : 'Sin importaciones aún'}
          </p>
          {!search && statusFilter === 'all' && tabFilter === 'active' && (
            <button onClick={() => setShowCreate(true)} className="text-xs text-cyan-400 hover:underline">
              Crear la primera importación →
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(imp => <ImportCard key={imp.id} imp={imp} />)}
          </div>
          <p className="text-xs text-slate-700 text-right">
            {filtered.length} importación{filtered.length !== 1 ? 'es' : ''}
          </p>
        </>
      ) : viewMode === 'kanban' ? (
        <KanbanBoard imports={filtered} />
      ) : (
        <TimelineView imports={filtered} />
      )}

      {showCreate && <CreateImportModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
