/**
 * CustomsSection — Despacho & Aduanas
 */
import { useState } from 'react'
import { Landmark, Check, X } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
dayjs.locale('es')

import { useComexCustoms, useUpsertComexCustoms } from '../../hooks/useComex'
import { DESPACHANTES } from '@shared/types'
import type { UpsertComexCustomsInput } from '@shared/types'
import { cn } from '../../components/ui/utils'

// ── Primitivas de edición ─────────────────────────────────────────────────────

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{children}</div>
}

/** Campo de sólo lectura — se rellena automáticamente desde el despacho */
function ReadOnly({
  label, value, placeholder = '—', prefix = ''
}: {
  label: string; value: string | number | null | undefined; placeholder?: string; prefix?: string
}) {
  const display = value != null && value !== ''
    ? `${prefix}${typeof value === 'number' ? value.toLocaleString('es-AR', { maximumFractionDigits: 2 }) : value}`
    : null
  return (
    <div>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={cn('text-sm mt-0.5', display ? 'text-slate-200' : 'text-slate-600 italic')}>
        {display ?? placeholder}
      </p>
    </div>
  )
}

function EText({
  label, value, onSave, placeholder = '—'
}: {
  label: string; value: string | null | undefined
  onSave: (v: string) => void; placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const start  = () => { setDraft(value ?? ''); setEditing(true) }
  const commit = () => { onSave(draft); setEditing(false) }
  const cancel = () => setEditing(false)

  if (editing) return (
    <div>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
        className="w-full bg-slate-700 border border-cyan-600 rounded px-2 py-1 text-sm text-white focus:outline-none" />
    </div>
  )
  return (
    <button onClick={start} className="text-left group w-full">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={cn('text-sm mt-0.5 group-hover:text-cyan-300 transition-colors truncate',
        value?.trim() ? 'text-slate-200' : 'text-slate-600 italic')}>
        {value?.trim() || placeholder}
      </p>
    </button>
  )
}

function ENum({
  label, value, onSave, prefix = '', placeholder = '—', decimals = 2
}: {
  label: string; value: number | null | undefined
  onSave: (v: number | null) => void
  prefix?: string; placeholder?: string; decimals?: number
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const start  = () => { setDraft(value != null ? String(value) : ''); setEditing(true) }
  const commit = () => { onSave(draft.trim() ? Number(draft) : null); setEditing(false) }

  if (editing) return (
    <div>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <input autoFocus type="number" step={decimals === 0 ? 1 : 0.01} value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        className="w-full bg-slate-700 border border-cyan-600 rounded px-2 py-1 text-sm text-white focus:outline-none" />
    </div>
  )
  return (
    <button onClick={start} className="text-left group w-full">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={cn('text-sm mt-0.5 group-hover:text-cyan-300 transition-colors',
        value != null ? 'text-slate-200' : 'text-slate-600 italic')}>
        {value != null
          ? `${prefix}${value.toLocaleString('es-AR', { maximumFractionDigits: decimals })}`
          : placeholder}
      </p>
    </button>
  )
}

function EDate({
  label, value, onSave, placeholder = '—'
}: {
  label: string; value: number | null | undefined
  onSave: (v: number | null) => void; placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const commit  = (s: string) => { onSave(s ? dayjs(s).valueOf() : null); setEditing(false) }
  const fmt     = (ts: number | null | undefined) => ts ? dayjs(ts).format('YYYY-MM-DD') : ''
  const display = (ts: number | null | undefined) => ts ? dayjs(ts).format('DD/MM/YYYY') : placeholder

  if (editing) return (
    <div>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <input autoFocus type="date" defaultValue={fmt(value)}
        onChange={e => commit(e.target.value)} onBlur={e => commit(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') setEditing(false) }}
        className="w-full bg-slate-700 border border-cyan-600 rounded px-2 py-1 text-sm text-white focus:outline-none" />
    </div>
  )
  return (
    <button onClick={() => setEditing(true)} className="text-left group w-full">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={cn('text-sm mt-0.5 group-hover:text-cyan-300 transition-colors',
        value ? 'text-slate-200' : 'text-slate-600 italic')}>
        {display(value)}
      </p>
    </button>
  )
}

function ESelect<T extends string>({
  label, value, options, onSave
}: {
  label: string; value: T | null | undefined
  options: readonly string[] | string[]
  onSave: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  if (editing) return (
    <div>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <select autoFocus value={value ?? ''} onChange={e => { onSave(e.target.value); setEditing(false) }}
        onBlur={() => setEditing(false)}
        className="w-full bg-slate-700 border border-cyan-600 rounded px-2 py-1 text-sm text-white focus:outline-none">
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
  return (
    <button onClick={() => setEditing(true)} className="text-left group w-full">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={cn('text-sm mt-0.5 group-hover:text-cyan-300 transition-colors truncate',
        value ? 'text-slate-200' : 'text-slate-600 italic')}>
        {value || '—'}
      </p>
    </button>
  )
}

/**
 * Toggle enviado/no enviado + fecha editable al hacer click en ella.
 */
function NotificationToggle({
  label, value, onToggle
}: {
  label: string; value: number | null | undefined; onToggle: (ts: number | null) => void
}) {
  const [editingDate, setEditingDate] = useState(false)
  const sent = !!value

  const handleDateChange = (s: string) => {
    if (s) onToggle(dayjs(s).valueOf())
    setEditingDate(false)
  }

  return (
    <div>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">{label}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Botón principal toggle */}
        <button
          onClick={() => onToggle(sent ? null : Date.now())}
          className={cn(
            'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition-colors',
            sent
              ? 'bg-emerald-900/40 text-emerald-300 hover:bg-red-900/30 hover:text-red-400'
              : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
          )}
          title={sent ? 'Click para marcar como no enviado' : 'Click para marcar como enviado hoy'}
        >
          {sent ? <Check size={11} /> : <X size={11} />}
          {sent ? 'Enviado' : 'Sin enviar'}
        </button>

        {/* Fecha editable */}
        {sent && (
          editingDate ? (
            <input
              autoFocus
              type="date"
              defaultValue={dayjs(value).format('YYYY-MM-DD')}
              onChange={e => { if (e.target.value) handleDateChange(e.target.value) }}
              onBlur={e => handleDateChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setEditingDate(false) }}
              className="w-36 bg-slate-700 border border-cyan-600 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
            />
          ) : (
            <button
              onClick={() => setEditingDate(true)}
              className="text-xs text-emerald-400 hover:text-cyan-300 transition-colors underline underline-offset-2"
              title="Click para editar la fecha"
            >
              {dayjs(value).format('DD/MM/YYYY')}
            </button>
          )
        )}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

interface Props {
  importId: string
  /** Si true: omite el container card exterior (se usa dentro de CollapsibleSection) */
  inner?: boolean
}

export default function CustomsSection({ importId, inner = false }: Props) {
  const { data: customs } = useComexCustoms(importId)
  const upsert = useUpsertComexCustoms()

  const save = (data: Partial<UpsertComexCustomsInput>) =>
    upsert.mutate({ importId, data })

  const c = customs ?? {}

  const fobCurrency = c.fob_currency ?? 'USD'

  const content = (
    <div className={cn(inner ? 'p-4 space-y-5' : 'bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-5')}>
      {!inner && (
        <div className="flex items-center gap-2">
          <Landmark size={14} className="text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">Despacho & Aduanas</h3>
          <span className="text-[10px] text-slate-500 ml-1">— click en cualquier campo para editar</span>
        </div>
      )}

      {/* ── Valores financieros ── */}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3">Valores financieros</p>
        <Row>
          <ESelect
            label="Moneda factura"
            value={c.fob_currency}
            options={['USD', 'EUR']}
            onSave={(v) => save({ fob_currency: v })}
          />
          <ENum
            label={`Valor factura (${fobCurrency})`}
            value={c.fob_invoice}
            onSave={(v) => save({ fob_invoice: v })}
          />
          {/* FOB despacho — read-only, se rellena al subir el despacho */}
          <ReadOnly
            label={`FOB despacho (${fobCurrency})`}
            value={c.fob_declared}
            placeholder="Del despacho"
          />
          {/* TC despacho — read-only, del despacho */}
          <ReadOnly
            label="Tipo de cambio despacho ($/USD)"
            value={c.dolar_aduana}
            prefix="$"
            placeholder="Del despacho"
          />
        </Row>
      </div>

      {/* ── Despacho ── */}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3">Despacho</p>
        <Row>
          <EText
            label="N° de despacho"
            value={c.despacho_number}
            onSave={(v) => save({ despacho_number: v })}
            placeholder="26001IC04091857C"
          />
          <ESelect
            label="Despachante"
            value={c.despachante}
            options={[...DESPACHANTES]}
            onSave={(v) => save({ despachante: v })}
          />
          <EDate
            label="Fecha de oficialización"
            value={c.oficializacion_date}
            onSave={(v) => save({ oficializacion_date: v })}
          />
        </Row>
      </div>

      {/* ── Shipping ── */}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3">Shipping</p>
        <Row>
          <EText
            label="N° de BL / VL"
            value={c.bl_number}
            onSave={(v) => save({ bl_number: v })}
            placeholder="CB673343"
          />
          <EText
            label="Ref. mail naviera"
            value={c.naviera_ref}
            onSave={(v) => save({ naviera_ref: v })}
            placeholder="26/01209"
          />
          {/* Carrier — read-only, se obtiene del despacho */}
          <ReadOnly
            label="Carrier / Naviera"
            value={c.carrier}
            placeholder="Del despacho"
          />
          {/* Canal — read-only, del despacho */}
          <ReadOnly
            label="Canal"
            value={c.canal}
            placeholder="Del despacho"
          />
        </Row>
      </div>

      {/* ── Carga ── */}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3">Carga</p>
        <Row>
          <ENum label="Peso bruto (kg)"      value={c.peso_bruto_kg} onSave={(v) => save({ peso_bruto_kg: v })} decimals={2} />
          <ENum label="Volumen (m³)"          value={c.volumen_m3}    onSave={(v) => save({ volumen_m3: v })}    decimals={2} />
          <ENum label="Cant. pallets/cajas"   value={c.cant_pallets}  onSave={(v) => save({ cant_pallets: v != null ? Math.round(v) : null })} decimals={0} />
        </Row>
      </div>

      {/* ── Bancario / MULC ── */}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3">Bancario / MULC</p>
        <Row>
          <EDate label="Fecha acceso MULC"      value={c.mulc_date}        onSave={(v) => save({ mulc_date: v })} />
          <EDate label="Fecha pago banco"        value={c.fecha_pago_banco} onSave={(v) => save({ fecha_pago_banco: v })} />
          <EDate label="Cierre operación banco"  value={c.cierre_banco_date} onSave={(v) => save({ cierre_banco_date: v })} />
        </Row>
      </div>

      {/* ── Notificaciones ── */}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3">Notificaciones</p>
        <div className="grid grid-cols-2 gap-4">
          <NotificationToggle
            label="Listas enviadas al despachante"
            value={c.listas_despachante_date}
            onToggle={(ts) => save({ listas_despachante_date: ts })}
          />
          <NotificationToggle
            label="Listas enviadas a Oscar y Andrea"
            value={c.listas_oscar_andrea_date}
            onToggle={(ts) => save({ listas_oscar_andrea_date: ts })}
          />
        </div>
      </div>
    </div>
  )

  return inner ? content : content
}
