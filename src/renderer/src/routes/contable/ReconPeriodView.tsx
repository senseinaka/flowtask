import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Upload, Play, CheckCircle2, Loader2,
  AlertCircle, FileCheck2, BarChart3, List
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import {
  useReconPeriod, useReconImports, useReconInvoices, useReconMLOps,
  useReconResults, useReconKPIs, useRunRecon, useSetReconPeriodStatus,
} from '../../hooks/useRecon'
import { useAuthSession } from '../../hooks/useCalendar'
import {
  RECON_STATUS_LABELS, RECON_STATUS_COLORS, RECON_ESTADO_LABELS, RECON_ESTADO_COLORS,
  RECON_SOURCE_LABELS,
  type ReconImportSource, type ReconEstado, type ReconPeriodStatus,
  type ReconImport, type ReconInvoice, type ReconMLOp,
} from '@shared/types'
import { cn } from '../../components/ui/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

function fmt(n: number): string {
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ── Fuentes de import ─────────────────────────────────────────────────────────

const SOURCES: { key: ReconImportSource; color: string; ext: string }[] = [
  { key: 'flexxus',       color: '#f59e0b', ext: 'XLSX' },
  { key: 'ml_principal',  color: '#3b82f6', ext: 'XLS' },
  { key: 'ml_secundaria', color: '#8b5cf6', ext: 'XLS' },
  { key: 'cupones_csv',   color: '#10b981', ext: 'CSV'  },
  { key: 'cupones_xlsx',  color: '#06b6d4', ext: 'XLSX' },
]

// ── Sub-componentes ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReconPeriodStatus }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold"
      style={{ backgroundColor: RECON_STATUS_COLORS[status] + '25', color: RECON_STATUS_COLORS[status] }}
    >
      {RECON_STATUS_LABELS[status]}
    </span>
  )
}

function EstadoBadge({ estado }: { estado: ReconEstado }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: RECON_ESTADO_COLORS[estado] + '22', color: RECON_ESTADO_COLORS[estado] }}
    >
      {RECON_ESTADO_LABELS[estado]}
    </span>
  )
}

// ── SourceCard ────────────────────────────────────────────────────────────────

function SourceCard({
  src, lastImport, importing, onImport,
}: {
  src: typeof SOURCES[0]
  lastImport: ReconImport | undefined
  importing: boolean
  onImport: () => void
}) {
  const ok = lastImport?.status === 'ok'
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-start gap-3">
      <div
        className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white mt-0.5"
        style={{ backgroundColor: src.color + '30', color: src.color }}
      >
        {src.ext}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{RECON_SOURCE_LABELS[src.key]}</p>
        {lastImport ? (
          <div className="mt-0.5">
            <p className={cn('text-xs', ok ? 'text-emerald-400' : 'text-red-400')}>
              {ok
                ? `${lastImport.row_count} filas · ${fmtDate(lastImport.imported_at)}`
                : `Error: ${lastImport.error_msg}`}
            </p>
            {lastImport.filename && (
              <p className="text-[10px] text-slate-600 truncate">{lastImport.filename}</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500 mt-0.5">Sin importar</p>
        )}
      </div>
      <button
        onClick={onImport}
        disabled={importing}
        className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-lg transition-colors disabled:opacity-50"
      >
        {importing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
        Cargar
      </button>
    </div>
  )
}

// ── TabImportar ───────────────────────────────────────────────────────────────

function TabImportar({
  periodId, userId,
}: {
  periodId: string
  userId: string
}) {
  const qc = useQueryClient()
  const { data: imports = [], refetch } = useReconImports(periodId)
  const [importingSource, setImportingSource] = useState<ReconImportSource | null>(null)
  const [feedback, setFeedback] = useState<Record<string, { ok: boolean; msg: string }>>({})

  const lastBySource = useMemo(() => {
    const map: Record<string, ReconImport> = {}
    for (const imp of imports) {
      if (!map[imp.source] || imp.imported_at > map[imp.source].imported_at) {
        map[imp.source] = imp
      }
    }
    return map
  }, [imports])

  async function handleImport(source: ReconImportSource) {
    setImportingSource(source)
    try {
      const result = await window.api.recon.imports.importFile(periodId, source, userId)
      if (result.canceled) return
      if (result.ok) {
        setFeedback(prev => ({ ...prev, [source]: { ok: true, msg: `${result.count} filas de "${result.filename}"` } }))
        await refetch()
        qc.invalidateQueries({ queryKey: ['recon-invoices', periodId] })
        qc.invalidateQueries({ queryKey: ['recon-mlops', periodId] })
      } else {
        setFeedback(prev => ({ ...prev, [source]: { ok: false, msg: result.error ?? 'Error desconocido' } }))
      }
    } finally {
      setImportingSource(null)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400 mb-4">
        Cargá los archivos de cada fuente para este período. Podés re-importar una fuente en cualquier momento — reemplaza los datos anteriores.
      </p>
      {SOURCES.map(src => (
        <div key={src.key}>
          <SourceCard
            src={src}
            lastImport={lastBySource[src.key]}
            importing={importingSource === src.key}
            onImport={() => handleImport(src.key)}
          />
          {feedback[src.key] && (
            <div className={cn(
              'mt-1 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5',
              feedback[src.key].ok
                ? 'bg-emerald-900/20 text-emerald-400'
                : 'bg-red-900/20 text-red-400'
            )}>
              {feedback[src.key].ok ? <FileCheck2 size={11} /> : <AlertCircle size={11} />}
              {feedback[src.key].msg}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── TabResultados ─────────────────────────────────────────────────────────────

const FILTER_OPTIONS: (ReconEstado | 'all')[] = [
  'all', 'conciliado', 'dif_menor', 'conciliado_monto',
  'diferencia_monto', 'rechazado_ml', 'no_cobrado_ml', 'pendiente',
]

function TabResultados({ periodId }: { periodId: string }) {
  const [estadoFilter, setEstadoFilter] = useState<ReconEstado | undefined>()
  const { data: results = [], isLoading } = useReconResults(periodId)
  const { data: invoices = [] } = useReconInvoices(periodId)
  const { data: mlOps    = [] } = useReconMLOps(periodId)

  const invoiceMap = useMemo(
    () => new Map<string, ReconInvoice>(invoices.map(i => [i.id, i])),
    [invoices]
  )
  const mlOpMap = useMemo(
    () => new Map<string, ReconMLOp>(mlOps.map(op => [op.id, op])),
    [mlOps]
  )

  const rows = useMemo(() => results
    .filter(r => !estadoFilter || r.estado === estadoFilter)
    .map(r => ({
      ...r,
      invoice: r.invoice_id ? invoiceMap.get(r.invoice_id) : undefined,
      mlOp:    r.ml_op_id   ? mlOpMap.get(r.ml_op_id)     : undefined,
    })),
    [results, estadoFilter, invoiceMap, mlOpMap]
  )

  if (isLoading) {
    return <div className="text-center text-slate-500 py-12 text-sm">Cargando resultados…</div>
  }
  if (results.length === 0) {
    return (
      <div className="text-center text-slate-500 py-16 text-sm">
        <Play size={20} className="mx-auto mb-2 text-slate-600" />
        Todavía no hay resultados. Importá los archivos y presioná "Conciliar".
      </div>
    )
  }

  return (
    <div>
      {/* Filtros */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {FILTER_OPTIONS.map(f => {
          const active = f === 'all' ? !estadoFilter : estadoFilter === f
          const count  = f === 'all'
            ? results.length
            : results.filter(r => r.estado === f).length
          if (count === 0 && f !== 'all') return null
          return (
            <button
              key={f}
              onClick={() => setEstadoFilter(f === 'all' ? undefined : f)}
              className={cn(
                'px-2 py-1 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1',
                active ? 'bg-amber-700/40 text-amber-200' : 'bg-slate-700/50 text-slate-400 hover:text-slate-200'
              )}
            >
              {f !== 'all' && (
                <span
                  className="w-1.5 h-1.5 rounded-full inline-block"
                  style={{ backgroundColor: RECON_ESTADO_COLORS[f] }}
                />
              )}
              {f === 'all' ? `Todos (${count})` : `${RECON_ESTADO_LABELS[f]} (${count})`}
            </button>
          )
        })}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-800 border-b border-slate-700">
              <th className="text-left px-3 py-2 text-slate-400 font-medium">Comprobante</th>
              <th className="text-left px-3 py-2 text-slate-400 font-medium max-w-[180px]">Concepto</th>
              <th className="text-right px-3 py-2 text-slate-400 font-medium">Total</th>
              <th className="text-right px-3 py-2 text-slate-400 font-medium">Tarjetas</th>
              <th className="text-right px-3 py-2 text-slate-400 font-medium">ML monto</th>
              <th className="text-right px-3 py-2 text-slate-400 font-medium">Dif.</th>
              <th className="text-left px-3 py-2 text-slate-400 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-slate-700/20 transition-colors">
                <td className="px-3 py-2 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                  {r.invoice?.comprobante ?? (r.mlOp?.operation_id ?? '—')}
                </td>
                <td className="px-3 py-2 text-slate-400 max-w-[180px] truncate">
                  {r.invoice?.concepto ?? r.mlOp?.counterpart_name ?? '—'}
                </td>
                <td className="px-3 py-2 text-right text-slate-300 whitespace-nowrap">
                  {r.invoice ? fmt(r.invoice.total) : '—'}
                </td>
                <td className="px-3 py-2 text-right text-slate-300 whitespace-nowrap">
                  {r.invoice ? fmt(r.invoice.importe_tarjetas) : '—'}
                </td>
                <td className="px-3 py-2 text-right text-slate-300 whitespace-nowrap">
                  {r.mlOp ? fmt(r.mlOp.transaction_amount) : '—'}
                </td>
                <td className={cn(
                  'px-3 py-2 text-right whitespace-nowrap font-mono',
                  r.diferencia === 0 ? 'text-slate-500'
                    : r.diferencia > 0 ? 'text-amber-400' : 'text-red-400'
                )}>
                  {r.diferencia !== 0 ? fmt(Math.abs(r.diferencia)) : '—'}
                </td>
                <td className="px-3 py-2">
                  <EstadoBadge estado={r.estado} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-slate-600 mt-2 text-right">{rows.length} filas</p>
    </div>
  )
}

// ── TabKPIs ───────────────────────────────────────────────────────────────────

function TabKPIs({ periodId }: { periodId: string }) {
  const { data: kpis } = useReconKPIs(periodId)

  if (!kpis) {
    return <div className="text-center text-slate-500 py-16 text-sm">Sin datos de KPIs aún.</div>
  }

  const pctConciliado = kpis.totalMonto > 0
    ? (kpis.conciliadoMonto / kpis.totalMonto) * 100
    : 0

  const estadoEntries = Object.entries(kpis.byEstado) as [ReconEstado, { count: number; monto: number }][]

  return (
    <div className="space-y-5">
      {/* Cards resumen */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total facturas', value: String(kpis.total), sub: '' },
          { label: '% conciliado', value: `${pctConciliado.toFixed(1)}%`, sub: `$ ${fmt(kpis.conciliadoMonto)}` },
          { label: 'Monto total', value: `$ ${fmt(kpis.totalMonto)}`, sub: '' },
          { label: 'Pendiente', value: `$ ${fmt(kpis.pendienteMonto)}`, sub: '' },
        ].map(card => (
          <div key={card.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-400">{card.label}</p>
            <p className="text-lg font-bold text-white mt-1">{card.value}</p>
            {card.sub && <p className="text-xs text-slate-500">{card.sub}</p>}
          </div>
        ))}
      </div>

      {/* Barra de progreso conciliación */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex justify-between text-xs text-slate-400 mb-2">
          <span>Conciliado</span>
          <span>{pctConciliado.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${Math.min(pctConciliado, 100)}%` }}
          />
        </div>
      </div>

      {/* Desglose por estado */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Desglose por estado</p>
        <div className="space-y-2">
          {estadoEntries
            .sort((a, b) => b[1].count - a[1].count)
            .map(([estado, { count, monto }]) => (
              <div key={estado} className="flex items-center gap-3">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: RECON_ESTADO_COLORS[estado] }}
                />
                <span className="text-xs text-slate-300 flex-1">{RECON_ESTADO_LABELS[estado]}</span>
                <span className="text-xs text-slate-400 font-mono">{count}</span>
                <span className="text-xs text-slate-500 font-mono w-32 text-right">$ {fmt(monto)}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

// ── ReconPeriodView ───────────────────────────────────────────────────────────

type Tab = 'importar' | 'resultados' | 'kpis'

export default function ReconPeriodView() {
  const { id }     = useParams<{ id: string }>()
  const navigate   = useNavigate()
  const { data: session } = useAuthSession()
  const userId     = session?.userId ?? ''

  const { data: period, isLoading } = useReconPeriod(id!)
  const { data: results = [] }      = useReconResults(id!)

  const runRecon       = useRunRecon()
  const setStatus      = useSetReconPeriodStatus()

  const [tab, setTab]       = useState<Tab>('importar')
  const [running, setRunning] = useState(false)
  const [runMsg, setRunMsg]  = useState('')

  async function handleRun() {
    if (!id) return
    setRunning(true)
    setRunMsg('')
    try {
      const result = await runRecon.mutateAsync(id)
      if (result.ok) {
        setRunMsg(`${result.inserted} resultados generados`)
        setTab('resultados')
      } else {
        setRunMsg(`Error: ${result.error}`)
      }
    } finally {
      setRunning(false)
    }
  }

  async function handleClose() {
    if (!id) return
    await setStatus.mutateAsync({ id, status: 'closed', closedBy: userId })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-900">
        <Loader2 size={20} className="animate-spin text-slate-500" />
      </div>
    )
  }
  if (!period) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-900 gap-3">
        <p className="text-slate-400 text-sm">Período no encontrado</p>
        <button onClick={() => navigate('/contable/recon')} className="text-amber-400 text-sm hover:underline">
          Volver
        </button>
      </div>
    )
  }

  const periodLabel = `${MONTH_NAMES[period.period_month - 1]} ${period.period_year}`
  const canClose = period.status === 'review'

  return (
    <div className="flex flex-col h-full bg-slate-900">

      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => navigate('/contable/recon')}
          className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-white">{periodLabel}</h1>
            <StatusBadge status={period.status} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {runMsg && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={12} /> {runMsg}
            </span>
          )}
          <button
            onClick={handleRun}
            disabled={running || period.status === 'closed'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-40"
          >
            {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            Conciliar
          </button>
          {canClose && (
            <button
              onClick={handleClose}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <CheckCircle2 size={12} />
              Cerrar período
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-6 border-b border-slate-700 flex gap-1 flex-shrink-0">
        {([
          { key: 'importar',   label: 'Importar',   icon: Upload     },
          { key: 'resultados', label: `Resultados${results.length ? ` (${results.length})` : ''}`, icon: List },
          { key: 'kpis',       label: 'KPIs',       icon: BarChart3  },
        ] as { key: Tab; label: string; icon: React.ElementType }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors',
              tab === t.key
                ? 'border-amber-500 text-amber-300'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            )}
          >
            <t.icon size={12} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          {tab === 'importar'   && <TabImportar   periodId={id!} userId={userId} />}
          {tab === 'resultados' && <TabResultados periodId={id!} />}
          {tab === 'kpis'       && <TabKPIs       periodId={id!} />}
        </div>
      </div>
    </div>
  )
}
