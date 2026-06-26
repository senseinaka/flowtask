import { useState, useRef, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import {
  ArrowLeft, TrendingUp, TrendingDown, FolderOpen,
  ExternalLink, CheckCircle2, AlertTriangle,
  Loader2, X, FileSpreadsheet, Search, ChevronDown, Umbrella
} from 'lucide-react'
import { cn } from '../../components/ui/utils'
import {
  usePeriodos, useSueldos, useHistorialColaborador,
  useConfirmarPeriodo, useDeletePeriodo,
  useUpdateSueldoNotas, useExportXls,
} from '../../hooks/useRrhh'
import { useQuery } from '@tanstack/react-query'
import { useRrhhEmpresa } from './RrhhEmpresaContext'
import type { RrhhSueldoConColaborador } from '@shared/types'

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString('es-AR').replace(/,/g, '.')}`
}

function calcAntiguedad(fechaIngreso: string | null): string {
  if (!fechaIngreso) return '—'
  // Accepts DD/MM/YYYY or YYYY-MM-DD
  let day: number, month: number, year: number
  const slash = fechaIngreso.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  const iso   = fechaIngreso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (slash) { [, day, month, year] = slash.map(Number) }
  else if (iso) { [, year, month, day] = iso.map(Number) }
  else return '—'
  const ingreso = new Date(year, month - 1, day)
  if (isNaN(ingreso.getTime())) return '—'
  const diffMs = Date.now() - ingreso.getTime()
  const years = diffMs / (1000 * 60 * 60 * 24 * 365.25)
  const y = Math.floor(years)
  const m = Math.floor((years - y) * 12)
  if (y === 0) return m <= 1 ? '< 1 mes' : `${m} meses`
  return m > 0 ? `${y}a ${m}m` : `${y} año${y !== 1 ? 's' : ''}`
}

function periodoShort(str: string): string {
  // "5 - 2026 Haberes normales" → "05"
  const m = str.match(/^\s*(\d{1,2})/)
  return m ? String(parseInt(m[1])).padStart(2, '0') : str.slice(0, 2)
}

function legajoNum(s: string | null): number {
  if (!s) return Infinity
  const n = parseInt(s.replace(/\D/g, ''), 10)
  return isNaN(n) ? Infinity : n
}

// ── Historial slide-over ──────────────────────────────────────────────────────

function HistorialSlideOver({
  colaboradorId, nombre, onClose
}: { colaboradorId: string; nombre: string; onClose: () => void }) {
  const { data: historial = [], isLoading } = useHistorialColaborador(colaboradorId)
  const chartData = historial.map(h => ({
    label: h.periodo.label.split(' ')[0].slice(0, 3) + ' ' + String(h.periodo.anio).slice(2),
    total: h.sueldo.total_neto,
  }))

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="w-[420px] h-full bg-slate-900 border-l border-slate-700 flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-5 border-b border-slate-700">
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X size={16} /></button>
          <div>
            <p className="text-sm font-semibold text-slate-100">{nombre}</p>
            <p className="text-xs text-slate-500">Historial de sueldos</p>
          </div>
        </div>
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 size={20} className="animate-spin text-slate-500" /></div>
        ) : historial.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">Sin historial</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
            <div>
              <p className="text-xs text-slate-500 mb-2">Evolución salarial</p>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [fmt(v), 'Total Neto']} labelStyle={{ color: '#94a3b8' }} />
                  <Line type="monotone" dataKey="total" stroke="#f472b6" strokeWidth={2} dot={{ fill: '#f472b6', r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {historial.length > 1 && (() => {
              const amounts = historial.map(h => h.sueldo.total_neto)
              const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length
              const deltas = historial.filter(h => h.delta_pct !== null).map(h => h.delta_pct!)
              const avgDelta = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null
              return (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Promedio', value: fmt(avg) },
                    { label: 'Máximo', value: fmt(Math.max(...amounts)) },
                    { label: 'Crecim. prom.', value: avgDelta !== null ? `${avgDelta > 0 ? '+' : ''}${avgDelta.toFixed(1)}%` : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-slate-800 rounded-lg p-2.5">
                      <p className="text-[10px] text-slate-500 mb-0.5">{label}</p>
                      <p className="text-xs font-semibold text-slate-200">{value}</p>
                    </div>
                  ))}
                </div>
              )
            })()}
            <div>
              <p className="text-xs text-slate-500 mb-2">Detalle por período</p>
              <div className="rounded-lg border border-slate-700 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-800/60 border-b border-slate-700">
                      <th className="text-left px-3 py-2 text-slate-500 font-medium">Período</th>
                      <th className="text-right px-3 py-2 text-slate-500 font-medium">Total Neto</th>
                      <th className="text-right px-3 py-2 text-slate-500 font-medium">Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...historial].reverse().map((h, i) => (
                      <tr key={i} className="border-b border-slate-700/50 last:border-0">
                        <td className="px-3 py-2 text-slate-300">{h.periodo.label}</td>
                        <td className="px-3 py-2 text-right font-medium text-slate-200">{fmt(h.sueldo.total_neto)}</td>
                        <td className={cn('px-3 py-2 text-right', h.delta_pct === null ? 'text-slate-600' : h.delta_pct > 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {h.delta_pct !== null ? `${h.delta_pct > 0 ? '+' : ''}${h.delta_pct.toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Inline notes cell ─────────────────────────────────────────────────────────

function NotasCell({ sueldoId, value, periodoId }: { sueldoId: string; value: string | null; periodoId: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const updateNotas = useUpdateSueldoNotas(periodoId)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { if (editing) ref.current?.focus() }, [editing])
  useEffect(() => { setDraft(value ?? '') }, [value])

  function commit() {
    const trimmed = draft.trim() || null
    if (trimmed !== (value ?? null)) updateNotas.mutate({ id: sueldoId, notas: trimmed })
    setEditing(false)
  }

  if (editing) {
    return (
      <textarea
        ref={ref} value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() }
          if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) }
        }}
        rows={2}
        className="w-full bg-slate-700 border border-pink-600/50 rounded px-2 py-1 text-xs text-slate-100 resize-none outline-none"
        style={{ minWidth: 150 }}
        onClick={e => e.stopPropagation()}
      />
    )
  }

  return (
    <div
      onClick={e => { e.stopPropagation(); setEditing(true) }}
      className={cn(
        'min-h-[28px] px-2 py-1 rounded text-xs cursor-text transition-colors',
        value ? 'text-slate-300 hover:bg-slate-700/50' : 'text-slate-600 hover:bg-slate-700/40 italic'
      )}
      style={{ minWidth: 150 }}
    >
      {value || 'Agregar nota…'}
    </div>
  )
}

// ── Sort header ───────────────────────────────────────────────────────────────

type SortKey = 'legajo' | 'nombre' | 'total_neto' | 'delta_pct' | 'antiguedad'

function SortTh({ label, k, current, onSort, className }: {
  label: string; k: SortKey; current: SortKey; onSort: (k: SortKey) => void; className?: string
}) {
  const active = current === k
  return (
    <th
      className={cn('px-3 py-2.5 cursor-pointer select-none whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider transition-colors', active ? 'text-pink-400' : 'text-slate-500 hover:text-slate-400', className)}
      onClick={() => onSort(k)}
    >
      {label}{active ? ' ↓' : ''}
    </th>
  )
}

function PlainTh({ label, className }: { label: string; className?: string }) {
  return (
    <th className={cn('px-3 py-2.5 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-slate-500', className)}>
      {label}
    </th>
  )
}

// ── Tarea filter dropdown ─────────────────────────────────────────────────────

function TareaFilter({ tareas, selected, onChange }: {
  tareas: string[]; selected: string | null; onChange: (t: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors',
          selected ? 'border-pink-600/60 bg-pink-950/30 text-pink-300' : 'border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500'
        )}
      >
        {selected ?? 'Todas las tareas'} <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-20 bg-slate-800 border border-slate-600 rounded-lg shadow-xl py-1 min-w-[200px] max-h-60 overflow-y-auto">
          <button
            onClick={() => { onChange(null); setOpen(false) }}
            className={cn('w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700 transition-colors', !selected ? 'text-pink-400' : 'text-slate-300')}
          >
            Todas las tareas
          </button>
          {tareas.map(t => (
            <button
              key={t}
              onClick={() => { onChange(t); setOpen(false) }}
              className={cn('w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700 transition-colors truncate', selected === t ? 'text-pink-400' : 'text-slate-300')}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PeriodoDetail() {
  const { id } = useParams<{ id: string }>()
  const empresa = useRrhhEmpresa()
  const navigate = useNavigate()
  const { data: periodos = [] } = usePeriodos()
  const { data: sueldos = [], isLoading: loadingSueldos } = useSueldos(id ?? null)
  const confirmar = useConfirmarPeriodo()
  const deletePeriodo = useDeletePeriodo()
  const exportXls = useExportXls()

  const { data: ausentes = [] } = useQuery({
    queryKey: ['rrhh:ausentes', id],
    queryFn: () => window.api.rrhh.periodos.ausentes(id!),
    enabled: !!id,
  })

  const [sortKey, setSortKey] = useState<SortKey>('legajo')
  const [search, setSearch] = useState('')
  const [tareaFilter, setTareaFilter] = useState<string | null>(null)
  const [selectedColaborador, setSelectedColaborador] = useState<{ id: string; nombre: string } | null>(null)

  const periodo = periodos.find(p => p.id === id)

  // Unique tarea values
  const tareas = useMemo(() =>
    [...new Set(sueldos.map(s => s.tarea).filter(Boolean))].sort(),
    [sueldos]
  )

  // Filter + sort
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return sueldos.filter(s => {
      if (tareaFilter && s.tarea !== tareaFilter) return false
      if (!q) return true
      return (
        s.colaborador.nombre.toLowerCase().includes(q) ||
        (s.colaborador.documento ?? '').includes(q) ||
        (s.colaborador.cuil ?? '').includes(q) ||
        (s.colaborador.legajo ?? '').includes(q) ||
        s.tarea.toLowerCase().includes(q) ||
        s.periodo_abonado.toLowerCase().includes(q) ||
        (s.notas ?? '').toLowerCase().includes(q)
      )
    })
  }, [sueldos, search, tareaFilter])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sortKey === 'legajo') return legajoNum(a.colaborador.legajo) - legajoNum(b.colaborador.legajo)
    if (sortKey === 'nombre') return a.colaborador.nombre.localeCompare(b.colaborador.nombre)
    if (sortKey === 'total_neto') return b.total_neto - a.total_neto
    if (sortKey === 'delta_pct') return (b.delta_pct ?? -Infinity) - (a.delta_pct ?? -Infinity)
    if (sortKey === 'antiguedad') {
      // sort by numeric years desc (most senior first)
      const yearsA = antigSort(a.colaborador.fecha_ingreso)
      const yearsB = antigSort(b.colaborador.fecha_ingreso)
      return yearsB - yearsA
    }
    return 0
  }), [filtered, sortKey])

  const totalSueldos = sueldos.reduce((s, e) => s + e.total_neto, 0)
  const totalVacaciones = sueldos.reduce((s, e) => s + (e.vacaciones_neto ?? 0), 0)
  const totalNeto = totalSueldos + totalVacaciones
  const nuevos = sueldos.filter(s => s.es_nuevo).length

  function buildXlsRows(rows: RrhhSueldoConColaborador[]) {
    return rows.map(s => ({
      'Apellido y Nombres': s.colaborador.nombre,
      'Legajo':             s.colaborador.legajo ?? '',
      'Documento':          s.colaborador.documento,
      'CUIL':               s.colaborador.cuil,
      'Tarea':              s.tarea,
      'Antigüedad':         calcAntiguedad(s.colaborador.fecha_ingreso),
      'Mes':                periodoShort(s.periodo_abonado),
      'Total Neto':         s.total_neto,
      'Vacaciones':         s.vacaciones_neto ?? '',
      'Días Vacaciones':    s.vacaciones_dias ?? '',
      'Variación ($)':      s.delta_importe ?? '',
      'Variación (%)':      s.delta_pct !== null ? `${s.delta_pct > 0 ? '+' : ''}${s.delta_pct.toFixed(1)}%` : '',
      'Estado':             s.es_nuevo ? 'NUEVO' : '',
      'Notas':              s.notas ?? '',
    })) as Record<string, unknown>[]
  }

  if (!periodo) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 text-sm">
        {periodos.length === 0 ? <Loader2 size={16} className="animate-spin" /> : 'Período no encontrado'}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-4 px-6 py-4 border-b border-slate-700 bg-slate-800/50">
        <button onClick={() => navigate(`/rrhh/sueldos/${empresa}`)} className="text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-slate-100">{periodo.label}</h1>
            {periodo.estado === 'confirmado'
              ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400 border border-emerald-800/40">Confirmado</span>
              : <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-800/30">Borrador</span>
            }
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Pago: {periodo.fecha_pago || '—'} · {sueldos.length} colaboradores</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportXls.mutate({
              periodoLabel: periodo.label,
              defaultFileName: `sueldos_${String(periodo.mes).padStart(2, '0')}-${periodo.anio}.xlsx`,
              rows: buildXlsRows(sorted),
            })}
            disabled={exportXls.isPending || sorted.length === 0}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-slate-100 transition-colors disabled:opacity-40"
          >
            {exportXls.isPending ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />}
            Exportar XLS
          </button>
          {periodo.pdf_drive_folder_id && (
            <button onClick={() => window.api.rrhh.drive.openFolder(periodo.pdf_drive_folder_id!)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
              <FolderOpen size={13} /> Drive <ExternalLink size={11} />
            </button>
          )}
          {periodo.estado !== 'confirmado' && (
            <button onClick={() => confirmar.mutate(periodo.id)} disabled={confirmar.isPending}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white transition-colors disabled:opacity-50">
              {confirmar.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Confirmar
            </button>
          )}
          <button onClick={() => { if (confirm('¿Eliminar este período?')) deletePeriodo.mutate(periodo.id, { onSuccess: () => navigate(`/rrhh/sueldos/${empresa}`) }) }}
            className="text-xs text-slate-600 hover:text-red-400 px-2 py-1.5 rounded transition-colors">
            Eliminar
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* KPIs */}
        <div className="flex-shrink-0 grid grid-cols-4 gap-3 px-6 pt-5 pb-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Total nómina</p>
            <p className="text-xl font-bold text-slate-100">{fmt(totalNeto)}</p>
            {totalVacaciones > 0 && (
              <div className="mt-1 space-y-0.5">
                <p className="text-[10px] text-slate-500">Sueldos: {fmt(totalSueldos)}</p>
                <p className="text-[10px] text-sky-400 flex items-center gap-0.5">
                  <Umbrella size={9} /> Vacaciones: {fmt(totalVacaciones)}
                </p>
              </div>
            )}
          </div>
          {[
            { label: 'vs mes anterior', value: periodo.delta_pct !== null ? `${periodo.delta_pct > 0 ? '+' : ''}${periodo.delta_pct.toFixed(1)}%` : '—', color: periodo.delta_pct !== null ? (periodo.delta_pct > 0 ? 'text-emerald-400' : 'text-red-400') : 'text-slate-500' },
            { label: 'Colaboradores', value: String(sueldos.length), extra: nuevos > 0 ? `+${nuevos} nuevos` : '' },
            { label: 'Promedio', value: sueldos.length ? fmt(totalNeto / sueldos.length) : '—', color: '' },
          ].map(({ label, value, color, extra }) => (
            <div key={label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</p>
              <div className="flex items-baseline gap-2">
                <p className={cn('text-xl font-bold text-slate-100', color)}>{value}</p>
                {extra && <span className="text-xs text-emerald-400">{extra}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Alerts */}
        {(nuevos > 0 || ausentes.length > 0 || sueldos.some(s => s.delta_pct !== null && Math.abs(s.delta_pct) >= 10)) && (
          <div className="flex-shrink-0 mx-6 mb-3 bg-slate-800/60 border border-slate-700 rounded-xl p-3 flex flex-wrap gap-x-5 gap-y-1">
            {sueldos.filter(s => s.es_nuevo).map(s => (
              <span key={s.id} className="flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircle2 size={10} /> {s.colaborador.nombre} — nuevo
              </span>
            ))}
            {ausentes.map(c => (
              <span key={c.id} className="flex items-center gap-1 text-xs text-amber-400">
                <AlertTriangle size={10} /> {c.nombre} — ausente
              </span>
            ))}
            {sueldos.filter(s => s.delta_pct !== null && Math.abs(s.delta_pct) >= 10)
              .sort((a, b) => Math.abs(b.delta_pct!) - Math.abs(a.delta_pct!)).slice(0, 4)
              .map(s => (
                <span key={s.id} className={cn('flex items-center gap-1 text-xs', s.delta_pct! > 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {s.delta_pct! > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {s.colaborador.nombre} {s.delta_pct! > 0 ? '▲' : '▼'}{Math.abs(s.delta_pct!).toFixed(1)}%
                </span>
              ))}
          </div>
        )}

        {/* Toolbar: search + tarea filter + count */}
        <div className="flex-shrink-0 flex items-center gap-3 px-6 pb-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, DNI, legajo…"
              className="w-full pl-7 pr-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-pink-600/60 transition-colors"
            />
          </div>
          <TareaFilter tareas={tareas} selected={tareaFilter} onChange={setTareaFilter} />
          <span className="text-[10px] text-slate-500 ml-auto">
            {filtered.length !== sueldos.length ? `${filtered.length} de ${sueldos.length}` : `${sueldos.length} colaboradores`}
          </span>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-6 pb-6">
          {loadingSueldos ? (
            <div className="flex justify-center py-12"><Loader2 size={16} className="animate-spin text-slate-500" /></div>
          ) : (
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs" style={{ minWidth: 1150 }}>
                <thead className="sticky top-0 z-10 bg-slate-800 border-b border-slate-700">
                  <tr>
                    <SortTh label="Apellido y Nombres" k="nombre" current={sortKey} onSort={setSortKey} />
                    <SortTh label="Legajo" k="legajo" current={sortKey} onSort={setSortKey} className="text-center" />
                    <PlainTh label="Documento" />
                    <PlainTh label="CUIL" />
                    <PlainTh label="Tarea" />
                    <SortTh label="Antigüedad" k="antiguedad" current={sortKey} onSort={setSortKey} />
                    <PlainTh label="Mes" className="text-center" />
                    <SortTh label="Total Neto" k="total_neto" current={sortKey} onSort={setSortKey} className="text-right" />
                    <PlainTh label="Vacaciones" className="text-right" />
                    <PlainTh label="Días" className="text-center" />
                    <SortTh label="Variación" k="delta_pct" current={sortKey} onSort={setSortKey} className="text-right" />
                    <PlainTh label="Notas" />
                    <th className="px-3 py-2.5 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(s => (
                    <tr key={s.id} className="border-b border-slate-700/40 hover:bg-slate-700/20 transition-colors">
                      {/* Nombre */}
                      <td className="px-3 py-2.5 cursor-pointer" onClick={() => setSelectedColaborador({ id: s.colaborador_id, nombre: s.colaborador.nombre })}>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-200 whitespace-nowrap">{s.colaborador.nombre}</span>
                          {s.es_nuevo && <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-900/40 text-emerald-400 border border-emerald-800/40">NUEVO</span>}
                        </div>
                      </td>

                      {/* Legajo */}
                      <td className="px-3 py-2.5 text-center font-mono text-[11px] text-slate-300">
                        {s.colaborador.legajo ?? <span className="text-slate-600">—</span>}
                      </td>

                      {/* Documento */}
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {s.colaborador.documento}
                      </td>

                      {/* CUIL */}
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {s.colaborador.cuil}
                      </td>

                      {/* Tarea */}
                      <td className="px-3 py-2.5 text-slate-400 max-w-[160px]">
                        <span className="truncate block" title={s.tarea}>{s.tarea}</span>
                      </td>

                      {/* Antigüedad */}
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-400">
                        {calcAntiguedad(s.colaborador.fecha_ingreso)}
                      </td>

                      {/* Mes */}
                      <td className="px-3 py-2.5 text-center text-slate-400 font-mono text-[11px]">
                        {periodoShort(s.periodo_abonado)}
                      </td>

                      {/* Total Neto */}
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <span className="font-semibold text-emerald-400">{fmt(s.total_neto)}</span>
                      </td>

                      {/* Vacaciones */}
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {s.vacaciones_neto != null && s.vacaciones_neto > 0
                          ? <span className="font-semibold text-sky-400">{fmt(s.vacaciones_neto)}</span>
                          : <span className="text-slate-700">—</span>
                        }
                      </td>

                      {/* Días vacaciones */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {s.vacaciones_dias != null && s.vacaciones_dias > 0
                          ? <span className="text-sky-300 font-mono text-[11px]">{s.vacaciones_dias}d</span>
                          : <span className="text-slate-700">—</span>
                        }
                      </td>

                      {/* Variación */}
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {s.delta_importe !== null && s.delta_pct !== null ? (
                          <div className={cn('flex flex-col items-end', s.delta_pct > 0 ? 'text-emerald-400' : 'text-red-400')}>
                            <span className="font-medium">{s.delta_importe > 0 ? '+' : ''}{fmt(s.delta_importe)}</span>
                            <span className="text-[10px] opacity-80">{s.delta_pct > 0 ? '▲' : '▼'} {Math.abs(s.delta_pct).toFixed(1)}%</span>
                          </div>
                        ) : <span className="text-slate-600 text-[10px]">1er mes</span>}
                      </td>

                      {/* Notas */}
                      <td className="px-1 py-1.5">
                        <NotasCell sueldoId={s.id} value={s.notas} periodoId={periodo.id} />
                      </td>

                      {/* Historial */}
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => setSelectedColaborador({ id: s.colaborador_id, nombre: s.colaborador.nombre })}
                          className="text-slate-600 hover:text-pink-400 transition-colors" title="Ver historial">
                          <TrendingUp size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sorted.length === 0 && (
                    <tr><td colSpan={13} className="px-4 py-8 text-center text-slate-600 text-xs">Sin resultados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedColaborador && (
        <HistorialSlideOver
          colaboradorId={selectedColaborador.id}
          nombre={selectedColaborador.nombre}
          onClose={() => setSelectedColaborador(null)}
        />
      )}
    </div>
  )
}

// helper for antigüedad sort (returns decimal years, more = older)
function antigSort(fechaIngreso: string | null): number {
  if (!fechaIngreso) return -1
  const slash = fechaIngreso.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  const iso   = fechaIngreso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  let day: number, month: number, year: number
  if (slash) { [, day, month, year] = slash.map(Number) }
  else if (iso) { [, year, month, day] = iso.map(Number) }
  else return -1
  const ingreso = new Date(year, month - 1, day)
  if (isNaN(ingreso.getTime())) return -1
  return (Date.now() - ingreso.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
}
