import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList
} from 'recharts'
import {
  Upload, Loader2, TrendingUp, TrendingDown, Users,
  ChevronRight, FolderOpen, AlertTriangle, CheckCircle2,
  ExternalLink, Minus
} from 'lucide-react'
import { cn } from '../../components/ui/utils'
import { usePeriodos, useSavePayroll, useSaveVacaciones, useSaveSac, useDeletePeriodo } from '../../hooks/useRrhh'
import { useRrhhEmpresa } from './RrhhEmpresaContext'
import { RRHH_EMPRESA_LABEL } from '@shared/types'
import type { RrhhPeriodoConStats, SavePayrollResult, SaveVacacionesResult } from '@shared/types'

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString('es-AR').replace(/,/g, '.')}`
}

function fmtM(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return fmt(n)
}

// ── KPI bar ───────────────────────────────────────────────────────────────────

function KpiBar({ periodos }: { periodos: RrhhPeriodoConStats[] }) {
  const ultimo = periodos[0] ?? null
  if (!ultimo) return null
  const grand = ultimo.total_neto + (ultimo.total_vacaciones ?? 0) + (ultimo.total_sac ?? 0)
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
        { label: 'Promedio', value: fmtM(promedio), sub: 'por colaborador' },
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

interface ChartRow {
  label: string
  sueldos: number
  vacaciones: number
  sac: number
  labelVal: number  // always 0, used as anchor for the top label
  total: number
  colabs: number
}

function CustomXTick(props: { x?: number; y?: number; payload?: { value: string; index: number }; chartData?: ChartRow[] }) {
  const { x = 0, y = 0, payload, chartData } = props
  if (!payload) return null
  const row = chartData?.[payload.index]
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={8}  textAnchor="middle" fill="#64748b" fontSize={10}>{payload.value}</text>
      <text x={0} y={21} textAnchor="middle" fill="#475569" fontSize={9}>{row?.colabs ?? ''} col.</text>
    </g>
  )
}

function NominaChart({ periodos }: { periodos: RrhhPeriodoConStats[] }) {
  if (periodos.length < 2) return null

  const data: ChartRow[] = [...periodos].reverse().map(p => {
    const sueldos    = p.total_neto
    const vacaciones = p.total_vacaciones ?? 0
    const sac        = p.total_sac ?? 0
    return {
      label:      p.label.split(' ')[0].slice(0, 3),
      sueldos,
      vacaciones,
      sac,
      labelVal:   0,
      total:      sueldos + vacaciones + sac,
      colabs:     p.cantidad_colaboradores,
    }
  })

  const maxVal = Math.max(...data.map(d => d.total))
  const hasAnyVac = data.some(d => d.vacaciones > 0)
  const hasAnySac = data.some(d => d.sac > 0)

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-400">Evolución de nómina</p>
        {(hasAnyVac || hasAnySac) && (
          <div className="flex items-center gap-3 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-pink-400" />
              Sueldos
            </span>
            {hasAnyVac && (
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-sky-400" />
                Vacaciones
              </span>
            )}
            {hasAnySac && (
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400" />
                SAC
              </span>
            )}
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={148}>
        <BarChart data={data} margin={{ top: 22, right: 4, left: 4, bottom: 4 }}>
          <XAxis
            dataKey="label"
            tick={<CustomXTick chartData={data} />}
            axisLine={false}
            tickLine={false}
            height={32}
          />
          <YAxis hide domain={[0, maxVal * 1.22]} />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,.04)' }}
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#94a3b8' }}
            formatter={(v: number, name: string) => {
              if (name === 'sueldos')    return [fmt(v), 'Sueldos']
              if (name === 'vacaciones') return [fmt(v), 'Vacaciones']
              if (name === 'sac')        return [fmt(v), 'SAC']
              return [null, '']
            }}
          />
          {/* Sueldos — bottom of stack */}
          <Bar dataKey="sueldos" fill="#f472b6" stackId="a" maxBarSize={44} isAnimationActive={false} />
          {/* Vacaciones — middle of stack (rounded top when es el segmento superior) */}
          <Bar dataKey="vacaciones" fill="#38bdf8" stackId="a" maxBarSize={44} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          {/* SAC — top of stack, rounded top corners */}
          <Bar dataKey="sac" fill="#f59e0b" stackId="a" maxBarSize={44} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          {/* Invisible bar — sits at the very top, carries the total label */}
          <Bar dataKey="labelVal" fill="transparent" stackId="a" maxBarSize={44} isAnimationActive={false}>
            <LabelList
              dataKey="total"
              position="top"
              style={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
              formatter={(v: number) => fmtM(v)}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Alerts panel (post-upload) ────────────────────────────────────────────────

function AlertsPanel({ result, onClose }: { result: SavePayrollResult; onClose: () => void }) {
  const { alerts, colaboradoresNuevos, colaboradoresActualizados } = result
  if (alerts.length === 0) return null

  const nuevos   = alerts.filter(a => a.type === 'nuevo')
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
  const hasDrive     = !!periodo.pdf_drive_folder_id
  const isConfirmado = periodo.estado === 'confirmado'
  const hasVac       = (periodo.total_vacaciones ?? 0) > 0
  const hasSac       = (periodo.total_sac ?? 0) > 0
  const grand        = periodo.total_neto + (periodo.total_vacaciones ?? 0) + (periodo.total_sac ?? 0)

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

      {(hasVac || hasSac) ? (
        <div className="space-y-0.5 mb-2">
          <p className="text-[11px] text-slate-400">Sueldos: <span className="text-slate-200 font-medium">{fmt(periodo.total_neto)}</span></p>
          {hasVac && <p className="text-[11px] text-slate-400">Vacaciones: <span className="text-sky-300 font-medium">{fmt(periodo.total_vacaciones!)}</span></p>}
          {hasSac && <p className="text-[11px] text-slate-400">SAC: <span className="text-amber-300 font-medium">{fmt(periodo.total_sac!)}</span></p>}
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

      <div className="mt-3 flex justify-end text-slate-700 group-hover:text-slate-500 transition-colors">
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
  accent: 'pink' | 'sky' | 'amber'
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

  const ACCENT = {
    pink:  { active: 'border-pink-500 bg-pink-950/10',   dragIcon: 'text-pink-400',  idleIcon: 'text-slate-500', label: 'text-slate-400' },
    sky:   { active: 'border-sky-500 bg-sky-950/10',     dragIcon: 'text-sky-400',   idleIcon: 'text-sky-600',   label: 'text-sky-600' },
    amber: { active: 'border-amber-500 bg-amber-950/10', dragIcon: 'text-amber-400', idleIcon: 'text-amber-600', label: 'text-amber-600' },
  }[accent]
  const borderActive = ACCENT.active
  const iconClass    = dragOver ? ACCENT.dragIcon : ACCENT.idleIcon

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
      <Upload size={16} className={iconClass} />
      <span className={cn('text-xs', !dragOver ? ACCENT.label : 'text-slate-400')}>
        {dragOver ? 'Soltá el PDF aquí' : label}
      </span>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function SueldosDashboard() {
  const navigate = useNavigate()
  const empresa = useRrhhEmpresa()
  const { data: periodos = [], isLoading } = usePeriodos()
  const savePayroll   = useSavePayroll()
  const saveVacaciones = useSaveVacaciones()
  const saveSac        = useSaveSac()
  const [lastVacResult, setLastVacResult] = useState<SaveVacacionesResult | null>(null)

  function handleFile(filePath: string) {
    savePayroll.mutate(filePath, {
      onSuccess: result => navigate(`/rrhh/sueldos/${empresa}/${result.periodo.id}`)
    })
  }

  function handleVacFile(filePath: string) {
    setLastVacResult(null)
    saveVacaciones.mutate(filePath, {
      onSuccess: result => {
        setLastVacResult(result)
        navigate(`/rrhh/sueldos/${empresa}/${result.periodo.id}`)
      }
    })
  }

  function handleSacFile(filePath: string) {
    saveSac.mutate(filePath, {
      onSuccess: result => navigate(`/rrhh/sueldos/${empresa}/${result.periodo.id}`)
    })
  }

  const isProcessing = savePayroll.isPending || saveVacaciones.isPending || saveSac.isPending

  return (
    <div className="h-full flex flex-col p-6 gap-5 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Sueldos {RRHH_EMPRESA_LABEL[empresa]}</h1>
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
      <div className="grid grid-cols-3 gap-3">
        <UploadZone
          label="Sueldos del mes"
          accent="pink"
          onFilePath={handleFile}
          selectFn={() => window.api.rrhh.selectPdf()}
        />
        <UploadZone
          label="Vacaciones"
          accent="sky"
          onFilePath={handleVacFile}
          selectFn={() => window.api.rrhh.selectVacacionesPdf()}
        />
        <UploadZone
          label="SAC / Aguinaldo"
          accent="amber"
          onFilePath={handleSacFile}
          selectFn={() => window.api.rrhh.selectSacPdf()}
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
      {saveSac.isError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/20 border border-red-800/40 text-xs text-red-400">
          <AlertTriangle size={13} />
          {saveSac.error?.message}
        </div>
      )}

      {/* Vacaciones no-match warning */}
      {lastVacResult && lastVacResult.colaboradoresSinMatch.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/40 text-xs text-amber-400">
          <p className="font-semibold mb-1">Sin match de documento en sueldos:</p>
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
                onClick={() => navigate(`/rrhh/sueldos/${empresa}/${p.id}`)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
