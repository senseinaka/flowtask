import { RECON_ESTADO_LABELS, RECON_ESTADO_COLORS, type ReconEstado } from '@shared/types'
import { useReconKPIs } from '../../hooks/useRecon'
import { TrendingUp, AlertCircle } from 'lucide-react'

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

const ESTADO_ORDER: ReconEstado[] = [
  'conciliado', 'dif_menor', 'conciliado_monto', 'diferencia_monto',
  'rechazado_ml', 'no_cobrado_ml',
  'sin_match_nave', 'sin_match_ml', 'sin_match_trans',
  'pendiente', 'requiere_revision', 'manual',
]

export default function ReconTabKPIs({
  periodId, onDrillDown,
}: {
  periodId: string
  onDrillDown: (estado: ReconEstado) => void
}) {
  const { data: kpis } = useReconKPIs(periodId)

  if (!kpis) {
    return (
      <div className="text-center text-slate-500 py-16 text-sm">
        <AlertCircle size={20} className="mx-auto mb-2 text-slate-600" />
        Sin datos de KPIs. Conciliá el período primero.
      </div>
    )
  }

  const pct = kpis.totalMonto > 0 ? (kpis.conciliadoMonto / kpis.totalMonto) * 100 : 0
  const pctCount = kpis.total > 0 ? ((kpis.byEstado?.conciliado?.count ?? 0) / kpis.total) * 100 : 0

  const estadoEntries: [ReconEstado, { count: number; monto: number }][] = ESTADO_ORDER
    .filter(e => (kpis.byEstado as Record<string, { count: number; monto: number }>)?.[e]?.count > 0)
    .map(e => [e, (kpis.byEstado as Record<string, { count: number; monto: number }>)[e]])

  return (
    <div className="space-y-5">

      {/* Resumen 4 cards */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard
          label="Facturas totales"
          value={String(kpis.total)}
          sub={`${pctCount.toFixed(0)}% conciliadas`}
        />
        <SummaryCard
          label="Monto total"
          value={`$${fmt(kpis.totalMonto)}`}
        />
        <SummaryCard
          label="Conciliado"
          value={`$${fmt(kpis.conciliadoMonto)}`}
          sub={`${pct.toFixed(1)}% del total`}
          accent="#10b981"
          onClick={() => onDrillDown('conciliado')}
        />
        <SummaryCard
          label="Pendiente / revisión"
          value={`$${fmt(kpis.pendienteMonto)}`}
          accent="#f59e0b"
          onClick={() => onDrillDown('pendiente')}
        />
      </div>

      {/* Barra de conciliación (stacked) */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <p className="text-xs text-slate-400 mb-3 font-medium">Distribución por monto</p>
        <div
          className="h-4 rounded-full overflow-hidden flex"
          style={{ gap: '1px' }}
        >
          {estadoEntries
            .filter(([, v]) => v.monto > 0)
            .map(([estado, v]) => (
              <div
                key={estado}
                title={`${RECON_ESTADO_LABELS[estado]}: $${fmt(v.monto)}`}
                onClick={() => onDrillDown(estado)}
                style={{ flex: v.monto, backgroundColor: RECON_ESTADO_COLORS[estado] }}
                className="cursor-pointer hover:opacity-80 transition-opacity"
              />
            ))}
        </div>
        {/* Leyenda */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
          {estadoEntries.map(([estado]) => (
            <button
              key={estado}
              onClick={() => onDrillDown(estado)}
              className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: RECON_ESTADO_COLORS[estado] }}
              />
              {RECON_ESTADO_LABELS[estado]}
            </button>
          ))}
        </div>
      </div>

      {/* Desglose por estado */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <TrendingUp size={12} /> Desglose por estado
        </p>
        <div className="space-y-2">
          {estadoEntries.map(([estado, v]) => {
            const pctLocal = kpis.totalMonto > 0 ? (v.monto / kpis.totalMonto) * 100 : 0
            return (
              <button
                key={estado}
                onClick={() => onDrillDown(estado)}
                className="w-full group"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: RECON_ESTADO_COLORS[estado] }}
                  />
                  <span className="text-xs text-slate-300 flex-1 text-left group-hover:text-white transition-colors">
                    {RECON_ESTADO_LABELS[estado]}
                  </span>
                  <span className="text-xs text-slate-400 tabular-nums w-6 text-right">{v.count}</span>
                  <span className="text-[10px] text-slate-600 tabular-nums w-8 text-right">{pctLocal.toFixed(0)}%</span>
                  <span className="text-xs text-slate-400 font-mono tabular-nums w-32 text-right">
                    ${fmt(v.monto)}
                  </span>
                </div>
                {/* Mini barra */}
                <div className="ml-5 mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pctLocal}%`, backgroundColor: RECON_ESTADO_COLORS[estado] }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-[10px] text-slate-600 text-center">
        Hacé click en cualquier estado para ver el detalle en la pestaña Resultados
      </p>
    </div>
  )
}

function SummaryCard({
  label, value, sub, accent, onClick,
}: {
  label: string
  value: string
  sub?: string
  accent?: string
  onClick?: () => void
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`bg-slate-800 border border-slate-700 rounded-xl p-4 text-left w-full ${onClick ? 'hover:border-amber-700/50 cursor-pointer transition-colors' : ''}`}
    >
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-lg font-bold mt-1" style={{ color: accent ?? 'white' }}>{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
    </Tag>
  )
}
