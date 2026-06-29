import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import {
  ResponsiveContainer, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts'
import { BarChart3, TrendingUp } from 'lucide-react'
import { cn } from '../../components/ui/utils'
import { useCashFlowSeries, fmtAmount } from '../../hooks/useCajas'
import type { CashboxWithBalance, CashCurrency } from '@shared/types'

// 12 meses incluyendo el actual
const MONTHS_BACK = 11

const AXIS_TICK = { fontSize: 11, fill: '#94a3b8' }
const AXIS_LINE = { stroke: '#334155' }
const CURRENCY_ORDER: CashCurrency[] = ['ARS', 'USD', 'EUR']

function compact(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${Math.round(v / 1_000)}k`
  return String(Math.round(v))
}

function ChartTooltip({ active, payload, label, currency }: {
  active?: boolean
  payload?: { dataKey: string; name: string; value: number; color: string }[]
  label?: string
  currency: CashCurrency
}) {
  if (!active || !payload?.length) return null
  const sym = currency === 'ARS' ? '$' : `${currency} `
  return (
    <div className="bg-slate-900/95 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
      {label && <p className="text-[11px] text-slate-400 mb-1 capitalize">{label}</p>}
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm" style={{ background: p.color }} />
            <span className="text-slate-300">{p.name}</span>
          </span>
          <span className="font-mono text-slate-100">{sym}{fmtAmount(p.value, currency)}</span>
        </div>
      ))}
    </div>
  )
}

function ChartCard({ title, icon: Icon, children }: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={13} className="text-slate-500" />
        <span className="text-xs font-medium text-slate-300">{title}</span>
      </div>
      {children}
    </div>
  )
}

function Empty({ label = 'Sin datos en el período' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center h-[180px] text-slate-600 text-xs">
      {label}
    </div>
  )
}

export default function CajasCharts({ boxes }: { boxes: CashboxWithBalance[] }) {
  const [currency, setCurrency] = useState<CashCurrency>('ARS')

  // Monedas presentes entre las cajas visibles (para el selector)
  const availableCurrencies = useMemo<CashCurrency[]>(() => {
    const set = new Set<CashCurrency>()
    for (const b of boxes) {
      for (const c of Object.keys(b.balances) as CashCurrency[]) set.add(c)
    }
    if (set.size === 0) set.add('ARS')
    return CURRENCY_ORDER.filter(c => set.has(c))
  }, [boxes])

  const cur = availableCurrencies.includes(currency) ? currency : availableCurrencies[0]

  // Rango: últimos 12 meses (fechas en formato YYYY-MM-DD)
  const { dateFrom, dateTo } = useMemo(() => ({
    dateFrom: dayjs().subtract(MONTHS_BACK, 'month').startOf('month').format('YYYY-MM-DD'),
    dateTo:   dayjs().endOf('month').format('YYYY-MM-DD'),
  }), [])

  const cashboxIds = useMemo(() => boxes.map(b => b.id), [boxes])
  const { data: series = [], isLoading } = useCashFlowSeries(dateFrom, dateTo, cashboxIds, cur)

  // Chart A — saldo actual por caja (descarta saldo 0, ordena desc)
  const balanceData = useMemo(
    () => boxes
      .map(b => ({ name: b.name, saldo: b.balances[cur] ?? 0 }))
      .filter(d => d.saldo !== 0)
      .sort((a, b) => b.saldo - a.saldo),
    [boxes, cur]
  )

  // Chart B — flujo mensual, rellenando meses faltantes con 0
  const flowData = useMemo(() => {
    const map: Record<string, { income: number; expense: number; net: number }> =
      Object.fromEntries(series.map(s => [s.period, s]))
    const out: { name: string; Ingresos: number; Egresos: number; Neto: number }[] = []
    for (let i = MONTHS_BACK; i >= 0; i--) {
      const d = dayjs().subtract(i, 'month')
      const row = map[d.format('YYYY-MM')]
      out.push({
        name:     d.locale('es').format('MMM YY'),
        Ingresos: row?.income ?? 0,
        Egresos:  row?.expense ?? 0,
        Neto:     row?.net ?? 0,
      })
    }
    return out
  }, [series])

  const hasFlow = flowData.some(d => d.Ingresos || d.Egresos)

  return (
    <div className="space-y-5">
      {availableCurrencies.length > 1 && (
        <div className="flex gap-2">
          {availableCurrencies.map(c => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                cur === c
                  ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700'
                  : 'text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200'
              )}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Saldo por caja" icon={TrendingUp}>
          {balanceData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={Math.max(180, balanceData.length * 40)}>
              <BarChart data={balanceData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" tickFormatter={compact} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
                <YAxis type="category" dataKey="name" width={112} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
                <Tooltip content={<ChartTooltip currency={cur} />} cursor={{ fill: 'rgba(148,163,184,0.06)' }} />
                <Bar dataKey="saldo" name="Saldo" radius={[0, 4, 4, 0]} barSize={18}>
                  {balanceData.map((d, i) => (
                    <Cell key={i} fill={d.saldo >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Flujo mensual (últimos 12 meses)" icon={BarChart3}>
          {isLoading ? <Empty label="Cargando…" /> : !hasFlow ? <Empty /> : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={flowData} margin={{ top: 4, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} className="capitalize" />
                <YAxis tickFormatter={compact} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} width={46} />
                <Tooltip content={<ChartTooltip currency={cur} />} cursor={{ fill: 'rgba(148,163,184,0.06)' }} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                <Bar dataKey="Ingresos" fill="#10b981" radius={[3, 3, 0, 0]} barSize={14} />
                <Bar dataKey="Egresos"  fill="#ef4444" radius={[3, 3, 0, 0]} barSize={14} />
                <Line type="monotone" dataKey="Neto" stroke="#38bdf8" strokeWidth={2} dot={{ r: 2.5, fill: '#38bdf8', strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  )
}
