import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import {
  Upload, Loader2, TrendingUp, TrendingDown, Users,
  ChevronRight, FolderOpen, AlertTriangle, CheckCircle2,
  ExternalLink, Minus, Umbrella
} from 'lucide-react'
import { cn } from '../../components/ui/utils'
import { usePeriodos, useSavePayroll, useSaveVacaciones, useDeletePeriodo } from '../../hooks/useRrhh'
import type { RrhhPeriodoConStats, SavePayrollResult, SaveVacacionesResult } from '@shared/types'

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString('es-AR').replace(/,/g, '.')}`
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return fmt(n)
}

// ── KPI bar ───────────────────────────────────────────────────────────────────

function KpiBar({ periodos }: { periodos: RrhhPeriodoConStats[] }) {
  const ultimo = periodos[0] ?? null
  if (!ultimo) return null
  const grand = ultimo.total_neto + (ultimo.total_vacaciones ?? 0)
  const promedio = ultimo.cantidad_colaboradores > 0
    ? grand / ultimo.cantidad_colaboradores : 0

  return (
    <div className="grid grid-cols-4 gap-3">
      {[
        { label: 'Total nómina', value: fmt(grand), sub: ultimo.label },
        {
          label: 'vs mes anterior',
          value: ultimo.delta_pct !== null
            ? `${ultimo.delta_pct > 0 ? '+' : ''}${ultimo.delta_pct.toFixed(1)}%`
            : '—',
          sub: ultimo.delta_total !== null ? fmt(Math.abs(ultimo.delta_total)) : 'Sin comparativa',
          color: ultimo.delta_pct !== null
            ? ultimo.delta_pct > 0 ? 'text-emerald-400' : ultimo.delta_pct < 0 ? 'text-red-400' : 'text-slate-400'
            : 'text-slate-500',
        },
        { label: 'Colaboradores', value: String(ultimo.cantidad_colaboradores), sub: 'activos este período' },
        { label: 'Promedio', value: fmtK(promedio), sub: 'por colaborador' },
      ].map(({ label, value, sub, color }) => (
        <div key={label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
          <p className={cn('text-xl font-bold text-slate-100', color)}>{value}</p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{sub}</p>
        </div>
      ))}
    </div>
  )
}

// ── Bar chart ─────────────────────────────────────────────────────────────────

function NominaChart({ periodos }: { periodos: RrhhPeriodoConStats[] }) {
  if (periodos.length < 2) return null
  const data = [...periodos].reverse().map(p => ({
    label: p.label.split(' ')[0].slice(0, 3),
    total: p.total_neto + (p.total_vacaciones ?? 0),
    promedio: p.cantidad_colaboradores > 0 ? (p.total_neto + (p.total_vacaciones ?? 0)) / p.cantidad_colaboradores : 0,
  }))
  const maxVal = Math.max(...data.map(d => d.total))

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <p className="text-xs font-semibold text-slate-400 mb-3">Evolución de nómina</p>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis hide domain={[0, maxVal * 1.1]} />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,.04)' }}
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
            formatter={(v: number) => [fmt(v), 'Total']}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Bar dataKey="total" fill="#f472b6" radius={[4, 4, 0, 0]} maxBarSize={40} />
          <ReferenceLine y={data[data.length - 1]?.promedio ?? 0} stroke="#64748b" strokeDasharray="3 3" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Alerts panel (post-upload) ────────────────────────────────────────────────

function AlertsPanel({ result, onClose }: { result: SavePayrollResult; onClose: () => void }) {
  const { alerts, colaboradoresNuevos, colaboradoresActualizados } = result
  if (alerts.length === 0) return null

  const nuevos  = alerts.filter(a => a.type === 'nuevo')
  const ausentes = alerts.filter(a => a.type === 'ausente')
  const cambios  = alerts.filter(a => a.type === 'aumento' || a.type === 'baja')

  return (
    <div className="bg-slate-800 border border-pink-800/40 rounded-xl p-4 relative">
      <button onClick={onClose} className="absolute top-3 right-3 text-slate-500 hover:text-slate-300">
        <Minus size={14} />
      </button>
      <p className="text-xs font-semibold text-pink-400 mb-3 uppercase tracking-wider">
        Resumen — {result.periodo.label}
      </p>
      <div className="space-y-1.5 text-xs">
        <p className="text-slate-400">
          <span className="text-slate-200 font-medium">{colaboradoresNuevos}</span> nuevos ·{' '}
          <span className="text-slate-200 font-medium">{colaboradoresActualizados}</span> actualizados
        </p>
        {nuevos.map((a, i) => (
          <p key={i} className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 size={11} /> <span className="font-medium">{a.nombre}</span> — colaborador nuevo
          </p>
        ))}
        {ausentes.map((a, i) => (
          <p key={i} className="flex items-center gap-1.5 text-amber-400">
            <AlertTriangle size={11} /> <span className="font-medium">{a.nombre}</span> — no aparece este mes
          </p>
        ))}
        {cambios.map((a, i) => (
          <p key={i} className={cn('flex items-center gap-1.5', a.type === 'aumento' ? 'text-emerald-400' : 'text-red-400')}>
            {a.type === 'aumento' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            <span className="font-medium">{a.nombre}</span>
            {' '}{a.type === 'aumento' ? '▲' : '▼'}{' '}
            {a.delta_pct?.toFixed(1)}% ({a.delta !== undefined ? fmt(Math.abs(a.delta)) : ''})
          </p>
        ))}
      </div>
    </div>
  )
}

// ── Period card ───────────────────────────────────────────────────────────────

function PeriodoCard({
  periodo, onClick
}: { periodo: RrhhPeriodoConStats; onClick: () => void }) {
  const hasDrive = !!periodo.pdf_drive_folder_id
  const isConfirmado = periodo.estado === 'confirmado'
  const hasVac = (periodo.total_vacaciones ?? 0) > 0
  const grand = periodo.total_neto + (periodo.total_vacaciones ?? 0)

  return (
    <button
      onClick={onClick}
      className="group bg-slate-800 border border-slate-700 hover:border-pink-700/60 rounded-xl p-4 text-left transition-all duration-150 hover:bg-slate-750"
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{periodo.label}</p>
        <div className="flex flex-col items-end gap-1">
          {isConfirmado
            ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400 border border-emerald-800/40">Confirmado</span>
            : <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-800/30">Borrador</span>
          }
          {hasDrive && (
            <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
              <FolderOpen size={10} /> Drive
            </span>
          )}
        </div>
      </div>

      {hasVac ? (
        <div className="space-y-0.5 mb-2">
          <p className="text-[11px] text-slate-400">Sueldos: <span className="text-slate-200 font-medium">{fmt(periodo.total_neto)}</span></p>
          <p className="text-[11px] text-slate-400 flex items-center gap-1">
            <Umbrella size={10} className="text-sky-400" />
            Vacaciones: <span className="text-sky-300 font-medium">{fmt(periodo.total_vacaciones!)}</span>
          </p>
          <p className="text-base font-bold text-slate-100">Total: {fmt(grand)}</p>
        </div>
      ) : (
        <p className="text-2xl font-bold text-slate-100 mt-1 mb-2">{fmt(periodo.total_neto)}</p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Users size={12} />
          <span>{periodo.cantidad_colaboradores} colaboradores</span>
        </div>
        {periodo.delta_pct !== null && (
          <span className={cn(
            'text-xs font-semibold flex items-center gap-0.5',
            periodo.delta_pct > 0 ? 'text-emerald-400' : periodo.delta_pct < 0 ? 'text-red-400' : 'text-slate-400'
          )}>
            {periodo.delta_pct > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {periodo.delta_pct > 0 ? '+' : ''}{periodo.delta_pct.toFixed(1)}%
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-600 group-hover:text-slate-400 transition-colors">
        <span>Pago: {periodo.fecha_pago || '—'}</span>
        <ChevronRight size={13} />
      </div>
    </button>
  )
}

// ── Upload zones ──────────────────────────────────────────────────────────────

function UploadZone({
  label, accent, onFilePath, selectFn
}: {
  label: string
  accent: 'pink' | 'sky'
  onFilePath: (p: string) => void
  selectFn: () => Promise<string | null>
}) {
  const [dragOver, setDragOver] = useState(false)

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file?.name.toLowerCase().endsWith('.pdf')) return
    const p = window.api.utils.getFilePath(file)
    if (p) onFilePath(p)
  }

  async function onClick() {
    const p = await selectFn()
    if (p) onFilePath(p)
  }

  const borderActive   = accent === 'pink' ? 'border-pink-500 bg-pink-950/10' : 'border-sky-500 bg-sky-950/10'
  const iconColor      = accent === 'pink' ? 'text-pink-400' : 'text-sky-400'

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={e => { const r = e.relatedTarget as Element | null; if (!r || !(e.currentTarget as Element).contains(r)) setDragOver(false) }}
      onDrop={onDrop}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-3 rounded-xl border-2 border-dashed p-5 transition-all duration-150 cursor-pointer',
        dragOver
          ? `${borderActive} scale-[1.01]`
          : 'border-slate-700 hover:border-slate-600 bg-slate-800/40'
      )}
    >
      {accent === 'sky'
        ? <Umbrella size={16} className={dragOver ? iconColor : 'text-slate-500'} />
        : <Upload size={16} className={dragOver ? iconColor : 'text-slate-500'} />
      }
      <span className="text-xs text-slate-400">
        {dragOver ? 'Soltá el PDF aquí' : label}
      </span>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function SueldosDashboard() {
  const navigate = useNavigate()
  const { data: periodos = [], isLoading } = usePeriodos()
  const savePayroll = useSavePayroll()
  const saveVacaciones = useSaveVacaciones()
  const [lastResult, setLastResult] = useState<SavePayrollResult | null>(null)
  const [lastVacResult, setLastVacResult] = useState<SaveVacacionesResult | null>(null)

  function handleFile(filePath: string) {
    setLastResult(null)
    savePayroll.mutate(filePath, {
      onSuccess: result => {
        setLastResult(result)
        navigate(`/rrhh/sueldos/${result.periodo.id}`)
      }
    })
  }

  function handleVacFile(filePath: string) {
    setLastVacResult(null)
    saveVacaciones.mutate(filePath, {
      onSuccess: result => {
        setLastVacResult(result)
        navigate(`/rrhh/sueldos/${result.periodo.id}`)
      }
    })
  }

  const isProcessing = savePayroll.isPending || saveVacaciones.isPending

  return (
    <div className="h-full flex flex-col p-6 gap-5 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Sueldos</h1>
          <p className="text-xs text-slate-500 mt-0.5">Nómina mensual — {periodos.length} período{periodos.length !== 1 ? 's' : ''} cargado{periodos.length !== 1 ? 's' : ''}</p>
        </div>
        {isProcessing && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 size={13} className="animate-spin" />
            Procesando PDF…
          </div>
        )}
      </div>

      {/* KPIs */}
      {periodos.length > 0 && <KpiBar periodos={periodos} />}

      {/* Upload zones */}
      <div className="grid grid-cols-2 gap-3">
        <UploadZone
          label="Arrastrá o hacé clic para subir sueldos del mes"
          accent="pink"
          onFilePath={handleFile}
          selectFn={() => window.api.rrhh.selectPdf()}
        />
        <UploadZone
          label="Arrastrá o hacé clic para subir vacaciones"
          accent="sky"
          onFilePath={handleVacFile}
          selectFn={() => window.api.rrhh.selectVacacionesPdf()}
        />
      </div>

      {/* Errors */}
      {savePayroll.isError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/20 border border-red-800/40 text-xs text-red-400">
          <AlertTriangle size={13} />
          {savePayroll.error?.message}
        </div>
      )}
      {saveVacaciones.isError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/20 border border-red-800/40 text-xs text-red-400">
          <AlertTriangle size={13} />
          {saveVacaciones.error?.message}
        </div>
      )}

      {/* Vacaciones no-match warning */}
      {lastVacResult && lastVacResult.colaboradoresSinMatch.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/40 text-xs text-amber-400">
          <p className="font-semibold mb-1">Sin match en sueldos:</p>
          {lastVacResult.colaboradoresSinMatch.map(n => <p key={n}>{n}</p>)}
        </div>
      )}

      {/* Chart */}
      {periodos.length >= 2 && <NominaChart periodos={periodos} />}

      {/* Periods grid */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-4">
          <Loader2 size={13} className="animate-spin" /> Cargando períodos…
        </div>
      ) : periodos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-600">
          <Upload size={32} />
          <p className="text-sm">Subí el primer PDF de sueldos para comenzar</p>
        </div>
      ) : (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-3">Historial de períodos</p>
          <div className="grid grid-cols-3 gap-3">
            {periodos.map(p => (
              <PeriodoCard
                key={p.id}
                periodo={p}
                onClick={() => navigate(`/rrhh/sueldos/${p.id}`)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
