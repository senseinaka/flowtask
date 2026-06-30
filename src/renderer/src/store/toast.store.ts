import { create } from 'zustand'

// Sistema de notificaciones (toasts) global y reutilizable.
//
// Reemplaza el toast ad-hoc que vivía en App.tsx (sólo respuestas de WhatsApp)
// y los alert() nativos de error desperdigados por la app. Pensado además para
// soportar el patrón "Deshacer ~5s": un toast con una acción (ver useUndoableDelete).
//
// Uso imperativo (desde handlers o hooks, sin hook de React):
//   import { toast } from '../store/toast.store'
//   toast.error('No se pudo guardar')
//   toast.success('Guardado')
//   const id = toast.show({ variant: 'info', message: 'Eliminado', action: { label: 'Deshacer', onClick } })

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastItem {
  id: number
  variant: ToastVariant
  title?: string
  message: string
  action?: ToastAction
  /** ms hasta auto-cierre; 0 = no se cierra solo. */
  duration: number
}

export interface ToastInput {
  variant?: ToastVariant
  title?: string
  message: string
  action?: ToastAction
  duration?: number
}

interface ToastState {
  toasts: ToastItem[]
  show: (t: ToastInput) => number
  dismiss: (id: number) => void
  clear: () => void
}

let counter = 0
const timers = new Map<number, ReturnType<typeof setTimeout>>()

// Duración por defecto según el tipo: los errores quedan más tiempo.
function defaultDuration(variant: ToastVariant): number {
  switch (variant) {
    case 'error':   return 7000
    case 'warning': return 6000
    default:        return 4500
  }
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  show: (t) => {
    const id = ++counter
    const variant = t.variant ?? 'info'
    const duration = t.duration ?? defaultDuration(variant)
    const item: ToastItem = {
      id,
      variant,
      title: t.title,
      message: t.message,
      action: t.action,
      duration,
    }
    set((s) => ({ toasts: [...s.toasts, item] }))
    if (duration > 0) {
      timers.set(id, setTimeout(() => get().dismiss(id), duration))
    }
    return id
  },

  dismiss: (id) => {
    const h = timers.get(id)
    if (h) { clearTimeout(h); timers.delete(id) }
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },

  clear: () => {
    timers.forEach((h) => clearTimeout(h))
    timers.clear()
    set({ toasts: [] })
  },
}))

// Fachada imperativa cómoda. Cada método devuelve el id por si hay que cerrarlo a mano.
type ToastOpts = Omit<ToastInput, 'variant' | 'message'>

export const toast = {
  show:    (t: ToastInput) => useToastStore.getState().show(t),
  success: (message: string, opts?: ToastOpts) => useToastStore.getState().show({ ...opts, variant: 'success', message }),
  error:   (message: string, opts?: ToastOpts) => useToastStore.getState().show({ ...opts, variant: 'error', message }),
  info:    (message: string, opts?: ToastOpts) => useToastStore.getState().show({ ...opts, variant: 'info', message }),
  warning: (message: string, opts?: ToastOpts) => useToastStore.getState().show({ ...opts, variant: 'warning', message }),
  dismiss: (id: number) => useToastStore.getState().dismiss(id),
}
