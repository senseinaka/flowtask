import { useState, useMemo } from 'react'
import {
  DollarSign, TrendingUp, RefreshCw, AlertTriangle, Check,
  Clock, ChevronDown, Edit2, Bell, TrendingDown
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts'
import { useCotizaciones, useAddCotizacion, useBcraRates, useRefreshBcra, useBcraCotizacionHoy } from '../../hooks/useComex'
import type { ComexMoneda, ComexCotizacion, BcraRateEntry, BcraCotizacionHoy } from '@shared/types'
import CotizacionAlarmasModal from './CotizacionAlarmasModal'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
dayjs.locale('es')

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

// ── Widget billete/divisa de hoy ──────────────────────────────────────────────

function DiffChip({ pct }: { pct: number }) {
  const abs = Math.abs(pct)
  const color =
    abs < 2  ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40' :
    abs < 5  ? 'text-amber-400   bg-amber-950/60   border-amber-800/40'   :
               'text-red-400     bg-red-950/60     border-red-800/40'
  const Icon = pct >= 0 ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${color}`}>
      <Icon size={9} />
      {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

function BilletesDivisaWidget({
  hoy,
  cotizaciones,
  onAlarmas,
}: {
  hoy: BcraCotizacionHoy[]
  cotizaciones: ComexCotizacion[]
  onAlarmas: () => void
}) {
  const latestNaka = (moneda: ComexMoneda) =>
    cotizaciones
      .filter(c => c.moneda === moneda)
      .sort((a, b) => b.created_at - a.created_at)[0]?.valor_ars ?? null

  const MONEDAS: { moneda: ComexMoneda; label: string; colorLabel: string; colorVal: string }[] = [
    { moneda: 'USD', label: 'Dólar',  colorLabel: 'text-blue-400',   colorVal: 'text-blue-300'   },
    { moneda: 'EUR', label: 'Euro',   colorLabel: 'text-purple-400', colorVal: 'text-purple-300' },
  ]

  return (
    <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-medium text-slate-400">
          BCRA · cotización oficial hoy
        </p>
        <button
          onClick={onAlarmas}
          className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 border border-amber-800/40 rounded-lg px-2.5 py-1 transition-colors"
        >
          <Bell size={11} /> Alarmas
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {MONEDAS.map(({ moneda, label, colorLabel, colorVal }) => {
          const entry    = hoy.find(h => h.moneda === moneda)
          const naka     = latestNaka(moneda)
          const billete  = entry?.billete_venta ?? null
          const divisa   = entry?.divisa_venta  ?? null

          const diffBillete = naka && billete ? (billete - naka) / naka * 100 : null
          const diffDivisa  = naka && divisa  ? (divisa  - naka) / naka * 100 : null

          return (
            <div key={moneda} className="bg-slate-900/60 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${colorLabel}`}>{moneda}</span>
                <span className="text-[10px] text-slate-600">{label}</span>
              </div>

              {/* Divisa */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-slate-600 uppercase tracking-wide">divisa venta</p>
                  <p className={`text-base font-bold ${colorVal}`}>
                    {divisa != null ? `$${fmtARS(divisa)}` : <span className="text-slate-600 text-sm">—</span>}
                  </p>
                </div>
                {diffDivisa !== null && <DiffChip pct={diffDivisa} />}
              </div>

              {/* Billete */}
              <div className="flex items-center justify-between border-t border-slate-700/40 pt-2">
                <div>
                  <p className="text-[9px] text-slate-600 uppercase tracking-wide">billete venta</p>
                  <p className="text-base font-bold text-slate-300">
                    {billete != null ? `$${fmtARS(billete)}` : <span className="text-slate-600 text-sm">—</span>}
                  </p>
                </div>
                {diffBillete !== null && <DiffChip pct={diffBillete} />}
              </div>

              {naka && (
                <p className="text-[9px] text-slate-600 pt-0.5">
                  Naka: ${fmtARS(naka)}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Tarjeta de moneda con formulario de edición ──────────────────────────────

function MonedaCard({
  moneda, color, label,
  latest, bcraHoy,
  onSave,
}: {
  moneda: ComexMoneda
  color: { border: string; badge: string; text: string }
  label: string
  latest: ComexCotizacion | null
  bcraHoy: number | null
  onSave: (moneda: ComexMoneda, valor: number, nota: string, created_at_ms: number) => void
}) {
  const [editing, setEditing]   = useState(false)
  const [inputVal, setInputVal] = useState('')
  const [inputNota, setInputNota] = useState('')
  const [inputFecha, setInputFecha] = useState(dayjs().format('YYYY-MM-DD'))

  function handleEdit() {
    setEditing(true)
    setInputVal(latest ? String(latest.valor_ars) : '')
    setInputFecha(dayjs().format('YYYY-MM-DD'))
    setInputNota('')
  }

  function handleSave() {
    const v = parseFloat(inputVal.replace(',', '.'))
    if (isNaN(v) || v <= 0) return
    // Usar mediodía de la fecha elegida para evitar problemas de TZ
    const ts = dayjs(inputFecha).hour(12).minute(0).second(0).valueOf()
    onSave(moneda, v, inputNota.trim(), ts)
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
            onClick={handleEdit}
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

      {pct !== null && <DesvioChip pct={pct} />}

      {/* Form inline */}
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
            type="date"
            value={inputFecha}
            max={dayjs().format('YYYY-MM-DD')}
            onChange={e => setInputFecha(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-300 outline-none focus:border-amber-500/60"
          />
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

// ── Gráfico ───────────────────────────────────────────────────────────────────

function CombinedChart({ cotizaciones, bcraUSD, bcraEUR }: {
  cotizaciones: ComexCotizacion[]
  bcraUSD: BcraRateEntry[]
  bcraEUR: BcraRateEntry[]
}) {
  const [rangeMonths, setRangeMonths] = useState<1 | 3 | 6>(6)
  const [view, setView] = useState<'both' | 'USD' | 'EUR'>('both')

  const fullData = useMemo(() => {
    const fechas = Array.from(
      new Set([...bcraUSD, ...bcraEUR].map(r => r.fecha))
    ).sort()

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
      ts:        new Date(fecha).getTime(),
      fecha:     dayjs(fecha).format('DD/MM'),
      usdPropio: usdPropio.get(fecha) ?? null,
      usdBcra:   usdBcra.get(fecha)   ?? null,
      eurPropio: eurPropio.get(fecha)  ?? null,
      eurBcra:   eurBcra.get(fecha)   ?? null,
    }))
  }, [cotizaciones, bcraUSD, bcraEUR])

  // Zoom temporal: recorta a los últimos N meses
  const chartData = useMemo(() => {
    if (!fullData.length) return []
    const cutoff = dayjs().subtract(rangeMonths, 'month').valueOf()
    const filtered = fullData.filter(d => d.ts >= cutoff)
    return filtered.length ? filtered : fullData
  }, [fullData, rangeMonths])

  // Zoom al valor: dominio del eje Y ajustado al min/max visible (no desde 0),
  // según la(s) moneda(s) elegida(s). Padding del 8% para que no toque los bordes.
  const yDomain = useMemo<[number, number] | undefined>(() => {
    const useUSD = view === 'both' || view === 'USD'
    const useEUR = view === 'both' || view === 'EUR'
    const vals: number[] = []
    for (const d of chartData) {
      if (useUSD) { if (d.usdPropio != null) vals.push(d.usdPropio); if (d.usdBcra != null) vals.push(d.usdBcra) }
      if (useEUR) { if (d.eurPropio != null) vals.push(d.eurPropio); if (d.eurBcra != null) vals.push(d.eurBcra) }
    }
    if (!vals.length) return undefined
    const min = Math.min(...vals), max = Math.max(...vals)
    const pad = Math.max((max - min) * 0.08, max * 0.004)
    return [Math.floor(min - pad), Math.ceil(max + pad)]
  }, [chartData, view])

  if (!fullData.length) return (
    <div className="h-48 flex items-center justify-center text-slate-600 text-sm">
      Sin datos BCRA — actualizá primero
    </div>
  )

  const tickInterval = Math.max(1, Math.floor(chartData.length / 10))
  const showUSD = view === 'both' || view === 'USD'
  const showEUR = view === 'both' || view === 'EUR'

  const rangeBtns: Array<{ k: 1 | 3 | 6; label: string }> = [
    { k: 1, label: '1M' }, { k: 3, label: '3M' }, { k: 6, label: '6M' },
  ]
  const viewBtns: Array<{ k: 'both' | 'USD' | 'EUR'; label: string }> = [
    { k: 'both', label: 'Ambas' }, { k: 'USD', label: 'USD' }, { k: 'EUR', label: 'EUR' },
  ]

  return (
    <div>
      {/* Controles de zoom */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex gap-1">
          {viewBtns.map(b => (
            <button
              key={b.k}
              onClick={() => setView(b.k)}
              className={`px-2.5 py-0.5 text-[11px] rounded-md border transition-colors ${
                view === b.k
                  ? 'bg-slate-700 border-slate-500 text-slate-100'
                  : 'border-slate-700 text-slate-500 hover:text-slate-300'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {rangeBtns.map(b => (
            <button
              key={b.k}
              onClick={() => setRangeMonths(b.k)}
              className={`px-2.5 py-0.5 text-[11px] rounded-md border transition-colors ${
                rangeMonths === b.k
                  ? 'bg-amber-500/20 border-amber-600/50 text-amber-300'
                  : 'border-slate-700 text-slate-500 hover:text-slate-300'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="fecha" tick={{ fill: '#475569', fontSize: 9 }} interval={tickInterval} stroke="#1e293b" />
          <YAxis
            tick={{ fill: '#475569', fontSize: 9 }}
            domain={yDomain ?? ['auto', 'auto']}
            tickFormatter={v => '$' + Math.round(v).toLocaleString('es-AR')}
            stroke="#1e293b"
            width={56}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
            labelStyle={{ color: '#94a3b8' }}
            formatter={(v: number, name: string) => [v != null ? `$ ${fmtARS(v)}` : '—', name]}
          />
          <Legend wrapperStyle={{ fontSize: 10, color: '#64748b' }} />
          {showUSD && <Line dataKey="usdPropio" name="USD propio" stroke="#60a5fa" strokeWidth={2} dot={false} connectNulls />}
          {showUSD && <Line dataKey="usdBcra"   name="USD BCRA"   stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />}
          {showEUR && <Line dataKey="eurPropio" name="EUR propio" stroke="#a78bfa" strokeWidth={2} dot={false} connectNulls />}
          {showEUR && <Line dataKey="eurBcra"   name="EUR BCRA"   stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Historial ─────────────────────────────────────────────────────────────────

function HistorialTable({ cotizaciones, bcraUSD, bcraEUR }: {
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
    <table className="w-full text-xs">
      <thead>
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
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function CotizacionesPage() {
  const [tab, setTab]             = useState<'actual' | 'historial'>('actual')
  const [showAlarmas, setShowAlarmas] = useState(false)

  const { data: cotizaciones = [] }               = useCotizaciones()
  const { data: bcraUSD = [], isLoading: loadingUSD } = useBcraRates('USD')
  const { data: bcraEUR = [], isLoading: loadingEUR } = useBcraRates('EUR')
  const { data: cotizHoy = [] }                   = useBcraCotizacionHoy()
  const addCotizacion = useAddCotizacion()
  const refreshBcra   = useRefreshBcra()
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

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
    setRefreshError(null)
    try {
      await Promise.all([refreshBcra.mutateAsync('USD'), refreshBcra.mutateAsync('EUR')])
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : String(e))
    } finally {
      setRefreshing(false)
    }
  }

  function handleSave(moneda: ComexMoneda, valor_ars: number, nota: string, created_at_ms: number) {
    addCotizacion.mutate({ moneda, valor_ars, nota: nota || undefined, created_at_ms })
  }

  const usdColor = { border: 'border-blue-900/60',   badge: 'bg-blue-950/60 text-blue-400',     text: 'text-blue-300'   }
  const eurColor = { border: 'border-purple-900/60', badge: 'bg-purple-950/60 text-purple-400', text: 'text-purple-300' }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign size={20} className="text-amber-400" />
          <div>
            <h1 className="text-lg font-bold text-white">Cotizaciones USD / EUR</h1>
            <p className="text-xs text-slate-400">Historial propio vs. BCRA Divisa Venta</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-slate-700/60">
        {(['actual', 'historial'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
              tab === t
                ? 'text-amber-400 border-amber-400'
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            {t === 'actual' ? 'Actual' : 'Historial'}
          </button>
        ))}
      </div>

      {showAlarmas && <CotizacionAlarmasModal onClose={() => setShowAlarmas(false)} />}

      {tab === 'actual' && (
        <>
          {/* Cotización billete/divisa hoy */}
          {cotizHoy.length > 0 && (
            <BilletesDivisaWidget
              hoy={cotizHoy}
              cotizaciones={cotizaciones}
              onAlarmas={() => setShowAlarmas(true)}
            />
          )}

          {/* BCRA refresh */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Clock size={11} />
            <span>BCRA · Divisa Venta</span>
            {bcraFecha && <span className="text-slate-600">· actualizado al {dayjs(bcraFecha).format('DD/MM/YYYY')}</span>}
            {(loadingUSD || loadingEUR) && <RefreshCw size={10} className="animate-spin text-indigo-400" />}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="ml-auto flex items-center gap-1 px-2.5 py-1 border border-slate-600 rounded-md text-slate-400 hover:border-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={10} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Actualizando...' : 'Actualizar BCRA'}
            </button>
          </div>

          {refreshError && (
            <div className="flex items-start gap-2 px-3 py-2 bg-red-950/30 border border-red-800/40 rounded-lg text-[11px] text-red-400">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <span className="font-mono break-all">{refreshError}</span>
            </div>
          )}

          {/* Cards */}
          <div className="grid grid-cols-2 gap-4">
            <MonedaCard moneda="USD" color={usdColor} label="USD · Dólar"
              latest={latestUSD} bcraHoy={bcraHoyUSD} onSave={handleSave} />
            <MonedaCard moneda="EUR" color={eurColor} label="EUR · Euro"
              latest={latestEUR} bcraHoy={bcraHoyEUR} onSave={handleSave} />
          </div>

          {/* Gráfico */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
            <p className="text-[11px] font-medium text-slate-500 mb-3">Evolución últimos 6 meses</p>
            <CombinedChart cotizaciones={cotizaciones} bcraUSD={bcraUSD} bcraEUR={bcraEUR} />
          </div>
        </>
      )}

      {tab === 'historial' && (
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl overflow-hidden">
          <HistorialTable cotizaciones={cotizaciones} bcraUSD={bcraUSD} bcraEUR={bcraEUR} />
        </div>
      )}
    </div>
  )
}
