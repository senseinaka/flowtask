import { useState } from 'react'
import { X, Loader2, Paperclip, ChevronRight } from 'lucide-react'
import { cn } from '../../components/ui/utils'
import { useCashMovementsDetailed, fmtAmount } from '../../hooks/useCajas'
import CashAttachments from './CashAttachments'
import type { CashboxWithBalance, CashCurrency, CashMovementListItem } from '@shared/types'
import { MOVEMENT_TYPE_LABELS } from '@shared/types'

const TYPE_COLOR: Record<string, string> = {
  income:   'text-emerald-400',
  expense:  'text-red-400',
  transfer: 'text-sky-400',
}

function parseAmounts(json: string): { currency: CashCurrency; amount: number }[] {
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function fmtMoney(currency: CashCurrency, amount: number): string {
  const abs = Math.abs(amount)
  const txt = currency === 'ARS' ? `$${fmtAmount(abs, currency)}` : `${currency} ${fmtAmount(abs, currency)}`
  return amount < 0 ? `- ${txt}` : txt
}

function MovementRow({ mov }: { mov: CashMovementListItem }) {
  const [open, setOpen] = useState(false)
  const amounts = parseAmounts(mov.amounts_json)
  const typeColor = TYPE_COLOR[mov.type] ?? 'text-slate-300'

  return (
    <div className="border border-slate-800 rounded-lg bg-slate-800/40">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-800/70 transition-colors rounded-lg"
      >
        <ChevronRight
          size={14}
          className={cn('shrink-0 text-slate-500 transition-transform', open && 'rotate-90')}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-medium', typeColor)}>
              {MOVEMENT_TYPE_LABELS[mov.type] ?? mov.type}
            </span>
            {mov.category_name && (
              <span className="text-[11px] text-slate-400 truncate">· {mov.category_name}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-slate-500">{mov.reference_date}</span>
            {mov.notes && (
              <span className="text-[10px] text-slate-600 truncate">— {mov.notes}</span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          {amounts.map(a => (
            <div key={a.currency} className={cn('text-xs font-mono', a.amount < 0 ? 'text-red-400' : 'text-slate-200')}>
              {fmtMoney(a.currency, a.amount)}
            </div>
          ))}
        </div>

        {mov.attachment_count > 0 && (
          <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] text-slate-400 bg-slate-800 border border-slate-700 rounded-full px-1.5 py-0.5">
            <Paperclip size={9} />
            {mov.attachment_count}
          </span>
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-800/80">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Comprobantes</p>
          <CashAttachments ownerType="movement" ownerId={mov.id} />
        </div>
      )}
    </div>
  )
}

export default function MovimientosModal({
  box,
  onClose,
}: {
  box: CashboxWithBalance
  onClose: () => void
}) {
  const { data: movements = [], isLoading } = useCashMovementsDetailed(box.id)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div>
            <p className="text-sm font-semibold text-slate-100">Movimientos y comprobantes</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{box.name} · {box.company?.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-2 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-500 text-sm">
              <Loader2 size={15} className="animate-spin" /> Cargando movimientos…
            </div>
          )}

          {!isLoading && movements.length === 0 && (
            <p className="text-center text-sm text-slate-500 py-10">
              Esta caja todavía no tiene movimientos.
            </p>
          )}

          {movements.map(mov => (
            <MovementRow key={mov.id} mov={mov} />
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-5 py-3 border-t border-slate-800 shrink-0">
          <p className="text-[10px] text-slate-600">
            Clic en un movimiento para ver o adjuntar comprobantes (se guardan en Google Drive).
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
