import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  Table2, Layers, Columns2, LayoutGrid,
  Maximize2, Minimize2, Search, X, ChevronDown, ChevronUp,
  CheckSquare, Square, ChevronsUpDown
} from 'lucide-react'
import { Play } from 'lucide-react'
import {
  RECON_ESTADO_LABELS, RECON_ESTADO_COLORS,
  type ReconEstado, type ReconInvoice, type ReconMLOp,
} from '@shared/types'
import { useReconResults, useReconInvoices, useReconMLOps, useUpdateReconResult } from '../../hooks/useRecon'
import { cn } from '../../components/ui/utils'

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

const TODOS_ESTADOS: ReconEstado[] = [
  'conciliado', 'dif_menor', 'conciliado_monto', 'diferencia_monto',
  'rechazado_ml', 'no_cobrado_ml', 'pendiente', 'requiere_revision', 'manual',
]

// ── tipos ────────────────────────────────────────────────────────────────────

type ViewMode = 'compact' | 'grouped' | 'dual' | 'cards'

interface EnrichedRow {
  id: string
  estado: ReconEstado
  diferencia: number
  invoice?: ReconInvoice
  mlOp?: ReconMLOp
  invoice_id?: string | null
  ml_op_id?: string | null
  notes?: string
}

// ── badges ───────────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: ReconEstado }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap"
      style={{
        backgroundColor: RECON_ESTADO_COLORS[estado] + '22',
        color: RECON_ESTADO_COLORS[estado],
      }}
    >
      {RECON_ESTADO_LABELS[estado]}
    </span>
  )
}

// ── DetalleFila ──────────────────────────────────────────────────────────────

function DetalleFila({
  row, periodId, userId, onClose,
}: {
  row: EnrichedRow
  periodId: string
  userId: string
  onClose: () => void
}) {
  const update = useUpdateReconResult()
  const [estado, setEstado] = useState<ReconEstado>(row.estado)
  const [notes, setNotes]   = useState(row.notes ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await update.mutateAsync({ id: row.id, periodId, data: { estado, notes, override_by: userId } })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const inv = row.invoice
  const op  = row.mlOp

  return (
    <div className="bg-slate-850 border-t border-slate-700 p-4 grid grid-cols-2 gap-6">
      {/* Factura */}
      <div>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Factura Flexxus</p>
        {inv ? (
          <div className="space-y-1 text-xs">
            <p className="text-slate-300 font-mono">{inv.comprobante}</p>
            <p className="text-slate-400 truncate">{inv.concepto}</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-2 text-slate-500">
              <span>Total</span>           <span className="text-slate-300 text-right">${fmt(inv.total)}</span>
              <span>Tarjetas</span>        <span className="text-slate-300 text-right">${fmt(inv.importe_tarjetas)}</span>
              <span>Efectivo</span>        <span className="text-slate-300 text-right">${fmt(inv.importe_efectivo)}</span>
              <span>Transferencia</span>   <span className="text-slate-300 text-right">${fmt(inv.importe_transferencia)}</span>
              <span>Cta. cte.</span>       <span className="text-slate-300 text-right">${fmt(inv.importe_cta_cte)}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-600 italic">Sin factura asociada</p>
        )}
      </div>

      {/* ML Op */}
      <div>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Operación ML</p>
        {op ? (
          <div className="space-y-1 text-xs">
            <p className="text-slate-300 font-mono">{op.operation_id}</p>
            <p className="text-slate-400 truncate">{op.counterpart_name}</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-2 text-slate-500">
              <span>Monto</span>       <span className="text-slate-300 text-right">${fmt(op.transaction_amount)}</span>
              <span>Fee ML</span>      <span className="text-slate-300 text-right">${fmt(op.mp_fee)}</span>
              <span>Estado</span>      <span className="text-slate-300 text-right">{op.status}</span>
              <span>Ref. ext.</span>   <span className="text-slate-300 text-right font-mono truncate">{op.external_reference || '—'}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-600 italic">Sin operación ML asociada</p>
        )}
      </div>

      {/* Diferencia + edición de estado */}
      <div className="col-span-2 flex items-end gap-4 pt-3 border-t border-slate-700/50">
        <div className="flex-1">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Estado manual</label>
          <select
            value={estado}
            onChange={e => setEstado(e.target.value as ReconEstado)}
            className="w-full bg-slate-700 border border-slate-600 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500"
          >
            {TODOS_ESTADOS.map(e => (
              <option key={e} value={e}>{RECON_ESTADO_LABELS[e]}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Notas</label>
          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Observación…"
            className="w-full bg-slate-700 border border-slate-600 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-40"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Vista Compacta ────────────────────────────────────────────────────────────

function VistaCompacta({
  rows, periodId, userId,
  selectedIds, onToggleSelect, onToggleSelectAll,
  focusedIndex, onFocusIndex,
  expandedId, onToggleExpand,
}: {
  rows: EnrichedRow[]
  periodId: string
  userId: string
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  focusedIndex: number
  onFocusIndex: (i: number) => void
  expandedId: string | null
  onToggleExpand: (id: string) => void
}) {
  const allSelected = rows.length > 0 && rows.every(r => selectedIds.has(r.id))
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([])

  useEffect(() => {
    rowRefs.current[focusedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [focusedIndex])

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-800 border-b border-slate-700">
            <th className="px-2 py-2 w-8">
              <button onClick={onToggleSelectAll} className="text-slate-400 hover:text-white">
                {allSelected ? <CheckSquare size={13} /> : <Square size={13} />}
              </button>
            </th>
            <th className="text-left px-3 py-2 text-slate-400 font-medium">Comprobante</th>
            <th className="text-left px-3 py-2 text-slate-400 font-medium max-w-[160px]">Concepto</th>
            <th className="text-right px-3 py-2 text-slate-400 font-medium">Total</th>
            <th className="text-right px-3 py-2 text-slate-400 font-medium">Tarjetas</th>
            <th className="text-right px-3 py-2 text-slate-400 font-medium">ML monto</th>
            <th className="text-right px-3 py-2 text-slate-400 font-medium">Dif.</th>
            <th className="text-left px-3 py-2 text-slate-400 font-medium">Estado</th>
            <th className="text-left px-3 py-2 text-slate-400 font-medium max-w-[140px]">Notas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isFocused  = focusedIndex === i
            const isExpanded = expandedId === r.id
            const isSelected = selectedIds.has(r.id)
            return (
              <>
                <tr
                  key={r.id}
                  ref={el => { rowRefs.current[i] = el }}
                  onClick={() => { onFocusIndex(i); onToggleExpand(r.id) }}
                  className={cn(
                    'border-b border-slate-700/40 cursor-pointer transition-colors',
                    isFocused  ? 'bg-amber-950/20'  : 'hover:bg-slate-700/20',
                    isSelected ? 'bg-blue-950/15'    : '',
                    isExpanded ? 'border-b-0'        : ''
                  )}
                >
                  <td className="px-2 py-2 w-8" onClick={e => { e.stopPropagation(); onToggleSelect(r.id) }}>
                    <span className="text-slate-500 hover:text-white">
                      {isSelected ? <CheckSquare size={13} className="text-blue-400" /> : <Square size={13} />}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                    {r.invoice?.comprobante ?? r.mlOp?.operation_id ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-400 max-w-[160px] truncate">
                    {r.invoice?.concepto ?? r.mlOp?.counterpart_name ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-300 whitespace-nowrap">
                    {r.invoice ? `$${fmt(r.invoice.total)}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-300 whitespace-nowrap">
                    {r.invoice ? `$${fmt(r.invoice.importe_tarjetas)}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-300 whitespace-nowrap">
                    {r.mlOp ? `$${fmt(r.mlOp.transaction_amount)}` : '—'}
                  </td>
                  <td className={cn(
                    'px-3 py-2 text-right whitespace-nowrap font-mono',
                    r.diferencia === 0 ? 'text-slate-600'
                      : Math.abs(r.diferencia) < 1000 ? 'text-amber-400' : 'text-red-400'
                  )}>
                    {r.diferencia !== 0 ? `$${fmt(Math.abs(r.diferencia))}` : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <EstadoBadge estado={r.estado} />
                  </td>
                  <td className="px-3 py-2 text-slate-500 text-[11px] max-w-[140px] truncate">
                    {r.notes || '—'}
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${r.id}-detail`} className="border-b border-slate-700">
                    <td colSpan={9} className="p-0">
                      <DetalleFila
                        row={r}
                        periodId={periodId}
                        userId={userId}
                        onClose={() => onToggleExpand(r.id)}
                      />
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Vista Agrupada ────────────────────────────────────────────────────────────

function VistaAgrupada({ rows, periodId, userId }: { rows: EnrichedRow[]; periodId: string; userId: string }) {
  const grouped = useMemo(() => {
    const map = new Map<ReconEstado, EnrichedRow[]>()
    for (const r of rows) {
      if (!map.has(r.estado)) map.set(r.estado, [])
      map.get(r.estado)!.push(r)
    }
    return map
  }, [rows])

  const [open, setOpen] = useState<Set<string>>(new Set(grouped.keys()))
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggle = (estado: string) =>
    setOpen(prev => { const n = new Set(prev); n.has(estado) ? n.delete(estado) : n.add(estado); return n })

  return (
    <div className="space-y-2">
      <div className="flex gap-2 justify-end mb-2">
        <button
          onClick={() => setOpen(new Set(grouped.keys()))}
          className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          Expandir todo
        </button>
        <span className="text-slate-700">·</span>
        <button
          onClick={() => setOpen(new Set())}
          className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          Colapsar todo
        </button>
      </div>
      {Array.from(grouped.entries()).sort((a, b) => b[1].length - a[1].length).map(([estado, est_rows]) => {
        const isOpen = open.has(estado)
        return (
          <div key={estado} className="border border-slate-700 rounded-xl overflow-hidden">
            <button
              onClick={() => toggle(estado)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-750 transition-colors"
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: RECON_ESTADO_COLORS[estado as ReconEstado] }}
              />
              <span className="text-sm font-medium text-white flex-1 text-left">
                {RECON_ESTADO_LABELS[estado as ReconEstado]}
              </span>
              <span className="text-xs text-slate-400 mr-2">{est_rows.length}</span>
              {isOpen ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
            </button>
            {isOpen && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-700/30">
                    {est_rows.map(r => (
                      <>
                        <tr
                          key={r.id}
                          onClick={() => setExpandedId(id => id === r.id ? null : r.id)}
                          className="hover:bg-slate-700/20 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-2 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                            {r.invoice?.comprobante ?? r.mlOp?.operation_id ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-400 max-w-[200px] truncate">
                            {r.invoice?.concepto ?? r.mlOp?.counterpart_name ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-300 whitespace-nowrap">
                            {r.invoice ? `$${fmt(r.invoice.total)}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-300 whitespace-nowrap">
                            {r.mlOp ? `$${fmt(r.mlOp.transaction_amount)}` : '—'}
                          </td>
                          <td className={cn('px-3 py-2 text-right font-mono text-[11px] whitespace-nowrap',
                            r.diferencia === 0 ? 'text-slate-600' : 'text-amber-400'
                          )}>
                            {r.diferencia !== 0 ? `$${fmt(Math.abs(r.diferencia))}` : '—'}
                          </td>
                        </tr>
                        {expandedId === r.id && (
                          <tr key={`${r.id}-d`}>
                            <td colSpan={5} className="p-0">
                              <DetalleFila row={r} periodId={periodId} userId={userId} onClose={() => setExpandedId(null)} />
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Vista Dual ────────────────────────────────────────────────────────────────

function VistaDual({ rows }: { rows: EnrichedRow[] }) {
  return (
    <div className="space-y-2">
      {rows.map(r => {
        const inv = r.invoice
        const op  = r.mlOp
        return (
          <div key={r.id} className="flex gap-2 items-stretch">
            {/* Factura */}
            <div className={cn(
              'flex-1 rounded-xl p-3 border text-xs',
              inv ? 'bg-slate-800 border-slate-700' : 'bg-slate-800/30 border-slate-700/30'
            )}>
              {inv ? (
                <>
                  <p className="font-mono text-slate-300 text-[11px] mb-1">{inv.comprobante}</p>
                  <p className="text-slate-400 truncate mb-2">{inv.concepto}</p>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Total</span>
                    <span className="text-slate-200 font-medium">${fmt(inv.total)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Tarjetas</span>
                    <span className="text-slate-300">${fmt(inv.importe_tarjetas)}</span>
                  </div>
                </>
              ) : (
                <p className="text-slate-600 italic text-[11px] pt-1">Sin factura</p>
              )}
            </div>

            {/* Centro: estado + diferencia */}
            <div className="flex flex-col items-center justify-center gap-1 w-28 flex-shrink-0">
              <EstadoBadge estado={r.estado} />
              {r.diferencia !== 0 && (
                <span className={cn('text-[10px] font-mono', Math.abs(r.diferencia) > 1000 ? 'text-red-400' : 'text-amber-400')}>
                  dif: ${fmt(Math.abs(r.diferencia))}
                </span>
              )}
            </div>

            {/* ML Op */}
            <div className={cn(
              'flex-1 rounded-xl p-3 border text-xs',
              op ? 'bg-slate-800 border-slate-700' : 'bg-slate-800/30 border-slate-700/30'
            )}>
              {op ? (
                <>
                  <p className="font-mono text-slate-300 text-[11px] mb-1">{op.operation_id}</p>
                  <p className="text-slate-400 truncate mb-2">{op.counterpart_name}</p>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Monto</span>
                    <span className="text-slate-200 font-medium">${fmt(op.transaction_amount)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Estado</span>
                    <span className="text-slate-300">{op.status}</span>
                  </div>
                </>
              ) : (
                <p className="text-slate-600 italic text-[11px] pt-1">Sin op. ML</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Vista Cards ───────────────────────────────────────────────────────────────

function VistaCards({ rows, periodId, userId }: { rows: EnrichedRow[]; periodId: string; userId: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  return (
    <div className="grid grid-cols-2 gap-2">
      {rows.map(r => (
        <div
          key={r.id}
          className={cn(
            'bg-slate-800 border rounded-xl overflow-hidden cursor-pointer transition-all',
            expandedId === r.id ? 'border-amber-700/60 col-span-2' : 'border-slate-700 hover:border-slate-600'
          )}
          onClick={() => setExpandedId(id => id === r.id ? null : r.id)}
        >
          <div className="p-3">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="font-mono text-[11px] text-slate-300 leading-tight truncate">
                {r.invoice?.comprobante ?? r.mlOp?.operation_id ?? '—'}
              </p>
              <EstadoBadge estado={r.estado} />
            </div>
            <p className="text-[11px] text-slate-500 truncate mb-2">
              {r.invoice?.concepto ?? r.mlOp?.counterpart_name ?? '—'}
            </p>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">
                {r.invoice ? `$${fmt(r.invoice.total)}` : '—'}
              </span>
              {r.diferencia !== 0 && (
                <span className="text-amber-400 font-mono">dif: ${fmt(Math.abs(r.diferencia))}</span>
              )}
              <span className="text-slate-500">
                {r.mlOp ? `ML $${fmt(r.mlOp.transaction_amount)}` : '—'}
              </span>
            </div>
          </div>
          {expandedId === r.id && (
            <div onClick={e => e.stopPropagation()}>
              <DetalleFila
                row={r}
                periodId={periodId}
                userId={userId}
                onClose={() => setExpandedId(null)}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── ReconTabResultados (principal) ────────────────────────────────────────────

const VIEW_MODES: { key: ViewMode; icon: React.ElementType; label: string }[] = [
  { key: 'compact', icon: Table2,    label: 'Tabla'     },
  { key: 'grouped', icon: Layers,    label: 'Agrupada'  },
  { key: 'dual',    icon: Columns2,  label: 'Dual'      },
  { key: 'cards',   icon: LayoutGrid, label: 'Cards'    },
]

export default function ReconTabResultados({
  periodId, userId, initialEstado,
}: {
  periodId: string
  userId: string
  initialEstado?: ReconEstado
}) {
  const { data: results = [], isLoading } = useReconResults(periodId)
  const { data: invoices = [] }           = useReconInvoices(periodId)
  const { data: mlOps   = [] }            = useReconMLOps(periodId)

  const [viewMode,      setViewMode]      = useState<ViewMode>('compact')
  const [isFullscreen,  setIsFullscreen]  = useState(false)
  const [search,        setSearch]        = useState('')
  const [estadoFilter,  setEstadoFilter]  = useState<ReconEstado | undefined>(initialEstado)
  const [expandedId,    setExpandedId]    = useState<string | null>(null)
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set())
  const [focusedIndex,  setFocusedIndex]  = useState(-1)
  const [batchTarget,   setBatchTarget]   = useState<ReconEstado | null>(null)
  const update = useUpdateReconResult()

  // Sync initialEstado when prop changes (drill-down from KPIs)
  useEffect(() => { if (initialEstado !== undefined) setEstadoFilter(initialEstado) }, [initialEstado])

  const invoiceMap = useMemo(
    () => new Map(invoices.map(i => [i.id, i])),
    [invoices]
  )
  const mlOpMap = useMemo(
    () => new Map(mlOps.map(op => [op.id, op])),
    [mlOps]
  )

  const allRows: EnrichedRow[] = useMemo(() => results.map(r => ({
    ...r,
    invoice: r.invoice_id ? invoiceMap.get(r.invoice_id) : undefined,
    mlOp:    r.ml_op_id   ? mlOpMap.get(r.ml_op_id)     : undefined,
  })), [results, invoiceMap, mlOpMap])

  const rows = useMemo(() => {
    let filtered = estadoFilter ? allRows.filter(r => r.estado === estadoFilter) : allRows
    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter(r =>
        (r.invoice?.comprobante ?? '').toLowerCase().includes(q) ||
        (r.invoice?.concepto    ?? '').toLowerCase().includes(q) ||
        (r.mlOp?.counterpart_name ?? '').toLowerCase().includes(q) ||
        (r.mlOp?.operation_id   ?? '').toLowerCase().includes(q) ||
        String(r.invoice?.total ?? '').includes(q)
      )
    }
    return filtered
  }, [allRows, estadoFilter, search])

  // Keyboard navigation (compact view)
  const onKey = useCallback((e: KeyboardEvent) => {
    if (viewMode !== 'compact') return
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIndex(i => Math.min(i + 1, rows.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setFocusedIndex(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && focusedIndex >= 0) {
      const row = rows[focusedIndex]
      if (row) setExpandedId(id => id === row.id ? null : row.id)
    }
    if (e.key === 'Escape') {
      if (isFullscreen) { setIsFullscreen(false); return }
      setExpandedId(null); setFocusedIndex(-1)
    }
  }, [viewMode, rows, focusedIndex, isFullscreen])

  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onKey])

  // Batch actions
  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleSelectAll() {
    setSelectedIds(prev => prev.size === rows.length ? new Set() : new Set(rows.map(r => r.id)))
  }
  async function applyBatch() {
    if (!batchTarget) return
    for (const id of selectedIds) {
      await update.mutateAsync({ id, periodId, data: { estado: batchTarget, override_by: userId } })
    }
    setSelectedIds(new Set())
    setBatchTarget(null)
  }

  // Estado filter counts
  const countByEstado = useMemo(() => {
    const map: Partial<Record<ReconEstado, number>> = {}
    for (const r of allRows) map[r.estado] = (map[r.estado] ?? 0) + 1
    return map
  }, [allRows])

  if (isLoading) return <div className="text-center text-slate-500 py-12 text-sm">Cargando resultados…</div>
  if (results.length === 0) return (
    <div className="text-center text-slate-500 py-16 text-sm">
      <Play size={20} className="mx-auto mb-2 text-slate-600" />
      Importá los archivos y presioná "Conciliar" para ver los resultados.
    </div>
  )

  return (
    <div
      className={cn(
        'flex flex-col gap-3',
        isFullscreen && 'fixed inset-0 z-[100] bg-slate-900 p-6 overflow-auto'
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Modo de vista */}
        <div className="flex bg-slate-800 border border-slate-700 rounded-lg p-0.5 gap-0.5">
          {VIEW_MODES.map(m => (
            <button
              key={m.key}
              onClick={() => setViewMode(m.key)}
              title={m.label}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded text-xs transition-colors',
                viewMode === m.key
                  ? 'bg-amber-700/40 text-amber-200'
                  : 'text-slate-500 hover:text-slate-300'
              )}
            >
              <m.icon size={12} />
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div className="relative flex-1 min-w-[160px]">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar comprobante, concepto, monto…"
            className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg pl-7 pr-7 py-1.5 focus:outline-none focus:border-amber-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
              <X size={11} />
            </button>
          )}
        </div>

        {/* Pantalla completa */}
        <button
          onClick={() => setIsFullscreen(v => !v)}
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
        >
          {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>

      {/* Filtros de estado */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setEstadoFilter(undefined)}
          className={cn(
            'px-2 py-1 rounded-full text-[11px] font-medium transition-colors',
            !estadoFilter ? 'bg-amber-700/40 text-amber-200' : 'bg-slate-700/50 text-slate-400 hover:text-slate-200'
          )}
        >
          Todos ({allRows.length})
        </button>
        {TODOS_ESTADOS.filter(e => countByEstado[e]).map(e => (
          <button
            key={e}
            onClick={() => setEstadoFilter(prev => prev === e ? undefined : e)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-colors',
              estadoFilter === e
                ? 'bg-amber-700/40 text-amber-200'
                : 'bg-slate-700/50 text-slate-400 hover:text-slate-200'
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: RECON_ESTADO_COLORS[e] }} />
            {RECON_ESTADO_LABELS[e]} ({countByEstado[e]})
          </button>
        ))}
      </div>

      {/* Hint teclado */}
      {viewMode === 'compact' && rows.length > 0 && (
        <p className="text-[10px] text-slate-600">
          ↑↓ navegar · Enter expandir · Esc cerrar
        </p>
      )}

      {/* Contenido según modo */}
      {viewMode === 'compact' && (
        <VistaCompacta
          rows={rows}
          periodId={periodId}
          userId={userId}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          focusedIndex={focusedIndex}
          onFocusIndex={setFocusedIndex}
          expandedId={expandedId}
          onToggleExpand={id => setExpandedId(prev => prev === id ? null : id)}
        />
      )}
      {viewMode === 'grouped' && (
        <VistaAgrupada rows={rows} periodId={periodId} userId={userId} />
      )}
      {viewMode === 'dual' && <VistaDual rows={rows} />}
      {viewMode === 'cards' && (
        <VistaCards rows={rows} periodId={periodId} userId={userId} />
      )}

      <p className="text-[10px] text-slate-600 text-right">{rows.length} filas{search && ' (filtradas)'}</p>

      {/* Barra de acciones en lote */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-3 bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 shadow-2xl shadow-black/50">
          <span className="text-xs text-slate-300 font-medium">{selectedIds.size} seleccionados</span>
          <div className="flex items-center gap-2">
            <select
              value={batchTarget ?? ''}
              onChange={e => setBatchTarget(e.target.value as ReconEstado || null)}
              className="bg-slate-700 border border-slate-600 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none"
            >
              <option value="">Cambiar estado a…</option>
              {TODOS_ESTADOS.map(e => <option key={e} value={e}>{RECON_ESTADO_LABELS[e]}</option>)}
            </select>
            <button
              onClick={applyBatch}
              disabled={!batchTarget || update.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-40"
            >
              <ChevronsUpDown size={11} />
              Aplicar
            </button>
          </div>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="p-1.5 text-slate-500 hover:text-white transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  )
}
