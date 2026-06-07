import { useState, useMemo } from 'react'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import {
  Wallet, Plus, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus,
  Edit3, Trash2, X, Check, Loader2, RefreshCw, Settings2, ArrowUpDown,
  ArrowUp, ArrowDown, AlertCircle, CalendarClock, Tag, Save
} from 'lucide-react'
import {
  useFinanceMovements, useFinanceMonthSummary, useFinanceConcepts, useFinanceCategories, useFinanceAccounts,
  useCreateFinanceMovement, useUpdateFinanceMovement, useQuickUpdateFinanceMovement, useDeleteFinanceMovement,
  useGenerateMovementsForMonth,
  useCreateFinanceConcept, useUpdateFinanceConcept, useDeleteFinanceConcept,
  getDiffColor, formatCurrency, formatFinanceDate, getMonthLabel, getEffectiveAmount
} from '../../hooks/useFinance'
import type {
  FinanceMovement, FinanceConcept, FinanceMonthSummary,
  FinanceMovementStatus, FinancePaymentMethod,
  CreateFinanceMovementInput, CreateFinanceConceptInput
} from '@shared/types'
import {
  FINANCE_STATUS_LABELS, FINANCE_STATUS_COLORS, FINANCE_PAYMENT_METHOD_LABELS,
  FINANCE_EXPENSE_TYPE_LABELS, FINANCE_RECURRENCE_LABELS
} from '@shared/types'
import { cn } from '../../components/ui/utils'

dayjs.locale('es')

const inputCls = 'w-full bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors'
const labelCls = 'block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1'

type SortKey = 'concept' | 'category' | 'estimated' | 'actual' | 'status' | 'payment_date' | 'due_date'
type SortDir = 'asc' | 'desc'

function diffPercentOf(actual: number, estimated: number): number | null {
  if (!estimated) return null
  return ((actual - estimated) / estimated) * 100
}

// ── Tarjetas de estadísticas (cards superiores) ──────────────────────────────

function DiffBadge({ amount, percent }: { amount: number | null; percent: number | null }) {
  if (amount === null || percent === null) {
    return <span className="text-slate-500 text-xs">Sin datos del mes anterior</span>
  }
  const color = getDiffColor(percent)
  const Icon  = amount > 0 ? TrendingUp : amount < 0 ? TrendingDown : Minus
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color }}>
      <Icon size={14} />
      {amount > 0 ? '+' : ''}{formatCurrency(amount)}
      <span className="text-xs opacity-80">({percent > 0 ? '+' : ''}{percent.toFixed(1)}%)</span>
    </span>
  )
}

function StatCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode
  color?: string; icon?: React.ElementType
}) {
  return (
    <div className="rounded-xl p-3.5 bg-slate-800/60 border border-slate-700/70">
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon size={12} className="text-slate-500" />}
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{label}</p>
      </div>
      <p className="text-xl font-bold" style={{ color: color ?? '#e2e8f0' }}>{value}</p>
      {sub && <div className="mt-1 text-[11px] text-slate-400">{sub}</div>}
    </div>
  )
}

function StatsCards({ summary, isLoading }: { summary: FinanceMonthSummary | undefined; isLoading: boolean }) {
  if (isLoading || !summary) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm py-6">
        <Loader2 size={14} className="animate-spin" /> Calculando resumen del mes...
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Fila 1 — totales y comparación */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label={`Total ${getMonthLabel(summary.month, summary.year)}`}
          value={formatCurrency(summary.totalActual)}
          sub={summary.totalActual !== summary.totalEstimated
            ? <span className="text-slate-500">Estimado: {formatCurrency(summary.totalEstimated)}</span>
            : undefined}
          color="#34d399"
          icon={Wallet}
        />
        <StatCard
          label="Total mes anterior"
          value={summary.prevMonthTotalActual !== null ? formatCurrency(summary.prevMonthTotalActual) : '—'}
          sub={summary.prevMonthTotalActual === null ? <span className="text-slate-500">Sin datos cargados</span> : undefined}
          icon={CalendarClock}
        />
        <div className="rounded-xl p-3.5 bg-slate-800/60 border border-slate-700/70">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ArrowUpDown size={12} className="text-slate-500" />
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Diferencia vs. mes anterior</p>
          </div>
          <DiffBadge amount={summary.diffAmount} percent={summary.diffPercent} />
        </div>
      </div>

      {/* Fila 2 — estado de pagos */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Pagado"   value={formatCurrency(summary.totalPaid)}    color={FINANCE_STATUS_COLORS.paid} />
        <StatCard label="Pendiente" value={formatCurrency(summary.totalPending)} color={FINANCE_STATUS_COLORS.pending} />
        <StatCard label="Vencido"  value={formatCurrency(summary.totalOverdue)} color={FINANCE_STATUS_COLORS.overdue} />
      </div>

      {/* Fila 3 — alertas y destacados */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Próximos vencimientos"
          value={summary.upcomingDueCount}
          sub={<span className="text-slate-500">en los próximos 7 días</span>}
          color={summary.upcomingDueCount > 0 ? '#f59e0b' : undefined}
          icon={AlertCircle}
        />
        <StatCard
          label="Mayor aumento"
          value={summary.biggestIncrease ? summary.biggestIncrease.conceptName : '—'}
          sub={summary.biggestIncrease
            ? <DiffBadge amount={summary.biggestIncrease.diffAmount} percent={summary.biggestIncrease.diffPercent} />
            : <span className="text-slate-500">Sin comparación disponible</span>}
          icon={TrendingUp}
        />
        <StatCard
          label="Categoría con mayor gasto"
          value={summary.topCategory ? summary.topCategory.categoryName : '—'}
          sub={summary.topCategory ? <span className="text-slate-400">{formatCurrency(summary.topCategory.total)}</span> : undefined}
          icon={Tag}
        />
      </div>
    </div>
  )
}

// ── Celdas editables en línea ─────────────────────────────────────────────────

function EditableAmount({ value, onSave }: { value: number | null; onSave: (v: number | null) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value !== null ? String(value) : '')

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(value !== null ? String(value) : ''); setEditing(true) }}
        className="text-left w-full hover:bg-slate-700/40 rounded px-1.5 py-0.5 -mx-1.5 transition-colors"
        title="Click para editar"
      >
        {value !== null ? formatCurrency(value) : <span className="text-slate-500">— sin cargar —</span>}
      </button>
    )
  }
  const commit = () => {
    const num = draft.trim() === '' ? null : Number(draft.replace(',', '.'))
    onSave(Number.isFinite(num) || num === null ? num : null)
    setEditing(false)
  }
  return (
    <input
      autoFocus
      type="number"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
      className="w-28 bg-slate-700 border border-emerald-500/60 rounded px-1.5 py-0.5 text-sm text-slate-100 focus:outline-none"
    />
  )
}

function EditableStatus({ value, onSave }: { value: FinanceMovementStatus; onSave: (v: FinanceMovementStatus) => void }) {
  const [editing, setEditing] = useState(false)
  if (!editing) {
    const color = FINANCE_STATUS_COLORS[value]
    return (
      <button
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-transform hover:scale-105"
        style={{ color, borderColor: color + '60', backgroundColor: color + '15' }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        {FINANCE_STATUS_LABELS[value]}
      </button>
    )
  }
  return (
    <select
      autoFocus
      value={value}
      onChange={e => { onSave(e.target.value as FinanceMovementStatus); setEditing(false) }}
      onBlur={() => setEditing(false)}
      className="bg-slate-700 border border-emerald-500/60 rounded px-1.5 py-0.5 text-xs text-slate-100 focus:outline-none"
    >
      {(Object.keys(FINANCE_STATUS_LABELS) as FinanceMovementStatus[]).map(s => (
        <option key={s} value={s}>{FINANCE_STATUS_LABELS[s]}</option>
      ))}
    </select>
  )
}

function EditableDate({ value, onSave }: { value: number | null; onSave: (v: number | null) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value ? dayjs(value).format('YYYY-MM-DD') : '')

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(value ? dayjs(value).format('YYYY-MM-DD') : ''); setEditing(true) }}
        className="text-left hover:bg-slate-700/40 rounded px-1.5 py-0.5 -mx-1.5 transition-colors"
        title="Click para editar"
      >
        {value ? formatFinanceDate(value) : <span className="text-slate-500">—</span>}
      </button>
    )
  }
  const commit = () => {
    onSave(draft ? dayjs(draft, 'YYYY-MM-DD').valueOf() : null)
    setEditing(false)
  }
  return (
    <input
      autoFocus
      type="date"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
      className="bg-slate-700 border border-emerald-500/60 rounded px-1.5 py-0.5 text-xs text-slate-100 focus:outline-none"
    />
  )
}

function EditableNotes({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value)

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(value); setEditing(true) }}
        className="text-left w-full max-w-[160px] truncate hover:bg-slate-700/40 rounded px-1.5 py-0.5 -mx-1.5 transition-colors text-slate-400"
        title={value || 'Click para agregar una nota'}
      >
        {value || <span className="text-slate-600 italic">sin notas</span>}
      </button>
    )
  }
  const commit = () => { onSave(draft); setEditing(false) }
  return (
    <input
      autoFocus
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
      className="w-40 bg-slate-700 border border-emerald-500/60 rounded px-1.5 py-0.5 text-xs text-slate-100 focus:outline-none"
    />
  )
}

// ── Encabezado de columna ordenable ───────────────────────────────────────────

function SortableHeader({ label, sortKey, currentKey, currentDir, onSort, className }: {
  label: string; sortKey: SortKey; currentKey: SortKey; currentDir: SortDir
  onSort: (key: SortKey) => void; className?: string
}) {
  const isActive = currentKey === sortKey
  const Icon = !isActive ? ArrowUpDown : (currentDir === 'asc' ? ArrowUp : ArrowDown)
  return (
    <th className={cn('px-3 py-2 text-left', className)}>
      <button
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold transition-colors',
          isActive ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
        )}
      >
        {label} <Icon size={11} />
      </button>
    </th>
  )
}

// ── Tabla principal de movimientos ────────────────────────────────────────────

function MovementsTable({
  movements, onQuickUpdate, onEdit, onDelete
}: {
  movements: FinanceMovement[]
  onQuickUpdate: (id: string, data: { amount_actual?: number | null; status?: FinanceMovementStatus; payment_date?: number | null; due_date?: number | null; notes?: string }) => void
  onEdit:   (m: FinanceMovement) => void
  onDelete: (m: FinanceMovement) => void
}) {
  const [sortKey, setSortKey] = useState<SortKey>('category')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const onSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    const arr = [...movements]
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'concept':      return dir * (a.concept?.name ?? '').localeCompare(b.concept?.name ?? '')
        case 'category':     return dir * (a.concept?.category?.name ?? '').localeCompare(b.concept?.category?.name ?? '')
        case 'estimated':    return dir * (a.amount_estimated - b.amount_estimated)
        case 'actual':       return dir * (getEffectiveAmount(a) - getEffectiveAmount(b))
        case 'status':       return dir * a.status.localeCompare(b.status)
        case 'payment_date': return dir * ((a.payment_date ?? 0) - (b.payment_date ?? 0))
        case 'due_date':     return dir * ((a.due_date ?? 0) - (b.due_date ?? 0))
        default: return 0
      }
    })
    return arr
  }, [movements, sortKey, sortDir])

  if (movements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Wallet size={28} className="text-slate-700 mb-3" />
        <p className="text-sm text-slate-400">No hay movimientos cargados para este mes.</p>
        <p className="text-xs text-slate-600 mt-1">Agregá uno nuevo o generá los movimientos a partir de tus conceptos activos.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-800/70 sticky top-0 z-10">
          <tr>
            <SortableHeader label="Concepto"   sortKey="concept"  currentKey={sortKey} currentDir={sortDir} onSort={onSort} />
            <SortableHeader label="Categoría"  sortKey="category" currentKey={sortKey} currentDir={sortDir} onSort={onSort} />
            <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-semibold text-slate-500">Tipo</th>
            <SortableHeader label="Estimado"   sortKey="estimated" currentKey={sortKey} currentDir={sortDir} onSort={onSort} className="text-right" />
            <SortableHeader label="Real"       sortKey="actual"    currentKey={sortKey} currentDir={sortDir} onSort={onSort} />
            <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-semibold text-slate-500">Var.</th>
            <SortableHeader label="Estado"       sortKey="status"       currentKey={sortKey} currentDir={sortDir} onSort={onSort} />
            <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-semibold text-slate-500">Método</th>
            <SortableHeader label="Pago"         sortKey="payment_date" currentKey={sortKey} currentDir={sortDir} onSort={onSort} />
            <SortableHeader label="Vencimiento"  sortKey="due_date"     currentKey={sortKey} currentDir={sortDir} onSort={onSort} />
            <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-semibold text-slate-500">Notas</th>
            <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider font-semibold text-slate-500">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/70">
          {sorted.map(m => {
            const diffPct = m.amount_actual !== null ? diffPercentOf(m.amount_actual, m.amount_estimated) : null
            const catColor  = m.concept?.category?.color ?? '#6366f1'
            return (
              <tr key={m.id} className="hover:bg-slate-800/40 transition-colors group">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: catColor }} />
                    <span className="font-medium text-slate-200 truncate">{m.concept?.name ?? '—'}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                  {m.concept?.category ? `${m.concept.category.icon} ${m.concept.category.name}` : '—'}
                </td>
                <td className="px-3 py-2">
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded font-medium',
                    m.concept?.expense_type === 'fixed' ? 'bg-blue-900/40 text-blue-300' : 'bg-purple-900/40 text-purple-300'
                  )}>
                    {m.concept ? FINANCE_EXPENSE_TYPE_LABELS[m.concept.expense_type] : '—'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-slate-400 whitespace-nowrap">{formatCurrency(m.amount_estimated)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <EditableAmount value={m.amount_actual} onSave={v => onQuickUpdate(m.id, { amount_actual: v })} />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {diffPct !== null ? (
                    <span className="text-xs font-semibold" style={{ color: getDiffColor(diffPct) }}>
                      {diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%
                    </span>
                  ) : <span className="text-slate-600 text-xs">—</span>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <EditableStatus value={m.status} onSave={v => onQuickUpdate(m.id, { status: v })} />
                </td>
                <td className="px-3 py-2 text-slate-400 text-xs whitespace-nowrap">
                  {FINANCE_PAYMENT_METHOD_LABELS[m.payment_method]}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <EditableDate value={m.payment_date} onSave={v => onQuickUpdate(m.id, { payment_date: v })} />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <EditableDate value={m.due_date} onSave={v => onQuickUpdate(m.id, { due_date: v })} />
                </td>
                <td className="px-3 py-2">
                  <EditableNotes value={m.notes} onSave={v => onQuickUpdate(m.id, { notes: v })} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(m)} className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-slate-700/50 transition-colors" title="Editar">
                      <Edit3 size={13} />
                    </button>
                    <button onClick={() => onDelete(m)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700/50 transition-colors" title="Eliminar">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot className="bg-slate-800/50 border-t border-slate-700">
          <tr>
            <td colSpan={3} className="px-3 py-2.5 text-right text-xs font-semibold text-slate-400">Total del mes</td>
            <td className="px-3 py-2.5 text-right font-semibold text-slate-300 whitespace-nowrap">
              {formatCurrency(sorted.reduce((acc, m) => acc + m.amount_estimated, 0))}
            </td>
            <td className="px-3 py-2.5 font-semibold text-emerald-400 whitespace-nowrap">
              {formatCurrency(sorted.reduce((acc, m) => acc + getEffectiveAmount(m), 0))}
            </td>
            <td colSpan={7} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── Modal: nuevo / editar movimiento ──────────────────────────────────────────

function MovementForm({ movement, concepts, period, onClose }: {
  movement: FinanceMovement | null
  concepts: FinanceConcept[]
  period:   { month: number; year: number }
  onClose:  () => void
}) {
  const isEdit = !!movement
  const create = useCreateFinanceMovement()
  const update = useUpdateFinanceMovement()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const firstConceptId = movement?.concept_id ?? concepts[0]?.id ?? ''
  const firstConcept   = concepts.find(c => c.id === firstConceptId)

  const [form, setForm] = useState({
    concept_id:       firstConceptId,
    amount_estimated: String(movement?.amount_estimated ?? firstConcept?.default_amount ?? 0),
    amount_actual:    movement?.amount_actual !== null && movement?.amount_actual !== undefined ? String(movement.amount_actual) : '',
    status:           movement?.status ?? 'pending' as FinanceMovementStatus,
    payment_method:   movement?.payment_method ?? firstConcept?.payment_method ?? 'transfer' as FinancePaymentMethod,
    payment_date:     movement?.payment_date ? dayjs(movement.payment_date).format('YYYY-MM-DD') : '',
    due_date:         movement?.due_date ? dayjs(movement.due_date).format('YYYY-MM-DD') : dayjs(new Date(period.year, period.month - 1, 10)).format('YYYY-MM-DD'),
    notes:            movement?.notes ?? '',
  })

  const upd = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm(f => ({ ...f, [key]: value }))

  // Al elegir un concepto nuevo (modo creación) precargamos su monto y método habituales
  const onConceptChange = (id: string) => {
    const c = concepts.find(cc => cc.id === id)
    setForm(f => ({
      ...f,
      concept_id: id,
      amount_estimated: !isEdit ? String(c?.default_amount ?? f.amount_estimated) : f.amount_estimated,
      payment_method:   !isEdit ? (c?.payment_method ?? f.payment_method) : f.payment_method,
    }))
  }

  const handleSave = async () => {
    setError(null)
    if (!form.concept_id) { setError('Elegí un concepto.'); return }
    setSaving(true)
    try {
      const data: CreateFinanceMovementInput = {
        concept_id:       form.concept_id,
        month:            period.month,
        year:             period.year,
        amount_estimated: Number(form.amount_estimated.replace(',', '.')) || 0,
        amount_actual:    form.amount_actual.trim() === '' ? null : (Number(form.amount_actual.replace(',', '.')) || 0),
        status:           form.status,
        payment_method:   form.payment_method,
        payment_date:     form.payment_date ? dayjs(form.payment_date, 'YYYY-MM-DD').valueOf() : null,
        due_date:         form.due_date ? dayjs(form.due_date, 'YYYY-MM-DD').valueOf() : null,
        notes:            form.notes,
      }
      if (isEdit) await update.mutateAsync({ id: movement!.id, data })
      else        await create.mutateAsync(data)
      onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ width: 'min(560px, 95vw)', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/50 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-600/30 flex items-center justify-center">
              {isEdit ? <Edit3 size={15} className="text-emerald-400" /> : <Plus size={15} className="text-emerald-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">{isEdit ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
              <p className="text-[10px] text-slate-500">{getMonthLabel(period.month, period.year)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <div>
            <label className={labelCls}>Concepto *</label>
            <select value={form.concept_id} onChange={e => onConceptChange(e.target.value)} className={inputCls} disabled={isEdit}>
              {concepts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.category ? `${c.category.icon} ` : ''}{c.name}
                </option>
              ))}
            </select>
            {isEdit && <p className="text-[10px] text-slate-500 mt-1">El concepto no se puede cambiar una vez creado el movimiento.</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Monto estimado</label>
              <input type="number" value={form.amount_estimated} onChange={e => upd('amount_estimated', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Monto real (si ya lo conocés)</label>
              <input type="number" value={form.amount_actual} onChange={e => upd('amount_actual', e.target.value)} placeholder="—" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Estado</label>
              <select value={form.status} onChange={e => upd('status', e.target.value as FinanceMovementStatus)} className={inputCls}>
                {(Object.keys(FINANCE_STATUS_LABELS) as FinanceMovementStatus[]).map(s => (
                  <option key={s} value={s}>{FINANCE_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Método de pago</label>
              <select value={form.payment_method} onChange={e => upd('payment_method', e.target.value as FinancePaymentMethod)} className={inputCls}>
                {(Object.keys(FINANCE_PAYMENT_METHOD_LABELS) as FinancePaymentMethod[]).map(p => (
                  <option key={p} value={p}>{FINANCE_PAYMENT_METHOD_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha de pago</label>
              <input type="date" value={form.payment_date} onChange={e => upd('payment_date', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fecha de vencimiento</label>
              <input type="date" value={form.due_date} onChange={e => upd('due_date', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Notas</label>
            <textarea value={form.notes} onChange={e => upd('notes', e.target.value)} rows={2} className={inputCls} placeholder="Observaciones, número de comprobante, etc." />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2 text-xs text-red-300">
              <AlertCircle size={13} /> {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-800/30 flex-shrink-0">
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2 transition-colors">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 rounded-lg px-4 py-2 transition-colors"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {isEdit ? 'Guardar cambios' : 'Crear movimiento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: gestionar conceptos ────────────────────────────────────────────────

function ConceptsManager({ onClose }: { onClose: () => void }) {
  const { data: concepts   = [], isLoading } = useFinanceConcepts()
  const { data: categories = [] } = useFinanceCategories()
  const { data: accounts   = [] } = useFinanceAccounts()
  const create = useCreateFinanceConcept()
  const update = useUpdateFinanceConcept()
  const remove = useDeleteFinanceConcept()

  const [showNew, setShowNew] = useState(false)
  const [draft, setDraft] = useState<CreateFinanceConceptInput>({
    category_id: categories[0]?.id ?? '',
    account_id:  accounts[0]?.id ?? '',
    name: '', default_amount: 0, expense_type: 'fixed', payment_method: 'transfer', recurrence: 'monthly', notes: ''
  })

  const startNew = () => {
    setDraft({
      category_id: categories[0]?.id ?? '',
      account_id:  accounts[0]?.id ?? '',
      name: '', default_amount: 0, expense_type: 'fixed', payment_method: 'transfer', recurrence: 'monthly', notes: ''
    })
    setShowNew(true)
  }

  const handleCreate = async () => {
    if (!draft.name.trim() || !draft.category_id || !draft.account_id) return
    await create.mutateAsync(draft)
    setShowNew(false)
  }

  const toggleActive = (c: FinanceConcept) =>
    update.mutate({ id: c.id, data: { is_active: c.is_active ? 0 : 1 } })

  const handleDelete = async (c: FinanceConcept) => {
    if (!confirm(`¿Eliminar el concepto "${c.name}"? También se eliminarán sus movimientos cargados.`)) return
    await remove.mutateAsync(c.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ width: 'min(720px, 95vw)', maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/50 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-600/30 flex items-center justify-center">
              <Settings2 size={15} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Conceptos</h2>
              <p className="text-[10px] text-slate-500">Gastos recurrentes que generan movimientos cada mes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={startNew}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Plus size={13} /> Nuevo concepto
            </button>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors"><X size={18} /></button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
          {showNew && (
            <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/20 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nombre *</label>
                  <input autoFocus value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} className={inputCls} placeholder="Ej: Internet" />
                </div>
                <div>
                  <label className={labelCls}>Categoría</label>
                  <select value={draft.category_id} onChange={e => setDraft(d => ({ ...d, category_id: e.target.value }))} className={inputCls}>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Cuenta</label>
                  <select value={draft.account_id} onChange={e => setDraft(d => ({ ...d, account_id: e.target.value }))} className={inputCls}>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Monto habitual</label>
                  <input type="number" value={draft.default_amount} onChange={e => setDraft(d => ({ ...d, default_amount: Number(e.target.value) || 0 }))} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Tipo de gasto</label>
                  <select value={draft.expense_type} onChange={e => setDraft(d => ({ ...d, expense_type: e.target.value as CreateFinanceConceptInput['expense_type'] }))} className={inputCls}>
                    {(Object.keys(FINANCE_EXPENSE_TYPE_LABELS) as Array<keyof typeof FINANCE_EXPENSE_TYPE_LABELS>).map(t => (
                      <option key={t} value={t}>{FINANCE_EXPENSE_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Método de pago habitual</label>
                  <select value={draft.payment_method} onChange={e => setDraft(d => ({ ...d, payment_method: e.target.value as CreateFinanceConceptInput['payment_method'] }))} className={inputCls}>
                    {(Object.keys(FINANCE_PAYMENT_METHOD_LABELS) as Array<keyof typeof FINANCE_PAYMENT_METHOD_LABELS>).map(p => (
                      <option key={p} value={p}>{FINANCE_PAYMENT_METHOD_LABELS[p]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Recurrencia</label>
                  <select value={draft.recurrence} onChange={e => setDraft(d => ({ ...d, recurrence: e.target.value as CreateFinanceConceptInput['recurrence'] }))} className={inputCls}>
                    {(Object.keys(FINANCE_RECURRENCE_LABELS) as Array<keyof typeof FINANCE_RECURRENCE_LABELS>).map(r => (
                      <option key={r} value={r}>{FINANCE_RECURRENCE_LABELS[r]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowNew(false)} className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5">Cancelar</button>
                <button onClick={handleCreate} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg px-3 py-1.5 transition-colors">
                  <Check size={13} /> Crear
                </button>
              </div>
            </div>
          )}

          {isLoading && <p className="text-sm text-slate-500 py-6 text-center">Cargando conceptos...</p>}

          {concepts.map(c => (
            <div key={c.id} className={cn(
              'flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 transition-colors',
              c.is_active ? 'border-slate-800 bg-slate-800/40' : 'border-slate-800/50 bg-slate-900/40 opacity-60'
            )}>
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.category?.color ?? '#6366f1' }} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{c.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {c.category?.icon} {c.category?.name} · {formatCurrency(c.default_amount)} · {FINANCE_EXPENSE_TYPE_LABELS[c.expense_type]} · {FINANCE_RECURRENCE_LABELS[c.recurrence]}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => toggleActive(c)}
                  className={cn(
                    'text-[10px] px-2 py-1 rounded-lg font-medium border transition-colors',
                    c.is_active
                      ? 'border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/20'
                      : 'border-slate-700 text-slate-500 hover:bg-slate-800'
                  )}
                  title={c.is_active ? 'Marcar como inactivo (no genera movimientos nuevos)' : 'Reactivar concepto'}
                >
                  {c.is_active ? 'Activo' : 'Inactivo'}
                </button>
                <button onClick={() => handleDelete(c)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700/50 transition-colors" title="Eliminar">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Dashboard principal ───────────────────────────────────────────────────────

export default function FinanceDashboard() {
  const [period, setPeriod] = useState(() => {
    const d = new Date()
    return { month: d.getMonth() + 1, year: d.getFullYear() }
  })

  const { data: movements = [], isLoading: loadingMovements } = useFinanceMovements(period.month, period.year)
  const { data: summary,        isLoading: loadingSummary }   = useFinanceMonthSummary(period.month, period.year)
  const { data: concepts  = [] } = useFinanceConcepts({ activeOnly: true })

  const [formMovement, setFormMovement] = useState<FinanceMovement | null | undefined>(undefined) // undefined = cerrado
  const [showConcepts, setShowConcepts] = useState(false)

  const quickUpdate  = useQuickUpdateFinanceMovement()
  const deleteMov    = useDeleteFinanceMovement()
  const generateMov  = useGenerateMovementsForMonth()

  const goToMonth = (delta: number) => {
    const d = new Date(period.year, period.month - 1 + delta, 1)
    setPeriod({ month: d.getMonth() + 1, year: d.getFullYear() })
  }

  const goToToday = () => {
    const d = new Date()
    setPeriod({ month: d.getMonth() + 1, year: d.getFullYear() })
  }

  const isCurrentMonth = useMemo(() => {
    const d = new Date()
    return period.month === d.getMonth() + 1 && period.year === d.getFullYear()
  }, [period])

  const handleQuickUpdate = (id: string, data: Parameters<typeof quickUpdate.mutate>[0]['data']) =>
    quickUpdate.mutate({ id, data })

  const handleDelete = async (m: FinanceMovement) => {
    if (!confirm(`¿Eliminar el movimiento "${m.concept?.name ?? ''}" de ${getMonthLabel(m.month, m.year)}?`)) return
    await deleteMov.mutateAsync(m.id)
  }

  const handleGenerate = async () => {
    await generateMov.mutateAsync({ month: period.month, year: period.year })
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-900">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-800 bg-slate-800/30">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-600/30 flex items-center justify-center">
              <Wallet size={18} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Finanzas Personales</h1>
              <p className="text-[11px] text-slate-500">{movements.length} movimientos · {concepts.length} conceptos activos</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Navegación de mes */}
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg">
              <button onClick={() => goToMonth(-1)} className="p-2 text-slate-400 hover:text-slate-200 transition-colors" title="Mes anterior">
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={goToToday}
                className={cn('px-3 py-1.5 text-xs font-semibold capitalize min-w-[140px] text-center transition-colors',
                  isCurrentMonth ? 'text-emerald-400' : 'text-slate-200 hover:text-emerald-300')}
                title="Ir al mes actual"
              >
                {getMonthLabel(period.month, period.year)}
              </button>
              <button onClick={() => goToMonth(1)} className="p-2 text-slate-400 hover:text-slate-200 transition-colors" title="Mes siguiente">
                <ChevronRight size={15} />
              </button>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generateMov.isPending}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 bg-slate-800 rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
              title="Crea movimientos pendientes para este mes a partir de los conceptos activos que todavía no tengan uno cargado"
            >
              {generateMov.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Generar del mes
            </button>

            <button
              onClick={() => setShowConcepts(true)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 bg-slate-800 rounded-lg px-3 py-2 transition-colors"
            >
              <Settings2 size={13} /> Conceptos
            </button>

            <button
              onClick={() => setFormMovement(null)}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg px-3 py-2 transition-colors"
            >
              <Plus size={13} /> Nuevo movimiento
            </button>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        <StatsCards summary={summary} isLoading={loadingSummary} />

        {loadingMovements ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-10 justify-center">
            <RefreshCw size={16} className="animate-spin" /> Cargando movimientos...
          </div>
        ) : (
          <MovementsTable
            movements={movements}
            onQuickUpdate={handleQuickUpdate}
            onEdit={setFormMovement}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* Modales */}
      {formMovement !== undefined && (
        <MovementForm
          movement={formMovement}
          concepts={concepts}
          period={period}
          onClose={() => setFormMovement(undefined)}
        />
      )}
      {showConcepts && <ConceptsManager onClose={() => setShowConcepts(false)} />}
    </div>
  )
}
