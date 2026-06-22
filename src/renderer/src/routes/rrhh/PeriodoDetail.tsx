import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import {
  ArrowLeft, TrendingUp, TrendingDown, Users, FolderOpen,
  ExternalLink, CheckCircle2, AlertTriangle, ChevronRight,
  Loader2, X, ChevronsUpDown, ArrowUpDown
} from 'lucide-react'
import { cn } from '../../components/ui/utils'
import { usePeriodos, useSueldos, useHistorialColaborador, useConfirmarPeriodo, useDeletePeriodo } from '../../hooks/useRrhh'
import { useQuery } from '@tanstack/react-query'
import type { RrhhSueldoConColaborador, RrhhHistorialEntry } from '@shared/types'

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString('es-AR').replace(/,/g, '.')}`
}

type SortKey = 'nombre' | 'total_neto' | 'delta_pct'

// ── Historial slide-over ──────────────────────────────────────────────────────

function HistorialSlideOver({
  colaboradorId, nombre, onClose
}: { colaboradorId: string; nombre: string; onClose: () => void }) {
  const { data: historial = [], isLoading } = useHistorialColaborador(colaboradorId)

  const chartData = historial.map(h => ({
    label: h.periodo.label.split(' ')[0].slice(0, 3) + ' ' + String(h.periodo.anio).slice(2),
    total: h.sueldo.total_neto,
    delta: h.delta_pct,
  }))

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-[420px] h-full bg-slate-900 border-l border-slate-700 flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-slate-700">
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X size={16} />
          </button>
          <div>
            <p className="text-sm font-semibold text-slate-100">{nombre}</p>
            <p className="text-xs text-slate-500">Historial de sueldos</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-slate-500" />
          </div>
        ) : historial.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">Sin historial</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
            {/* Chart */}
            <div>
              <p className="text-xs text-slate-500 mb-2">Evolución salarial</p>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
                    formatter={(v: number) => [fmt(v), 'Total Neto']}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Line
                    type="monotone" dataKey="total"
                    stroke="#f472b6" strokeWidth={2} dot={{ fill: '#f472b6', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Stats */}
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

            {/* Table */}
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
                        <td className={cn('px-3 py-2 text-right',
                          h.delta_pct === null ? 'text-slate-600'
                          : h.delta_pct > 0 ? 'text-emerald-400' : 'text-red-400'
                        )}>
                          {h.delta_pct !== null
                            ? `${h.delta_pct > 0 ? '+' : ''}${h.delta_pct.toFixed(1)}%`
                            : '—'}
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

// ── Employee row ──────────────────────────────────────────────────────────────

function EmpleadoRow({ s, onClick }: { s: RrhhSueldoConColaborador; onClick: () => void }) {
  const hasDelta = s.delta_importe !== null && s.delta_pct !== null

  return (
    <tr
      className="border-b border-slate-700/50 hover:bg-slate-700/25 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-200 leading-tight">{s.colaborador.nombre}</span>
          {s.es_nuevo && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400 border border-emerald-800/40 flex-shrink-0">NUEVO</span>
          )}
        </div>
        <span className="text-[10px] text-slate-500">{s.tarea}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-semibold text-emerald-400 whitespace-nowrap">{fmt(s.total_neto)}</span>
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        {hasDelta ? (
          <div className="flex flex-col items-end">
            <span className={cn('text-xs font-medium', s.delta_importe! > 0 ? 'text-emerald-400' : 'text-red-400')}>
              {s.delta_importe! > 0 ? '+' : ''}{fmt(s.delta_importe!)}
            </span>
            <span className={cn('text-[10px]', s.delta_pct! > 0 ? 'text-emerald-500' : 'text-red-500')}>
              {s.delta_pct! > 0 ? '▲' : '▼'} {Math.abs(s.delta_pct!).toFixed(1)}%
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-600">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {hasDelta ? (
          s.delta_pct! > 0 ? <TrendingUp size={13} className="text-emerald-400 mx-auto" />
          : s.delta_pct! < 0 ? <TrendingDown size={13} className="text-red-400 mx-auto" />
          : <span className="text-slate-600 text-xs">—</span>
        ) : (
          <span className="text-[9px] text-emerald-600 font-medium">1er mes</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <ChevronRight size={13} className="text-slate-600 mx-auto" />
      </td>
    </tr>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PeriodoDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: periodos = [] } = usePeriodos()
  const { data: sueldos = [], isLoading: loadingSueldos } = useSueldos(id ?? null)
  const confirmar = useConfirmarPeriodo()
  const deletePeriodo = useDeletePeriodo()

  const { data: ausentes = [] } = useQuery({
    queryKey: ['rrhh:ausentes', id],
    queryFn: () => window.api.rrhh.periodos.ausentes(id!),
    enabled: !!id,
  })

  const [sortKey, setSortKey] = useState<SortKey>('nombre')
  const [selectedColaborador, setSelectedColaborador] = useState<{ id: string; nombre: string } | null>(null)

  const periodo = periodos.find(p => p.id === id)

  const sorted = [...sueldos].sort((a, b) => {
    if (sortKey === 'nombre') return a.colaborador.nombre.localeCompare(b.colaborador.nombre)
    if (sortKey === 'total_neto') return b.total_neto - a.total_neto
    if (sortKey === 'delta_pct') {
      const da = a.delta_pct ?? -Infinity
      const db = b.delta_pct ?? -Infinity
      return db - da
    }
    return 0
  })

  const totalNeto = sueldos.reduce((s, e) => s + e.total_neto, 0)
  const nuevos = sueldos.filter(s => s.es_nuevo).length

  if (!periodo) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 text-sm">
        {periodos.length === 0 ? <Loader2 size={16} className="animate-spin" /> : 'Período no encontrado'}
      </div>
    )
  }

  function SortBtn({ k, label }: { k: SortKey; label: string }) {
    return (
      <button
        onClick={() => setSortKey(k)}
        className={cn('flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors',
          sortKey === k ? 'text-pink-400' : 'text-slate-500 hover:text-slate-400'
        )}
      >
        {label} <ArrowUpDown size={9} />
      </button>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header bar */}
      <div className="flex-shrink-0 flex items-center gap-4 px-6 py-4 border-b border-slate-700 bg-slate-800/50">
        <button onClick={() => navigate('/rrhh/sueldos')} className="text-slate-400 hover:text-slate-200 transition-colors">
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
          <p className="text-xs text-slate-500 mt-0.5">
            Pago: {periodo.fecha_pago || '—'} · {periodo.cantidad_colaboradores} colaboradores
          </p>
        </div>
        <div className="flex items-center gap-2">
          {periodo.pdf_drive_folder_id && (
            <button
              onClick={() => window.api.rrhh.drive.openFolder(periodo.pdf_drive_folder_id!)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <FolderOpen size={13} /> Drive <ExternalLink size={11} />
            </button>
          )}
          {periodo.estado !== 'confirmado' && (
            <button
              onClick={() => confirmar.mutate(periodo.id)}
              disabled={confirmar.isPending}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white transition-colors disabled:opacity-50"
            >
              {confirmar.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Confirmar período
            </button>
          )}
          <button
            onClick={() => { if (confirm('¿Eliminar este período?')) deletePeriodo.mutate(periodo.id, { onSuccess: () => navigate('/rrhh/sueldos') }) }}
            className="text-xs text-slate-600 hover:text-red-400 px-2 py-1.5 rounded transition-colors"
          >
            Eliminar
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {/* KPIs inline */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Total nómina</p>
            <p className="text-xl font-bold text-slate-100">{fmt(totalNeto)}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">vs mes anterior</p>
            <p className={cn('text-xl font-bold', periodo.delta_pct !== null
              ? periodo.delta_pct > 0 ? 'text-emerald-400' : 'text-red-400'
              : 'text-slate-500'
            )}>
              {periodo.delta_pct !== null
                ? `${periodo.delta_pct > 0 ? '+' : ''}${periodo.delta_pct.toFixed(1)}%`
                : '—'}
            </p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Colaboradores</p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-bold text-slate-100">{sueldos.length}</p>
              {nuevos > 0 && <span className="text-xs text-emerald-400">+{nuevos} nuevos</span>}
            </div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Promedio</p>
            <p className="text-xl font-bold text-slate-100">
              {sueldos.length ? fmt(totalNeto / sueldos.length) : '—'}
            </p>
          </div>
        </div>

        {/* Alerts */}
        {(nuevos > 0 || ausentes.length > 0 || sueldos.some(s => s.delta_pct !== null && Math.abs(s.delta_pct) >= 10)) && (
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex flex-col gap-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Novedades del período</p>
            {sueldos.filter(s => s.es_nuevo).map(s => (
              <p key={s.id} className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle2 size={11} /> <span className="font-medium">{s.colaborador.nombre}</span> — colaborador nuevo
              </p>
            ))}
            {ausentes.map(c => (
              <p key={c.id} className="flex items-center gap-1.5 text-xs text-amber-400">
                <AlertTriangle size={11} /> <span className="font-medium">{c.nombre}</span> — no aparece este mes
              </p>
            ))}
            {sueldos
              .filter(s => s.delta_pct !== null && Math.abs(s.delta_pct) >= 10)
              .sort((a, b) => Math.abs(b.delta_pct!) - Math.abs(a.delta_pct!))
              .slice(0, 5)
              .map(s => (
                <p key={s.id} className={cn('flex items-center gap-1.5 text-xs', s.delta_pct! > 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {s.delta_pct! > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  <span className="font-medium">{s.colaborador.nombre}</span>
                  {' '}{s.delta_pct! > 0 ? '▲' : '▼'} {Math.abs(s.delta_pct!).toFixed(1)}%
                  {' '}({fmt(Math.abs(s.delta_importe!))})
                </p>
              ))}
          </div>
        )}

        {/* Table */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <p className="text-xs font-semibold text-slate-300">Detalle por colaborador</p>
            <p className="text-[10px] text-slate-500">Clic en fila para ver historial</p>
          </div>
          {loadingSueldos ? (
            <div className="p-6 flex justify-center"><Loader2 size={16} className="animate-spin text-slate-500" /></div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/60">
                  <th className="px-4 py-2.5"><SortBtn k="nombre" label="Nombre" /></th>
                  <th className="px-4 py-2.5 text-right"><SortBtn k="total_neto" label="Total Neto" /></th>
                  <th className="px-4 py-2.5 text-right"><SortBtn k="delta_pct" label="Variación" /></th>
                  <th className="px-4 py-2.5 text-center w-10">
                    <ChevronsUpDown size={11} className="text-slate-600 mx-auto" />
                  </th>
                  <th className="px-4 py-2.5 w-8" />
                </tr>
              </thead>
              <tbody>
                {sorted.map(s => (
                  <EmpleadoRow
                    key={s.id}
                    s={s}
                    onClick={() => setSelectedColaborador({ id: s.colaborador_id, nombre: s.colaborador.nombre })}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Historial slide-over */}
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
