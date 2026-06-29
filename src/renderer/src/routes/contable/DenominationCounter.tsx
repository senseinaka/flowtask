import type { CashCurrency } from '@shared/types'
import { CASH_DENOMINATIONS } from '@shared/types'
import { cn } from '../../components/ui/utils'
import { fmtAmount } from '../../hooks/useCajas'

// Contador de billetes por denominación, reutilizable. El estado `quantities`
// vive en el componente padre (keyed `${currency}:${denom}`), así el padre puede
// leer el total y el desglose. Lo usan ConteoRapidoModal y NuevoMovimientoModal.

export function fmtDenom(denom: number, cur: CashCurrency): string {
  if (cur === 'ARS') return `$ ${new Intl.NumberFormat('es-AR').format(denom)}`
  if (cur === 'USD') return `USD ${denom}`
  return `€ ${denom}`
}

export function denomQty(quantities: Record<string, string>, cur: CashCurrency, denom: number): number {
  return parseInt(quantities[`${cur}:${denom}`] || '0', 10) || 0
}

export function denomTotal(quantities: Record<string, string>, cur: CashCurrency): number {
  return CASH_DENOMINATIONS[cur].reduce((sum, d) => sum + d * denomQty(quantities, cur, d), 0)
}

export function DenominationCounter({
  currency,
  quantities,
  setQuantities,
  showTotal = true,
  totalLabel = 'Total contado',
}: {
  currency: CashCurrency
  quantities: Record<string, string>
  setQuantities: React.Dispatch<React.SetStateAction<Record<string, string>>>
  showTotal?: boolean
  totalLabel?: string
}) {
  const total = denomTotal(quantities, currency)

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-3 gap-2 mb-2">
        <span className="text-[10px] text-slate-600 uppercase tracking-wider">Denominación</span>
        <span className="text-[10px] text-slate-600 uppercase tracking-wider text-center">Cantidad</span>
        <span className="text-[10px] text-slate-600 uppercase tracking-wider text-right">Subtotal</span>
      </div>

      {CASH_DENOMINATIONS[currency].map(denom => {
        const q   = denomQty(quantities, currency, denom)
        const sub = denom * q
        return (
          <div key={denom} className="grid grid-cols-3 gap-2 items-center">
            <span className="text-xs font-mono text-slate-400">
              {fmtDenom(denom, currency)}
            </span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={quantities[`${currency}:${denom}`] ?? ''}
              onChange={e => setQuantities(prev => ({
                ...prev,
                [`${currency}:${denom}`]: e.target.value.replace(/\D/g, ''),
              }))}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-100 font-mono text-center focus:border-slate-500 outline-none w-full"
            />
            <span className={cn(
              'text-xs font-mono text-right',
              sub > 0 ? 'text-slate-200' : 'text-slate-600'
            )}>
              {sub > 0 ? fmtAmount(sub, currency) : '—'}
            </span>
          </div>
        )
      })}

      {showTotal && (
        <div className="grid grid-cols-3 gap-2 items-center border-t border-slate-700 pt-2 mt-2">
          <span className="text-xs text-slate-400 font-medium">{totalLabel}</span>
          <span />
          <span className="text-sm font-mono font-semibold text-slate-100 text-right">
            {fmtAmount(total, currency)}
          </span>
        </div>
      )}
    </div>
  )
}
