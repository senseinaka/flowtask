import { useState, useMemo } from 'react'
import {
  X, DollarSign, TrendingUp, RefreshCw, AlertTriangle, Check,
  Clock, ChevronDown, ChevronUp, Edit2
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts'
import { useCotizaciones, useAddCotizacion, useBcraRates, useRefreshBcra } from '../../hooks/useComex'
import type { ComexMoneda, ComexCotizacion, BcraRateEntry } from '@shared/types'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
dayjs.locale('es')

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtARS(v: number) {
  return v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function desvio(propio: number, bcra: number): number {
  return ((propio - bcra) / bcra) * 100
}

function DesvioChip({ pct }: { pct: number }) {
  const abs = Math.abs(pct)
  const color =
    abs < 10  ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40' :
    abs < 25  ? 'text-amber-400   bg-amber-950/60   border-amber-800/40'   :
                'text-red-400     bg-red-950/60     border-red-800/40'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${color}`}>
      {pct > 0 ? <TrendingUp size={10}/> : <ChevronDown size={10}/>}
      {pct > 0 ? '+' : ''}{pct.toFixed(1)}% vs BCRA
    </span>
  )
}

// ── sub-componente: tarjeta de una moneda ─────────────────────────────────────

function MonedaCard({
  moneda, color, label,
  latest, bcraHoy,
  onSave,
}: {
  moneda: ComexMoneda
  color: { border: string; badge: string; text: string; line: string }
  label: string
  latest: ComexCotizacion | null
  bcraHoy: number | null
  onSave: (moneda: ComexMoneda, valor: number, nota: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const [inputNota, setInputNota] = useState('')

  function handleSave() {
    const v = parseFloat(inputVal.replace(',', '.'))
    if (isNaN(v) || v <= 0) return
    onSave(moneda, v, inputNota.trim())
    setEditing(false)
    setInputVal('')
    setInputNota('')
  }

  const pct = latest && bcraHoy ? desvio(latest.valor_ars, bcraHoy) : null

  return (
    <div className={`bg-slate-900/60 border rounded-xl p-4 flex flex-col gap-3 ${color.border}`}>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${color.badge}`}>
          {label}
        </span>
        {!editing && (
          <button
            onClick={() => { setEditing(true); setInputVal(latest ? String(latest.valor_ars) : '') }}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Edit2 size={11}/> Actualizar
          </button>
        )}
      </div>

      {/* Valor actual */}
      <div>
        <p className="text-[11px] text-slate-500 mb-0.5">Tu cotización · ARS</p>
        <p className={`text-2xl font-bold tracking-tight ${color.text}`}>
          {latest ? `$ ${fmtARS(latest.valor_ars)}` : <span className="text-slate-600 text-base">Sin datos</span>}
        </p>
        {latest && (
          <p className="text-[10px] text-slate-600 mt-0.5">
            {dayjs(latest.created_at).format('DD/MM/YYYY HH:mm')}
          </p>
        )}
      </div>

      {/* BCRA */}
      <div className="bg-slate-800/60 rounded-lg px-3 py-2 flex items-center justify-between">
        <span className="text-[11px] text-slate-500">BCRA Divisa Venta</span>
        <span className="text-[13px] font-semibold text-slate-300">
          {bcraHoy != null ? `$ ${fmtARS(bcraHoy)}` : '—'}
        </span>
      </div>

      {/* Desvío */}
      {pct !== null && <DesvioChip pct={pct} />}

      {/* Form de edición inline */}
      {editing && (
        <div className="flex flex-col gap-2 pt-1 border-t border-slate-700/60">
          <div className="flex gap-2">
            <input
              type="number"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              placeholder="Nuevo valor ARS"
              autoFocus
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-amber-500/60"
            />
          </div>
          <input
            type="text"
            value={inputNota}
            onChange={e => setInputNota(e.target.value)}
            placeholder="Nota (opcional)"
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-amber-500/60"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1"
            >
              <Check size={12}/> Guardar
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 border border-slate-600 text-slate-400 hover:text-slate-200 text-xs rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Gráfico combinado ─────────────────────────────────────────────────────────

function CombinedChart({
  cotizaciones,
  bcraUSD,
  bcraEUR,
}: {
  cotizaciones: ComexCotizacion[]
  bcraUSD: BcraRateEntry[]
  bcraEUR: BcraRateEntry[]
}) {
  const chartData = useMemo(() => {
    // Todas las fechas únicas (BCRA tiene cobertura diaria)
    const fechas = Array.from(
      new Set([...bcraUSD, ...bcraEUR].map(r => r.fecha))
    ).sort()

    // Para cotizaciones propias: armar un mapa fecha → valor (valor vigente ese día)
    function buildPropioMap(moneda: ComexMoneda): Map<string, number> {
      const sorted = cotizaciones
        .filter(c => c.moneda === moneda)
        .sort((a, b) => a.created_at - b.created_at)
      const map = new Map<string, number>()
      let current: number | null = null
      for (const fecha of fechas) {
        const ts = new Date(fecha).getTime()
        for (const c of sorted) {
          if (c.created_at <= ts + 86_400_000) current = c.valor_ars
        }
        if (current !== null) map.set(fecha, current)
      }
      return map
    }

    const usdPropio = buildPropioMap('USD')
    const eurPropio = buildPropioMap('EUR')
    const usdBcra   = new Map(bcraUSD.map(r => [r.fecha, r.valor]))
    const eurBcra   = new Map(bcraEUR.map(r => [r.fecha, r.valor]))

    return fechas.map(fecha => ({
      fecha: dayjs(fecha).format('DD/MM'),
      usdPropio: usdPropio.get(fecha) ?? null,
      usdBcra:   usdBcra.get(fecha)   ?? null,
      eurPropio: eurPropio.get(fecha)  ?? null,
      eurBcra:   eurBcra.get(fecha)   ?? null,
    }))
  }, [cotizaciones, bcraUSD, bcraEUR])

  if (!chartData.length) return (
    <div className="h-48 flex items-center justify-center text-slate-600 text-sm">
      Sin datos para graficar
    </div>
  )

  // Mostrar solo 1 de cada 7 labels en el eje X para no saturar
  const tickInterval = Math.max(1, Math.floor(chartData.length / 10))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey="fecha"
          tick={{ fill: '#475569', fontSize: 9 }}
          interval={tickInterval}
          stroke="#1e293b"
        />
        <YAxis
          tick={{ fill: '#475569', fontSize: 9 }}
          tickFormatter={v => `$${Math.round(v / 1000)}k`}
          stroke="#1e293b"
          width={36}
        />
        <Tooltip
          contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: '#94a3b8' }}
          formatter={(v: number, name: string) => [
            v != null ? `$ ${fmtARS(v)}` : '—',
            name
          ]}
        />
        <Legend wrapperStyle={{ fontSize: 10, color: '#64748b' }} />
        <Line dataKey="usdPropio" name="USD propio"  stroke="#60a5fa" strokeWidth={2} dot={false} connectNulls />
        <Line dataKey="usdBcra"   name="USD BCRA"    stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />
        <Line dataKey="eurPropio" name="EUR propio"  stroke="#a78bfa" strokeWidth={2} dot={false} connectNulls />
        <Line dataKey="eurBcra"   name="EUR BCRA"    stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Tabla historial ───────────────────────────────────────────────────────────

function HistorialTable({
  cotizaciones,
  bcraUSD,
  bcraEUR,
}: {
  cotizaciones: ComexCotizacion[]
  bcraUSD: BcraRateEntry[]
  bcraEUR: BcraRateEntry[]
}) {
  const bcraMapUSD = useMemo(() => new Map(bcraUSD.map(r => [r.fecha, r.valor])), [bcraUSD])
  const bcraMapEUR = useMemo(() => new Map(bcraEUR.map(r => [r.fecha, r.valor])), [bcraEUR])

  if (!cotizaciones.length) return (
    <p className="text-center text-slate-600 text-sm py-8">Sin cotizaciones registradas</p>
  )

  return (
    <div className="overflow-y-auto max-h-72">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-slate-900">
          <tr>
            {['Fecha', 'Moneda', 'Valor propio', 'BCRA ese día', 'Desvío', 'Nota'].map(h => (
              <th key={h} className="text-left px-3 py-2 text-[10px] font-medium text-slate-500 uppercase tracking-wider border-b border-slate-700/60">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cotizaciones.map(c => {
            const fechaStr = dayjs(c.created_at).format('YYYY-MM-DD')
            const bcraMap  = c.moneda === 'USD' ? bcraMapUSD : bcraMapEUR
            const bcraVal  = bcraMap.get(fechaStr) ?? null
            const pct      = bcraVal ? desvio(c.valor_ars, bcraVal) : null
            return (
              <tr key={c.id} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                <td className="px-3 py-2 text-slate-500">{dayjs(c.created_at).format('DD/MM/YYYY HH:mm')}</td>
                <td className="px-3 py-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${c.moneda === 'USD' ? 'bg-blue-950/60 text-blue-400' : 'bg-purple-950/60 text-purple-400'}`}>
                    {c.moneda}
                  </span>
                </td>
                <td className="px-3 py-2 font-semibold text-slate-200">$ {fmtARS(c.valor_ars)}</td>
                <td className="px-3 py-2 text-slate-400">{bcraVal != null ? `$ ${fmtARS(bcraVal)}` : '—'}</td>
                <td className="px-3 py-2">
                  {pct !== null ? <DesvioChip pct={pct} /> : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-3 py-2 text-slate-500 max-w-[120px] truncate">{c.nota ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Modal principal ───────────────────────────────────────────────────────────

export default function CotizacionesModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'actual' | 'historial'>('actual')

  const { data: cotizaciones = [] } = useCotizaciones()
  const { data: bcraUSD = [], isLoading: loadingUSD } = useBcraRates('USD')
  const { data: bcraEUR = [], isLoading: loadingEUR } = useBcraRates('EUR')
  const addCotizacion  = useAddCotizacion()
  const refreshBcra    = useRefreshBcra()
  const [refreshing, setRefreshing] = useState(false)

  const latestUSD = useMemo(() =>
    cotizaciones.filter(c => c.moneda === 'USD').sort((a,b) => b.created_at - a.created_at)[0] ?? null,
    [cotizaciones]
  )
  const latestEUR = useMemo(() =>
    cotizaciones.filter(c => c.moneda === 'EUR').sort((a,b) => b.created_at - a.created_at)[0] ?? null,
    [cotizaciones]
  )

  const bcraHoyUSD = bcraUSD.length ? bcraUSD[bcraUSD.length - 1].valor : null
  const bcraHoyEUR = bcraEUR.length ? bcraEUR[bcraEUR.length - 1].valor : null
  const bcraFecha  = bcraUSD.length ? bcraUSD[bcraUSD.length - 1].fecha : null

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await Promise.all([refreshBcra.mutateAsync('USD'), refreshBcra.mutateAsync('EUR')])
    } finally {
      setRefreshing(false)
    }
  }

  function handleSave(moneda: ComexMoneda, valor_ars: number, nota: string) {
    addCotizacion.mutate({ moneda, valor_ars, nota })
  }

  const usdColor = {
    border: 'border-blue-900/60',
    badge:  'bg-blue-950/60 text-blue-400',
    text:   'text-blue-300',
    line:   '#60a5fa',
  }
  const eurColor = {
    border: 'border-purple-900/60',
    badge:  'bg-purple-950/60 text-purple-400',
    text:   'text-purple-300',
    line:   '#a78bfa',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-0 shrink-0">
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-slate-100">Cotizaciones USD / EUR</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors p-1">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 px-5 pt-3 border-b border-slate-700/60 shrink-0">
          {(['actual', 'historial'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors capitalize -mb-px ${
                tab === t
                  ? 'text-amber-400 border-amber-400'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              {t === 'actual' ? 'Actual' : 'Historial'}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {tab === 'actual' && (
            <>
              {/* BCRA refresh row */}
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <Clock size={11} />
                <span>BCRA · Divisa Venta</span>
                {bcraFecha && <span className="text-slate-600">· {dayjs(bcraFecha).format('DD/MM/YYYY')}</span>}
                {(loadingUSD || loadingEUR) && <RefreshCw size={10} className="animate-spin text-indigo-400" />}
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="ml-auto flex items-center gap-1 px-2 py-0.5 border border-slate-600 rounded-md hover:border-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
                >
                  <RefreshCw size={10} className={refreshing ? 'animate-spin' : ''} />
                  {refreshing ? 'Actualizando...' : 'Actualizar BCRA'}
                </button>
              </div>

              {/* Cards USD + EUR */}
              <div className="grid grid-cols-2 gap-3">
                <MonedaCard moneda="USD" color={usdColor} label="USD · Dólar"
                  latest={latestUSD} bcraHoy={bcraHoyUSD} onSave={handleSave} />
                <MonedaCard moneda="EUR" color={eurColor} label="EUR · Euro"
                  latest={latestEUR} bcraHoy={bcraHoyEUR} onSave={handleSave} />
              </div>

              {/* Gráfico */}
              <div>
                <p className="text-[11px] font-medium text-slate-500 mb-2">Últimos 6 meses</p>
                <CombinedChart cotizaciones={cotizaciones} bcraUSD={bcraUSD} bcraEUR={bcraEUR} />
              </div>
            </>
          )}

          {tab === 'historial' && (
            <HistorialTable cotizaciones={cotizaciones} bcraUSD={bcraUSD} bcraEUR={bcraEUR} />
          )}
        </div>
      </div>
    </div>
  )
}
