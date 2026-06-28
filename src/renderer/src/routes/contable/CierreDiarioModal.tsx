import { useState, useMemo } from 'react'
import { X, Loader2, Hash, AlertTriangle, CheckCircle2, MoonStar } from 'lucide-react'
import { cn } from '../../components/ui/utils'
import {
  useCreateCashCount,
  useCreateCashDifference,
  useSetCashboxStatus,
  useDailyMovementsSummary,
  parseCurrencies,
  fmtAmount,
} from '../../hooks/useCajas'
import type { CashboxWithBalance, CashCurrency } from '@shared/types'
import { CASH_DENOMINATIONS } from '@shared/types'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function fmtDenom(denom: number, cur: CashCurrency): string {
  if (cur === 'ARS') return `$ ${new Intl.NumberFormat('es-AR').format(denom)}`
  if (cur === 'USD') return `USD ${denom}`
  return `€ ${denom}`
}

const TYPE_LABELS: Record<string, string> = {
  income:      'Ingresos',
  expense:     'Egresos',
  transfer:    'Transferencias',
  adjustment:  'Ajustes',
  bank_deposit:'Depósitos',
  opening:     'Apertura',
  correction:  'Correcciones',
}

export default function CierreDiarioModal({
  box,
  onClose,
  onSuccess,
}: {
  box: CashboxWithBalance
  onClose: () => void
  onSuccess: () => void
}) {
  const currencies   = parseCurrencies(box.currencies)
  const date         = today()

  const [activeTab,  setActiveTab]  = useState<CashCurrency>(currencies[0])
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [notes,      setNotes]      = useState('')
  const [error,      setError]      = useState<string | null>(null)

  const createCount = useCreateCashCount()
  const createDiff  = useCreateCashDifference()
  const setStatus   = useSetCashboxStatus()
  const { data: summary = [] } = useDailyMovementsSummary(box.id, date)

  const saving = createCount.isPending || createDiff.isPending || setStatus.isPending

  function qty(cur: CashCurrency, denom: number): number {
    return parseInt(quantities[`${cur}:${denom}`] || '0', 10) || 0
  }

  const totals = useMemo<Partial<Record<CashCurrency, number>>>(() => {
    const result: Partial<Record<CashCurrency, number>> = {}
    for (const cur of currencies) {
      result[cur] = CASH_DENOMINATIONS[cur].reduce((sum, d) => sum + d * qty(cur, d), 0)
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

  // Summary grouped by type and currency
  const summaryByType = useMemo(() => {
    const map: Record<string, Partial<Record<CashCurrency, number>>> = {}
    for (const row of summary) {
      if (!map[row.type]) map[row.type] = {}
      map[row.type][row.currency as CashCurrency] = row.total
    }
    return map
  }, [summary])

  const movementTypes = Object.keys(summaryByType)

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
        count_type:     'daily_close',
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

      await setStatus.mutateAsync({
        id:     box.id,
        status: hasDiff ? 'with_difference' : 'closed',
      })

      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar el cierre.')
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
            <div className="flex items-center gap-2">
              <MoonStar size={14} className="text-sky-400" />
              <p className="text-sm font-semibold text-slate-100">Cierre diario</p>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {box.name} · {box.company?.name} · {new Date(date).toLocaleDateString('es-AR')}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* Resumen del día */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
              Movimientos del día
            </p>
            {movementTypes.length === 0 ? (
              <p className="text-xs text-slate-600 italic">Sin movimientos registrados hoy.</p>
            ) : (
              <div className="bg-slate-800/60 rounded-xl divide-y divide-slate-700/50">
                {movementTypes.map(type => (
                  <div key={type} className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-slate-400">
                      {TYPE_LABELS[type] ?? type}
                    </span>
                    <div className="flex gap-3">
                      {currencies.map(cur => {
                        const val = summaryByType[type][cur]
                        if (val === undefined) return null
                        return (
                          <span
                            key={cur}
                            className={cn(
                              'text-xs font-mono',
                              val >= 0 ? 'text-emerald-400' : 'text-red-400'
                            )}
                          >
                            {cur} {val >= 0 ? '+' : ''}{fmtAmount(val, cur)}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Saldo del sistema */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
              Saldo del sistema al cierre
            </p>
            <div className="bg-slate-800/60 rounded-xl px-3 py-2 flex gap-4">
              {currencies.map(cur => (
                <div key={cur}>
                  <span className="text-[10px] text-slate-500">{cur} </span>
                  <span className="text-sm font-mono font-semibold text-slate-100">
                    {fmtAmount(box.balances[cur] ?? 0, cur)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Conteo de cierre */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
              Conteo de cierre
            </p>

            {currencies.length > 1 && (
              <div className="flex gap-2 mb-3">
                {currencies.map(cur => (
                  <button
                    key={cur}
                    onClick={() => setActiveTab(cur)}
                    className={cn(
                      'px-4 py-1.5 rounded-full text-xs font-medium border transition-colors',
                      activeTab === cur
                        ? 'bg-sky-900/40 text-sky-300 border-sky-700'
                        : 'bg-transparent text-slate-400 border-slate-700 hover:border-slate-500'
                    )}
                  >
                    {cur}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-1">
              <div className="grid grid-cols-3 gap-2 mb-1">
                <span className="text-[10px] text-slate-600 uppercase tracking-wider">Denominación</span>
                <span className="text-[10px] text-slate-600 uppercase tracking-wider text-center">Cantidad</span>
                <span className="text-[10px] text-slate-600 uppercase tracking-wider text-right">Subtotal</span>
              </div>

              {CASH_DENOMINATIONS[activeTab].map(denom => {
                const q   = qty(activeTab, denom)
                const sub = denom * q
                return (
                  <div key={denom} className="grid grid-cols-3 gap-2 items-center">
                    <span className="text-xs font-mono text-slate-400">
                      {fmtDenom(denom, activeTab)}
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={quantities[`${activeTab}:${denom}`] ?? ''}
                      onChange={e => setQuantities(prev => ({
                        ...prev,
                        [`${activeTab}:${denom}`]: e.target.value.replace(/\D/g, ''),
                      }))}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-100 font-mono text-center focus:border-slate-500 outline-none w-full"
                    />
                    <span className={cn('text-xs font-mono text-right', sub > 0 ? 'text-slate-200' : 'text-slate-600')}>
                      {sub > 0 ? fmtAmount(sub, activeTab) : '—'}
                    </span>
                  </div>
                )
              })}

              <div className="grid grid-cols-3 gap-2 items-center border-t border-slate-700 pt-2 mt-2">
                <span className="text-xs text-slate-400 font-medium">Total contado</span>
                <span />
                <span className="text-sm font-mono font-semibold text-slate-100 text-right">
                  {fmtAmount(totals[activeTab] ?? 0, activeTab)}
                </span>
              </div>
            </div>
          </div>

          {/* Diferencias */}
          <div className="bg-slate-800/60 rounded-xl p-3 space-y-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Resultado del cierre</p>
            {currencies.map(cur => {
              const system  = box.balances[cur] ?? 0
              const counted = totals[cur] ?? 0
              const diff    = diffs[cur] ?? 0
              return (
                <div key={cur} className="flex justify-between text-xs">
                  <span className="text-slate-400">{cur} — diferencia</span>
                  <span className={cn(
                    'font-mono font-medium',
                    diff === 0 ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {diff === 0
                      ? 'Cuadra'
                      : `${diff >= 0 ? '+' : ''}${fmtAmount(diff, cur)}`
                    }
                  </span>
                </div>
              )
            })}
            <div className={cn(
              'flex items-center gap-1.5 text-[11px] font-medium pt-1 border-t border-slate-700',
              hasDiff ? 'text-amber-400' : 'text-emerald-400'
            )}>
              {hasDiff
                ? <><AlertTriangle size={11} /> La caja quedará con diferencia pendiente</>
                : <><CheckCircle2 size={11} /> La caja quedará cerrada sin diferencias</>
              }
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">
              Notas de cierre (opcional)
            </label>
            <input
              type="text"
              placeholder="Observaciones…"
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
                : 'bg-sky-900/40 text-sky-300 border-sky-700 hover:bg-sky-900/60',
              saving && 'opacity-40 cursor-not-allowed'
            )}
          >
            {saving
              ? <><Loader2 size={13} className="animate-spin" /> Cerrando…</>
              : <><Hash size={13} /> Confirmar cierre</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
