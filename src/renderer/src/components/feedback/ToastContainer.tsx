import { CheckCircle2, XCircle, Info, AlertTriangle, X, Undo2 } from 'lucide-react'
import { useToastStore, type ToastVariant } from '../../store/toast.store'

// Render global del stack de toasts. Se monta una sola vez en App.tsx.
// Lee el estado del store (toast.store) — cualquier parte de la app dispara toasts
// con el helper imperativo `toast.*` sin tener que pasar props.

const VARIANT: Record<ToastVariant, { ring: string; iconWrap: string; icon: typeof Info; iconColor: string }> = {
  success: { ring: 'border-emerald-700/60', iconWrap: 'bg-emerald-900/50', icon: CheckCircle2,  iconColor: 'text-emerald-400' },
  error:   { ring: 'border-red-700/60',     iconWrap: 'bg-red-900/50',     icon: XCircle,        iconColor: 'text-red-400' },
  warning: { ring: 'border-amber-700/60',   iconWrap: 'bg-amber-900/50',   icon: AlertTriangle,  iconColor: 'text-amber-400' },
  info:    { ring: 'border-indigo-700/60',  iconWrap: 'bg-indigo-900/50',  icon: Info,           iconColor: 'text-indigo-400' },
}

export default function ToastContainer() {
  const toasts  = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-5 left-5 z-[60] flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((t) => {
        const v = VARIANT[t.variant]
        const Icon = v.icon
        return (
          <div
            key={t.id}
            className={`pointer-events-auto bg-slate-800 border ${v.ring} rounded-xl shadow-2xl px-4 py-3 flex items-start gap-3`}
            style={{ animation: 'slideInRight 0.2s ease-out' }}
            role="status"
          >
            <div className={`w-8 h-8 rounded-full ${v.iconWrap} flex items-center justify-center flex-shrink-0`}>
              <Icon size={15} className={v.iconColor} />
            </div>
            <div className="flex-1 min-w-0">
              {t.title && <p className="text-xs font-semibold text-white">{t.title}</p>}
              <p className="text-xs text-slate-300 whitespace-pre-line break-words">{t.message}</p>
              {t.action && (
                <button
                  onClick={() => { t.action!.onClick(); dismiss(t.id) }}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-indigo-300 hover:text-indigo-200"
                >
                  <Undo2 size={12} />
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="text-slate-500 hover:text-slate-300 flex-shrink-0"
              aria-label="Cerrar"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
