import { useState, useRef, useCallback } from 'react'
import { toast } from '../store/toast.store'

// Borrado diferido con Deshacer (~5s).
//
// Oculta el ítem de la UI de inmediato y ejecuta la mutación real sólo si el
// usuario NO hace clic en "Deshacer" dentro del plazo.
//
// Uso:
//   const { deleteWithUndo, pendingIds } = useUndoableDelete(
//     (id) => deleteTarea.mutateAsync(id),
//     { message: 'Tarea eliminada' }
//   )
//   // En el render:
//   const visible = tasks.filter(t => !pendingIds.has(t.id))
//   // En el handler:
//   <button onClick={() => deleteWithUndo(task.id)} />

interface Options {
  message?: string
  duration?: number
}

export function useUndoableDelete<T extends string | number>(
  deleteFn: (id: T) => Promise<unknown>,
  opts: Options = {}
) {
  const duration = opts.duration ?? 5000
  const message  = opts.message  ?? 'Eliminado'

  // Set reactivo de ids cuya eliminación está en vuelo.
  const [pendingIds, setPending] = useState(() => new Set<T>())
  const timers = useRef(new Map<T, ReturnType<typeof setTimeout>>())

  const deleteWithUndo = useCallback((id: T) => {
    // Agregar al set → ocultar de la UI.
    setPending(prev => { const s = new Set(prev); s.add(id); return s })

    const undo = () => {
      const h = timers.current.get(id)
      if (h) clearTimeout(h)
      timers.current.delete(id)
      setPending(prev => { const s = new Set(prev); s.delete(id); return s })
    }

    const doDelete = async () => {
      timers.current.delete(id)
      try {
        await deleteFn(id)
      } catch {
        toast.error('No se pudo eliminar')
        // Devolver el ítem si falló
        setPending(prev => { const s = new Set(prev); s.delete(id); return s })
      }
    }

    const handle = setTimeout(() => {
      // Cerrar el toast antes de ejecutar (la duración del toast cubre el plazo)
      void doDelete()
    }, duration)
    timers.current.set(id, handle)

    toast.show({
      variant:  'info',
      message,
      duration: duration + 300,
      action: { label: 'Deshacer', onClick: undo },
    })
  }, [deleteFn, duration, message])

  return { deleteWithUndo, pendingIds }
}
