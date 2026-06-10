import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, CalendarClock, Tag, Building2, Clock, RefreshCw,
  Edit2, ListChecks, Sparkles
} from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
dayjs.locale('es')

import {
  useComexPlanning, useUpdateComexPlanning, useRecalculateComexPlanning,
  useUpdatePlanningMilestone, useComexSuppliers
} from '../../hooks/useComex'
import {
  PLANNING_TYPES, PLANNING_TYPE_LABELS,
  PLANNING_STATUSES, PLANNING_STATUS_LABELS,
  PLANNING_PRIORITIES, PLANNING_PRIORITY_LABELS,
  PLANNING_RISK_LABELS, PLANNING_RISK_COLORS,
  PLANNING_MILESTONE_LABELS, PLANNING_MILESTONE_STATUSES
} from '@shared/types'
import type { ImportOrderPlanning, ImportOrderPlanningMilestone, PlanningMilestoneStatus } from '@shared/types'

// ── Inline edit primitives ────────────────────────────────────────────────────

function EText({
  label, value, onSave, placeholder = '—', multiline = false
}: {
  label?: string; value: string; onSave: (v: string) => void
  placeholder?: string; multiline?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const start = () => { setDraft(value); setEditing(true) }
  const commit = () => { if (draft !== value) onSave(draft); setEditing(false) }
  const cancel = () => setEditing(false)

  const cls = 'w-full bg-slate-900 border border-cyan-500 rounded px-2 py-1 text-sm text-white focus:outline-none'

  if (editing) {
    if (multiline) return (
      <div className="space-y-1">
        {label && <span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>}
        <textarea
          autoFocus rows={4} value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') cancel() }}
          onBlur={commit}
          className={cls + ' resize-none'}
        />
      </div>
    )
    return (
      <div className="space-y-1">
        {label && <span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>}
        <input
          autoFocus value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
          onBlur={commit}
          className={cls}
        />
      </div>
    )
  }

  return (
    <div className="space-y-1 group cursor-pointer" onClick={start}>
      {label && <span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>}
      <p className={`text-sm min-h-[1.25rem] ${value ? 'text-white' : 'text-slate-600 italic'} group-hover:text-cyan-300 transition-colors`}>
        {value || placeholder}
        <Edit2 size={11} className="inline ml-1.5 opacity-0 group-hover:opacity-50" />
      </p>
    </div>
  )
}

function ENum({
  label, value, onSave, placeholder = '—', suffix = ''
}: {
  label?: string; value: number | null; onSave: (v: number | null) => void; placeholder?: string; suffix?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const start = () => { setDraft(value !== null ? String(value) : ''); setEditing(true) }
  const commit = () => {
    const n = parseFloat(draft)
    onSave(isNaN(n) ? null : n)
    setEditing(false)
  }
  const cancel = () => setEditing(false)

  if (editing) return (
    <div className="space-y-1">
      {label && <span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>}
      <input
        autoFocus type="number" value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
        onBlur={commit}
        className="w-full bg-slate-900 border border-cyan-500 rounded px-2 py-1 text-sm text-white focus:outline-none"
      />
    </div>
  )

  return (
    <div className="space-y-1 group cursor-pointer" onClick={start}>
      {label && <span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>}
      <p className={`text-sm min-h-[1.25rem] ${value !== null ? 'text-white' : 'text-slate-600 italic'} group-hover:text-cyan-300 transition-colors`}>
        {value !== null ? `${value}${suffix}` : placeholder}
        <Edit2 size={11} className="inline ml-1.5 opacity-0 group-hover:opacity-50" />
      </p>
    </div>
  )
}

function ESelect<T extends string>({
  label, value, options, onSave
}: {
  label?: string
  value: T
  options: { value: T; label: string }[]
  onSave: (v: T) => void
}) {
  const [editing, setEditing] = useState(false)

  const commit = (v: T) => { if (v !== value) onSave(v); setEditing(false) }

  if (editing) return (
    <div className="space-y-1">
      {label && <span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>}
      <select
        autoFocus
        value={value}
        onChange={(e) => commit(e.target.value as T)}
        onBlur={() => setEditing(false)}
        className="w-full bg-slate-900 border border-cyan-500 rounded px-2 py-1 text-sm text-white focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )

  const display = options.find((o) => o.value === value)?.label || value

  return (
    <div className="space-y-1 group cursor-pointer" onClick={() => setEditing(true)}>
      {label && <span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>}
      <p className={`text-sm min-h-[1.25rem] ${display ? 'text-white' : 'text-slate-600 italic'} group-hover:text-cyan-300 transition-colors`}>
        {display || '—'}
        <Edit2 size={11} className="inline ml-1.5 opacity-0 group-hover:opacity-50" />
      </p>
    </div>
  )
}

function EDate({
  label, value, onSave
}: {
  label?: string; value: number | null; onSave: (v: number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const start = () => { setDraft(value ? dayjs(value).format('YYYY-MM-DD') : ''); setEditing(true) }
  const commit = () => {
    onSave(draft ? dayjs(draft).valueOf() : null)
    setEditing(false)
  }
  const cancel = () => setEditing(false)

  if (editing) return (
    <div className="space-y-1">
      {label && <span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>}
      <input
        autoFocus type="date" value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
        onBlur={commit}
        className="w-full bg-slate-900 border border-cyan-500 rounded px-2 py-1 text-sm text-white focus:outline-none"
      />
    </div>
  )

  return (
    <div className="space-y-1 group cursor-pointer" onClick={start}>
      {label && <span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>}
      <p className={`text-sm min-h-[1.25rem] ${value ? 'text-white' : 'text-slate-600 italic'} group-hover:text-cyan-300 transition-colors`}>
        {value ? dayjs(value).format('DD/MM/YYYY') : '—'}
        <Edit2 size={11} className="inline ml-1.5 opacity-0 group-hover:opacity-50" />
      </p>
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ icon: Icon, title, children, action }: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <Icon size={15} className="text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
}

// ── Read-only stat ─────────────────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="space-y-1">
      <span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      <p className="text-sm font-medium" style={color ? { color } : { color: 'white' }}>{value}</p>
    </div>
  )
}

// ── Risk badge ──────────────────────────────────────────────────────────────────

function RiskBadge({ status }: { status: ImportOrderPlanning['risk_status'] }) {
  const color = PLANNING_RISK_COLORS[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ backgroundColor: `${color}22`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {PLANNING_RISK_LABELS[status]}
    </span>
  )
}

// ── Milestone row ──────────────────────────────────────────────────────────────

function MilestoneRow({ milestone, planningId }: { milestone: ImportOrderPlanningMilestone; planningId: string }) {
  const updateMilestone = useUpdatePlanningMilestone()

  const save = (data: Partial<ImportOrderPlanningMilestone>) =>
    updateMilestone.mutate({ id: milestone.id, planningId, data })

  const date = milestone.calculated_date
  const isPast = date != null && date < Date.now()

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-700/40 last:border-0">
      <div className={`w-2 h-2 rounded-full shrink-0 ${milestone.status === 'done' ? 'bg-emerald-500' : milestone.status === 'delayed' ? 'bg-red-500' : isPast ? 'bg-amber-500' : 'bg-slate-600'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{PLANNING_MILESTONE_LABELS[milestone.milestone_type]}</p>
      </div>
      <div className="w-24 shrink-0">
        <span className="text-xs text-slate-400">{date ? dayjs(date).format('DD/MM/YY') : '—'}</span>
      </div>
      <div className="w-32 shrink-0">
        <ESelect<PlanningMilestoneStatus>
          value={milestone.status}
          options={PLANNING_MILESTONE_STATUSES.map((s) => ({
            value: s,
            label: { pending: 'Pendiente', in_progress: 'En curso', done: 'Hecho', delayed: 'Demorado' }[s]
          }))}
          onSave={(v) => save({ status: v })}
        />
      </div>
      <div className="w-28 shrink-0">
        <EDate value={milestone.real_date} onSave={(v) => save({ real_date: v })} />
      </div>
    </div>
  )
}

// ── Main View ─────────────────────────────────────────────────────────────────

export default function ComexPlanningDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const updatePlanning = useUpdateComexPlanning()
  const recalculate = useRecalculateComexPlanning()

  const { data: planning, isLoading } = useComexPlanning(id ?? null)
  const { data: suppliers = [] } = useComexSuppliers()

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center text-slate-500">Cargando...</div>
  )
  if (!planning) return (
    <div className="flex-1 flex items-center justify-center text-slate-500">Programación no encontrada</div>
  )

  const save = (data: Partial<ImportOrderPlanning>) =>
    updatePlanning.mutate({ id: planning.id, data })

  const milestones = [...(planning.milestones ?? [])].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/comex/plannings')}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <CalendarClock size={20} className="text-cyan-400" />
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Tag size={15} className="text-cyan-400 shrink-0" />
            {planning.brand?.name ?? 'Programación'}
          </h1>
          {planning.supplier && (
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
              <Building2 size={11} />
              {planning.supplier.name}
            </p>
          )}
        </div>
        <RiskBadge status={planning.risk_status} />
        <button
          onClick={() => recalculate.mutate(planning.id)}
          disabled={recalculate.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={recalculate.isPending ? 'animate-spin' : ''} />
          Recalcular
        </button>
      </div>

      {/* ── Datos generales ───────────────────────────────────────────────────── */}
      <Section icon={CalendarClock} title="Datos generales">
        <FieldGrid>
          <ESelect
            label="Proveedor"
            value={planning.supplier_id ?? ''}
            options={[
              { value: '', label: '— Sin asignar —' },
              ...suppliers.map((s) => ({ value: s.id, label: s.name }))
            ]}
            onSave={(v) => save({ supplier_id: v || null })}
          />
          <ESelect
            label="Tipo de programación"
            value={planning.planning_type}
            options={PLANNING_TYPES.map((t) => ({ value: t, label: PLANNING_TYPE_LABELS[t] }))}
            onSave={(v) => save({ planning_type: v })}
          />
          <ESelect
            label="Estado"
            value={planning.status}
            options={PLANNING_STATUSES.map((s) => ({ value: s, label: PLANNING_STATUS_LABELS[s] }))}
            onSave={(v) => save({ status: v })}
          />
          <ESelect
            label="Prioridad"
            value={planning.priority}
            options={PLANNING_PRIORITIES.map((p) => ({ value: p, label: PLANNING_PRIORITY_LABELS[p] }))}
            onSave={(v) => save({ priority: v })}
          />
          <EText label="País de origen" value={planning.country} onSave={(v) => save({ country: v })} placeholder="—" />
          <EText label="Responsable" value={planning.responsible_user_id} onSave={(v) => save({ responsible_user_id: v })} placeholder="—" />
        </FieldGrid>
      </Section>

      {/* ── Fechas objetivo ───────────────────────────────────────────────────── */}
      <Section icon={Clock} title="Fechas objetivo">
        <FieldGrid>
          <EDate label="Inicio cobertura objetivo" value={planning.target_coverage_start_date} onSave={(v) => save({ target_coverage_start_date: v })} />
          <EDate label="Fin cobertura objetivo" value={planning.target_coverage_end_date} onSave={(v) => save({ target_coverage_end_date: v })} />
          <EDate label="Disponibilidad comercial objetivo" value={planning.target_commercial_availability_date} onSave={(v) => save({ target_commercial_availability_date: v })} />
        </FieldGrid>
      </Section>

      {/* ── Resumen calculado ─────────────────────────────────────────────────── */}
      <Section icon={Sparkles} title="Resumen calculado">
        <FieldGrid>
          <Stat label="Pedido recomendado" value={planning.recommended_order_date ? dayjs(planning.recommended_order_date).format('DD/MM/YYYY') : '—'} />
          <Stat label="Límite de aprobación" value={planning.approval_deadline_date ? dayjs(planning.approval_deadline_date).format('DD/MM/YYYY') : '—'} />
          <Stat label="Recepción estimada" value={planning.estimated_reception_date ? dayjs(planning.estimated_reception_date).format('DD/MM/YYYY') : '—'} />
          <Stat label="Lead time total" value={`${planning.total_lead_time_days} días`} />
          <Stat label="Demanda del período" value={planning.demand_for_period != null ? planning.demand_for_period.toLocaleString('es-AR') : '—'} />
          <Stat label="Cobertura objetivo" value={planning.desired_coverage_months != null ? `${planning.desired_coverage_months} meses` : '—'} />
          <Stat label="Riesgo" value={PLANNING_RISK_LABELS[planning.risk_status]} color={PLANNING_RISK_COLORS[planning.risk_status]} />
          <Stat label="Stock actual" value={planning.current_stock != null ? String(planning.current_stock) : '—'} />
          <Stat label="Stock de seguridad" value={planning.safety_stock != null ? String(planning.safety_stock) : '—'} />
        </FieldGrid>
      </Section>

      {/* ── Desglose de lead times ────────────────────────────────────────────── */}
      <Section icon={Clock} title="Desglose de lead times (días)">
        <FieldGrid>
          <ENum label="Análisis y aprobación interna" value={planning.internal_approval_days} onSave={(v) => save({ internal_approval_days: v ?? 0 })} />
          <ENum label="Preparación del proveedor" value={planning.supplier_preparation_days} onSave={(v) => save({ supplier_preparation_days: v ?? 0 })} />
          <ENum label="Producción" value={planning.production_days} onSave={(v) => save({ production_days: v ?? 0 })} />
          <ENum label="Inspección" value={planning.inspection_days} onSave={(v) => save({ inspection_days: v ?? 0 })} />
          <ENum label="Embarque / tránsito" value={planning.shipping_days} onSave={(v) => save({ shipping_days: v ?? 0 })} />
          <ENum label="Nacionalización" value={planning.customs_days} onSave={(v) => save({ customs_days: v ?? 0 })} />
          <ENum label="Entrega local" value={planning.local_delivery_days} onSave={(v) => save({ local_delivery_days: v ?? 0 })} />
          <ENum label="Margen de seguridad" value={planning.safety_days} onSave={(v) => save({ safety_days: v ?? 0 })} />
        </FieldGrid>
      </Section>

      {/* ── Hitos ─────────────────────────────────────────────────────────────── */}
      <Section icon={ListChecks} title="Hitos">
        {milestones.length === 0 ? (
          <p className="text-sm text-slate-500 italic">
            Sin hitos calculados. Definí una fecha de disponibilidad comercial y recalculá.
          </p>
        ) : (
          <div>
            <div className="flex items-center gap-3 pb-2 border-b border-slate-700 text-[10px] uppercase tracking-wider text-slate-500">
              <div className="w-2 shrink-0" />
              <div className="flex-1">Hito</div>
              <div className="w-24 shrink-0">Calculada</div>
              <div className="w-32 shrink-0">Estado</div>
              <div className="w-28 shrink-0">Fecha real</div>
            </div>
            {milestones.map((m) => (
              <MilestoneRow key={m.id} milestone={m} planningId={planning.id} />
            ))}
          </div>
        )}
      </Section>

      {/* ── Notas e IA ────────────────────────────────────────────────────────── */}
      <Section icon={Tag} title="Notas">
        <EText
          value={planning.notes}
          onSave={(v) => save({ notes: v })}
          placeholder="Observaciones sobre esta programación..."
          multiline
        />
        {(planning.ai_recommendation_summary || planning.ai_risk_explanation) && (
          <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-3">
            {planning.ai_recommendation_summary && (
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Recomendación IA</span>
                <p className="text-sm text-slate-300">{planning.ai_recommendation_summary}</p>
              </div>
            )}
            {planning.ai_risk_explanation && (
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Explicación de riesgo (IA)</span>
                <p className="text-sm text-slate-300">{planning.ai_risk_explanation}</p>
              </div>
            )}
          </div>
        )}
      </Section>
    </div>
  )
}
