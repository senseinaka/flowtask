import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useConfirmStore } from '../../store/confirm.store'

// Render global del diálogo de confirmación. Se monta una sola vez en App.tsx,
// con z-index por encima de los modales (z-[70]) porque muchas confirmaciones se
// disparan desde DENTRO de un modal (p.ej. borrar en el detalle de una tarea).
//
// Teclado: ESC = cancelar, Enter = confirmar. Click en el backdrop = cancelar.

export default function ConfirmDialog() {
  const current = useConfirmStore((s) => s.current)
  const respond = useConfirmStore((s) => s.respond)

  useEffect(() => {
    if (!current) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); respond(false) }
      else if (e.key === 'Enter') { e.preventDefault(); respond(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, respond])

  if (!current) return null

  const danger = current.danger ?? false

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      style={{ animation: 'fadeIn 0.15s ease-out' }}
      onClick={() => respond(false)}
    >
      <div
        className="relative bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md mx-4 p-5"
        style={{ animation: 'scaleIn 0.15s ease-out' }}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${danger ? 'bg-red-900/50' : 'bg-indigo-900/50'}`}>
            <AlertTriangle size={17} className={danger ? 'text-red-400' : 'text-indigo-400'} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            {current.title && <h2 className="text-sm font-semibold text-white">{current.title}</h2>}
            <p className="text-sm text-slate-300 mt-1 whitespace-pre-line">{current.message}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={() => respond(false)}
            className="px-3.5 py-1.5 rounded-lg text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors"
          >
            {current.cancelLabel ?? 'Cancelar'}
          </button>
          <button
            autoFocus
            onClick={() => respond(true)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold text-white transition-colors ${
              danger ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {current.confirmLabel ?? (danger ? 'Eliminar' : 'Confirmar')}
          </button>
        </div>
      </div>
    </div>
  )
}
