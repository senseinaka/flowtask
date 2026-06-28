import { useState } from 'react'
import { X, Loader2, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react'
import { cn } from '../../components/ui/utils'
import {
  useCashDifferences,
  useUpdateCashDifference,
  useSetCashboxStatus,
  fmtAmount,
} from '../../hooks/useCajas'
import type { CashboxWithBalance, CashDifference, CashCurrency } from '@shared/types'

type InlineAction = { id: string; type: 'resolved' | 'written_off'; notes: string } | null

const STATUS_CONFIG: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  pending:         { label: 'Pendiente',      color: 'text-amber-400',  Icon: Clock        },
  under_review:    { label: 'En revisión',    color: 'text-sky-400',    Icon: AlertTriangle },
  resolved:        { label: 'Resuelta',       color: 'text-emerald-400',Icon: CheckCircle2  },
  written_off:     { label: 'Dada de baja',   color: 'text-slate-400',  Icon: XCircle       },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  const { Icon, label, color } = cfg
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium', color)}>
      <Icon size={11} />
      {label}
    </span>
  )
}

function DiffRow({
  diff,
  action,
  onStartAction,
  onChangeNotes,
  onConfirm,
  onCancel,
  saving,
}: {
  diff: CashDifference
  action: InlineAction
  onStartAction: (type: 'resolved' | 'written_off') => void
  onChangeNotes: (notes: string) => void
  onConfirm: () => void
  onCancel: () => void
  saving: boolean
}) {
  const isActive   = action?.id === diff.id
  const isPending  = diff.status === 'pending' || diff.status === 'under_review'
  const diffAmt    = diff.difference
  const cur        = diff.currency as CashCurrency

  return (
    <div className={cn(
      'rounded-xl border p-3 space-y-2 transition-colors',
      isPending ? 'border-slate-700 bg-slate-800/60' : 'border-slate-800 bg-slate-800/30'
    )}>
      {/* Row header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-300">{cur}</span>
            <StatusBadge status={diff.status} />
          </div>
          <p className="text-[10px] text-slate-600">
            {new Date(diff.created_at).toLocaleDateString('es-AR', {
              day: '2-digit', month: '2-digit', year: 'numeric',
            })}
          </p>
        </div>
        <div className="text-right space-y-0.5">
          <p className={cn(
            'text-sm font-mono font-semibold',
            diffAmt > 0 ? 'text-emerald-400' : diffAmt < 0 ? 'text-red-400' : 'text-slate-400'
          )}>
            {diffAmt >= 0 ? '+' : ''}{fmtAmount(diffAmt, cur)}
          </p>
          <p className="text-[10px] text-slate-600 font-mono">
            Sistema {fmtAmount(diff.system_amount, cur)} · Contado {fmtAmount(diff.counted_amount, cur)}
          </p>
        </div>
      </div>

      {/* Resolution info (resolved/written_off) */}
      {!isPending && diff.resolution_notes && (
        <p className="text-[11px] text-slate-500 italic border-t border-slate-700 pt-2">
          {diff.resolution_notes}
          {diff.resolved_by && <span className="text-slate-600 not-italic"> — {diff.resolved_by}</span>}
        </p>
      )}

      {/* Action buttons (pending only) */}
      {isPending && !isActive && (
        <div className="flex gap-2 border-t border-slate-700 pt-2">
          <button
            onClick={() => onStartAction('resolved')}
            className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-emerald-700 text-emerald-300 bg-emerald-900/30 hover:bg-emerald-900/50 transition-colors"
          >
            Resolver
          </button>
          <button
            onClick={() => onStartAction('written_off')}
            className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-slate-600 text-slate-400 bg-slate-700/40 hover:bg-slate-700/60 transition-colors"
          >
            Dar de baja
          </button>
        </div>
      )}

      {/* Inline confirm form */}
      {isActive && (
        <div className="border-t border-slate-700 pt-2 space-y-2">
          <p className="text-[11px] text-slate-400">
            {action.type === 'resolved' ? 'Resolución' : 'Motivo de baja'}
          </p>
          <input
            type="text"
            autoFocus
            placeholder="Descripción (opcional)…"
            value={action.notes}
            onChange={e => onChangeNotes(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:border-slate-400 outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={onConfirm}
              disabled={saving}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                action.type === 'resolved'
                  ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700 hover:bg-emerald-900/60'
                  : 'bg-slate-700/50 text-slate-300 border-slate-600 hover:bg-slate-700',
                saving && 'opacity-40 cursor-not-allowed'
              )}
            >
              {saving
                ? <><Loader2 size={11} className="animate-spin" /> Guardando…</>
                : action.type === 'resolved' ? 'Confirmar resolución' : 'Confirmar baja'
              }
            </button>
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 border border-slate-700 rounded-lg"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DiferenciasModal({
  box,
  onClose,
}: {
  box: CashboxWithBalance
  onClose: () => void
}) {
  const { data: diffs = [], isLoading } = useCashDifferences(box.id)
  const updateDiff = useUpdateCashDifference()
  const setStatus  = useSetCashboxStatus()
  const [action, setAction] = useState<InlineAction>(null)

  const pendingCount = diffs.filter(d => d.status === 'pending' || d.status === 'under_review').length

  function startAction(diff: CashDifference, type: 'resolved' | 'written_off') {
    setAction({ id: diff.id, type, notes: '' })
  }

  async function confirmAction() {
    if (!action) return
    await updateDiff.mutateAsync({
      id:               action.id,
      status:           action.type,
      resolution_notes: action.notes,
    })
    setAction(null)

    // Si no quedan diferencias pendientes, marcar caja como ok
    const remaining = diffs.filter(
      d => d.id !== action.id && (d.status === 'pending' || d.status === 'under_review')
    )
    if (remaining.length === 0) {
      await setStatus.mutateAsync({ id: box.id, status: 'ok' })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div>
            <p className="text-sm font-semibold text-slate-100">Diferencias</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {box.name}
              {pendingCount > 0 && (
                <span className="ml-2 text-amber-400">{pendingCount} pendiente{pendingCount > 1 ? 's' : ''}</span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={18} className="animate-spin text-slate-500" />
            </div>
          ) : diffs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-500 gap-2">
              <CheckCircle2 size={28} className="text-emerald-600" />
              <p className="text-sm">Sin diferencias registradas</p>
            </div>
          ) : (
            diffs.map(diff => (
              <DiffRow
                key={diff.id}
                diff={diff}
                action={action?.id === diff.id ? action : null}
                onStartAction={type => startAction(diff, type)}
                onChangeNotes={notes => setAction(a => a ? { ...a, notes } : a)}
                onConfirm={confirmAction}
                onCancel={() => setAction(null)}
                saving={updateDiff.isPending}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
