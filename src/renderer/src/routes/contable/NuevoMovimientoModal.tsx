import { useState, useMemo, useEffect } from 'react'
import { X, Loader2, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, ChevronDown } from 'lucide-react'
import { cn } from '../../components/ui/utils'
import {
  useCashCategories,
  useCreateCashMovement,
  useCreateTransfer,
  parseCurrencies,
  fmtAmount,
} from '../../hooks/useCajas'
import type { CashboxWithBalance, CashCurrency } from '@shared/types'

type Tipo = 'income' | 'expense' | 'transfer'

const TIPO_CONFIG: Record<Tipo, { label: string; icon: React.ElementType; color: string }> = {
  income:   { label: 'Ingreso',       icon: ArrowDownCircle,  color: 'emerald' },
  expense:  { label: 'Egreso',        icon: ArrowUpCircle,    color: 'red'     },
  transfer: { label: 'Transferencia', icon: ArrowLeftRight,   color: 'sky'     },
}

const TIPO_COLOR: Record<string, string> = {
  emerald: 'bg-emerald-900/40 text-emerald-300 border-emerald-700',
  red:     'bg-red-900/30 text-red-300 border-red-800',
  sky:     'bg-sky-900/30 text-sky-300 border-sky-800',
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function parseNum(s: string): number {
  return parseFloat(s.replace(',', '.')) || 0
}

export default function NuevoMovimientoModal({
  box,
  allBoxes,
  initialTipo,
  onClose,
  onSuccess,
}: {
  box: CashboxWithBalance
  allBoxes: CashboxWithBalance[]
  initialTipo: Tipo
  onClose: () => void
  onSuccess: () => void
}) {
  const currencies  = parseCurrencies(box.currencies)
  const createMov   = useCreateCashMovement()
  const createTrans = useCreateTransfer()

  const [tipo,         setTipo]         = useState<Tipo>(initialTipo)
  const [categoryId,   setCategoryId]   = useState('')
  const [destId,       setDestId]       = useState('')
  const [amounts,      setAmounts]      = useState<Record<string, string>>({})
  const [refDate,      setRefDate]      = useState(today())
  const [notes,        setNotes]        = useState('')
  const [error,        setError]        = useState<string | null>(null)

  const { data: categories = [] } = useCashCategories(
    tipo === 'transfer' ? undefined : tipo
  )

  // Reset category when tipo changes
  useEffect(() => { setCategoryId('') }, [tipo])

  const otherBoxes = allBoxes.filter(b => b.id !== box.id)

  // Parsed amounts
  const parsedAmounts = useMemo(
    () => Object.fromEntries(currencies.map(cur => [cur, parseNum(amounts[cur] ?? '')])),
    [amounts, currencies]
  )

  const hasAmount = Object.values(parsedAmounts).some(v => v > 0)

  // Estimated balances after movement
  const estimatedBalances = useMemo<Partial<Record<CashCurrency, number>>>(() => {
    const result: Partial<Record<CashCurrency, number>> = {}
    for (const cur of currencies) {
      const current = box.balances[cur] ?? 0
      const amt     = parsedAmounts[cur] ?? 0
      result[cur] = tipo === 'income'   ? current + amt
                  : tipo === 'expense'  ? current - amt
                  : /* transfer */        current - amt
    }
    return result
  }, [parsedAmounts, box.balances, tipo, currencies])

  const destBox = allBoxes.find(b => b.id === destId)
  const estimatedDestBalances = useMemo<Partial<Record<CashCurrency, number>>>(() => {
    if (!destBox) return {}
    const result: Partial<Record<CashCurrency, number>> = {}
    for (const cur of currencies) {
      result[cur] = (destBox.balances[cur] ?? 0) + (parsedAmounts[cur] ?? 0)
    }
    return result
  }, [parsedAmounts, destBox, currencies])

  const saving = createMov.isPending || createTrans.isPending

  async function handleSubmit() {
    setError(null)
    if (!hasAmount) { setError('Ingresá al menos un importe.'); return }
    if (tipo === 'transfer' && !destId) { setError('Seleccioná la caja destino.'); return }
    if (tipo !== 'transfer' && !categoryId) { setError('Seleccioná una categoría.'); return }

    try {
      const amountsList = currencies
        .map(cur => ({ currency: cur, amount: parsedAmounts[cur] ?? 0 }))
        .filter(a => a.amount > 0)

      if (tipo === 'transfer') {
        await createTrans.mutateAsync({
          source_cashbox_id: box.id,
          dest_cashbox_id:   destId,
          amounts:           amountsList,
          notes,
          reference_date:    refDate,
        })
      } else {
        const signed = amountsList.map(a => ({
          currency: a.currency,
          amount:   tipo === 'expense' ? -Math.abs(a.amount) : Math.abs(a.amount),
        }))
        await createMov.mutateAsync({
          cashbox_id:     box.id,
          type:           tipo,
          reference_date: refDate,
          category_id:    categoryId,
          notes,
          amounts:        signed,
        })
      }
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar.')
    }
  }

  const cfg = TIPO_CONFIG[tipo]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <p className="text-sm font-semibold text-slate-100">
              {cfg.label}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {box.name} · {box.company?.name}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X size={18} />
          </button>
        </div>

        {/* Tipo selector */}
        <div className="flex px-5 pt-4 gap-2">
          {(Object.keys(TIPO_CONFIG) as Tipo[]).map(t => {
            const c = TIPO_CONFIG[t]
            const Icon = c.icon
            const active = tipo === t
            return (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-colors',
                  active ? TIPO_COLOR[c.color] : 'border-slate-700 text-slate-500 hover:text-slate-300'
                )}
              >
                <Icon size={13} />
                {c.label}
              </button>
            )
          })}
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">

          {/* Categoría (no para transfer) */}
          {tipo !== 'transfer' && (
            <div>
              <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">
                Categoría
              </label>
              <div className="relative">
                <select
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 pr-8"
                >
                  <option value="">Seleccionar…</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Caja destino (solo transfer) */}
          {tipo === 'transfer' && (
            <div>
              <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">
                Caja destino
              </label>
              <div className="relative">
                <select
                  value={destId}
                  onChange={e => setDestId(e.target.value)}
                  className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 pr-8"
                >
                  <option value="">Seleccionar…</option>
                  {otherBoxes.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.company?.name ?? ''})
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Importes */}
          <div>
            <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">
              Importes
            </label>
            <div className="space-y-2">
              {currencies.map(cur => (
                <div key={cur} className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 w-8 font-mono">{cur}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={amounts[cur] ?? ''}
                    onChange={e => setAmounts(a => ({ ...a, [cur]: e.target.value }))}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 font-mono focus:border-slate-500 outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Saldo estimado */}
          {hasAmount && (
            <div className="bg-slate-800/60 rounded-lg p-3 space-y-1.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
                {tipo === 'transfer' ? 'Saldo estimado tras la transferencia' : 'Saldo estimado'}
              </p>
              {currencies.filter(cur => (parsedAmounts[cur] ?? 0) > 0).map(cur => {
                const before = box.balances[cur] ?? 0
                const after  = estimatedBalances[cur] ?? 0
                const diff   = (parsedAmounts[cur] ?? 0)
                const sign   = tipo === 'income' ? '+' : '-'
                const signColor = tipo === 'income' ? 'text-emerald-400' : 'text-red-400'
                return (
                  <div key={cur}>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Saldo actual {cur}</span>
                      <span className="font-mono">{cur === 'ARS' ? `$${fmtAmount(before, cur)}` : `${cur} ${fmtAmount(before, cur)}`}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">{tipo === 'transfer' ? 'Sale' : TIPO_CONFIG[tipo].label}</span>
                      <span className={cn('font-mono', signColor)}>
                        {sign} {cur === 'ARS' ? `$${fmtAmount(diff, cur)}` : `${cur} ${fmtAmount(diff, cur)}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-medium border-t border-slate-700 pt-1 mt-1">
                      <span className="text-slate-300">Estimado {cur}</span>
                      <span className={cn('font-mono', after < 0 ? 'text-red-400' : 'text-slate-100')}>
                        {cur === 'ARS' ? `$${fmtAmount(after, cur)}` : `${cur} ${fmtAmount(after, cur)}`}
                      </span>
                    </div>
                    {/* Saldo destino para transfer */}
                    {tipo === 'transfer' && destBox && (
                      <div className="flex justify-between text-xs mt-1.5 pt-1.5 border-t border-slate-700/50">
                        <span className="text-slate-500">Estimado {destBox.name} {cur}</span>
                        <span className="font-mono text-emerald-400">
                          {cur === 'ARS'
                            ? `$${fmtAmount(estimatedDestBalances[cur] ?? 0, cur)}`
                            : `${cur} ${fmtAmount(estimatedDestBalances[cur] ?? 0, cur)}`}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Fecha y notas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">Fecha</label>
              <input
                type="date"
                value={refDate}
                onChange={e => setRefDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">Notas</label>
              <input
                type="text"
                placeholder="Opcional…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-5 py-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !hasAmount}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
              TIPO_COLOR[cfg.color],
              (saving || !hasAmount) && 'opacity-40 cursor-not-allowed'
            )}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <cfg.icon size={13} />}
            {saving ? 'Guardando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
