import { useState } from 'react'
import { ShieldCheck, Loader2, X, AlertCircle } from 'lucide-react'
import { cn } from '../../components/ui/utils'
import { useCashOperators } from '../../hooks/useCashOperators'
import type { CashOperator } from '@shared/types'

// Modal reutilizable de autorización: elegir operador + PIN → verifica en main
// (window.api.cajas.operators.verify) y, si es correcto, llama onVerified(op).
// El renderer nunca ve el hash; sólo recibe true/false desde el proceso main.
export default function PinGate({
  title = 'Autorización requerida',
  description = 'Elegí tu usuario e ingresá tu PIN para continuar.',
  confirmLabel = 'Autorizar',
  onCancel,
  onVerified,
}: {
  title?: string
  description?: string
  confirmLabel?: string
  onCancel: () => void
  onVerified: (op: CashOperator) => void
}) {
  const { data: operators = [], isLoading } = useCashOperators()
  const withPin = operators.filter(o => o.has_pin)
  const [selId, setSelId] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)

  async function submit() {
    setError('')
    if (!selId) { setError('Elegí un operador'); return }
    if (!/^\d{4}$/.test(pin)) { setError('El PIN debe tener 4 dígitos'); return }
    setVerifying(true)
    try {
      const ok = await window.api.cajas.operators.verify(selId, pin)
      if (!ok) { setError('PIN incorrecto'); setPin(''); return }
      const op = operators.find(o => o.id === selId)
      if (op) onVerified(op)
    } catch (e) {
      // El main lanza un Error con mensaje claro cuando el operador quedó
      // bloqueado por demasiados intentos; lo mostramos tal cual.
      const msg = e instanceof Error ? e.message.replace(/^Error:\s*/, '') : ''
      setError(msg || 'No se pudo verificar el PIN')
      setPin('')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-xs mx-4 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-400" />
            <p className="text-sm font-semibold text-slate-100">{title}</p>
          </div>
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-300">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-[11px] text-slate-500 leading-relaxed">{description}</p>

          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 size={18} className="animate-spin text-slate-500" />
            </div>
          ) : withPin.length === 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-800/50 bg-amber-900/20 px-3 py-2.5">
              <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-300/90 leading-relaxed">
                No hay operadores con PIN configurado. Agregá uno desde "Operadores de caja".
              </p>
            </div>
          ) : (
            <>
              {/* Selector de operador */}
              <div className="flex flex-wrap gap-1.5">
                {withPin.map(op => (
                  <button
                    key={op.id}
                    onClick={() => { setSelId(op.id); setError('') }}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                      selId === op.id
                        ? 'border-emerald-600 bg-emerald-900/40 text-emerald-200'
                        : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600'
                    )}
                  >
                    <span className="size-5 rounded-full bg-emerald-900/50 text-emerald-300 flex items-center justify-center text-[10px] font-bold">
                      {op.name.slice(0, 2).toUpperCase()}
                    </span>
                    {op.name}
                  </button>
                ))}
              </div>

              {/* PIN */}
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                value={pin}
                autoFocus
                disabled={!selId}
                onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setError('') }}
                onKeyDown={e => { if (e.key === 'Enter') submit() }}
                placeholder="••••"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-base text-slate-100 tracking-[0.5em] text-center focus:border-emerald-500 outline-none disabled:opacity-40 placeholder:tracking-normal"
              />

              {error && (
                <p className="flex items-center gap-1.5 text-[11px] text-red-400">
                  <AlertCircle size={12} /> {error}
                </p>
              )}

              <button
                onClick={submit}
                disabled={verifying || !selId}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {verifying ? <><Loader2 size={14} className="animate-spin" /> Verificando…</> : confirmLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
