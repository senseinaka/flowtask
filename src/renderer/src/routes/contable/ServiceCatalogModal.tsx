import { useState } from 'react'
import { X, Plus, Pencil, Trash2, Check, Loader2 } from 'lucide-react'
import { useCatalog, useUpsertCatalog, useDeleteCatalogEntry } from '../../hooks/useServiceCatalog'
import type { CatalogType } from '../../hooks/useServiceCatalog'

const TYPE_LABELS: Record<CatalogType, string> = {
  category:       'Categorías',
  area:           'Áreas internas',
  payment_method: 'Medios de pago',
}

export default function ServiceCatalogModal({
  type,
  onClose,
}: {
  type: CatalogType
  onClose: () => void
}) {
  const { data: entries = [], isLoading } = useCatalog(type)
  const upsert = useUpsertCatalog()
  const del = useDeleteCatalogEntry()

  const [newLabel, setNewLabel] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  async function handleAdd() {
    const label = newLabel.trim()
    if (!label) return
    await upsert.mutateAsync({ config_type: type, value: label, label })
    setNewLabel('')
  }

  async function handleSaveEdit(id: string) {
    const label = editLabel.trim()
    if (!label) return
    await upsert.mutateAsync({ id, config_type: type, value: '', label })
    setEditId(null)
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700 shrink-0">
          <p className="flex-1 text-sm font-semibold">Gestionar {TYPE_LABELS[type]}</p>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <p className="text-slate-500 text-sm text-center py-4">Cargando...</p>
          ) : entries.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">Sin entradas todavía.</p>
          ) : (
            <div className="space-y-1">
              {entries.map(e => (
                <div key={e.id} className="flex items-center gap-2 group min-h-[32px]">
                  {editId === e.id ? (
                    <>
                      <input
                        autoFocus
                        value={editLabel}
                        onChange={ev => setEditLabel(ev.target.value)}
                        onKeyDown={ev => {
                          if (ev.key === 'Enter') handleSaveEdit(e.id)
                          if (ev.key === 'Escape') setEditId(null)
                        }}
                        className="flex-1 px-2 py-1 bg-slate-800 border border-emerald-500 rounded text-sm outline-none"
                      />
                      <button
                        onClick={() => handleSaveEdit(e.id)}
                        disabled={upsert.isPending}
                        className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                      >
                        {upsert.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        className="p-1 rounded hover:bg-slate-700 text-slate-400"
                      >
                        <X size={13} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-slate-200">{e.label}</span>
                      <button
                        onClick={() => { setEditId(e.id); setEditLabel(e.label) }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-700 text-slate-400 transition-opacity"
                      >
                        <Pencil size={12} />
                      </button>
                      {confirmDel === e.id ? (
                        <button
                          onClick={() => { del.mutate({ id: e.id, type }); setConfirmDel(null) }}
                          className="text-xs px-2 py-0.5 bg-red-600 hover:bg-red-500 rounded text-white"
                        >
                          ¿Borrar?
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmDel(e.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-700 text-red-400 transition-opacity"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-slate-700/50">
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="Nueva entrada..."
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              className="flex-1 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleAdd}
              disabled={!newLabel.trim() || upsert.isPending}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded text-sm text-white"
            >
              {upsert.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
