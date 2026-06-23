import { useState } from 'react'
import { X, Plus, Trash2, GripVertical, Save, Loader2, AlertCircle } from 'lucide-react'
import { useRrhhListas, useUpsertLista, useDeleteLista } from '../../hooks/useRrhh'
import type { RrhhListaTipo, RrhhLista } from '@shared/types'

interface Props {
  onClose: () => void
}

const TIPOS: { id: RrhhListaTipo; label: string }[] = [
  { id: 'sector',    label: 'Sectores'   },
  { id: 'puesto',    label: 'Puestos'    },
  { id: 'categoria', label: 'Categorías' },
  { id: 'banco',     label: 'Bancos'     },
]

function ListaTab({ tipo }: { tipo: RrhhListaTipo }) {
  const { data: items = [], isLoading } = useRrhhListas(tipo)
  const upsert = useUpsertLista()
  const deleteItem = useDeleteLista()

  const [newValor, setNewValor] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editValor, setEditValor] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function handleAdd() {
    const v = newValor.trim()
    if (!v) return
    upsert.mutate(
      { tipo, valor: v, orden: items.length },
      {
        onSuccess: () => setNewValor(''),
      }
    )
  }

  function handleEdit(item: RrhhLista) {
    setEditId(item.id)
    setEditValor(item.valor)
  }

  function handleSaveEdit(item: RrhhLista) {
    const v = editValor.trim()
    if (!v || v === item.valor) { setEditId(null); return }
    upsert.mutate(
      { id: item.id, tipo, valor: v, orden: item.orden },
      { onSuccess: () => setEditId(null) }
    )
  }

  function handleDelete(id: string) {
    deleteItem.mutate({ id, tipo }, { onSuccess: () => setConfirmDelete(null) })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-500 gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Agregar */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Nuevo valor..."
          value={newValor}
          onChange={e => setNewValor(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-pink-500"
        />
        <button
          onClick={handleAdd}
          disabled={!newValor.trim() || upsert.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </div>

      {/* Lista */}
      {items.length === 0 ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-4 justify-center">
          <AlertCircle className="w-4 h-4" /> Sin elementos. Agregá el primero.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {items.map(item => (
            <li key={item.id} className="flex items-center gap-2 group">
              <GripVertical className="w-4 h-4 text-slate-700 flex-shrink-0" />
              {editId === item.id ? (
                <>
                  <input
                    autoFocus
                    value={editValor}
                    onChange={e => setEditValor(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveEdit(item)
                      if (e.key === 'Escape') setEditId(null)
                    }}
                    className="flex-1 px-2.5 py-1 bg-slate-700 border border-pink-500 rounded-md text-sm text-slate-100 focus:outline-none"
                  />
                  <button
                    onClick={() => handleSaveEdit(item)}
                    disabled={upsert.isPending}
                    className="p-1.5 rounded-md bg-pink-600/20 hover:bg-pink-600/30 text-pink-300 disabled:opacity-50"
                    title="Guardar"
                  >
                    <Save className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setEditId(null)}
                    className="p-1.5 rounded-md hover:bg-slate-700 text-slate-500"
                    title="Cancelar"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : confirmDelete === item.id ? (
                <>
                  <span className="flex-1 text-sm text-red-300">¿Eliminar &ldquo;{item.valor}&rdquo;?</span>
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deleteItem.isPending}
                    className="px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs disabled:opacity-50"
                  >
                    {deleteItem.isPending ? 'Eliminando...' : 'Eliminar'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="px-2.5 py-1 rounded-md hover:bg-slate-700 text-slate-400 text-xs"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <span
                    className="flex-1 text-sm text-slate-200 cursor-pointer hover:text-slate-100 py-0.5"
                    onDoubleClick={() => handleEdit(item)}
                    title="Doble clic para editar"
                  >
                    {item.valor}
                  </span>
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-1.5 rounded-md text-slate-600 hover:text-slate-300 hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Editar"
                  >
                    <Save className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(item.id)}
                    className="p-1.5 rounded-md text-slate-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function RrhhListasAdmin({ onClose }: Props) {
  const [activeTipo, setActiveTipo] = useState<RrhhListaTipo>('sector')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative flex flex-col w-full max-w-lg max-h-[85vh] bg-slate-900 rounded-xl border border-slate-700 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Administrar listas</h2>
            <p className="text-xs text-slate-500 mt-0.5">Sectores, puestos, categorías y bancos disponibles</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tipo tabs */}
        <div className="flex border-b border-slate-700 flex-shrink-0 px-2 pt-1">
          {TIPOS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTipo(t.id)}
              className={`px-4 py-2 text-sm border-b-2 transition-colors -mb-px ${
                activeTipo === t.id
                  ? 'border-pink-500 text-pink-300 font-medium'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-5">
          <ListaTab tipo={activeTipo} />
        </div>
      </div>
    </div>
  )
}
