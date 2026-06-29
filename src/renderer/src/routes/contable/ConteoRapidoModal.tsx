import { useState, useMemo } from 'react'
import { X, Loader2, Hash, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '../../components/ui/utils'
import {
  useCreateCashCount,
  useCreateCashDifference,
  useSetCashboxStatus,
  parseCurrencies,
  fmtAmount,
} from '../../hooks/useCajas'
import type { CashboxWithBalance, CashCurrency } from '@shared/types'
import { CASH_DENOMINATIONS } from '@shared/types'
import { DenominationCounter, denomQty, denomTotal } from './DenominationCounter'

export default function ConteoRapidoModal({
  box,
  onClose,
  onSuccess,
}: {
  box: CashboxWithBalance
  onClose: () => void
  onSuccess: () => void
}) {
  const currencies  = parseCurrencies(box.currencies)
  const [activeTab,  setActiveTab]  = useState<CashCurrency>(currencies[0])
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [notes,      setNotes]      = useState('')
  const [error,      setError]      = useState<string | null>(null)

  const createCount = useCreateCashCount()
  const createDiff  = useCreateCashDifference()
  const setStatus   = useSetCashboxStatus()

  const saving = createCount.isPending || createDiff.isPending || setStatus.isPending

  function qty(cur: CashCurrency, denom: number): number {
    return denomQty(quantities, cur, denom)
  }

  const totals = useMemo<Partial<Record<CashCurrency, number>>>(() => {
    const result: Partial<Record<CashCurrency, number>> = {}
    for (const cur of currencies) {
      result[cur] = denomTotal(quantities, cur)
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantities, currencies])

  const diffs = useMemo<Partial<Record<CashCurrency, number>>>(() => {
    const result: Partial<Record<CashCurrency, number>> = {}
    for (const cur of currencies) {
      result[cur] = (totals[cur] ?? 0) - (box.balances[cur] ?? 0)
    }
    return result
  }, [totals, box.balances, currencies])

  const hasDiff = currencies.some(cur => (diffs[cur] ?? 0) !== 0)

  async function handleSubmit() {
    setError(null)
    try {
      const details = currencies.flatMap(cur =>
        CASH_DENOMINATIONS[cur].map(denom => ({
          currency: cur, denomination: denom, quantity: qty(cur, denom),
        }))
      )

      const countId = await createCount.mutateAsync({
        cashbox_id:     box.id,
        count_type:     'quick_count',
        notes,
        details,
        has_difference: hasDiff,
      })

      for (const cur of currencies) {
        const diff = diffs[cur] ?? 0
        if (diff !== 0) {
          await createDiff.mutateAsync({
            cashbox_id:     box.id,
            count_id:       countId,
            currency:       cur,
            system_amount:  box.balances[cur] ?? 0,
            counted_amount: totals[cur] ?? 0,
          })
        }
      }

      await setStatus.mutateAsync({ id: box.id, status: hasDiff ? 'with_difference' : 'ok' })

      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el conteo.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div>
            <p className="text-sm font-semibold text-slate-100">Conteo rápido</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{box.name} · {box.company?.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X size={18} />
          </button>
        </div>

        {/* Currency tabs */}
        {currencies.length > 1 && (
          <div className="flex px-5 pt-4 gap-2 shrink-0">
            {currencies.map(cur => (
              <button
                key={cur}
                onClick={() => setActiveTab(cur)}
                className={cn(
                  'px-4 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  activeTab === cur
                    ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700'
                    : 'bg-transparent text-slate-400 border-slate-700 hover:border-slate-500'
                )}
              >
                {cur}
              </button>
            ))}
          </div>
        )}

        {/* Denomination grid */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <DenominationCounter
            currency={activeTab}
            quantities={quantities}
            setQuantities={setQuantities}
          />

          {/* Resumen de diferencias */}
          <div className="bg-slate-800/60 rounded-xl p-3 space-y-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Resumen vs saldo del sistema</p>
            {currencies.map(cur => {
              const system  = box.balances[cur] ?? 0
              const counted = totals[cur] ?? 0
              const diff    = diffs[cur] ?? 0
              const hasD    = diff !== 0
              return (
                <div key={cur} className="space-y-0.5">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>{cur} — Saldo sistema</span>
                    <span className="font-mono">{fmtAmount(system, cur)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>{cur} — Contado</span>
                    <span className="font-mono">{fmtAmount(counted, cur)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-medium border-t border-slate-700 pt-1">
                    <span className={hasD ? 'text-red-400' : 'text-emerald-400'}>
                      Diferencia {cur}
                    </span>
                    <span className={cn('font-mono', hasD ? 'text-red-400' : 'text-emerald-400')}>
                      {diff >= 0 ? '+' : ''}{fmtAmount(diff, cur)}
                    </span>
                  </div>
                </div>
              )
            })}

            <div className={cn(
              'flex items-center gap-1.5 text-[11px] font-medium pt-1 border-t border-slate-700',
              hasDiff ? 'text-red-400' : 'text-emerald-400'
            )}>
              {hasDiff
                ? <><AlertTriangle size={11} /> Con diferencia — se registrará una discrepancia</>
                : <><CheckCircle2 size={11} /> Sin diferencia — caja cuadra</>
              }
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">
              Notas (opcional)
            </label>
            <input
              type="text"
              placeholder="Observaciones del conteo…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-5 py-3 border-t border-slate-800 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
              hasDiff
                ? 'bg-amber-900/40 text-amber-300 border-amber-700 hover:bg-amber-900/60'
                : 'bg-emerald-900/40 text-emerald-300 border-emerald-700 hover:bg-emerald-900/60',
              saving && 'opacity-40 cursor-not-allowed'
            )}
          >
            {saving
              ? <><Loader2 size={13} className="animate-spin" /> Guardando…</>
              : <><Hash size={13} /> {hasDiff ? 'Registrar con diferencia' : 'Confirmar conteo'}</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
