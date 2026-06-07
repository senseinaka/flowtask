import { useState, useMemo, useEffect } from 'react'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts'
import {
  Wallet, Plus, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus,
  Edit3, Trash2, X, Check, Loader2, RefreshCw, Settings2, ArrowUpDown,
  ArrowUp, ArrowDown, AlertCircle, AlertTriangle, CalendarClock, Tag, Save,
  Clock, Bell, Info, CheckCircle2, Search, ListChecks, Filter,
  PieChart as PieChartIcon, BarChart3, GitCompare, LineChart as LineChartIcon,
  Trophy, Award, Flame, LayoutGrid, History as HistoryIcon, CopyPlus,
  Upload, Download, FileSpreadsheet, FileText, Lock, Unlock, ShieldCheck, ShieldOff,
  KeyRound, Eye, EyeOff, ChevronDown, AlertOctagon, Receipt,
  Sparkles, ClipboardPaste, FilePlus2
} from 'lucide-react'
import {
  useFinanceMovements, useUpcomingFinanceMovements, useFinanceMonthSummary,
  useFinanceConcepts, useFinanceCategories, useFinanceAccounts,
  useCreateFinanceMovement, useUpdateFinanceMovement, useQuickUpdateFinanceMovement, useDeleteFinanceMovement,
  useGenerateMovementsForMonth, useGenerateMovementsFromPreviousMonth,
  useCreateFinanceConcept, useUpdateFinanceConcept, useDeleteFinanceConcept,
  useCreateFinanceCategory, useUpdateFinanceCategory, useDeleteFinanceCategory,
  useMovementEntries, useAddMovementEntry, useUpdateMovementEntry, useRemoveMovementEntry,
  useFinanceCategoryBreakdown, useFinanceHistory, useFinanceTopConcepts, useFinanceTopIncreases,
  getDiffColor, formatCurrency, formatFinanceDate, getMonthLabel, getMonthName, MONTH_OPTIONS,
  getEffectiveAmount, formatSignedPercent,
  getMovementUrgency, getDueLabel, groupMovementsByUrgency, getFinanceAlerts,
  getDisplayStatus, getNextStatusOnClick,
  FINANCE_URGENCY_ORDER, FINANCE_URGENCY_LABELS, FINANCE_URGENCY_COLORS, FINANCE_HISTORY_MONTHS,
  useFinanceImportSelectFile, useFinanceImportParseText, useConfirmFinanceImport,
  useExportFinanceMovements, useExportFinanceMovementsSelection, useExportFinanceSummaryPdf,
  useFinanceSecurityStatus, useSetupFinancePin, useVerifyFinancePin, useDisableFinancePin, useChangeFinancePin,
  type FinanceMovementUrgency, type FinanceAlert, type FinanceAlertKind, type FinanceAlertSeverity
} from '../../hooks/useFinance'
import type {
  FinanceMovement, FinanceConcept, FinanceMonthSummary, FinanceCategory, FinanceAccount,
  FinanceMovementEntry,
  FinanceMovementStatus, FinancePaymentMethod, FinanceExpenseType, FinanceRecurrence,
  CreateFinanceMovementInput, CreateFinanceConceptInput, CreateFinanceCategoryInput,
  FinanceCategoryBreakdownItem, FinanceHistoryEntry, FinanceRankingConcept, FinanceRankingIncrease,
  FinanceImportPreviewItem, FinanceImportConfirmItem, FinanceImportIssue, FinanceImportResult
} from '@shared/types'
import {
  FINANCE_STATUS_LABELS, FINANCE_STATUS_COLORS, FINANCE_PAYMENT_METHOD_LABELS,
  FINANCE_EXPENSE_TYPE_LABELS, FINANCE_RECURRENCE_LABELS
} from '@shared/types'
import { cn } from '../../components/ui/utils'

dayjs.locale('es')

const inputCls = 'w-full bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors'
const labelCls = 'block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1'

type SortKey = 'concept' | 'category' | 'previous' | 'actual' | 'status' | 'payment_date' | 'due_date'
type SortDir = 'asc' | 'desc'

// Nota: el tab de gráfico "por categoría" se llama 'breakdown' (no 'categories')
// para no chocar con el nuevo modal de gestión "Categorías" (CategoriesManager,
// análogo a ConceptsManager) — son cosas distintas: uno es un desglose de gasto,
// el otro es un CRUD de categorías.
//
// La vieja pestaña única "Mes actual" (mezclaba resumen + planilla) se separó en
// dos, cada una con un propósito claro:
//   - 'overview'  → "Dashboard": avisos, alertas y tarjetas de totales — vista de
//                   un vistazo, "¿cómo viene el mes?". Es la pestaña de entrada.
//   - 'movements' → "Movimientos": filtros, acciones en lote y la planilla editable
//                   — vista de trabajo, "necesito cargar/revisar algo puntual".
// (El valor interno es 'overview' y no 'dashboard' para no mezclarse con el nombre
// del componente `FinanceDashboard` — la etiqueta visible sí dice "Dashboard".)
type DashboardTab = 'overview' | 'movements' | 'upcoming' | 'charts' | 'breakdown' | 'history'

// ── Filtros completos de movimientos ──────────────────────────────────────────

interface MovementFilters {
  categoryId:    string   // 'all' | category id
  accountId:     string   // 'all' | account id
  status:        string   // 'all' | FinanceMovementStatus
  paymentMethod: string   // 'all' | FinancePaymentMethod
  expenseType:   string   // 'all' | FinanceExpenseType
  recurrence:    string   // 'all' | FinanceRecurrence
  search:        string
}

const EMPTY_FILTERS: MovementFilters = {
  categoryId: 'all', accountId: 'all', status: 'all',
  paymentMethod: 'all', expenseType: 'all', recurrence: 'all', search: ''
}

function hasActiveFilters(f: MovementFilters): boolean {
  return f.categoryId !== 'all' || f.accountId !== 'all' || f.status !== 'all'
    || f.paymentMethod !== 'all' || f.expenseType !== 'all' || f.recurrence !== 'all'
    || f.search.trim() !== ''
}

function applyMovementFilters(movements: FinanceMovement[], f: MovementFilters): FinanceMovement[] {
  if (!hasActiveFilters(f)) return movements
  const q = f.search.trim().toLowerCase()
  return movements.filter(m => {
    if (f.categoryId    !== 'all' && m.concept?.category_id    !== f.categoryId)    return false
    if (f.accountId     !== 'all' && m.concept?.account_id     !== f.accountId)     return false
    // Comparamos contra el estado MOSTRADO (no el persistido): "vencido" se deriva
    // de due_date en caliente y casi nunca queda guardado como tal en la base — si
    // filtráramos por m.status el filtro "Vencido" no encontraría casi nada.
    if (f.status        !== 'all' && getDisplayStatus(m)        !== f.status)        return false
    if (f.paymentMethod !== 'all' && m.payment_method          !== f.paymentMethod) return false
    if (f.expenseType   !== 'all' && m.concept?.expense_type   !== f.expenseType)   return false
    if (f.recurrence    !== 'all' && m.concept?.recurrence     !== f.recurrence)    return false
    if (q) {
      const hay = `${m.concept?.name ?? ''} ${m.notes ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

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

/**
 * Badge de estado de un movimiento — click-to-cycle:
 *  - Click izquierdo: avanza al siguiente estado del ciclo (ver getNextStatusOnClick:
 *    recurrentes ciclan Pendiente ⇄ Pagado; no recurrentes ciclan Sin estado →
 *    Pendiente → Pagado → ...; si está vencido, un click lo manda directo a Pagado).
 *  - Click derecho: abre un selector directo, por si se quiere saltar a un estado
 *    puntual sin recorrer el ciclo (atajo para usuarios avanzados).
 * El color/label que se ve es el "estado mostrado" (getDisplayStatus): superpone
 * "Vencido" sobre el estado real cuando corresponde, sin tocar lo guardado en la base.
 */
function EditableStatus({ movement, onSave }: { movement: FinanceMovement; onSave: (v: FinanceMovementStatus) => void }) {
  const [picking, setPicking] = useState(false)
  const display = getDisplayStatus(movement)
  const color   = FINANCE_STATUS_COLORS[display]

  if (picking) {
    return (
      <select
        autoFocus
        value={movement.status}
        onChange={e => { onSave(e.target.value as FinanceMovementStatus); setPicking(false) }}
        onBlur={() => setPicking(false)}
        className="bg-slate-700 border border-emerald-500/60 rounded px-1.5 py-0.5 text-xs text-slate-100 focus:outline-none"
      >
        {(Object.keys(FINANCE_STATUS_LABELS) as FinanceMovementStatus[]).map(s => (
          <option key={s} value={s}>{FINANCE_STATUS_LABELS[s]}</option>
        ))}
      </select>
    )
  }

  const next = getNextStatusOnClick(movement)
  return (
    <button
      onClick={() => onSave(next)}
      onContextMenu={e => { e.preventDefault(); setPicking(true) }}
      title={`Click para pasar a "${FINANCE_STATUS_LABELS[next]}" · click derecho para elegir un estado puntual`}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-transform hover:scale-105"
      style={{ color, borderColor: color + '60', backgroundColor: color + '15' }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {FINANCE_STATUS_LABELS[display]}
    </button>
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

/**
 * Título editable de una fila (nombre de concepto, categoría, etc.) — click para
 * editar, Enter/blur para guardar, Escape para cancelar. Mismo patrón click-to-edit
 * que EditableNotes/EditableAmount, con la tipografía del título de la fila.
 * Usado en ConceptsManager y CategoriesManager.
 */
function EditableInlineTitle({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value)

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(value); setEditing(true) }}
        className="group/name flex items-center gap-1.5 text-left hover:bg-slate-700/40 rounded px-1.5 py-0.5 -mx-1.5 transition-colors min-w-0 max-w-full"
        title="Click para editar el nombre"
      >
        <span className="text-sm font-medium text-slate-200 truncate">{value}</span>
        <Edit3 size={11} className="text-slate-600 opacity-0 group-hover/name:opacity-100 flex-shrink-0 transition-opacity" />
      </button>
    )
  }
  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) onSave(trimmed)
    setEditing(false)
  }
  return (
    <input
      autoFocus
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onFocus={e => e.target.select()}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
      className="w-full max-w-[240px] bg-slate-700 border border-emerald-500/60 rounded px-1.5 py-0.5 text-sm text-slate-100 focus:outline-none"
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

// ── Barra de filtros completos ────────────────────────────────────────────────

const selectCls = 'bg-slate-700/60 border border-slate-600 rounded-lg pl-2.5 pr-7 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors'

function FiltersBar({
  filters, onChange, categories, accounts, resultCount, totalCount
}: {
  filters: MovementFilters
  onChange: (f: MovementFilters) => void
  categories: FinanceCategory[]
  accounts: FinanceAccount[]
  resultCount: number
  totalCount: number
}) {
  const active = hasActiveFilters(filters)
  const set = <K extends keyof MovementFilters>(key: K, value: MovementFilters[K]) =>
    onChange({ ...filters, [key]: value })

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold uppercase tracking-wider mr-1">
          <Filter size={12} /> Filtros
        </div>

        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            value={filters.search}
            onChange={e => set('search', e.target.value)}
            placeholder="Buscar concepto o nota…"
            className="bg-slate-700/60 border border-slate-600 rounded-lg pl-7 pr-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors w-44"
          />
        </div>

        <select value={filters.categoryId} onChange={e => set('categoryId', e.target.value)} className={selectCls}>
          <option value="all">Todas las categorías</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>

        <select value={filters.accountId} onChange={e => set('accountId', e.target.value)} className={selectCls}>
          <option value="all">Todas las cuentas</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
        </select>

        <select value={filters.status} onChange={e => set('status', e.target.value)} className={selectCls}>
          <option value="all">Todos los estados</option>
          {(Object.keys(FINANCE_STATUS_LABELS) as FinanceMovementStatus[]).map(s => (
            <option key={s} value={s}>{FINANCE_STATUS_LABELS[s]}</option>
          ))}
        </select>

        <select value={filters.paymentMethod} onChange={e => set('paymentMethod', e.target.value)} className={selectCls}>
          <option value="all">Todos los métodos de pago</option>
          {(Object.keys(FINANCE_PAYMENT_METHOD_LABELS) as FinancePaymentMethod[]).map(p => (
            <option key={p} value={p}>{FINANCE_PAYMENT_METHOD_LABELS[p]}</option>
          ))}
        </select>

        <select value={filters.expenseType} onChange={e => set('expenseType', e.target.value)} className={selectCls}>
          <option value="all">Fijo y variable</option>
          {(Object.keys(FINANCE_EXPENSE_TYPE_LABELS) as FinanceExpenseType[]).map(t => (
            <option key={t} value={t}>{FINANCE_EXPENSE_TYPE_LABELS[t]}</option>
          ))}
        </select>

        <select value={filters.recurrence} onChange={e => set('recurrence', e.target.value)} className={selectCls}>
          <option value="all">Todas las recurrencias</option>
          {(Object.keys(FINANCE_RECURRENCE_LABELS) as FinanceRecurrence[]).map(r => (
            <option key={r} value={r}>{FINANCE_RECURRENCE_LABELS[r]}</option>
          ))}
        </select>

        {active && (
          <button
            onClick={() => onChange(EMPTY_FILTERS)}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-300 px-2 py-1.5 rounded-lg hover:bg-slate-700/40 transition-colors"
          >
            <X size={12} /> Limpiar filtros
          </button>
        )}
      </div>

      {active && (
        <p className="text-[11px] text-slate-500 pl-0.5">
          Mostrando <span className="text-slate-300 font-semibold">{resultCount}</span> de {totalCount} movimientos
        </p>
      )}
    </div>
  )
}

// ── Tabla principal de movimientos ────────────────────────────────────────────

function MovementsTable({
  movements, onQuickUpdate, onEdit, onDelete, selectedIds, onToggleSelect, onToggleSelectAll
}: {
  movements: FinanceMovement[]
  onQuickUpdate: (id: string, data: { amount_actual?: number | null; status?: FinanceMovementStatus; payment_date?: number | null; due_date?: number | null; notes?: string }) => void
  onEdit:   (m: FinanceMovement) => void
  onDelete: (m: FinanceMovement) => void
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: (ids: string[]) => void
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
        case 'previous':     return dir * ((a.previous_month_amount ?? -1) - (b.previous_month_amount ?? -1))
        case 'actual':       return dir * (getEffectiveAmount(a) - getEffectiveAmount(b))
        case 'status':       return dir * getDisplayStatus(a).localeCompare(getDisplayStatus(b))
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
            <th className="px-3 py-2 w-9">
              <input
                type="checkbox"
                title="Seleccionar todo"
                checked={sorted.length > 0 && sorted.every(m => selectedIds.has(m.id))}
                ref={el => {
                  if (el) el.indeterminate = sorted.some(m => selectedIds.has(m.id)) && !sorted.every(m => selectedIds.has(m.id))
                }}
                onChange={() => onToggleSelectAll(sorted.map(m => m.id))}
                className="accent-emerald-500"
              />
            </th>
            <SortableHeader label="Concepto"   sortKey="concept"  currentKey={sortKey} currentDir={sortDir} onSort={onSort} />
            <SortableHeader label="Categoría"  sortKey="category" currentKey={sortKey} currentDir={sortDir} onSort={onSort} />
            <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-semibold text-slate-500">Tipo</th>
            <SortableHeader label="Mes anterior" sortKey="previous" currentKey={sortKey} currentDir={sortDir} onSort={onSort} className="text-right" />
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
              <tr key={m.id} className={cn('hover:bg-slate-800/40 transition-colors group', selectedIds.has(m.id) && 'bg-emerald-500/5')}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(m.id)}
                    onChange={() => onToggleSelect(m.id)}
                    className="accent-emerald-500"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: catColor }} />
                    <span className="font-medium text-slate-200 truncate">{m.concept?.name ?? '—'}</span>
                    {!!m.concept?.tracks_multiple_entries && (
                      <span
                        className="flex items-center gap-0.5 text-[9px] font-semibold text-purple-400 bg-purple-950/40 border border-purple-800/40 rounded px-1 py-0.5 flex-shrink-0"
                        title={
                          m.entries_count
                            ? `Suma ${m.entries_count} ${m.entries_count === 1 ? 'carga' : 'cargas'} de este mes — el monto real es el total acumulado, no un pago único.`
                            : 'Este concepto acumula varias cargas en el mes — todavía no cargaste ninguna.'
                        }
                      >
                        <Receipt size={9} /> {m.entries_count ?? 0}
                      </span>
                    )}
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
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {m.previous_month_amount != null ? (
                    <span className="text-slate-400" title="Lo que se pagó por este concepto el mes anterior">
                      {formatCurrency(m.previous_month_amount)}
                    </span>
                  ) : (
                    <span className="text-slate-600 text-xs" title="No hubo un pago registrado de este concepto el mes anterior">—</span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <EditableAmount value={m.amount_actual} onSave={v => onQuickUpdate(m.id, { amount_actual: v })} />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {m.concept?.tracks_multiple_entries ? (
                    // La variación compara una estimación única contra la SUMA de
                    // varias cargas — el % puede ser engañoso (ej: "+200%" solo
                    // porque hubo 3 cargas en vez de 1). Se aclara en vez de alarmar.
                    <span className="text-[10px] text-slate-600 italic" title="No se compara: el monto real acá es la suma de varias cargas, no una sola estimación.">
                      suma de cargas
                    </span>
                  ) : diffPct !== null ? (
                    <span className="text-xs font-semibold" style={{ color: getDiffColor(diffPct) }}>
                      {diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%
                    </span>
                  ) : <span className="text-slate-600 text-xs">—</span>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <EditableStatus movement={m} onSave={v => onQuickUpdate(m.id, { status: v, payment_date: v === 'paid' ? (m.payment_date ?? Date.now()) : m.payment_date })} />
                    {m.status !== 'paid' && (
                      <button
                        onClick={() => onQuickUpdate(m.id, { status: 'paid', payment_date: m.payment_date ?? Date.now() })}
                        title="Marcar como pagado"
                        className="p-1 rounded-md text-slate-600 hover:text-emerald-400 hover:bg-slate-700/50 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <CheckCircle2 size={13} />
                      </button>
                    )}
                  </div>
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
            <td colSpan={4} className="px-3 py-2.5 text-right text-xs font-semibold text-slate-400">Total del mes</td>
            <td className="px-3 py-2.5 text-right font-semibold text-slate-300 whitespace-nowrap">
              {formatCurrency(sorted.reduce((acc, m) => acc + (m.previous_month_amount ?? 0), 0))}
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

// ── Barra de acciones en lote (selección múltiple en la tabla) ───────────────
//
// Aparece flotando arriba de la tabla cuando hay movimientos tildados: permite
// marcarlos todos como pagados de una sola vez (un loop de quickUpdate, igual
// que la acción rápida individual) o exportar solo esa selección — sin volver
// a tocar la base de datos: se manda tal cual lo que ya está cargado en pantalla.

function BulkActionsBar({
  selected, onMarkPaid, onClear
}: {
  selected: FinanceMovement[]
  onMarkPaid: () => void
  onClear: () => void
}) {
  const [exportOpen, setExportOpen] = useState(false)
  const exportSelection = useExportFinanceMovementsSelection()
  const count = selected.length
  const pendingCount = selected.filter(m => m.status !== 'paid').length

  const handleExport = async (format: 'xlsx' | 'csv') => {
    setExportOpen(false)
    await exportSelection.mutateAsync({ movements: selected, format })
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-700/40 bg-emerald-950/20 px-4 py-2.5">
      <p className="text-xs text-emerald-200">
        <span className="font-semibold">{count}</span> {count === 1 ? 'movimiento seleccionado' : 'movimientos seleccionados'}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={onMarkPaid}
          disabled={pendingCount === 0}
          title={pendingCount === 0 ? 'Ya están todos marcados como pagados' : `Marcar ${pendingCount} ${pendingCount === 1 ? 'movimiento' : 'movimientos'} como pagado`}
          className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-white border border-emerald-700/50 hover:border-emerald-500 bg-emerald-900/30 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <CheckCircle2 size={13} /> Marcar como pagado{pendingCount > 0 && ` (${pendingCount})`}
        </button>

        <div className="relative">
          <button
            onClick={() => setExportOpen(o => !o)}
            disabled={exportSelection.isPending}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 bg-slate-800 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            {exportSelection.isPending ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            Exportar selección <ChevronDown size={11} />
          </button>
          {exportOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
              <div className="absolute right-0 top-full mt-1.5 z-50 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden py-1">
                <button onClick={() => handleExport('xlsx')}
                  className="w-full flex items-center gap-2.5 text-left text-xs text-slate-300 hover:bg-slate-700/60 hover:text-white px-3 py-2 transition-colors">
                  <FileSpreadsheet size={14} className="text-emerald-400" /> A Excel (.xlsx)
                </button>
                <button onClick={() => handleExport('csv')}
                  className="w-full flex items-center gap-2.5 text-left text-xs text-slate-300 hover:bg-slate-700/60 hover:text-white px-3 py-2 transition-colors">
                  <FileSpreadsheet size={14} className="text-emerald-400" /> A CSV
                </button>
              </div>
            </>
          )}
        </div>

        <button onClick={onClear} title="Cancelar selección" className="p-1.5 rounded-lg text-emerald-400/60 hover:text-emerald-200 hover:bg-emerald-900/30 transition-colors">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Alertas inteligentes (basadas en reglas — ver getFinanceAlerts) ───────────

const ALERT_ICONS: Record<FinanceAlertKind, React.ElementType> = {
  overdue:      AlertTriangle,
  due_today:    Clock,
  due_soon:     Bell,
  increase:     TrendingUp,
  no_movements: Info,
}

const ALERT_STYLES: Record<FinanceAlertSeverity, { box: string; icon: string }> = {
  danger:  { box: 'border-red-800/40 bg-red-950/20 text-red-200',       icon: 'text-red-400' },
  warning: { box: 'border-amber-800/40 bg-amber-950/20 text-amber-200', icon: 'text-amber-400' },
  info:    { box: 'border-sky-800/40 bg-sky-950/20 text-sky-200',       icon: 'text-sky-400' },
}

function SmartAlerts({ alerts }: { alerts: FinanceAlert[] }) {
  if (alerts.length === 0) return null
  return (
    <div className="space-y-2">
      {alerts.map(a => {
        const Icon = ALERT_ICONS[a.kind]
        const style = ALERT_STYLES[a.severity]
        return (
          <div key={a.id} className={cn('flex items-start gap-3 rounded-xl border px-4 py-2.5', style.box)}>
            <Icon size={15} className={cn('flex-shrink-0 mt-0.5', style.icon)} />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug">{a.title}</p>
              <p className="text-xs opacity-80 mt-0.5 leading-snug">{a.message}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Recordatorio de respaldo mensual ──────────────────────────────────────────
//
// Aviso "suave" (no intrusivo, descartable) que aparece sobre el final del mes
// si todavía no se exportó nada de ese período — para no depender de acordarse
// solo. Se guarda en localStorage (no en la DB: es una preferencia del
// dispositivo/usuario, no un dato financiero) y nunca bloquea ni interrumpe.

const EXPORT_REMINDER_LAST_DAYS = 5   // muestra el aviso en los últimos N días del mes

function periodKey(period: { month: number; year: number }): string {
  return `${period.year}-${String(period.month).padStart(2, '0')}`
}

function hasExportedThisPeriod(period: { month: number; year: number }): boolean {
  try { return !!localStorage.getItem(`finance:lastExport:${periodKey(period)}`) }
  catch { return true }   // si localStorage no está disponible, no insistir
}

function markExportedThisPeriod(period: { month: number; year: number }): void {
  try { localStorage.setItem(`finance:lastExport:${periodKey(period)}`, String(Date.now())) }
  catch { /* localStorage no disponible — no es crítico, simplemente no se recuerda */ }
}

function isReminderDismissed(period: { month: number; year: number }): boolean {
  try { return !!localStorage.getItem(`finance:exportReminder:dismissed:${periodKey(period)}`) }
  catch { return false }
}

function dismissReminder(period: { month: number; year: number }): void {
  try { localStorage.setItem(`finance:exportReminder:dismissed:${periodKey(period)}`, '1') }
  catch { /* idem */ }
}

function ExportReminderBanner({
  period, onDismiss
}: {
  period: { month: number; year: number }
  onDismiss: () => void
}) {
  const exportMovements = useExportFinanceMovements()

  const handleExport = async () => {
    const res = await exportMovements.mutateAsync({ month: period.month, year: period.year, format: 'xlsx' })
    if (res) { markExportedThisPeriod(period); onDismiss() }   // si canceló el diálogo, no se da por exportado
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-emerald-800/40 bg-emerald-950/20 px-4 py-2.5 text-emerald-100">
      <CalendarClock size={15} className="flex-shrink-0 mt-0.5 text-emerald-400" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug">Quedan pocos días de {getMonthLabel(period.month, period.year)} — ¿ya guardaste un respaldo?</p>
        <p className="text-xs opacity-75 mt-0.5 leading-snug">
          Exportar los movimientos a Excel/CSV (o el resumen en PDF, desde el botón "Exportar") te deja una copia local de este mes.
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={handleExport}
          disabled={exportMovements.isPending}
          className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-white border border-emerald-700/50 hover:border-emerald-500 bg-emerald-900/30 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
        >
          {exportMovements.isPending ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          Exportar a Excel
        </button>
        <button
          onClick={onDismiss}
          title="No volver a mostrar este aviso para este mes"
          className="p-1.5 rounded-lg text-emerald-400/60 hover:text-emerald-200 hover:bg-emerald-900/30 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Vista "Próximos pagos": cards agrupadas por urgencia ──────────────────────

/** Menú rápido para posponer un vencimiento: +N días o elegir una fecha puntual. */
function PostponeMenu({ dueDate, onPostpone }: { dueDate: number | null; onPostpone: (newDate: number) => void }) {
  const [open, setOpen] = useState(false)
  const base = dueDate ?? Date.now()
  const quickOptions = [7, 15, 30]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="Posponer vencimiento"
        className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-slate-700/50 transition-colors"
      >
        <CalendarClock size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-40 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-1.5 w-44">
            <p className="px-3 pb-1 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Posponer</p>
            {quickOptions.map(days => (
              <button
                key={days}
                onClick={() => { onPostpone(dayjs(base).add(days, 'day').valueOf()); setOpen(false) }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700/60 transition-colors"
              >
                + {days} días
              </button>
            ))}
            <div className="border-t border-slate-700 mt-1 pt-1.5 px-3 pb-1">
              <label className="block text-[10px] text-slate-500 mb-1">Elegir fecha</label>
              <input
                type="date"
                defaultValue={dueDate ? dayjs(dueDate).format('YYYY-MM-DD') : ''}
                onChange={e => {
                  if (!e.target.value) return
                  onPostpone(dayjs(e.target.value, 'YYYY-MM-DD').valueOf())
                  setOpen(false)
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded px-1.5 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function UpcomingMovementCard({
  movement, onQuickUpdate, onEdit
}: {
  movement: FinanceMovement
  onQuickUpdate: (id: string, data: { status?: FinanceMovementStatus; payment_date?: number | null; due_date?: number | null }) => void
  onEdit: (m: FinanceMovement) => void
}) {
  const urgency = getMovementUrgency(movement)
  const color = urgency ? FINANCE_URGENCY_COLORS[urgency] : '#64748b'
  const catColor = movement.concept?.category?.color ?? '#6366f1'

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-2.5 hover:bg-slate-800/60 transition-colors group">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: catColor }} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate">{movement.concept?.name ?? '—'}</p>
          <p className="text-[11px] text-slate-500 truncate">
            {movement.concept?.category ? `${movement.concept.category.icon} ${movement.concept.category.name} · ` : ''}
            {formatCurrency(getEffectiveAmount(movement))}
            {movement.due_date !== null && <> · vence {formatFinanceDate(movement.due_date)}</>}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 flex-shrink-0">
        {movement.due_date !== null && (
          <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color }}>
            {getDueLabel(movement.due_date)}
          </span>
        )}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onQuickUpdate(movement.id, { status: 'paid', payment_date: movement.payment_date ?? Date.now() })}
            title="Marcar como pagado"
            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-slate-700/50 transition-colors"
          >
            <CheckCircle2 size={15} />
          </button>
          <PostponeMenu dueDate={movement.due_date} onPostpone={newDate => onQuickUpdate(movement.id, { due_date: newDate })} />
          <button
            onClick={() => onEdit(movement)}
            title="Editar movimiento"
            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-slate-700/50 transition-colors"
          >
            <Edit3 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function UrgencyBucketSection({
  urgency, movements, onQuickUpdate, onEdit
}: {
  urgency: FinanceMovementUrgency
  movements: FinanceMovement[]
  onQuickUpdate: (id: string, data: { status?: FinanceMovementStatus; payment_date?: number | null; due_date?: number | null }) => void
  onEdit: (m: FinanceMovement) => void
}) {
  if (movements.length === 0) return null
  const color = FINANCE_URGENCY_COLORS[urgency]
  const total = movements.reduce((acc, m) => acc + getEffectiveAmount(m), 0)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-0.5">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{FINANCE_URGENCY_LABELS[urgency]}</h3>
        <span className="text-[11px] text-slate-500">
          · {movements.length} {movements.length === 1 ? 'movimiento' : 'movimientos'} · {formatCurrency(total)}
        </span>
      </div>
      <div className="space-y-1.5">
        {movements.map(m => (
          <UpcomingMovementCard key={m.id} movement={m} onQuickUpdate={onQuickUpdate} onEdit={onEdit} />
        ))}
      </div>
    </div>
  )
}

function UpcomingPaymentsView({
  onQuickUpdate, onEdit
}: {
  onQuickUpdate: (id: string, data: { status?: FinanceMovementStatus; payment_date?: number | null; due_date?: number | null }) => void
  onEdit: (m: FinanceMovement) => void
}) {
  const { data: movements = [], isLoading } = useUpcomingFinanceMovements()
  const groups = useMemo(() => groupMovementsByUrgency(movements), [movements])

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm py-10 justify-center">
        <RefreshCw size={16} className="animate-spin" /> Cargando próximos pagos...
      </div>
    )
  }

  if (movements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ListChecks size={28} className="text-slate-700 mb-3" />
        <p className="text-sm text-slate-400">No tenés pagos pendientes ni vencidos cargados.</p>
        <p className="text-xs text-slate-600 mt-1">¡Vas al día! Los nuevos movimientos pendientes con vencimiento van a aparecer acá.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {FINANCE_URGENCY_ORDER.map(key => (
        <UrgencyBucketSection key={key} urgency={key} movements={groups[key]} onQuickUpdate={onQuickUpdate} onEdit={onEdit} />
      ))}
    </div>
  )
}

/**
 * Separa los movimientos del mes en los dos focos del panel de alertas —
 * "Vencidos" y "Recurrentes sin pagar" (ver doc de `MonthAlertsPanel` para el
 * criterio de cada uno). Función pura, sin hooks, para poder reusar exactamente
 * el mismo criterio tanto dentro del panel como en el badge de la pestaña
 * "Dashboard" (conteo) sin duplicar — y sin que se desincronicen con el tiempo.
 */
function getMonthAlertMovements(movements: FinanceMovement[]): {
  overdue: FinanceMovement[]
  recurringUnpaid: FinanceMovement[]
} {
  const overdue = movements.filter(m => getDisplayStatus(m) === 'overdue')
  const recurringUnpaid = movements.filter(m =>
    m.concept != null && m.concept.recurrence !== 'one_time' &&
    getDisplayStatus(m) !== 'paid' && getDisplayStatus(m) !== 'overdue'
  )
  return { overdue, recurringUnpaid }
}

/**
 * Dashboard de alertas del mes (Fase 7).
 *
 * `SmartAlerts` ya da el resumen narrativo ("3 pagos vencidos, suman $X") en
 * forma de banners informativos. Esto va un paso más allá: eleva los movimientos
 * concretos que conviene resolver ANTES de cerrar el mes a una superficie propia,
 * prominente y accionable — con el mismo botón de "Marcar pagado" de un click que
 * ya usa "Próximos pagos" (UpcomingMovementCard), para no obligar a buscarlos en
 * la tabla principal ni cambiar de pestaña.
 *
 * Dos focos, pedidos explícitamente:
 * - "Vencidos": getDisplayStatus(m) === 'overdue' (vencimiento ya pasado y
 *   todavía sin pagar — el cálculo es el mismo overlay que pinta el badge rojo
 *   en la tabla, no se persiste un estado nuevo).
 * - "Recurrentes sin pagar": conceptos con recurrencia (no 'one_time') cuyo
 *   movimiento de este mes todavía no está pagado — son pagos que con certeza
 *   van a salir sí o sí, así que vale la pena tenerlos a la vista hasta resolverlos
 *   (a diferencia de los "puntuales/sin estado", que pueden no llegar a ocurrir).
 *
 * No se muestra nada si no hay nada pendiente — el usuario "está al día" y no
 * hace falta ocupar espacio con una sección vacía.
 */
function MonthAlertsPanel({
  movements, period, onQuickUpdate, onEdit
}: {
  movements: FinanceMovement[]
  period: { month: number; year: number }
  onQuickUpdate: (id: string, data: { status?: FinanceMovementStatus; payment_date?: number | null; due_date?: number | null }) => void
  onEdit: (m: FinanceMovement) => void
}) {
  const { overdue, recurringUnpaid } = useMemo(() => getMonthAlertMovements(movements), [movements])

  if (overdue.length === 0 && recurringUnpaid.length === 0) return null

  const overdueTotal   = overdue.reduce((acc, m) => acc + getEffectiveAmount(m), 0)
  const recurringTotal = recurringUnpaid.reduce((acc, m) => acc + getEffectiveAmount(m), 0)
  const totalCount     = overdue.length + recurringUnpaid.length

  return (
    <div className="rounded-2xl border border-amber-700/30 bg-gradient-to-br from-amber-950/10 via-slate-900 to-slate-900 overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-800/60">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-600/30 flex items-center justify-center flex-shrink-0">
          <AlertOctagon size={15} className="text-amber-400" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">
            Alertas de {getMonthLabel(period.month, period.year)} — {totalCount} {totalCount === 1 ? 'pendiente' : 'pendientes'}
          </h3>
          <p className="text-[11px] text-slate-500">Conviene resolver esto antes de cerrar el mes — un click en <CheckCircle2 size={10} className="inline -mt-0.5" /> lo marca como pagado.</p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {overdue.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-0.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0 bg-red-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-red-400">Vencidos</h4>
              <span className="text-[11px] text-slate-500">
                · {overdue.length} {overdue.length === 1 ? 'movimiento' : 'movimientos'} · {formatCurrency(overdueTotal)}
              </span>
            </div>
            <div className="space-y-1.5">
              {overdue.map(m => (
                <UpcomingMovementCard key={m.id} movement={m} onQuickUpdate={onQuickUpdate} onEdit={onEdit} />
              ))}
            </div>
          </div>
        )}

        {recurringUnpaid.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-0.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0 bg-amber-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">Recurrentes sin pagar</h4>
              <span className="text-[11px] text-slate-500">
                · {recurringUnpaid.length} {recurringUnpaid.length === 1 ? 'movimiento' : 'movimientos'} · {formatCurrency(recurringTotal)}
              </span>
            </div>
            <div className="space-y-1.5">
              {recurringUnpaid.map(m => (
                <UpcomingMovementCard key={m.id} movement={m} onQuickUpdate={onQuickUpdate} onEdit={onEdit} />
              ))}
            </div>
          </div>
        )}
      </div>
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

  // Para conceptos "de varias cargas" (Opción C), monto/estado/fecha de pago se
  // derivan en vivo del registro de cargas — no del snapshot `movement` con el
  // que se abrió el modal (que queda desactualizado en cuanto se agrega una carga).
  const tracksEntries = isEdit && firstConcept?.tracks_multiple_entries === 1
  const { data: liveEntries = [] } = useMovementEntries(tracksEntries ? movement!.id : null)
  const liveTotal = useMemo(
    () => liveEntries.reduce((sum, e) => sum + e.amount, 0),
    [liveEntries]
  )
  const liveLastDate = useMemo(() => {
    const dated = liveEntries.filter(e => e.entry_date != null).map(e => e.entry_date as number)
    return dated.length ? Math.max(...dated) : null
  }, [liveEntries])

  const [form, setForm] = useState({
    concept_id:       firstConceptId,
    amount_estimated: String(movement?.amount_estimated ?? firstConcept?.default_amount ?? 0),
    amount_actual:    movement?.amount_actual !== null && movement?.amount_actual !== undefined ? String(movement.amount_actual) : '',
    // Estado inicial al dar de alta a mano: igual criterio que la generación automática
    // (recurrente → "pendiente", puntual/variable → "sin estado, puede no ocurrir").
    status:           movement?.status ?? (firstConcept?.recurrence === 'one_time' ? 'no_status' : 'pending') as FinanceMovementStatus,
    payment_method:   movement?.payment_method ?? firstConcept?.payment_method ?? 'transfer' as FinancePaymentMethod,
    payment_date:     movement?.payment_date ? dayjs(movement.payment_date).format('YYYY-MM-DD') : '',
    // Por defecto un movimiento nuevo NO tiene fecha de vencimiento — se carga
    // a mano solo si corresponde (pedido explícito: "no debe tener vencimiento").
    due_date:         movement?.due_date ? dayjs(movement.due_date).format('YYYY-MM-DD') : '',
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
      status:           !isEdit ? ((c?.recurrence === 'one_time' ? 'no_status' : 'pending') as FinanceMovementStatus) : f.status,
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
            {tracksEntries ? (
              <div>
                <label className={labelCls}>Monto real (suma de cargas)</label>
                <div className={cn(inputCls, 'flex items-center justify-between text-slate-400 cursor-not-allowed select-none')}>
                  <span>{liveEntries.length === 0 ? '—' : formatCurrency(liveTotal)}</span>
                  <Receipt size={13} className="text-purple-400" />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Se calcula solo a partir del registro de cargas de abajo.</p>
              </div>
            ) : (
              <div>
                <label className={labelCls}>Monto real (si ya lo conocés)</label>
                <input type="number" value={form.amount_actual} onChange={e => upd('amount_actual', e.target.value)} placeholder="—" className={inputCls} />
              </div>
            )}
          </div>

          {tracksEntries && (
            <MovementEntriesLedger movementId={movement!.id} entries={liveEntries} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Estado</label>
              {tracksEntries ? (
                <>
                  <div className={cn(inputCls, 'flex items-center text-slate-400 cursor-not-allowed select-none')}>
                    {FINANCE_STATUS_LABELS[liveEntries.length > 0 ? 'paid' : 'pending']}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Se actualiza solo: "pagado" apenas cargás la primera entrada, "pendiente" si no hay ninguna.</p>
                </>
              ) : (
                <select value={form.status} onChange={e => upd('status', e.target.value as FinanceMovementStatus)} className={inputCls}>
                  {(Object.keys(FINANCE_STATUS_LABELS) as FinanceMovementStatus[]).map(s => (
                    <option key={s} value={s}>{FINANCE_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              )}
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
              {tracksEntries ? (
                <>
                  <div className={cn(inputCls, 'flex items-center text-slate-400 cursor-not-allowed select-none')}>
                    {liveLastDate != null ? dayjs(liveLastDate).format('DD/MM/YYYY') : '—'}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Toma la fecha de la última carga registrada.</p>
                </>
              ) : (
                <input type="date" value={form.payment_date} onChange={e => upd('payment_date', e.target.value)} className={inputCls} />
              )}
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

/**
 * Registro de cargas (Opción C) — sub-ledger embebido en el modal de edición de
 * un movimiento cuyo concepto está marcado `tracks_multiple_entries`.
 *
 * Reemplaza el viejo workaround de duplicar conceptos ("Nafta 1", "Nafta 2",
 * "Nafta 3") cuando un mismo gasto ocurre varias veces en el mes: acá se carga
 * cada ocurrencia como una "entrada" (monto + fecha + nota) dentro del MISMO
 * movimiento, y el backend recalcula automáticamente `amount_actual`, `status`
 * y `payment_date` del movimiento a partir de la suma/lista de entradas
 * (ver `recalcMovementFromEntries` en queries/finance.ts).
 */
function MovementEntriesLedger({ movementId, entries }: {
  movementId: string
  entries:    FinanceMovementEntry[]
}) {
  const add    = useAddMovementEntry()
  const update = useUpdateMovementEntry()
  const remove = useRemoveMovementEntry()

  const todayStr = dayjs().format('YYYY-MM-DD')
  const [draft, setDraft] = useState({ amount: '', entry_date: todayStr, note: '' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState({ amount: '', entry_date: '', note: '' })
  const [busy, setBusy] = useState(false)

  const total = useMemo(() => entries.reduce((sum, e) => sum + e.amount, 0), [entries])

  const sorted = useMemo(
    () => [...entries].sort((a, b) => (b.entry_date ?? 0) - (a.entry_date ?? 0) || b.created_at - a.created_at),
    [entries]
  )

  const resetDraft = () => setDraft({ amount: '', entry_date: todayStr, note: '' })

  const handleAdd = async () => {
    const amount = Number(draft.amount.replace(',', '.'))
    if (!amount || amount <= 0) return
    setBusy(true)
    try {
      await add.mutateAsync({
        movement_id: movementId,
        amount,
        entry_date:  draft.entry_date ? dayjs(draft.entry_date, 'YYYY-MM-DD').valueOf() : null,
        note:        draft.note.trim()
      })
      resetDraft()
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (e: FinanceMovementEntry) => {
    setEditingId(e.id)
    setEditDraft({
      amount:     String(e.amount),
      entry_date: e.entry_date ? dayjs(e.entry_date).format('YYYY-MM-DD') : '',
      note:       e.note ?? ''
    })
  }

  const handleSaveEdit = async (id: string) => {
    const amount = Number(editDraft.amount.replace(',', '.'))
    if (!amount || amount <= 0) return
    setBusy(true)
    try {
      await update.mutateAsync({
        id, movementId,
        data: {
          amount,
          entry_date: editDraft.entry_date ? dayjs(editDraft.entry_date, 'YYYY-MM-DD').valueOf() : null,
          note:       editDraft.note.trim()
        }
      })
      setEditingId(null)
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (e: FinanceMovementEntry) => {
    if (!confirm(`¿Eliminar esta carga de ${formatCurrency(e.amount)}? El total del movimiento se recalcula solo.`)) return
    await remove.mutateAsync({ id: e.id, movementId })
  }

  return (
    <div className="rounded-xl border border-purple-800/30 bg-purple-950/10 p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt size={14} className="text-purple-400" />
          <h3 className="text-xs font-semibold text-slate-200">Registro de cargas</h3>
          <span className="text-[10px] text-slate-500">({entries.length} {entries.length === 1 ? 'carga' : 'cargas'})</span>
        </div>
        <span className="text-xs font-semibold text-purple-300">{formatCurrency(total)}</span>
      </div>

      {sorted.length > 0 && (
        <div className="space-y-1.5">
          {sorted.map(e => (
            <div key={e.id} className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
              {editingId === e.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number" autoFocus value={editDraft.amount}
                      onChange={ev => setEditDraft(d => ({ ...d, amount: ev.target.value }))}
                      className={cn(inputCls, 'py-1.5 text-xs')} placeholder="Monto"
                    />
                    <input
                      type="date" value={editDraft.entry_date}
                      onChange={ev => setEditDraft(d => ({ ...d, entry_date: ev.target.value }))}
                      className={cn(inputCls, 'py-1.5 text-xs')}
                    />
                    <input
                      type="text" value={editDraft.note}
                      onChange={ev => setEditDraft(d => ({ ...d, note: ev.target.value }))}
                      className={cn(inputCls, 'py-1.5 text-xs')} placeholder="Nota (opcional)"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingId(null)} className="text-[11px] text-slate-400 hover:text-slate-200 px-2 py-1">Cancelar</button>
                    <button
                      onClick={() => handleSaveEdit(e.id)} disabled={busy}
                      className="flex items-center gap-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 rounded-lg px-2.5 py-1"
                    >
                      <Check size={11} /> Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex items-baseline gap-2.5">
                    <span className="text-sm font-semibold text-slate-100 flex-shrink-0">{formatCurrency(e.amount)}</span>
                    <span className="text-[11px] text-slate-500 flex-shrink-0">
                      {e.entry_date ? dayjs(e.entry_date).format('DD/MM/YYYY') : 'sin fecha'}
                    </span>
                    {e.note && <span className="text-[11px] text-slate-500 truncate">· {e.note}</span>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => startEdit(e)} className="p-1 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-slate-700/50 transition-colors" title="Editar carga">
                      <Edit3 size={12} />
                    </button>
                    <button onClick={() => handleRemove(e)} className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700/50 transition-colors" title="Eliminar carga">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {sorted.length === 0 && (
        <p className="text-[11px] text-slate-500 italic">Todavía no cargaste ninguna entrada para este mes.</p>
      )}

      <div className="grid grid-cols-3 gap-2 pt-1">
        <input
          type="number" value={draft.amount}
          onChange={e => setDraft(d => ({ ...d, amount: e.target.value }))}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          className={cn(inputCls, 'py-1.5 text-xs')} placeholder="Monto de la carga"
        />
        <input
          type="date" value={draft.entry_date}
          onChange={e => setDraft(d => ({ ...d, entry_date: e.target.value }))}
          className={cn(inputCls, 'py-1.5 text-xs')}
        />
        <input
          type="text" value={draft.note}
          onChange={e => setDraft(d => ({ ...d, note: e.target.value }))}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          className={cn(inputCls, 'py-1.5 text-xs')} placeholder="Nota (opcional)"
        />
      </div>
      <div className="flex justify-end">
        <button
          onClick={handleAdd}
          disabled={busy || !draft.amount.trim()}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg px-3 py-1.5 transition-colors"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Agregar carga
        </button>
      </div>
    </div>
  )
}

// ── Bloqueo por PIN (Fase 5) ──────────────────────────────────────────────────
//
// Pantalla que reemplaza todo el contenido del módulo mientras esté bloqueado.
// La verificación nunca expone el PIN ni su hash — solo dice si lo que se
// tipeó coincide. No hay límite de intentos: es un freno para miradas casuales
// en un equipo compartido, no una caja fuerte.

function FinanceLockScreen({ onUnlock }: { onUnlock: () => void }) {
  const verify = useVerifyFinancePin()
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [error, setError] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pin || verify.isPending) return
    const ok = await verify.mutateAsync(pin)
    if (ok) onUnlock()
    else { setError(true); setPin('') }
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-slate-900 px-6">
      <div className="w-full max-w-xs text-center space-y-5">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-600/20 border border-emerald-600/30 flex items-center justify-center">
          <Lock size={24} className="text-emerald-400" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white">Finanzas Personales bloqueadas</h1>
          <p className="text-xs text-slate-500 mt-1">Ingresá tu PIN para acceder a esta sección.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <input
              autoFocus
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 12)); setError(false) }}
              className={cn(
                inputCls, 'text-center text-lg tracking-[0.5em] pr-10',
                error && 'border-red-500 focus:border-red-500 focus:ring-red-500/30'
              )}
              placeholder="••••"
            />
            <button
              type="button"
              onClick={() => setShowPin(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              tabIndex={-1}
            >
              {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-400 flex items-center justify-center gap-1.5">
              <AlertOctagon size={13} /> PIN incorrecto. Probá de nuevo.
            </p>
          )}
          <button
            type="submit"
            disabled={!pin || verify.isPending}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg px-3 py-2.5 transition-colors disabled:opacity-50"
          >
            {verify.isPending ? <Loader2 size={13} className="animate-spin" /> : <Unlock size={13} />}
            Desbloquear
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Modal: gestionar bloqueo por PIN ──────────────────────────────────────────

function SecurityManager({ onClose }: { onClose: () => void }) {
  const { data: status } = useFinanceSecurityStatus()
  const setup   = useSetupFinancePin()
  const disable = useDisableFinancePin()
  const change  = useChangeFinancePin()

  const [mode, setMode] = useState<'setup' | 'change' | 'disable' | null>(null)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const reset = () => { setMode(null); setCurrentPin(''); setNewPin(''); setConfirmPin(''); setError('') }
  const startMode = (m: typeof mode) => { reset(); setMode(m); setNotice('') }

  const pinInput = (value: string, onChange: (v: string) => void, label: string, autoFocus = false) => (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        type="password" inputMode="numeric" autoFocus={autoFocus}
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 12))}
        className={cn(inputCls, 'tracking-[0.3em]')}
        placeholder="••••"
      />
    </div>
  )

  const handleSetup = async () => {
    setError('')
    if (newPin.length < 4)     return setError('El PIN debe tener al menos 4 dígitos.')
    if (newPin !== confirmPin) return setError('Los PIN ingresados no coinciden.')
    await setup.mutateAsync(newPin)
    reset()
    setNotice('Bloqueo activado — la próxima vez que entres a Finanzas vas a tener que ingresar el PIN.')
  }

  const handleChange = async () => {
    setError('')
    if (newPin.length < 4)     return setError('El PIN nuevo debe tener al menos 4 dígitos.')
    if (newPin !== confirmPin) return setError('Los PIN nuevos no coinciden.')
    const ok = await change.mutateAsync({ currentPin, newPin })
    if (!ok) return setError('El PIN actual ingresado es incorrecto.')
    reset()
    setNotice('PIN actualizado correctamente.')
  }

  const handleDisable = async () => {
    setError('')
    const ok = await disable.mutateAsync(currentPin)
    if (!ok) return setError('El PIN actual ingresado es incorrecto.')
    reset()
    setNotice('Bloqueo desactivado.')
  }

  const enabled = status?.enabled ?? false

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ width: 'min(440px, 95vw)', maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/50 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-600/30 flex items-center justify-center">
              <KeyRound size={15} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Bloqueo por PIN</h2>
              <p className="text-[10px] text-slate-500">Pantalla de acceso para esta sección</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          <div className={cn(
            'flex items-center gap-3 rounded-xl border p-3.5',
            enabled ? 'border-emerald-700/40 bg-emerald-950/20' : 'border-slate-700 bg-slate-800/40'
          )}>
            {enabled
              ? <ShieldCheck size={18} className="text-emerald-400 flex-shrink-0" />
              : <ShieldOff size={18} className="text-slate-500 flex-shrink-0" />}
            <div className="text-xs">
              <p className={cn('font-semibold', enabled ? 'text-emerald-300' : 'text-slate-300')}>
                {enabled ? 'Bloqueo activado' : 'Bloqueo desactivado'}
              </p>
              <p className="text-slate-500 mt-0.5">
                {enabled
                  ? 'Vas a necesitar el PIN cada vez que entres a Finanzas Personales.'
                  : 'Cualquiera con acceso a esta computadora puede ver tus datos financieros sin restricción.'}
              </p>
            </div>
          </div>

          {notice && (
            <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-950/20 border border-emerald-700/40 rounded-lg px-3 py-2">
              <CheckCircle2 size={14} className="flex-shrink-0" /> {notice}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-300 bg-red-950/20 border border-red-700/40 rounded-lg px-3 py-2">
              <AlertOctagon size={14} className="flex-shrink-0" /> {error}
            </div>
          )}

          {!enabled && mode !== 'setup' && (
            <button
              onClick={() => startMode('setup')}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg px-3 py-2.5 transition-colors"
            >
              <Lock size={13} /> Activar bloqueo por PIN
            </button>
          )}

          {!enabled && mode === 'setup' && (
            <div className="space-y-2.5">
              {pinInput(newPin, setNewPin, 'Nuevo PIN (mín. 4 dígitos)', true)}
              {pinInput(confirmPin, setConfirmPin, 'Repetí el PIN')}
              <div className="flex items-center gap-2 pt-1">
                <button onClick={handleSetup} disabled={setup.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg px-3 py-2 transition-colors disabled:opacity-50">
                  {setup.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Activar
                </button>
                <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2 transition-colors">Cancelar</button>
              </div>
            </div>
          )}

          {enabled && mode === null && (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => startMode('change')}
                className="flex items-center justify-center gap-1.5 text-xs text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 bg-slate-800 rounded-lg px-3 py-2 transition-colors">
                <KeyRound size={13} /> Cambiar PIN
              </button>
              <button onClick={() => startMode('disable')}
                className="flex items-center justify-center gap-1.5 text-xs text-red-300 hover:text-red-200 border border-red-800/50 hover:border-red-700 bg-red-950/20 rounded-lg px-3 py-2 transition-colors">
                <ShieldOff size={13} /> Desactivar
              </button>
            </div>
          )}

          {enabled && mode === 'change' && (
            <div className="space-y-2.5">
              {pinInput(currentPin, setCurrentPin, 'PIN actual', true)}
              {pinInput(newPin, setNewPin, 'PIN nuevo')}
              {pinInput(confirmPin, setConfirmPin, 'Repetí el PIN nuevo')}
              <div className="flex items-center gap-2 pt-1">
                <button onClick={handleChange} disabled={change.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg px-3 py-2 transition-colors disabled:opacity-50">
                  {change.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Guardar
                </button>
                <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2 transition-colors">Cancelar</button>
              </div>
            </div>
          )}

          {enabled && mode === 'disable' && (
            <div className="space-y-2.5">
              <p className="text-xs text-amber-300 bg-amber-950/20 border border-amber-700/40 rounded-lg px-3 py-2">
                Vas a poder entrar a Finanzas Personales sin pedir PIN. Podés volver a activarlo cuando quieras.
              </p>
              {pinInput(currentPin, setCurrentPin, 'PIN actual', true)}
              <div className="flex items-center gap-2 pt-1">
                <button onClick={handleDisable} disabled={disable.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg px-3 py-2 transition-colors disabled:opacity-50">
                  {disable.isPending ? <Loader2 size={13} className="animate-spin" /> : <ShieldOff size={13} />} Desactivar bloqueo
                </button>
                <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2 transition-colors">Cancelar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Exportar: menú desplegable Excel / CSV / PDF resumen ──────────────────────
//
// Cada opción abre un diálogo "Guardar como" en el proceso principal; si el
// usuario cancela, no pasa nada. Al guardar, se abre el explorador de archivos
// en la carpeta destino para encontrarlo fácil (ver finance.ipc → shell.showItemInFolder).

// Etiqueta descriptiva mientras se genera cada formato — reemplaza el rótulo
// fijo "Exportar" durante la espera para que no parezca que la app se congeló
// (el diálogo nativo de Windows puede mostrar "(No responde)" unos segundos
// mientras el proceso principal arma el archivo en el hilo principal).
const EXPORT_PROGRESS_LABELS: Record<'xlsx' | 'csv' | 'pdf', string> = {
  xlsx: 'Generando Excel…',
  csv:  'Generando CSV…',
  pdf:  'Generando PDF…',
}

function ExportMenu({ period }: { period: { month: number; year: number } }) {
  const [open, setOpen] = useState(false)
  const exportMovements = useExportFinanceMovements()
  const exportPdf       = useExportFinanceSummaryPdf()
  const busy = exportMovements.isPending || exportPdf.isPending

  const pendingKind: 'xlsx' | 'csv' | 'pdf' | null =
    exportPdf.isPending ? 'pdf' : (exportMovements.isPending ? (exportMovements.variables?.format ?? 'xlsx') : null)

  const handleExport = async (kind: 'xlsx' | 'csv' | 'pdf') => {
    setOpen(false)
    const res = kind === 'pdf'
      ? await exportPdf.mutateAsync({ month: period.month, year: period.year })
      : await exportMovements.mutateAsync({ month: period.month, year: period.year, format: kind })
    // Si efectivamente se guardó algo (no canceló el diálogo), se registra para
    // que el recordatorio de respaldo de fin de mes no vuelva a insistir.
    if (res) markExportedThisPeriod(period)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={busy}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 bg-slate-800 rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
        title="Exportar los movimientos de este mes a Excel/CSV, o un resumen en PDF"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
        {pendingKind ? EXPORT_PROGRESS_LABELS[pendingKind] : 'Exportar'}
        {!busy && <ChevronDown size={12} />}
      </button>
      {busy && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-60 bg-slate-800 border border-slate-700 rounded-lg shadow-xl px-3 py-2.5">
          <p className="text-[11px] text-slate-400 leading-snug">
            Armando el archivo… puede tardar varios segundos. La ventana para elegir dónde guardarlo puede verse "sin responder" mientras tanto — es normal, no la cierres.
          </p>
        </div>
      )}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-50 w-60 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden py-1">
            <button onClick={() => handleExport('xlsx')}
              className="w-full flex items-center gap-2.5 text-left text-xs text-slate-300 hover:bg-slate-700/60 hover:text-white px-3 py-2 transition-colors">
              <FileSpreadsheet size={14} className="text-emerald-400" /> Movimientos a Excel (.xlsx)
            </button>
            <button onClick={() => handleExport('csv')}
              className="w-full flex items-center gap-2.5 text-left text-xs text-slate-300 hover:bg-slate-700/60 hover:text-white px-3 py-2 transition-colors">
              <FileSpreadsheet size={14} className="text-emerald-400" /> Movimientos a CSV
            </button>
            <div className="h-px bg-slate-700/60 my-1" />
            <button onClick={() => handleExport('pdf')}
              className="w-full flex items-center gap-2.5 text-left text-xs text-slate-300 hover:bg-slate-700/60 hover:text-white px-3 py-2 transition-colors">
              <FileText size={14} className="text-rose-400" /> Resumen del mes en PDF
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Modal: importar movimientos con previsualización (Fase 5) ────────────────
//
// Flujo en dos pasos a propósito: 1) elegir archivo → se parsea y matchea contra
// conceptos existentes sin escribir nada; 2) revisar/ajustar cada fila (concepto,
// monto, estado, notas — todo editable) y recién ahí confirmar. Las filas con
// problemas (concepto no encontrado, monto inválido, duplicado) arrancan
// destildadas para que nada se cargue "a ciegas".

const IMPORT_ISSUE_META: Record<FinanceImportIssue, { label: string; cls: string }> = {
  ok:                { label: 'Listo para importar',    cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  concept_not_found: { label: 'Concepto no encontrado', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  invalid_amount:    { label: 'Monto inválido',         cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  duplicate:         { label: 'Ya existe este mes',     cls: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
}

interface ImportRowDraft {
  item:      FinanceImportPreviewItem
  include:   boolean
  conceptId: string | null
  amount:    number | null
  status:    FinanceMovementStatus
  notes:     string
  overwrite: boolean
}

function buildImportRowDrafts(items: FinanceImportPreviewItem[]): ImportRowDraft[] {
  return items.map(item => ({
    item,
    include:   item.issue === 'ok',
    conceptId: item.matchedConceptId,
    amount:    item.amount,
    status:    item.status,
    notes:     item.notes,
    overwrite: false
  }))
}

function ImportManager({
  period, concepts, onClose
}: {
  period: { month: number; year: number }
  concepts: FinanceConcept[]
  onClose: () => void
}) {
  const selectFile    = useFinanceImportSelectFile()
  const parseText     = useFinanceImportParseText()
  const confirmImport = useConfirmFinanceImport()
  const createConcept = useCreateFinanceConcept()
  const { data: categories = [] } = useFinanceCategories()
  const { data: accounts   = [] } = useFinanceAccounts()

  // Dos orígenes posibles: archivo (Excel/CSV, parseo rígido por encabezados) o
  // texto pegado (la IA lo interpreta) — ambos terminan en la MISMA previsualización
  // y reusan toda la UI de revisión de filas de abajo.
  const [mode, setMode] = useState<'file' | 'paste'>('file')
  const [pastedText, setPastedText] = useState('')

  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<ImportRowDraft[]>([])
  const [result, setResult] = useState<FinanceImportResult | null>(null)
  const [onlyIssues, setOnlyIssues] = useState(false)

  // Creación inline de conceptos para filas "concepto no encontrado": un solo
  // formulario abierto a la vez, prellenado con el nombre crudo detectado en la fila.
  const [conceptDraftIdx, setConceptDraftIdx] = useState<number | null>(null)
  const [conceptDraft, setConceptDraft] = useState({ name: '', category_id: '', account_id: '' })

  const handlePickFile = async () => {
    setResult(null)
    setOnlyIssues(false)
    setConceptDraftIdx(null)
    const preview = await selectFile.mutateAsync({ month: period.month, year: period.year })
    if (!preview) return
    setFileName(preview.fileName)
    setRows(buildImportRowDrafts(preview.items))
  }

  const handleProcessText = async () => {
    if (!pastedText.trim()) return
    setResult(null)
    setOnlyIssues(false)
    setConceptDraftIdx(null)
    const preview = await parseText.mutateAsync({ rawText: pastedText, month: period.month, year: period.year })
    if (!preview) return
    setFileName(preview.fileName)
    setRows(buildImportRowDrafts(preview.items))
  }

  /** Vuelve a la pantalla inicial (elegir archivo / pegar texto) sin cerrar el modal. */
  const handleStartOver = () => {
    setFileName(null)
    setRows([])
    setResult(null)
    setConceptDraftIdx(null)
  }

  const updateRow = (idx: number, patch: Partial<ImportRowDraft>) =>
    setRows(rs => rs.map((r, i) => i === idx ? { ...r, ...patch } : r))

  /** Si reasigna el concepto a mano, el chequeo de "duplicado" original ya no aplica tal cual. */
  const handleConceptChange = (idx: number, conceptId: string) => {
    const row = rows[idx]
    const sameAsMatched = conceptId === row.item.matchedConceptId
    updateRow(idx, { conceptId: conceptId || null, overwrite: sameAsMatched ? row.overwrite : false })
    setConceptDraftIdx(null)
  }

  /** Abre el mini-formulario de creación de concepto, prellenado con el nombre crudo de la fila. */
  const handleOpenConceptDraft = (idx: number, rawName: string) => {
    setConceptDraftIdx(idx)
    setConceptDraft({ name: rawName, category_id: categories[0]?.id ?? '', account_id: accounts[0]?.id ?? '' })
  }

  /** Crea el concepto nuevo y lo asigna de una a la fila que lo originó. */
  const handleCreateConceptForRow = async (idx: number) => {
    const name = conceptDraft.name.trim()
    if (!name || !conceptDraft.category_id || !conceptDraft.account_id) return
    const created = await createConcept.mutateAsync({
      category_id: conceptDraft.category_id,
      account_id:  conceptDraft.account_id,
      name
    })
    handleConceptChange(idx, created.id)
  }

  const includedRows = rows.filter(r => r.include)
  const readyCount   = includedRows.filter(r => r.conceptId && r.amount !== null).length
  const issueRows    = rows.filter(r => r.item.issue !== 'ok')
  const visibleRows  = rows
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => !onlyIssues || row.item.issue !== 'ok')

  const handleConfirm = async () => {
    const items: FinanceImportConfirmItem[] = includedRows
      .filter((r): r is ImportRowDraft & { conceptId: string; amount: number } => r.conceptId !== null && r.amount !== null)
      .map(r => ({
        rowIndex: r.item.rowIndex,
        conceptId: r.conceptId,
        amount: r.amount,
        status: r.status,
        paymentDate: r.item.paymentDate,
        notes: r.notes,
        overwriteMovementId: (r.overwrite && r.item.matchedConceptId === r.conceptId) ? r.item.existingMovementId : null
      }))
    if (!items.length) return
    const res = await confirmImport.mutateAsync({ items, month: period.month, year: period.year })
    setResult(res)
    setRows([])
    setFileName(null)
  }

  const handleClose = () => {
    setFileName(null); setRows([]); setResult(null)
    setPastedText(''); setConceptDraftIdx(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ width: 'min(880px, 95vw)', maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/50 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-600/30 flex items-center justify-center">
              <Upload size={15} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Importar movimientos</h2>
              <p className="text-[10px] text-slate-500">
                Excel, CSV o texto pegado → {getMonthLabel(period.month, period.year)} · con previsualización antes de cargar nada
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="text-slate-500 hover:text-slate-300 transition-colors"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {result && (
            <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4 flex items-start gap-3">
              <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300 space-y-0.5">
                <p className="font-semibold text-emerald-300">Importación completada</p>
                <p>
                  {result.imported} {result.imported === 1 ? 'movimiento creado' : 'movimientos creados'}
                  {', '}{result.updated} {result.updated === 1 ? 'actualizado' : 'actualizados'}
                  {result.skipped > 0 && ` · ${result.skipped} ${result.skipped === 1 ? 'salteado' : 'salteados'}`}.
                </p>
              </div>
            </div>
          )}

          {!fileName && !result && (
            <div className="space-y-5">
              <div className="flex items-center justify-center gap-1 p-1 rounded-xl bg-slate-800/60 border border-slate-700 w-fit mx-auto">
                <button
                  onClick={() => setMode('file')}
                  className={cn(
                    'flex items-center gap-1.5 text-xs font-medium rounded-lg px-3.5 py-1.5 transition-colors',
                    mode === 'file' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  <FileSpreadsheet size={13} /> Archivo
                </button>
                <button
                  onClick={() => setMode('paste')}
                  className={cn(
                    'flex items-center gap-1.5 text-xs font-medium rounded-lg px-3.5 py-1.5 transition-colors',
                    mode === 'paste' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  <ClipboardPaste size={13} /> Pegar datos
                </button>
              </div>

              {mode === 'file' ? (
                <div className="text-center py-6 space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                    <FileSpreadsheet size={22} className="text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-300 font-medium">Elegí un archivo Excel o CSV para importar</p>
                    <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
                      Se reconocen columnas como "Concepto", "Monto", "Estado", "Fecha de pago" y "Notas" en cualquier orden
                      (con o sin acentos). Vas a poder revisar y ajustar cada fila — incluido a qué concepto corresponde —
                      antes de cargar nada.
                    </p>
                  </div>
                  <button
                    onClick={handlePickFile}
                    disabled={selectFile.isPending}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg px-4 py-2.5 transition-colors disabled:opacity-50"
                  >
                    {selectFile.isPending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    Elegir archivo…
                  </button>
                </div>
              ) : (
                <div className="py-2 space-y-3 max-w-xl mx-auto">
                  <div className="text-center">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-3">
                      <Sparkles size={20} className="text-purple-400" />
                    </div>
                    <p className="text-sm text-slate-300 font-medium">Pegá una lista o tabla de gastos</p>
                    <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
                      Copiá y pegá texto libre — una tabla de Excel, una lista de WhatsApp, notas sueltas, lo que tengas — y
                      la IA va a interpretar cada gasto (concepto, monto, fecha, estado) usando{' '}
                      <span className="text-slate-300">{getMonthLabel(period.month, period.year)}</span> como referencia
                      para completar fechas incompletas.
                    </p>
                  </div>
                  <textarea
                    value={pastedText}
                    onChange={e => setPastedText(e.target.value)}
                    placeholder={'Ej:\nNafta 1  25000  pagado  03/06\nLuz  18.500  pendiente\nAlquiler — 350000 — 01/06 — transferencia'}
                    rows={7}
                    className={cn(inputCls, 'text-xs leading-relaxed font-mono resize-y')}
                  />
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={handleProcessText}
                      disabled={parseText.isPending || !pastedText.trim()}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg px-4 py-2.5 transition-colors disabled:opacity-50"
                    >
                      {parseText.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      {parseText.isPending ? 'Analizando con IA…' : 'Procesar con IA'}
                    </button>
                    {parseText.isError && (
                      <p className="text-[11px] text-rose-400 text-center max-w-sm">
                        No se pudo interpretar el texto pegado. Probá con un formato más simple (una línea por gasto) o
                        revisá que la IA esté configurada en Ajustes.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {result && (
            <div className="text-center pt-2">
              <button onClick={handleStartOver} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 bg-slate-800 rounded-lg px-3.5 py-2 transition-colors">
                <Upload size={13} /> Importar más
              </button>
            </div>
          )}

          {fileName && rows.length > 0 && (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-slate-400">
                  <span className="text-slate-200 font-medium">{fileName}</span> · {rows.length} {rows.length === 1 ? 'fila' : 'filas'} · {readyCount} {readyCount === 1 ? 'lista' : 'listas'} para importar
                </p>
                <div className="flex items-center gap-3">
                  {issueRows.length > 0 && (
                    <label className="flex items-center gap-1.5 text-[11px] text-amber-300/90 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={onlyIssues}
                        onChange={e => setOnlyIssues(e.target.checked)}
                        className="accent-amber-500"
                      />
                      Mostrar solo filas con problemas ({issueRows.length})
                    </label>
                  )}
                  <button
                    onClick={mode === 'file' ? handlePickFile : handleStartOver}
                    className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
                  >
                    {mode === 'file' ? <><Upload size={11} /> Elegir otro archivo</> : <><ClipboardPaste size={11} /> Pegar otro texto</>}
                  </button>
                </div>
              </div>

              {onlyIssues && visibleRows.length === 0 && (
                <p className="text-xs text-emerald-400 flex items-center gap-1.5 py-2">
                  <CheckCircle2 size={13} /> Ninguna fila tiene problemas — todo lo demás está listo para importar.
                </p>
              )}

              <div className="space-y-2">
                {visibleRows.map(({ row, idx }) => {
                  const meta = IMPORT_ISSUE_META[row.item.issue]
                  const showOverwrite = !!row.item.existingMovementId && row.item.matchedConceptId === row.conceptId
                  return (
                    <div key={row.item.rowIndex} className={cn(
                      'rounded-xl border p-3 transition-colors',
                      row.include ? 'border-slate-700 bg-slate-800/40' : 'border-slate-800 bg-slate-800/10 opacity-60'
                    )}>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={row.include}
                          onChange={e => updateRow(idx, { include: e.target.checked })}
                          className="mt-1 accent-emerald-500"
                        />
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-slate-200 truncate">"{row.item.rawConceptName}"</span>
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md border font-medium whitespace-nowrap', meta.cls)}>{meta.label}</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div>
                              <label className={labelCls}>Concepto</label>
                              <select
                                value={row.conceptId ?? ''}
                                onChange={e => handleConceptChange(idx, e.target.value)}
                                className={cn(inputCls, 'text-xs py-1.5', !row.conceptId && 'border-amber-600/50')}
                              >
                                <option value="">— Sin asignar —</option>
                                {concepts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                              {row.item.issue === 'concept_not_found' && conceptDraftIdx !== idx && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenConceptDraft(idx, row.item.rawConceptName)}
                                  className="mt-1 inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
                                >
                                  <FilePlus2 size={11} /> Crear concepto nuevo
                                </button>
                              )}
                            </div>
                            <div>
                              <label className={labelCls}>Monto</label>
                              <input
                                type="number" step="0.01"
                                value={row.amount ?? ''}
                                onChange={e => updateRow(idx, { amount: e.target.value === '' ? null : Number(e.target.value) })}
                                className={cn(inputCls, 'text-xs py-1.5', row.amount === null && 'border-amber-600/50')}
                              />
                            </div>
                            <div>
                              <label className={labelCls}>Estado</label>
                              <select
                                value={row.status}
                                onChange={e => updateRow(idx, { status: e.target.value as FinanceMovementStatus })}
                                className={cn(inputCls, 'text-xs py-1.5')}
                              >
                                {(Object.keys(FINANCE_STATUS_LABELS) as FinanceMovementStatus[]).map(s =>
                                  <option key={s} value={s}>{FINANCE_STATUS_LABELS[s]}</option>
                                )}
                              </select>
                            </div>
                            <div>
                              <label className={labelCls}>Notas</label>
                              <input
                                value={row.notes}
                                onChange={e => updateRow(idx, { notes: e.target.value })}
                                className={cn(inputCls, 'text-xs py-1.5')}
                              />
                            </div>
                          </div>
                          {conceptDraftIdx === idx && (
                            <div className="rounded-lg border border-emerald-700/30 bg-emerald-950/10 p-2.5 space-y-2">
                              <p className="text-[10px] text-emerald-300/90 font-medium flex items-center gap-1.5">
                                <Sparkles size={11} /> Concepto nuevo — se crea y se asigna a esta fila
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div>
                                  <label className={labelCls}>Nombre</label>
                                  <input
                                    autoFocus
                                    value={conceptDraft.name}
                                    onChange={e => setConceptDraft(d => ({ ...d, name: e.target.value }))}
                                    className={cn(inputCls, 'text-xs py-1.5')}
                                  />
                                </div>
                                <div>
                                  <label className={labelCls}>Categoría</label>
                                  <select
                                    value={conceptDraft.category_id}
                                    onChange={e => setConceptDraft(d => ({ ...d, category_id: e.target.value }))}
                                    className={cn(inputCls, 'text-xs py-1.5')}
                                  >
                                    <option value="">— Elegir —</option>
                                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className={labelCls}>Cuenta</label>
                                  <select
                                    value={conceptDraft.account_id}
                                    onChange={e => setConceptDraft(d => ({ ...d, account_id: e.target.value }))}
                                    className={cn(inputCls, 'text-xs py-1.5')}
                                  >
                                    <option value="">— Elegir —</option>
                                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.icon} {acc.name}</option>)}
                                  </select>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleCreateConceptForRow(idx)}
                                  disabled={createConcept.isPending || !conceptDraft.name.trim() || !conceptDraft.category_id || !conceptDraft.account_id}
                                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md px-2.5 py-1.5 transition-colors disabled:opacity-50"
                                >
                                  {createConcept.isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                                  Crear y asignar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConceptDraftIdx(null)}
                                  className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                          {showOverwrite && (
                            <label className="flex items-center gap-1.5 text-[11px] text-orange-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={row.overwrite}
                                onChange={e => updateRow(idx, { overwrite: e.target.checked })}
                                className="accent-orange-500"
                              />
                              Sobrescribir el movimiento que ya existe para "{row.item.matchedConceptName}" este mes (en vez de saltearlo)
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {fileName && rows.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-6 py-3.5 border-t border-slate-800 bg-slate-800/30 flex-shrink-0">
            <p className="text-[11px] text-slate-500">
              Las filas destildadas, sin concepto asignado o sin monto válido no se van a importar.
            </p>
            <button
              onClick={handleConfirm}
              disabled={confirmImport.isPending || readyCount === 0}
              className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
            >
              {confirmImport.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Confirmar importación ({readyCount})
            </button>
          </div>
        )}
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
    name: '', default_amount: 0, expense_type: 'fixed', payment_method: 'transfer',
    recurrence: 'monthly', recurrence_month: null, notes: '', tracks_multiple_entries: 0
  })

  const startNew = () => {
    setDraft({
      category_id: categories[0]?.id ?? '',
      account_id:  accounts[0]?.id ?? '',
      name: '', default_amount: 0, expense_type: 'fixed', payment_method: 'transfer',
      recurrence: 'monthly', recurrence_month: null, notes: '', tracks_multiple_entries: 0
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
                  <select
                    value={draft.recurrence}
                    onChange={e => {
                      const recurrence = e.target.value as CreateFinanceConceptInput['recurrence']
                      setDraft(d => ({ ...d, recurrence, recurrence_month: recurrence === 'annual' ? (d.recurrence_month ?? new Date().getMonth() + 1) : null }))
                    }}
                    className={inputCls}
                  >
                    {(Object.keys(FINANCE_RECURRENCE_LABELS) as Array<keyof typeof FINANCE_RECURRENCE_LABELS>).map(r => (
                      <option key={r} value={r}>{FINANCE_RECURRENCE_LABELS[r]}</option>
                    ))}
                  </select>
                </div>
              </div>
              {draft.recurrence === 'annual' && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Mes del año en que se paga</label>
                    <select
                      value={draft.recurrence_month ?? new Date().getMonth() + 1}
                      onChange={e => setDraft(d => ({ ...d, recurrence_month: Number(e.target.value) }))}
                      className={inputCls}
                    >
                      {MONTH_OPTIONS.map(m => (
                        <option key={m.value} value={m.value} className="capitalize">{m.label}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">"Generar del mes" solo va a crear el movimiento de este concepto cuando el período corresponda a este mes.</p>
                  </div>
                </div>
              )}
              <label className="flex items-start gap-2.5 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2.5 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={!!draft.tracks_multiple_entries}
                  onChange={e => setDraft(d => ({ ...d, tracks_multiple_entries: e.target.checked ? 1 : 0 }))}
                  className="mt-0.5 accent-emerald-500"
                />
                <span>
                  <span className="block text-xs font-medium text-slate-200">Puede recibir varias cargas en el mes</span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">
                    Para gastos que se repiten dentro de un mismo período (ej: nafta, supermercado).
                    En vez de crear "{draft.name || 'Concepto'} 1", "{draft.name || 'Concepto'} 2", etc.,
                    vas a poder cargar cada gasto por separado y el sistema suma el total automáticamente.
                  </span>
                </span>
              </label>
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
                  <EditableInlineTitle value={c.name} onSave={name => update.mutate({ id: c.id, data: { name } })} />
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {c.category?.icon} {c.category?.name} · {formatCurrency(c.default_amount)} · {FINANCE_EXPENSE_TYPE_LABELS[c.expense_type]}
                    {' · '}{FINANCE_PAYMENT_METHOD_LABELS[c.payment_method]} · {FINANCE_RECURRENCE_LABELS[c.recurrence]}
                    {c.recurrence === 'annual' && (
                      <span className="capitalize"> ({getMonthName(c.recurrence_month ?? (new Date(c.created_at).getMonth() + 1))})</span>
                    )}
                    {!!c.tracks_multiple_entries && (
                      <span className="text-purple-400"> · acepta varias cargas</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => update.mutate({ id: c.id, data: { tracks_multiple_entries: c.tracks_multiple_entries ? 0 : 1 } })}
                  className={cn(
                    'text-[10px] px-2 py-1 rounded-lg font-medium border transition-colors',
                    c.tracks_multiple_entries
                      ? 'border-purple-700/50 text-purple-400 hover:bg-purple-900/20'
                      : 'border-slate-700 text-slate-500 hover:bg-slate-800'
                  )}
                  title={c.tracks_multiple_entries ? 'Acepta varias cargas por mes (clic para desactivar)' : 'Activar registro de varias cargas por mes (ej: nafta, súper)'}
                >
                  {c.tracks_multiple_entries ? '☰ Varias cargas' : '☰ Una carga'}
                </button>
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

/**
 * Gestión de categorías (Fase 6 — submenú "Categorías"). Mismo patrón visual y de
 * interacción que ConceptsManager: modal con lista + alta rápida + edición inline.
 *
 * ⚠️ Punto delicado: `finance_categories` tiene `ON DELETE CASCADE` hacia
 * `finance_concepts`, que a su vez cascadea hacia `finance_movements` — borrar una
 * categoría borra silenciosamente TODOS sus conceptos y TODOS los movimientos de
 * esos conceptos (de cualquier mes/año), no solo del período actual. Por eso acá
 * se calcula la cantidad de conceptos asociados (vía useFinanceConcepts, sin pedir
 * nada nuevo al main process) y se arma una advertencia explícita y disuasiva
 * antes de confirmar — a diferencia del borrado de un concepto individual, donde
 * el alcance es mucho más acotado.
 */
function CategoriesManager({ onClose }: { onClose: () => void }) {
  const { data: categories = [], isLoading } = useFinanceCategories()
  const { data: concepts   = [] } = useFinanceConcepts()
  const create = useCreateFinanceCategory()
  const update = useUpdateFinanceCategory()
  const remove = useDeleteFinanceCategory()

  const [showNew, setShowNew] = useState(false)
  const [draft, setDraft] = useState<CreateFinanceCategoryInput>({ name: '', icon: '🏷️', color: '#6366f1' })

  const startNew = () => {
    setDraft({ name: '', icon: '🏷️', color: '#6366f1' })
    setShowNew(true)
  }

  const handleCreate = async () => {
    if (!draft.name.trim()) return
    await create.mutateAsync(draft)
    setShowNew(false)
  }

  // Cantidad de conceptos por categoría — determina qué tan grave es el borrado en cascada.
  const conceptCountByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of concepts) map.set(c.category_id, (map.get(c.category_id) ?? 0) + 1)
    return map
  }, [concepts])

  const handleDelete = async (cat: FinanceCategory) => {
    const count = conceptCountByCategory.get(cat.id) ?? 0
    const warning = count > 0
      ? `⚠️ ATENCIÓN — Borrado en cascada\n\n` +
        `La categoría "${cat.name}" tiene ${count} concepto${count === 1 ? '' : 's'} asociado${count === 1 ? '' : 's'}.\n\n` +
        `Si la eliminás, también se eliminarán esos conceptos Y TODOS sus movimientos cargados ` +
        `(de cualquier mes y año), de forma permanente e irreversible.\n\n` +
        `¿Seguro que querés continuar?`
      : `¿Eliminar la categoría "${cat.name}"? Esta acción no se puede deshacer.`
    if (!confirm(warning)) return
    await remove.mutateAsync(cat.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ width: 'min(640px, 95vw)', maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/50 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-600/30 flex items-center justify-center">
              <Tag size={15} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Categorías</h2>
              <p className="text-[10px] text-slate-500">Agrupan los conceptos para los gráficos y reportes por rubro</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={startNew}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Plus size={13} /> Nueva categoría
            </button>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors"><X size={18} /></button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
          {showNew && (
            <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/20 p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className={labelCls}>Nombre *</label>
                  <input autoFocus value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} className={inputCls} placeholder="Ej: Servicios" />
                </div>
                <div>
                  <label className={labelCls}>Ícono (emoji)</label>
                  <input
                    value={draft.icon ?? ''}
                    onChange={e => setDraft(d => ({ ...d, icon: e.target.value }))}
                    className={cn(inputCls, 'text-center text-lg')}
                    placeholder="🏷️"
                    maxLength={4}
                  />
                </div>
                <div>
                  <label className={labelCls}>Color</label>
                  <input
                    type="color"
                    value={draft.color ?? '#6366f1'}
                    onChange={e => setDraft(d => ({ ...d, color: e.target.value }))}
                    className="w-full h-[38px] rounded-lg cursor-pointer bg-slate-700/60 border border-slate-600"
                  />
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

          {isLoading && <p className="text-sm text-slate-500 py-6 text-center">Cargando categorías...</p>}

          {categories.map(cat => {
            const count = conceptCountByCategory.get(cat.id) ?? 0
            return (
              <div key={cat.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-2.5 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="color"
                    value={cat.color}
                    onChange={e => update.mutate({ id: cat.id, data: { color: e.target.value } })}
                    title="Cambiar color"
                    className="w-7 h-7 rounded-full cursor-pointer border border-slate-700 bg-transparent p-0 overflow-hidden flex-shrink-0"
                  />
                  <input
                    value={cat.icon}
                    onChange={e => update.mutate({ id: cat.id, data: { icon: e.target.value } })}
                    title="Cambiar ícono (emoji)"
                    maxLength={4}
                    className="w-9 text-center text-base bg-transparent border border-transparent hover:border-slate-700 focus:border-emerald-500/60 rounded px-1 py-0.5 focus:outline-none flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <EditableInlineTitle value={cat.name} onSave={name => update.mutate({ id: cat.id, data: { name } })} />
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {count} concepto{count === 1 ? '' : 's'} asociado{count === 1 ? '' : 's'}
                      {cat.is_default ? ' · categoría predeterminada' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleDelete(cat)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700/50 transition-colors"
                    title="Eliminar (también borra en cascada sus conceptos y movimientos)"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}

          {!isLoading && categories.length === 0 && (
            <p className="text-sm text-slate-500 py-6 text-center">No hay categorías todavía. Creá la primera con "Nueva categoría".</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Visualización (Fase 3): gráficos, vista por categoría y vista histórica ──
//
// Todos los datos llegan ya agregados desde el proceso principal (computados al
// vuelo — ver getFinanceCategoryBreakdown / getFinanceHistory / getFinanceTop*),
// así que acá solo nos ocupamos de graficarlos con recharts y estilarlos
// consistentemente con el resto del módulo (tema emerald + slate oscuro).

function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)}M`
  if (abs >= 1_000)     return `$${Math.round(value / 1_000)}K`
  return `$${Math.round(value)}`
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean; label?: React.ReactNode
  payload?: { name?: string; value?: number; color?: string; fill?: string }[]
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
      {label !== undefined && <p className="text-[11px] font-semibold text-slate-300 mb-1 capitalize">{label}</p>}
      <div className="space-y-0.5">
        {payload.map((entry, i) => {
          const color = entry.color ?? entry.fill ?? '#94a3b8'
          return (
            <p key={i} className="text-[11px] flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-slate-400">{entry.name}:</span>
              <span className="font-semibold" style={{ color }}>{formatCurrency(entry.value)}</span>
            </p>
          )
        })}
      </div>
    </div>
  )
}

function ChartCard({ title, subtitle, icon: Icon, children, className }: {
  title: string; subtitle?: string; icon?: React.ElementType; children: React.ReactNode; className?: string
}) {
  return (
    <div className={cn('rounded-xl p-4 bg-slate-800/60 border border-slate-700/70', className)}>
      <div className="flex items-center gap-2.5 mb-3.5">
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-emerald-600/15 border border-emerald-600/25 flex items-center justify-center flex-shrink-0">
            <Icon size={13} className="text-emerald-400" />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-100 truncate">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500 truncate">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

function EmptyChartState({ icon: Icon = BarChart3, message }: { icon?: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <Icon size={24} className="text-slate-700 mb-2" />
      <p className="text-xs text-slate-500 max-w-[260px]">{message}</p>
    </div>
  )
}

const CHART_AXIS_TICK = { fontSize: 10, fill: '#64748b' }
const CHART_AXIS_LINE = { stroke: '#334155' }

// ── 1. Dona — distribución del gasto por categoría ───────────────────────────

function CategoryDonutChart({ data }: { data: FinanceCategoryBreakdownItem[] }) {
  if (!data.length) {
    return <EmptyChartState icon={PieChartIcon} message="Todavía no hay movimientos cargados este mes para repartir por categoría." />
  }
  const top = data.slice(0, 7)
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div className="w-full sm:w-[52%] flex-shrink-0">
        <ResponsiveContainer width="100%" height={216}>
          <PieChart>
            <Pie data={top} dataKey="totalActual" nameKey="categoryName" cx="50%" cy="50%"
                 innerRadius={54} outerRadius={88} paddingAngle={2} stroke="rgba(15,23,42,0.7)" strokeWidth={2}>
              {top.map((d, i) => <Cell key={i} fill={d.categoryColor} />)}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 w-full space-y-1.5 min-w-0">
        {top.map(item => (
          <div key={item.categoryId ?? '__none__'} className="flex items-center gap-2 text-xs">
            <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.categoryColor }} />
            <span className="text-slate-300 truncate flex-1">{item.categoryIcon} {item.categoryName}</span>
            <span className="text-slate-500 flex-shrink-0">{item.percent.toFixed(0)}%</span>
            <span className="text-slate-200 font-semibold flex-shrink-0 w-[92px] text-right">{formatCurrency(item.totalActual)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 2. Barras — estimado vs. real por categoría ──────────────────────────────

function EstimatedVsActualChart({ data }: { data: FinanceCategoryBreakdownItem[] }) {
  if (!data.length) {
    return <EmptyChartState icon={BarChart3} message="Cargá movimientos este mes para comparar lo estimado contra lo real, categoría por categoría." />
  }
  const chartData = data.slice(0, 8).map(d => ({
    name: d.categoryName.length > 15 ? `${d.categoryName.slice(0, 14)}…` : d.categoryName,
    Estimado: d.totalEstimated,
    Real: d.totalActual
  }))
  return (
    <ResponsiveContainer width="100%" height={Math.max(216, chartData.length * 34)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
        <XAxis type="number" tickFormatter={formatCompactCurrency} tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} />
        <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={CHART_AXIS_LINE} tickLine={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.06)' }} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        <Bar dataKey="Estimado" fill="#64748b" radius={[0, 4, 4, 0]} barSize={10} />
        <Bar dataKey="Real"     fill="#10b981" radius={[0, 4, 4, 0]} barSize={10} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── 3. Comparativo — estado de pagos: mes actual vs. anterior ────────────────

function MonthComparisonChart({ history }: { history: FinanceHistoryEntry[] }) {
  const last2 = history.slice(-2)
  if (last2.length < 2 || !last2.some(h => h.totalActual > 0)) {
    return <EmptyChartState icon={GitCompare} message="Necesitás movimientos cargados en al menos dos meses consecutivos para poder compararlos." />
  }
  const chartData = last2.map(h => ({
    name: getMonthLabel(h.month, h.year),
    Pagado: h.totalPaid,
    Pendiente: h.totalPending,
    Vencido: h.totalOverdue
  }))
  return (
    <ResponsiveContainer width="100%" height={236}>
      <BarChart data={chartData} barGap={6} margin={{ top: 4, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={CHART_AXIS_LINE} tickLine={false} className="capitalize" />
        <YAxis tickFormatter={formatCompactCurrency} tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={46} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.06)' }} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        <Bar dataKey="Pagado"    fill={FINANCE_STATUS_COLORS.paid}    radius={[4, 4, 0, 0]} barSize={46} />
        <Bar dataKey="Pendiente" fill={FINANCE_STATUS_COLORS.pending} radius={[4, 4, 0, 0]} barSize={46} />
        <Bar dataKey="Vencido"   fill={FINANCE_STATUS_COLORS.overdue} radius={[4, 4, 0, 0]} barSize={46} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── 4. Evolución — gasto estimado vs. real a lo largo de los últimos meses ───

function SpendingEvolutionChart({ history }: { history: FinanceHistoryEntry[] }) {
  if (history.length < 2 || !history.some(h => h.totalActual > 0)) {
    return <EmptyChartState icon={LineChartIcon} message="A medida que cargues más meses vas a poder ver acá la evolución de tu gasto a lo largo del tiempo." />
  }
  const chartData = history.map(h => ({
    name: getMonthLabel(h.month, h.year),
    Estimado: h.totalEstimated,
    Real: h.totalActual
  }))
  return (
    <ResponsiveContainer width="100%" height={236}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 12, bottom: 4, left: 4 }}>
        <defs>
          <linearGradient id="financeEvolutionFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#10b981" stopOpacity={0.32} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={CHART_AXIS_LINE} tickLine={false} className="capitalize" />
        <YAxis tickFormatter={formatCompactCurrency} tick={CHART_AXIS_TICK} axisLine={CHART_AXIS_LINE} tickLine={false} width={46} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#475569', strokeDasharray: '3 3' }} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        <Area type="monotone" dataKey="Real" name="Real" stroke="#10b981" strokeWidth={2}
              fill="url(#financeEvolutionFill)" dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} />
        <Line type="monotone" dataKey="Estimado" name="Estimado" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ── 5, 6, 7 — Rankings (top conceptos / top categorías / mayores aumentos) ───

function RankingRow({ rank, color, label, sub, value, percent }: {
  rank: number; color: string; label: string; sub?: string
  value: React.ReactNode; percent: number
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-600 font-bold w-4 text-right flex-shrink-0">{rank}</span>
        <div className="min-w-0 flex-1">
          <p className="text-slate-300 truncate">{label}</p>
          {sub && <p className="text-[10px] text-slate-500 truncate">{sub}</p>}
        </div>
        <span className="text-slate-100 font-semibold flex-shrink-0 text-right">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden ml-6">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(4, Math.min(100, percent))}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function TopConceptsRanking({ items }: { items: FinanceRankingConcept[] }) {
  if (!items.length) return <EmptyChartState icon={Trophy} message="Todavía no hay gastos cargados este mes para armar el ranking de conceptos." />
  const max = items[0].amount
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <RankingRow key={item.conceptId} rank={i + 1} color={item.categoryColor}
          label={`${item.categoryIcon} ${item.conceptName}`} sub={item.categoryName}
          value={formatCurrency(item.amount)}
          percent={max > 0 ? (item.amount / max) * 100 : 0}
        />
      ))}
    </div>
  )
}

function TopCategoriesRanking({ items }: { items: FinanceCategoryBreakdownItem[] }) {
  if (!items.length) return <EmptyChartState icon={Award} message="Todavía no hay gastos cargados este mes para armar el ranking de categorías." />
  const top = items.slice(0, 8)
  const max = top[0].totalActual
  return (
    <div className="space-y-3">
      {top.map((item, i) => (
        <RankingRow key={item.categoryId ?? '__none__'} rank={i + 1} color={item.categoryColor}
          label={`${item.categoryIcon} ${item.categoryName}`}
          sub={`${item.count} movimiento${item.count === 1 ? '' : 's'} · ${item.percent.toFixed(0)}% del mes`}
          value={formatCurrency(item.totalActual)}
          percent={max > 0 ? (item.totalActual / max) * 100 : 0}
        />
      ))}
    </div>
  )
}

function TopIncreasesRanking({ items }: { items: FinanceRankingIncrease[] }) {
  if (!items.length) {
    return <EmptyChartState icon={Flame} message="No se detectaron aumentos respecto al mes anterior — o todavía no hay datos de dos meses para comparar." />
  }
  const max = items[0].diffAmount
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const color = getDiffColor(item.diffPercent)
        return (
          <RankingRow key={item.conceptId} rank={i + 1} color={color}
            label={item.conceptName}
            sub={`${item.categoryName} · ${formatCurrency(item.previousAmount)} → ${formatCurrency(item.currentAmount)}`}
            value={<span style={{ color }}>+{formatCurrency(item.diffAmount)} ({formatSignedPercent(item.diffPercent)})</span>}
            percent={max > 0 ? (item.diffAmount / max) * 100 : 0}
          />
        )
      })}
    </div>
  )
}

// ── Vista "Gráficos": orquesta los 7 ──────────────────────────────────────────

function ChartsView({ breakdown, history, topConcepts, topIncreases, isLoading, period }: {
  breakdown: FinanceCategoryBreakdownItem[]
  history: FinanceHistoryEntry[]
  topConcepts: FinanceRankingConcept[]
  topIncreases: FinanceRankingIncrease[]
  isLoading: boolean
  period: { month: number; year: number }
}) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm py-10 justify-center">
        <RefreshCw size={16} className="animate-spin" /> Calculando gráficos...
      </div>
    )
  }

  const monthLabel = getMonthLabel(period.month, period.year)

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Calculados al vuelo a partir de los movimientos de <span className="capitalize text-slate-400 font-medium">{monthLabel}</span> y de los meses anteriores (para evolución y comparativos) — nada queda precalculado en la base.
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="Distribución por categoría" subtitle={`Gasto real de ${monthLabel} — dona`} icon={PieChartIcon}>
          <CategoryDonutChart data={breakdown} />
        </ChartCard>

        <ChartCard title="Estimado vs. real por categoría" subtitle="¿Dónde te desviás más del presupuesto? — barras" icon={BarChart3}>
          <EstimatedVsActualChart data={breakdown} />
        </ChartCard>

        <ChartCard title="Comparativo mensual" subtitle="Estado de pagos: mes actual vs. anterior" icon={GitCompare}>
          <MonthComparisonChart history={history} />
        </ChartCard>

        <ChartCard title="Evolución del gasto" subtitle={`Estimado vs. real — últimos ${history.length || FINANCE_HISTORY_MONTHS} meses`} icon={LineChartIcon}>
          <SpendingEvolutionChart history={history} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard title="Top conceptos" subtitle="Los gastos individuales más altos del mes" icon={Trophy}>
          <TopConceptsRanking items={topConcepts} />
        </ChartCard>

        <ChartCard title="Top categorías" subtitle="Las categorías que más pesan este mes" icon={Award}>
          <TopCategoriesRanking items={breakdown} />
        </ChartCard>

        <ChartCard title="Mayores aumentos" subtitle="Conceptos que más subieron vs. el mes anterior" icon={Flame}>
          <TopIncreasesRanking items={topIncreases} />
        </ChartCard>
      </div>
    </div>
  )
}

// ── Vista "Por categoría" ─────────────────────────────────────────────────────

function CategoryDetailCard({ item }: { item: FinanceCategoryBreakdownItem }) {
  return (
    <div className="rounded-xl p-4 bg-slate-800/60 border border-slate-700/70 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
               style={{ backgroundColor: `${item.categoryColor}22`, border: `1px solid ${item.categoryColor}44` }}>
            {item.categoryIcon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100 truncate">{item.categoryName}</p>
            <p className="text-[11px] text-slate-500">{item.count} movimiento{item.count === 1 ? '' : 's'}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold" style={{ color: item.categoryColor }}>{formatCurrency(item.totalActual)}</p>
          {item.totalActual !== item.totalEstimated && (
            <p className="text-[10px] text-slate-500">Estimado: {formatCurrency(item.totalEstimated)}</p>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-semibold">
          <span>% del gasto del mes</span>
          <span>{item.percent.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, item.percent)}%`, backgroundColor: item.categoryColor }} />
        </div>
      </div>

      {item.topConcepts.length > 0 && (
        <div className="pt-2.5 border-t border-slate-700/50 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Principales conceptos</p>
          {item.topConcepts.map(c => (
            <div key={c.conceptId} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-slate-400 truncate">{c.conceptName}</span>
              <span className="text-slate-300 font-medium flex-shrink-0">{formatCurrency(c.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryView({ breakdown, isLoading, period }: {
  breakdown: FinanceCategoryBreakdownItem[]; isLoading: boolean
  period: { month: number; year: number }
}) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm py-10 justify-center">
        <RefreshCw size={16} className="animate-spin" /> Calculando desglose por categoría...
      </div>
    )
  }
  if (!breakdown.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <LayoutGrid size={28} className="text-slate-700 mb-3" />
        <p className="text-sm text-slate-400">No hay movimientos cargados en <span className="capitalize">{getMonthLabel(period.month, period.year)}</span> para desglosar por categoría.</p>
        <p className="text-xs text-slate-600 mt-1">Generá los movimientos del mes con el botón "Generar del mes", arriba a la derecha.</p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        {breakdown.length} categoría{breakdown.length === 1 ? '' : 's'} con movimientos en <span className="capitalize text-slate-400">{getMonthLabel(period.month, period.year)}</span>, ordenadas por gasto real — con sus principales conceptos.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {breakdown.map(item => <CategoryDetailCard key={item.categoryId ?? '__none__'} item={item} />)}
      </div>
    </div>
  )
}

// ── Vista "Histórica" ─────────────────────────────────────────────────────────

const HISTORY_RANGE_OPTIONS = [6, 12] as const

function HistoryTable({ history, onSelectMonth }: {
  history: FinanceHistoryEntry[]; onSelectMonth: (month: number, year: number) => void
}) {
  const rows = [...history].reverse()
  return (
    <div className="rounded-xl border border-slate-700/70 overflow-hidden overflow-x-auto">
      <table className="w-full text-xs min-w-[640px]">
        <thead className="bg-slate-800/80">
          <tr>
            {['Mes', 'Estimado', 'Real', 'Pagado', 'Pendiente', 'Vencido', 'Variación'].map((h, i) => (
              <th key={h} className={cn(
                'px-3 py-2.5 font-semibold uppercase tracking-wider text-[10px] text-slate-500',
                i === 0 ? 'text-left' : 'text-right'
              )}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map(h => {
            // Mes sin movimientos generados todavía: los $0 no representan gasto
            // real, sino ausencia de datos — se muestran atenuados con "—" en vez
            // de cifras, para no leerse como "no gastaste nada este mes".
            const empty = h.movementsCount === 0
            return (
              <tr key={`${h.year}-${h.month}`}
                  onClick={() => onSelectMonth(h.month, h.year)}
                  className="hover:bg-slate-800/40 cursor-pointer transition-colors group">
                <td className="px-3 py-2.5 font-medium capitalize">
                  <span className="text-slate-200 group-hover:text-emerald-400 transition-colors">{getMonthLabel(h.month, h.year)}</span>
                  {empty && <span className="ml-2 text-[9px] uppercase tracking-wider text-slate-600 font-semibold">sin movimientos</span>}
                </td>
                {empty ? (
                  <td colSpan={5} className="px-3 py-2.5 text-right text-slate-600 italic">Todavía no se generaron movimientos para este mes</td>
                ) : (
                  <>
                    <td className="px-3 py-2.5 text-right text-slate-400">{formatCurrency(h.totalEstimated)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-100 font-semibold">{formatCurrency(h.totalActual)}</td>
                    <td className="px-3 py-2.5 text-right" style={{ color: FINANCE_STATUS_COLORS.paid }}>{formatCurrency(h.totalPaid)}</td>
                    <td className="px-3 py-2.5 text-right" style={{ color: FINANCE_STATUS_COLORS.pending }}>{formatCurrency(h.totalPending)}</td>
                    <td className="px-3 py-2.5 text-right" style={{ color: FINANCE_STATUS_COLORS.overdue }}>{formatCurrency(h.totalOverdue)}</td>
                  </>
                )}
                <td className="px-3 py-2.5 text-right">
                  {!empty && h.diffPercent !== null ? (
                    <span className="inline-flex items-center gap-1 font-semibold justify-end" style={{ color: getDiffColor(h.diffPercent) }}>
                      {h.diffPercent > 0 ? <TrendingUp size={11} /> : h.diffPercent < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
                      {formatSignedPercent(h.diffPercent)}
                    </span>
                  ) : <span className="text-slate-600">—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function HistoryView({ history, isLoading, range, onRangeChange, onSelectMonth, period, onGenerateCurrentMonth, generating }: {
  history: FinanceHistoryEntry[]; isLoading: boolean
  range: number; onRangeChange: (n: number) => void
  onSelectMonth: (month: number, year: number) => void
  period: { month: number; year: number }
  onGenerateCurrentMonth: () => void | Promise<void>
  generating: boolean
}) {
  // Solo cuentan los meses que efectivamente tienen movimientos cargados —
  // un mes "vacío" (recién reseteado, o futuro) no debe ensuciar promedios
  // ni aparecer como "el mes de menor gasto" por descarte.
  const withData = useMemo(() => history.filter(h => h.movementsCount > 0), [history])
  const isEmpty  = !isLoading && withData.length === 0

  const stats = useMemo(() => {
    if (!withData.length) return null
    const avg = withData.reduce((acc, h) => acc + h.totalActual, 0) / withData.length
    let max = withData[0]; let min = withData[0]
    for (const h of withData) {
      if (h.totalActual > max.totalActual) max = h
      if (h.totalActual < min.totalActual) min = h
    }
    return { avg, max, min }
  }, [withData])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-slate-500 max-w-md">
          Historial agregado al vuelo, mes a mes, a partir de los movimientos cargados — sin nada precalculado. Hacé clic en un mes para ir directo a su detalle.
        </p>
        <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg overflow-hidden flex-shrink-0">
          {HISTORY_RANGE_OPTIONS.map(n => (
            <button key={n} onClick={() => onRangeChange(n)}
              className={cn('px-3 py-1.5 text-xs font-semibold transition-colors',
                range === n ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200')}>
              Últimos {n} meses
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-10 justify-center">
          <RefreshCw size={16} className="animate-spin" /> Calculando historial...
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center text-center gap-3 rounded-2xl border border-dashed border-slate-700 bg-slate-800/20 px-6 py-14">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600/10 border border-emerald-600/20 flex items-center justify-center">
            <HistoryIcon size={24} className="text-emerald-400/70" />
          </div>
          <div className="space-y-1 max-w-sm">
            <h3 className="text-sm font-semibold text-slate-200">Todavía no hay historial para mostrar</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Esto es esperable: el módulo de Finanzas se reinició y por ahora no hay movimientos cargados en ningún mes.
              El histórico se va a ir armando solo, mes a mes, a medida que generes y cargues los movimientos —
              no hay nada que precalcular ni migrar a mano.
            </p>
          </div>
          <button
            onClick={() => { void onGenerateCurrentMonth() }}
            disabled={generating}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 rounded-lg px-4 py-2 transition-colors mt-1"
          >
            {generating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Generar movimientos de <span className="capitalize">{getMonthLabel(period.month, period.year)}</span>
          </button>
          <p className="text-[10px] text-slate-600">Crea un movimiento pendiente por cada concepto activo, listo para que cargues los montos reales a medida que pagás.</p>
        </div>
      ) : (
        <>
          {stats && (
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Promedio mensual" value={formatCurrency(stats.avg)} icon={Wallet} />
              <StatCard label="Mes con mayor gasto"
                value={<span className="capitalize">{getMonthLabel(stats.max.month, stats.max.year)}</span>}
                sub={<span className="text-slate-400">{formatCurrency(stats.max.totalActual)}</span>}
                color="#ef4444" icon={TrendingUp} />
              <StatCard label="Mes con menor gasto"
                value={<span className="capitalize">{getMonthLabel(stats.min.month, stats.min.year)}</span>}
                sub={<span className="text-slate-400">{formatCurrency(stats.min.totalActual)}</span>}
                color="#10b981" icon={TrendingDown} />
            </div>
          )}

          {withData.length < history.length && (
            <p className="text-[10px] text-slate-600 flex items-center gap-1.5">
              <Info size={11} />
              {history.length - withData.length === 1
                ? 'Hay 1 mes en este rango sin movimientos generados — se muestra atenuado en la tabla y no afecta los promedios de arriba.'
                : `Hay ${history.length - withData.length} meses en este rango sin movimientos generados — se muestran atenuados en la tabla y no afectan los promedios de arriba.`}
            </p>
          )}

          <HistoryTable history={history} onSelectMonth={onSelectMonth} />
        </>
      )}
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
  const { data: categories = [] } = useFinanceCategories()
  const { data: accounts   = [] } = useFinanceAccounts()
  const { data: upcoming   = [] } = useUpcomingFinanceMovements()

  // Bloqueo por PIN (Fase 5): se consulta una sola vez al entrar; "unlocked" vive
  // solo en este componente, así que cambiar de mes/pestaña no vuelve a pedirlo,
  // pero salir del módulo y reentrar sí (es justamente lo que se busca).
  const { data: securityStatus } = useFinanceSecurityStatus()
  const [unlocked, setUnlocked] = useState(false)
  const locked = !!securityStatus?.enabled && !unlocked

  const [formMovement, setFormMovement] = useState<FinanceMovement | null | undefined>(undefined) // undefined = cerrado
  const [showConcepts, setShowConcepts] = useState(false)
  const [showCategories, setShowCategories] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showSecurity, setShowSecurity] = useState(false)
  // 'overview' (Dashboard) como pestaña de entrada: el usuario ve primero el
  // resumen del mes (alertas, totales) y desde ahí decide si necesita ir a
  // trabajar con el detalle en "Movimientos".
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview')
  const [filters, setFilters] = useState<MovementFilters>(EMPTY_FILTERS)
  const [historyRange, setHistoryRange] = useState<number>(FINANCE_HISTORY_MONTHS)

  // Datos para Visualización (Fase 3): desglose por categoría, historial y rankings —
  // todos computados al vuelo en el proceso principal a partir de los movimientos.
  const { data: breakdown = [], isLoading: loadingBreakdown } = useFinanceCategoryBreakdown(period.month, period.year)
  const { data: history   = [], isLoading: loadingHistory }   = useFinanceHistory(period.month, period.year, historyRange)
  const { data: topConcepts  = [] } = useFinanceTopConcepts(period.month, period.year)
  const { data: topIncreases = [] } = useFinanceTopIncreases(period.month, period.year)

  const quickUpdate     = useQuickUpdateFinanceMovement()
  const deleteMov       = useDeleteFinanceMovement()
  const generateMov     = useGenerateMovementsForMonth()
  const generateFromPrev = useGenerateMovementsFromPreviousMonth()

  const alerts = useMemo(() => getFinanceAlerts({ upcoming, summary }), [upcoming, summary])

  const filteredMovements = useMemo(() => applyMovementFilters(movements, filters), [movements, filters])

  // Selección múltiple para acciones en lote (Fase 5+): vive acá porque tanto
  // la tabla (tilda filas) como la barra flotante (marca/exporta) la necesitan.
  // Se vacía al cambiar de mes para no arrastrar selecciones de otro período.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  useEffect(() => { setSelectedIds(new Set()) }, [period.month, period.year])

  const selectedMovements = useMemo(
    () => filteredMovements.filter(m => selectedIds.has(m.id)),
    [filteredMovements, selectedIds]
  )

  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const toggleSelectAll = (ids: string[]) => setSelectedIds(prev => {
    const allSelected = ids.length > 0 && ids.every(id => prev.has(id))
    const next = new Set(prev)
    ids.forEach(id => allSelected ? next.delete(id) : next.add(id))
    return next
  })

  const clearSelection = () => setSelectedIds(new Set())

  /** Marca como pagados todos los seleccionados que aún no lo estén — mismo gesto que la acción rápida individual, en lote. */
  const handleBulkMarkPaid = () => {
    selectedMovements
      .filter(m => m.status !== 'paid')
      .forEach(m => quickUpdate.mutate({ id: m.id, data: { status: 'paid', payment_date: m.payment_date ?? Date.now() } }))
    clearSelection()
  }

  const overdueCount = useMemo(
    () => upcoming.filter(m => getMovementUrgency(m) === 'overdue').length,
    [upcoming]
  )

  // Cantidad total de pendientes del mes (vencidos + recurrentes sin pagar) —
  // mismo criterio que pinta MonthAlertsPanel, para mostrar un badge en la
  // pestaña "Dashboard" y que se note desde cualquier otra pestaña si hay algo
  // para resolver, sin tener que entrar a mirar.
  const monthAlertsCount = useMemo(() => {
    const { overdue, recurringUnpaid } = getMonthAlertMovements(movements)
    return overdue.length + recurringUnpaid.length
  }, [movements])

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

  // Recordatorio de respaldo (Fase 5+): solo aplica al mes actual, sobre el
  // final del mes, si todavía no se exportó nada de ese período ni se descartó
  // el aviso a propósito. Se reevalúa al cambiar de mes o de pestaña porque
  // depende de localStorage (no de datos de la query).
  const [reminderDismissed, setReminderDismissed] = useState(false)
  useEffect(() => { setReminderDismissed(isReminderDismissed(period)) }, [period.month, period.year])

  const showExportReminder = useMemo(() => {
    if (!isCurrentMonth || reminderDismissed || movements.length === 0) return false
    const daysInMonth = new Date(period.year, period.month, 0).getDate()
    const today = new Date().getDate()
    if (today < daysInMonth - EXPORT_REMINDER_LAST_DAYS + 1) return false
    return !hasExportedThisPeriod(period)
  }, [isCurrentMonth, reminderDismissed, movements.length, period])

  const handleDismissReminder = () => { dismissReminder(period); setReminderDismissed(true) }

  const handleQuickUpdate = (id: string, data: Parameters<typeof quickUpdate.mutate>[0]['data']) =>
    quickUpdate.mutate({ id, data })

  const handleDelete = async (m: FinanceMovement) => {
    if (!confirm(`¿Eliminar el movimiento "${m.concept?.name ?? ''}" de ${getMonthLabel(m.month, m.year)}?`)) return
    await deleteMov.mutateAsync(m.id)
  }

  const handleGenerate = async () => {
    await generateMov.mutateAsync({ month: period.month, year: period.year })
  }

  /** "Crear nuevo mes desde mes anterior" (Fase 4): proyecta los montos estimados a partir de lo realmente gastado el mes pasado. */
  const handleGenerateFromPrevious = async () => {
    await generateFromPrev.mutateAsync({ month: period.month, year: period.year })
  }

  /** Desde "Vista histórica": salta directo a la planilla de ese mes en "Movimientos" — es el detalle que se quiere revisar, no el resumen. */
  const handleSelectHistoryMonth = (month: number, year: number) => {
    setPeriod({ month, year })
    setActiveTab('movements')
  }

  /** CTA del estado vacío del Histórico: genera los movimientos del mes actual y lleva directo a "Movimientos" para empezar a cargar montos. */
  const handleGenerateAndViewCurrentMonth = async () => {
    await generateMov.mutateAsync({ month: period.month, year: period.year })
    setActiveTab('movements')
  }

  if (locked) {
    return <FinanceLockScreen onUnlock={() => setUnlocked(true)} />
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
              disabled={generateMov.isPending || generateFromPrev.isPending}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 bg-slate-800 rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
              title="Crea movimientos pendientes para este mes a partir del monto habitual de cada concepto activo que todavía no tenga uno cargado (respeta su recurrencia: mensual, anual en su mes, puntual una sola vez)"
            >
              {generateMov.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Generar del mes
            </button>

            <button
              onClick={handleGenerateFromPrevious}
              disabled={generateMov.isPending || generateFromPrev.isPending}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 bg-slate-800 rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
              title="Crea el nuevo mes proyectando cada estimado a partir de lo realmente pagado el mes anterior (en vez del monto habitual del concepto) — útil para gastos variables como servicios o tarjetas"
            >
              {generateFromPrev.isPending ? <Loader2 size={13} className="animate-spin" /> : <CopyPlus size={13} />}
              Crear desde mes anterior
            </button>

            <button
              onClick={() => setShowConcepts(true)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 bg-slate-800 rounded-lg px-3 py-2 transition-colors"
            >
              <Settings2 size={13} /> Conceptos
            </button>

            <button
              onClick={() => setShowCategories(true)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 bg-slate-800 rounded-lg px-3 py-2 transition-colors"
            >
              <Tag size={13} /> Categorías
            </button>

            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 bg-slate-800 rounded-lg px-3 py-2 transition-colors"
              title="Importar movimientos desde un archivo Excel o CSV, con previsualización"
            >
              <Upload size={13} /> Importar
            </button>

            <ExportMenu period={period} />

            <button
              onClick={() => setShowSecurity(true)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 bg-slate-800 rounded-lg px-3 py-2 transition-colors"
              title="Configurar el bloqueo por PIN de esta sección"
            >
              {securityStatus?.enabled ? <ShieldCheck size={13} className="text-emerald-400" /> : <KeyRound size={13} />}
              Seguridad
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

      {/* Pestañas: dashboard del mes, planilla de movimientos, próximos pagos, etc. */}
      <div className="flex-shrink-0 px-6 pt-3 border-b border-slate-800 bg-slate-800/10">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              'flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-t-lg border-b-2 transition-colors',
              activeTab === 'overview'
                ? 'text-emerald-400 border-emerald-500 bg-slate-800/50'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/30'
            )}
            title="Avisos, alertas y totales del mes — la vista de un vistazo"
          >
            <Wallet size={13} /> Dashboard
            {monthAlertsCount > 0 && (
              <span className={cn(
                'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold',
                'bg-amber-500/20 text-amber-300'
              )}>
                {monthAlertsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={cn(
              'flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-t-lg border-b-2 transition-colors',
              activeTab === 'movements'
                ? 'text-emerald-400 border-emerald-500 bg-slate-800/50'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/30'
            )}
            title="Filtros, selección en lote y la planilla editable de movimientos del mes"
          >
            <ListChecks size={13} /> Movimientos
          </button>
          <button
            onClick={() => setActiveTab('upcoming')}
            className={cn(
              'flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-t-lg border-b-2 transition-colors',
              activeTab === 'upcoming'
                ? 'text-emerald-400 border-emerald-500 bg-slate-800/50'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/30'
            )}
          >
            <CalendarClock size={13} /> Próximos pagos
            {upcoming.length > 0 && (
              <span className={cn(
                'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold',
                overdueCount > 0 ? 'bg-red-500/20 text-red-300' : 'bg-slate-700 text-slate-300'
              )}>
                {upcoming.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('charts')}
            className={cn(
              'flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-t-lg border-b-2 transition-colors',
              activeTab === 'charts'
                ? 'text-emerald-400 border-emerald-500 bg-slate-800/50'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/30'
            )}
          >
            <BarChart3 size={13} /> Gráficos
          </button>
          <button
            onClick={() => setActiveTab('breakdown')}
            className={cn(
              'flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-t-lg border-b-2 transition-colors',
              activeTab === 'breakdown'
                ? 'text-emerald-400 border-emerald-500 bg-slate-800/50'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/30'
            )}
          >
            <LayoutGrid size={13} /> Por categoría
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              'flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-t-lg border-b-2 transition-colors',
              activeTab === 'history'
                ? 'text-emerald-400 border-emerald-500 bg-slate-800/50'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/30'
            )}
          >
            <HistoryIcon size={13} /> Histórico
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/*
          "Dashboard" — vista de un vistazo: avisos, alertas y totales del mes.
          Los banners (recordatorio de respaldo + alertas inteligentes) vivían
          arriba de todas las pestañas; se mudan acá porque conceptualmente son
          justamente eso — resumen y avisos — y así "Movimientos"/"Próximos
          pagos"/"Gráficos" quedan enfocadas en su propia tarea sin un banner
          que a veces no aplica al contexto.
        */}
        {activeTab === 'overview' && (
          <>
            {showExportReminder && <ExportReminderBanner period={period} onDismiss={handleDismissReminder} />}
            <SmartAlerts alerts={alerts} />
            <MonthAlertsPanel movements={movements} period={period} onQuickUpdate={handleQuickUpdate} onEdit={setFormMovement} />
            <StatsCards summary={summary} isLoading={loadingSummary} />
          </>
        )}

        {/* "Movimientos" — vista de trabajo: filtrar, seleccionar en lote y editar la planilla del mes. */}
        {activeTab === 'movements' && (
          <>
            <FiltersBar
              filters={filters}
              onChange={setFilters}
              categories={categories}
              accounts={accounts}
              resultCount={filteredMovements.length}
              totalCount={movements.length}
            />

            {selectedIds.size > 0 && (
              <BulkActionsBar
                selected={selectedMovements}
                onMarkPaid={handleBulkMarkPaid}
                onClear={clearSelection}
              />
            )}

            {loadingMovements ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm py-10 justify-center">
                <RefreshCw size={16} className="animate-spin" /> Cargando movimientos...
              </div>
            ) : (
              <MovementsTable
                movements={filteredMovements}
                onQuickUpdate={handleQuickUpdate}
                onEdit={setFormMovement}
                onDelete={handleDelete}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
              />
            )}
          </>
        )}

        {activeTab === 'upcoming' && (
          <UpcomingPaymentsView onQuickUpdate={handleQuickUpdate} onEdit={setFormMovement} />
        )}

        {activeTab === 'charts' && (
          <ChartsView
            breakdown={breakdown}
            history={history}
            topConcepts={topConcepts}
            topIncreases={topIncreases}
            isLoading={loadingBreakdown || loadingHistory}
            period={period}
          />
        )}

        {activeTab === 'breakdown' && (
          <CategoryView breakdown={breakdown} isLoading={loadingBreakdown} period={period} />
        )}

        {activeTab === 'history' && (
          <HistoryView
            history={history}
            isLoading={loadingHistory}
            range={historyRange}
            onRangeChange={setHistoryRange}
            onSelectMonth={handleSelectHistoryMonth}
            period={period}
            onGenerateCurrentMonth={handleGenerateAndViewCurrentMonth}
            generating={generateMov.isPending}
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
      {showCategories && <CategoriesManager onClose={() => setShowCategories(false)} />}
      {showImport && <ImportManager period={period} concepts={concepts} onClose={() => setShowImport(false)} />}
      {showSecurity && <SecurityManager onClose={() => setShowSecurity(false)} />}
    </div>
  )
}
