import { AlertTriangle, ChevronRight } from 'lucide-react'
import { cn } from '../../components/ui/utils'
import { usePendingDifferences, fmtAmount } from '../../hooks/useCajas'
import type { CashCurrency } from '@shared/types'

// Antigüedad legible en español a partir de un ISO date.
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 7)  return `hace ${days} días`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `hace ${weeks} sem`
  const months = Math.floor(days / 30)
  return `hace ${months} mes${months > 1 ? 'es' : ''}`
}

// Una diferencia se considera "vieja" (más urgente) pasada una semana.
function isStale(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() > 7 * 86_400_000
}

export default function AlertasDescuadre({
  onResolve,
}: {
  onResolve: (cashboxId: string) => void
}) {
  const { data: pending = [] } = usePendingDifferences()

  // Banner silencioso: si no hay descuadres, no ocupa espacio.
  if (pending.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-700/60 bg-amber-950/30 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-800/40">
        <AlertTriangle size={15} className="text-amber-400 shrink-0" />
        <p className="text-sm font-semibold text-amber-200">
          {pending.length} descuadre{pending.length > 1 ? 's' : ''} sin resolver
        </p>
      </div>

      <div className="max-h-52 overflow-y-auto divide-y divide-amber-900/30">
        {pending.map(d => {
          const cur   = d.currency as CashCurrency
          const stale = isStale(d.created_at)
          return (
            <button
              key={d.id}
              onClick={() => onResolve(d.cashbox_id)}
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-amber-900/20 transition-colors group"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate">
                  {d.cashbox_name}
                  {d.company_name && (
                    <span className="text-slate-500 font-normal"> · {d.company_name}</span>
                  )}
                </p>
                <p className={cn('text-[10px]', stale ? 'text-amber-400' : 'text-slate-500')}>
                  {timeAgo(d.created_at)}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className={cn(
                  'text-sm font-mono font-semibold',
                  d.difference > 0 ? 'text-emerald-400' : d.difference < 0 ? 'text-red-400' : 'text-slate-400'
                )}>
                  {d.difference >= 0 ? '+' : ''}{fmtAmount(d.difference, cur)}
                </span>
                <span className="flex items-center gap-0.5 text-[11px] font-medium text-amber-300 group-hover:text-amber-200">
                  Resolver
                  <ChevronRight size={13} />
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
