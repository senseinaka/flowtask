import { useState } from 'react'
import { Users, Plus, Pencil, Trash2, Check, X, Loader2, KeyRound, ShieldCheck } from 'lucide-react'
import { cn } from '../../components/ui/utils'
import {
  useCashOperators, useCreateOperator, useUpdateOperator, useDeleteOperator
} from '../../hooks/useCashOperators'
import type { CashOperator } from '@shared/types'

function isValidPin(p: string): boolean {
  return /^\d{4}$/.test(p)
}

// Input de PIN: sólo 4 dígitos, oculto.
function PinInput({
  value, onChange, placeholder, autoFocus, onEnter
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
  onEnter?: () => void
}) {
  return (
    <input
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={4}
      value={value}
      autoFocus={autoFocus}
      onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
      onKeyDown={e => { if (e.key === 'Enter' && onEnter) onEnter() }}
      placeholder={placeholder ?? '••••'}
      className="w-24 bg-slate-900 border border-slate-600 rounded-md px-2 py-1.5 text-sm text-slate-100 tracking-[0.4em] text-center focus:border-emerald-500 outline-none placeholder:tracking-normal"
    />
  )
}

// ── Fila de operador (ver / editar / eliminar) ────────────────────────────────

function OperatorRow({ op }: { op: CashOperator }) {
  const update = useUpdateOperator()
  const del = useDeleteOperator()
  const [editing, setEditing] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [name, setName] = useState(op.name)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  function save() {
    const n = name.trim()
    if (!n) { setError('El nombre es obligatorio'); return }
    if (pin !== '' && !isValidPin(pin)) { setError('El PIN debe tener 4 dígitos'); return }
    update.mutate(
      { id: op.id, name: n, pin: pin || undefined },
      { onSuccess: () => { setEditing(false); setPin(''); setError('') } }
    )
  }
  function cancel() {
    setEditing(false); setName(op.name); setPin(''); setError('')
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 px-3 py-2.5 bg-slate-900/60 rounded-lg border border-slate-700">
        <div className="flex items-center gap-2">
          <input
            value={name}
            autoFocus
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); else if (e.key === 'Escape') cancel() }}
            placeholder="Nombre del operador"
            className="flex-1 bg-slate-900 border border-slate-600 rounded-md px-2.5 py-1.5 text-sm text-slate-100 focus:border-emerald-500 outline-none"
          />
          <PinInput value={pin} onChange={setPin} placeholder="nuevo PIN" onEnter={save} />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-500">PIN vacío = no cambia</p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={save}
              disabled={update.isPending}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-emerald-900/40 text-emerald-300 border border-emerald-700 hover:bg-emerald-900/60 disabled:opacity-50"
            >
              {update.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Guardar
            </button>
            <button onClick={cancel} className="px-2 py-1 text-slate-500 hover:text-slate-300 text-xs">Cancelar</button>
          </div>
        </div>
        {error && <p className="text-[11px] text-red-400">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-900/40 rounded-lg group">
      <div className="size-8 rounded-full bg-emerald-900/40 text-emerald-300 flex items-center justify-center text-xs font-bold shrink-0">
        {op.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-200 truncate leading-tight">{op.name}</p>
        <span className={cn(
          'inline-flex items-center gap-1 text-[11px]',
          op.has_pin ? 'text-emerald-500/80' : 'text-amber-500/80'
        )}>
          <KeyRound size={10} />
          {op.has_pin ? 'PIN configurado' : 'Sin PIN'}
        </span>
      </div>

      {confirmDel ? (
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-red-400">¿Eliminar?</span>
          <button
            onClick={() => del.mutate(op.id)}
            disabled={del.isPending}
            className="px-2 py-1 rounded text-xs bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
          >
            {del.isPending ? '…' : 'Sí'}
          </button>
          <button onClick={() => setConfirmDel(false)} className="px-2 py-1 text-slate-400 hover:text-slate-200 text-xs">No</button>
        </div>
      ) : (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)} className="p-1.5 text-slate-500 hover:text-emerald-400" title="Editar">
            <Pencil size={14} />
          </button>
          <button onClick={() => setConfirmDel(true)} className="p-1.5 text-slate-500 hover:text-red-400" title="Eliminar">
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Form de alta ──────────────────────────────────────────────────────────────

function AddOperatorForm({ onClose }: { onClose: () => void }) {
  const create = useCreateOperator()
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  function submit() {
    const n = name.trim()
    if (!n) { setError('El nombre es obligatorio'); return }
    if (!isValidPin(pin)) { setError('El PIN debe tener 4 dígitos'); return }
    create.mutate(
      { name: n, pin },
      { onSuccess: () => onClose(), onError: (e: Error) => setError(e.message) }
    )
  }

  return (
    <div className="flex flex-col gap-2 px-3 py-3 bg-slate-900/60 rounded-lg border border-emerald-800/50">
      <div className="flex items-center gap-2">
        <input
          value={name}
          autoFocus
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); else if (e.key === 'Escape') onClose() }}
          placeholder="Nombre del operador"
          className="flex-1 bg-slate-900 border border-slate-600 rounded-md px-2.5 py-1.5 text-sm text-slate-100 focus:border-emerald-500 outline-none"
        />
        <PinInput value={pin} onChange={setPin} placeholder="PIN" onEnter={submit} />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-500">Clave numérica de 4 dígitos</p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={submit}
            disabled={create.isPending}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
          >
            {create.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Crear
          </button>
          <button onClick={onClose} className="px-2 py-1 text-slate-500 hover:text-slate-300 text-xs">Cancelar</button>
        </div>
      </div>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  )
}

// ── Modal raíz ────────────────────────────────────────────────────────────────

export default function OperadoresModal({ onClose }: { onClose: () => void }) {
  const { data: operators = [], isLoading } = useCashOperators()
  const [adding, setAdding] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-slate-800 border border-slate-700 rounded-xl w-[460px] max-h-[80vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-emerald-400" />
            <h2 className="font-semibold text-sm text-slate-100">Operadores de caja</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X size={16} />
          </button>
        </div>

        {/* Nota de alcance */}
        <div className="px-5 pt-3">
          <p className="flex items-start gap-1.5 text-[11px] text-slate-500 leading-relaxed">
            <ShieldCheck size={13} className="text-slate-600 shrink-0 mt-0.5" />
            El PIN identifica al operador y autoriza acciones sensibles en las cajas. No es la clave de inicio de sesión.
          </p>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={18} className="animate-spin text-slate-500" />
            </div>
          ) : operators.length === 0 && !adding ? (
            <p className="text-xs text-slate-600 text-center py-8 leading-relaxed">
              Ningún operador todavía.<br />Usá "+ Nuevo operador" para agregar.
            </p>
          ) : (
            operators.map(op => <OperatorRow key={op.id} op={op} />)
          )}

          {adding && <AddOperatorForm onClose={() => setAdding(false)} />}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-700 shrink-0">
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Plus size={14} />
              Nuevo operador
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
