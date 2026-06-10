import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Tag, Building2, Package, Edit2, Calendar } from 'lucide-react'
import { useComexBrand, useUpdateComexBrand, useComexSuppliers } from '../../hooks/useComex'
import type { ComexBrand } from '@shared/types'

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
  label, value, onSave, placeholder = '—'
}: {
  label?: string; value: number | null; onSave: (v: number | null) => void; placeholder?: string
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
        {value !== null ? value : placeholder}
        <Edit2 size={11} className="inline ml-1.5 opacity-0 group-hover:opacity-50" />
      </p>
    </div>
  )
}

function ESelect({
  label, value, options, onSave
}: {
  label?: string
  value: string
  options: { value: string; label: string }[]
  onSave: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)

  const commit = (v: string) => { if (v !== value) onSave(v); setEditing(false) }

  if (editing) return (
    <div className="space-y-1">
      {label && <span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>}
      <select
        autoFocus
        value={value}
        onChange={(e) => commit(e.target.value)}
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

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ icon: Icon, title, children }: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-700/60">
        <Icon size={15} className="text-cyan-400" />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
}

// ── Editable title (large) ────────────────────────────────────────────────────

function EditableTitle({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const start = () => { setDraft(value); setEditing(true) }
  const commit = () => { if (draft.trim() && draft !== value) onSave(draft.trim()); setEditing(false) }
  const cancel = () => setEditing(false)

  if (editing) return (
    <input
      autoFocus value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
      onBlur={commit}
      className="text-lg font-bold text-white bg-slate-900 border border-cyan-500 rounded px-2 py-0.5 w-full focus:outline-none"
    />
  )

  return (
    <h1
      onClick={start}
      className="text-lg font-bold text-white cursor-pointer hover:text-cyan-300 transition-colors group flex items-center gap-2"
    >
      {value}
      <Edit2 size={13} className="opacity-0 group-hover:opacity-50 shrink-0" />
    </h1>
  )
}

// ── Demanda mensual (12 meses) ─────────────────────────────────────────────────

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function MonthlyDemandGrid({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  let parsed: Record<string, number> = {}
  try { parsed = JSON.parse(value) || {} } catch { parsed = {} }

  const setMonth = (month: number, raw: string) => {
    const next = { ...parsed }
    const n = parseFloat(raw)
    if (raw === '' || isNaN(n)) {
      delete next[String(month)]
    } else {
      next[String(month)] = n
    }
    onSave(JSON.stringify(next))
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {MONTH_LABELS.map((label, i) => {
        const month = i + 1
        const v = parsed[String(month)]
        return (
          <div key={month} className="space-y-1">
            <span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
            <input
              type="number"
              defaultValue={v !== undefined ? String(v) : ''}
              onBlur={(e) => setMonth(month, e.target.value)}
              placeholder="—"
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>
        )
      })}
    </div>
  )
}

// ── Main View ─────────────────────────────────────────────────────────────────

export default function ComexBrandDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const updateBrand = useUpdateComexBrand()

  const { data: brand, isLoading } = useComexBrand(id ?? null)
  const { data: suppliers = [] } = useComexSuppliers()

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center text-slate-500">Cargando...</div>
  )
  if (!brand) return (
    <div className="flex-1 flex items-center justify-center text-slate-500">Marca no encontrada</div>
  )

  const save = (data: Partial<ComexBrand>) =>
    updateBrand.mutate({ id: brand.id, data })

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/comex/brands')}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <Tag size={20} className="text-cyan-400" />
        <div className="flex-1 min-w-0">
          <EditableTitle value={brand.name} onSave={(v) => save({ name: v })} />
          {brand.category && (
            <p className="text-xs text-slate-400 mt-0.5">{brand.category}</p>
          )}
        </div>
      </div>

      {/* ── Datos generales ───────────────────────────────────────────────────── */}
      <Section icon={Tag} title="Datos generales">
        <FieldGrid>
          <EText label="Categoría" value={brand.category} onSave={(v) => save({ category: v })} placeholder="Calzado, indumentaria, etc." />
          <ESelect
            label="Proveedor primario"
            value={brand.primary_supplier_id ?? ''}
            options={[
              { value: '', label: '— Sin asignar —' },
              ...suppliers.map((s) => ({ value: s.id, label: s.name }))
            ]}
            onSave={(v) => save({ primary_supplier_id: v || null })}
          />
          <ENum label="Frecuencia de compra (días)" value={brand.purchase_frequency_days} onSave={(v) => save({ purchase_frequency_days: v })} placeholder="—" />
        </FieldGrid>
        {brand.primary_supplier && (
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
            <Building2 size={12} />
            <span>Proveedor: {brand.primary_supplier.name}</span>
          </div>
        )}
      </Section>

      {/* ── Demanda y stock ───────────────────────────────────────────────────── */}
      <Section icon={Package} title="Demanda y stock">
        <FieldGrid>
          <ENum label="Demanda anual estimada (unidades)" value={brand.demand_annual} onSave={(v) => save({ demand_annual: v })} placeholder="—" />
          <ENum label="Stock actual" value={brand.current_stock} onSave={(v) => save({ current_stock: v })} placeholder="—" />
          <ENum label="Stock de seguridad" value={brand.safety_stock} onSave={(v) => save({ safety_stock: v })} placeholder="—" />
        </FieldGrid>
      </Section>

      {/* ── Demanda mensual ───────────────────────────────────────────────────── */}
      <Section icon={Calendar} title="Demanda mensual estimada (unidades)">
        <MonthlyDemandGrid value={brand.demand_monthly_json} onSave={(v) => save({ demand_monthly_json: v })} />
      </Section>

      {/* ── Notas ─────────────────────────────────────────────────────────────── */}
      <Section icon={Tag} title="Notas">
        <EText
          value={brand.notes}
          onSave={(v) => save({ notes: v })}
          placeholder="Observaciones generales sobre la marca..."
          multiline
        />
      </Section>
    </div>
  )
}
