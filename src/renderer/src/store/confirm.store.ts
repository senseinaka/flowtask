import { create } from 'zustand'

// Diálogo de confirmación imperativo y temático, en reemplazo de window.confirm()
// (que rompe el theme oscuro, no describe consecuencias y no es accesible).
//
// Uso:
//   const confirm = useConfirm()
//   if (await confirm({ title: 'Eliminar tarea', message: '¿Eliminar "X"?', danger: true })) {
//     await deleteTask.mutateAsync(id)
//   }
//
// El diálogo se monta UNA vez en App.tsx (<ConfirmDialog/>). Sólo hay uno activo
// a la vez: si se pide otro mientras hay uno pendiente, el anterior se resuelve en
// false (se cancela) para no perder la promesa.

export interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** Estilo destructivo (botón rojo) para borrados/acciones irreversibles. */
  danger?: boolean
}

interface ConfirmState {
  current: (ConfirmOptions & { id: number }) | null
  _resolve: ((v: boolean) => void) | null
  open: (opts: ConfirmOptions) => Promise<boolean>
  respond: (v: boolean) => void
}

let cid = 0

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  current: null,
  _resolve: null,

  open: (opts) =>
    new Promise<boolean>((resolve) => {
      const prev = get()._resolve
      if (prev) prev(false) // cancelar cualquier confirm pendiente
      set({ current: { ...opts, id: ++cid }, _resolve: resolve })
    }),

  respond: (v) => {
    const r = get()._resolve
    set({ current: null, _resolve: null })
    if (r) r(v)
  },
}))

/** Hook ergonómico: devuelve la función `confirm(opts) => Promise<boolean>`. */
export function useConfirm() {
  return useConfirmStore((s) => s.open)
}

/** Variante imperativa para usar fuera de componentes. */
export const confirm = (opts: ConfirmOptions) => useConfirmStore.getState().open(opts)
