import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Search, X, ChevronDown, ChevronUp,
  Maximize2, Minimize2
} from 'lucide-react'
import {
  RECON_ESTADO_LABELS, RECON_ESTADO_COLORS,
  type ReconEstado, type ReconResultEnriched,
} from '@shared/types'
import { useAllReconResults, useReconPeriods, useUpdateReconResult } from '../../hooks/useRecon'
import { useAuthSession } from '../../hooks/useCalendar'
import { cn } from '../../components/ui/utils'

const MONTH_NAMES = [
  'Ene','Feb','Mar','Abr','May','Jun',
  'Jul','Ago','Sep','Oct','Nov','Dic',
]

const TODOS_ESTADOS: ReconEstado[] = [
  'conciliado', 'dif_menor', 'conciliado_monto', 'diferencia_monto',
  'rechazado_ml', 'no_cobrado_ml', 'pendiente', 'requiere_revision', 'manual',
]

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtPeriod(month: number, year: number) {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

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

// ── Detalle expandido de una fila ─────────────────────────────────────────────

function DetalleFila({
  row, userId, onClose
}: {
  row: ReconResultEnriched
  userId: string
  onClose: () => void
}) {
  const update = useUpdateReconResult()
  const [estado, setEstado] = useState<ReconEstado>(row.estado)
  const [notes,  setNotes]  = useState(row.notes ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await update.mutateAsync({ id: row.id, periodId: row.period_id, data: { estado, notes, override_by: userId } })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className="border-b border-slate-700">
      <td colSpan={10} className="p-0">
        <div className="bg-slate-850 border-t border-slate-700 p-4 grid grid-cols-2 gap-6">
          {/* Factura */}
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Factura Flexxus</p>
            {row.comprobante ? (
              <div className="space-y-1 text-xs">
                <p className="text-slate-300 font-mono">{row.comprobante}</p>
                <p className="text-slate-400 truncate">{row.concepto}</p>
                {row.fecha && (
                  <p className="text-slate-500">Período: {row.fecha}</p>
                )}
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-2 text-slate-500">
                  <span>Total</span>         <span className="text-slate-300 text-right">${fmt(row.total ?? 0)}</span>
                  <span>Tarjetas</span>      <span className="text-slate-300 text-right">${fmt(row.importe_tarjetas ?? 0)}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600 italic">Sin factura asociada</p>
            )}
          </div>

          {/* ML Op */}
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Operación ML</p>
            {row.operation_id ? (
              <div className="space-y-1 text-xs">
                <p className="text-slate-300 font-mono">{row.operation_id}</p>
                <p className="text-slate-400 truncate">{row.counterpart_name}</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-2 text-slate-500">
                  <span>Monto</span>   <span className="text-slate-300 text-right">${fmt(row.transaction_amount ?? 0)}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600 italic">Sin operación ML asociada</p>
            )}
          </div>

          {/* Edición */}
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
              <button onClick={onClose}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition-colors">
                Cerrar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-40">
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ReconConciliacion() {
  const navigate = useNavigate()
  const { data: session } = useAuthSession()
  const userId = session?.userId ?? ''

  const { data: periods = [] } = useReconPeriods()
  const [filterMonth, setFilterMonth] = useState<number | undefined>()
  const [filterYear,  setFilterYear]  = useState<number | undefined>()
  const [estadoFilter, setEstadoFilter] = useState<ReconEstado | undefined>()
  const [search,      setSearch]      = useState('')
  const [expandedId,  setExpandedId]  = useState<string | null>(null)
  const [sortCol,     setSortCol]     = useState<'period' | 'comprobante' | 'total' | 'diferencia'>('period')
  const [sortAsc,     setSortAsc]     = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const { data: allRows = [], isLoading } = useAllReconResults({
    periodMonth: filterMonth,
    periodYear:  filterYear,
    estado:      estadoFilter,
  })

  // Períodos únicos disponibles para el filtro
  const availablePeriods = useMemo(() =>
    periods.map(p => ({ month: p.period_month, year: p.period_year, id: p.id }))
      .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month),
    [periods]
  )

  // Filtrado local por búsqueda
  const filtered = useMemo(() => {
    let rows = allRows
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(r =>
        (r.comprobante  ?? '').toLowerCase().includes(q) ||
        (r.concepto     ?? '').toLowerCase().includes(q) ||
        (r.operation_id ?? '').toLowerCase().includes(q) ||
        (r.counterpart_name ?? '').toLowerCase().includes(q) ||
        String(r.total ?? '').includes(q)
      )
    }
    return rows
  }, [allRows, search])

  // Ordenamiento
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortCol === 'period') {
        cmp = a.period_year !== b.period_year
          ? a.period_year - b.period_year
          : a.period_month - b.period_month
      } else if (sortCol === 'comprobante') {
        cmp = (a.comprobante ?? '').localeCompare(b.comprobante ?? '')
      } else if (sortCol === 'total') {
        cmp = (a.total ?? 0) - (b.total ?? 0)
      } else if (sortCol === 'diferencia') {
        cmp = Math.abs(a.diferencia) - Math.abs(b.diferencia)
      }
      return sortAsc ? cmp : -cmp
    })
  }, [filtered, sortCol, sortAsc])

  // KPIs
  const kpis = useMemo(() => {
    const conciliados = filtered.filter(r =>
      r.estado === 'conciliado' || r.estado === 'conciliado_monto'
    ).length
    const diferencias = filtered.filter(r =>
      r.estado === 'diferencia_monto' || r.estado === 'dif_menor'
    ).length
    const sinML = filtered.filter(r => r.estado === 'no_cobrado_ml').length
    const totalMonto = filtered.reduce((s, r) => s + (r.total ?? 0), 0)
    return { total: filtered.length, conciliados, diferencias, sinML, totalMonto }
  }, [filtered])

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortAsc(v => !v)
    else { setSortCol(col); setSortAsc(false) }
  }

  function SortIcon({ col }: { col: typeof sortCol }) {
    if (sortCol !== col) return <ChevronsUpDown size={10} className="text-slate-600 inline ml-1" />
    return sortAsc
      ? <ChevronUp size={10} className="text-amber-400 inline ml-1" />
      : <ChevronDown size={10} className="text-amber-400 inline ml-1" />
  }

  const countByEstado = useMemo(() => {
    const map: Partial<Record<ReconEstado, number>> = {}
    for (const r of allRows) map[r.estado] = (map[r.estado] ?? 0) + 1
    return map
  }, [allRows])

  return (
    <div className={cn(
      'flex flex-col bg-slate-900',
      isFullscreen ? 'fixed inset-0 z-[100]' : 'h-full'
    )}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => navigate('/contable/recon')}
          className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-base font-semibold text-white flex-1">Conciliación</h1>

        {/* Filtro período */}
        <select
          value={filterYear !== undefined && filterMonth !== undefined ? `${filterYear}-${filterMonth}` : ''}
          onChange={e => {
            if (!e.target.value) { setFilterYear(undefined); setFilterMonth(undefined); return }
            const [y, m] = e.target.value.split('-').map(Number)
            setFilterYear(y)
            setFilterMonth(m)
          }}
          className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500"
        >
          <option value="">Todos los períodos</option>
          {availablePeriods.map(p => (
            <option key={p.id} value={`${p.year}-${p.month}`}>
              {fmtPeriod(p.month, p.year)}
            </option>
          ))}
        </select>

        <button
          onClick={() => setIsFullscreen(v => !v)}
          className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-white transition-colors"
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {/* KPIs */}
      <div className="flex gap-3 px-6 py-3 border-b border-slate-700 flex-shrink-0">
        <div className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
          <div className="text-[10px] text-slate-500">Total</div>
          <div className="text-base font-bold text-slate-200">{kpis.total}</div>
        </div>
        <div className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
          <div className="text-[10px] text-slate-500">Conciliadas</div>
          <div className="text-base font-bold text-emerald-400">{kpis.conciliados}</div>
        </div>
        <div className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
          <div className="text-[10px] text-slate-500">Diferencias</div>
          <div className="text-base font-bold text-amber-400">{kpis.diferencias}</div>
        </div>
        <div className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
          <div className="text-[10px] text-slate-500">Sin ML</div>
          <div className="text-base font-bold text-slate-400">{kpis.sinML}</div>
        </div>
        <div className="flex-[1.6] bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
          <div className="text-[10px] text-slate-500">Monto total</div>
          <div className="text-sm font-bold text-blue-400">${fmt(kpis.totalMonto)}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-2.5 border-b border-slate-700 flex items-center gap-2 flex-shrink-0">
        {/* Buscador */}
        <div className="relative flex-1 max-w-xs">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar comprobante, concepto…"
            className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg pl-7 pr-7 py-1.5 focus:outline-none focus:border-amber-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
              <X size={11} />
            </button>
          )}
        </div>

        {/* Filtros de estado */}
        <div className="flex flex-wrap gap-1">
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
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="text-center text-slate-500 py-16 text-sm">Cargando resultados…</div>
        ) : sorted.length === 0 ? (
          <div className="text-center text-slate-500 py-16 text-sm">
            Sin resultados.{allRows.length === 0 && ' Importá archivos y conciliá desde cada período.'}
          </div>
        ) : (
          <table className="w-full text-xs table-fixed border-collapse">
            <colgroup>
              <col style={{ width: 80 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 70 }} />
              <col />
              <col style={{ width: 88 }} />
              <col style={{ width: 88 }} />
              <col style={{ width: 88 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 110 }} />
            </colgroup>
            <thead>
              <tr className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10">
                <th
                  className="text-left px-3 py-2 text-slate-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => toggleSort('period')}
                >
                  Período <SortIcon col="period" />
                </th>
                <th
                  className="text-left px-3 py-2 text-slate-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => toggleSort('comprobante')}
                >
                  Comprobante <SortIcon col="comprobante" />
                </th>
                <th className="text-left px-3 py-2 text-slate-400 font-medium">Fecha</th>
                <th className="text-left px-3 py-2 text-slate-400 font-medium">Concepto</th>
                <th
                  className="text-right px-3 py-2 text-slate-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => toggleSort('total')}
                >
                  Total <SortIcon col="total" />
                </th>
                <th className="text-right px-3 py-2 text-slate-400 font-medium">Tarjetas</th>
                <th className="text-right px-3 py-2 text-slate-400 font-medium">ML</th>
                <th
                  className="text-right px-3 py-2 text-slate-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => toggleSort('diferencia')}
                >
                  Dif. <SortIcon col="diferencia" />
                </th>
                <th className="text-left px-3 py-2 text-slate-400 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => {
                const isExpanded = expandedId === r.id
                return (
                  <>
                    <tr
                      key={r.id}
                      onClick={() => setExpandedId(id => id === r.id ? null : r.id)}
                      className={cn(
                        'border-b border-slate-700/40 cursor-pointer transition-colors',
                        isExpanded ? 'bg-amber-950/20 border-b-0' : 'hover:bg-slate-800/60'
                      )}
                    >
                      <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">
                        {fmtPeriod(r.period_month, r.period_year)}
                      </td>
                      <td className="px-3 py-1.5 text-slate-300 font-mono text-[11px] truncate">
                        {r.comprobante ?? (r.operation_id ? `ML ${r.operation_id}` : '—')}
                      </td>
                      <td className="px-3 py-1.5 text-slate-500">
                        {r.fecha || '—'}
                      </td>
                      <td className="px-3 py-1.5 text-slate-400 truncate">
                        {r.concepto ?? r.counterpart_name ?? '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-300 tabular-nums whitespace-nowrap">
                        {r.total != null ? `$${fmt(r.total)}` : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-300 tabular-nums whitespace-nowrap">
                        {r.importe_tarjetas != null ? `$${fmt(r.importe_tarjetas)}` : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-300 tabular-nums whitespace-nowrap">
                        {r.transaction_amount != null ? `$${fmt(r.transaction_amount)}` : '—'}
                      </td>
                      <td className={cn(
                        'px-3 py-1.5 text-right tabular-nums whitespace-nowrap',
                        r.diferencia === 0 ? 'text-slate-600'
                          : Math.abs(r.diferencia) < 1000 ? 'text-amber-400' : 'text-red-400'
                      )}>
                        {r.diferencia !== 0 ? `$${fmt(Math.abs(r.diferencia))}` : '—'}
                      </td>
                      <td className="px-3 py-1.5">
                        <EstadoBadge estado={r.estado} />
                      </td>
                    </tr>
                    {isExpanded && (
                      <DetalleFila
                        key={`${r.id}-detail`}
                        row={r}
                        userId={userId}
                        onClose={() => setExpandedId(null)}
                      />
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="px-6 py-2 text-[10px] text-slate-600 border-t border-slate-800 flex-shrink-0">
        {sorted.length} filas{search && ' (filtradas)'}
      </p>
    </div>
  )
}

// Ícono auxiliar (no importado de lucide para evitar conflicto de nombre)
function ChevronsUpDown({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m7 15 5 5 5-5" />
      <path d="m7 9 5-5 5 5" />
    </svg>
  )
}
