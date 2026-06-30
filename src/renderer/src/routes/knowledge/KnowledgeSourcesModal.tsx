import { useState } from 'react'
import { Pencil, Trash2, Plus, X } from 'lucide-react'
import { useKnowledgeSources, useCreateKnowledgeSource, useUpdateKnowledgeSource, useDeleteKnowledgeSource } from '../../hooks/useKnowledge'
import { AVAILABLE_ICONS, SourceIcon } from './KnowledgeHelpers'
import { useUndoableDelete } from '../../hooks/useUndoableDelete'

export default function KnowledgeSourcesModal({ onClose }: { onClose: () => void }) {
  const { data: sources = [] } = useKnowledgeSources()
  const createSrc = useCreateKnowledgeSource()
  const updateSrc = useUpdateKnowledgeSource()
  const deleteSrc = useDeleteKnowledgeSource()

  const { deleteWithUndo, pendingIds } = useUndoableDelete(
    (id: string) => deleteSrc.mutateAsync(id),
    { message: 'Fuente eliminada' }
  )

  const [newName, setNewName]     = useState('')
  const [newIcon, setNewIcon]     = useState('Tag')
  const [newColor, setNewColor]   = useState('#64748b')
  const [editingId, setEditingId] = useState<string | null>(null)

  const handleCreate = () => {
    if (!newName.trim()) return
    createSrc.mutate({ name: newName.trim(), icon: newIcon, color: newColor }, {
      onSuccess: () => { setNewName(''); setNewIcon('Tag'); setNewColor('#64748b') }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <h2 className="text-sm font-semibold text-slate-100">Gestionar fuentes</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors"><X size={16}/></button>
        </div>

        <div className="overflow-y-auto flex-1">
          {sources.filter(s => !pendingIds.has(s.id)).map(src => (
            <div key={src.id} className="flex items-center gap-3 px-5 py-3 border-b border-slate-800">
              <span style={{ color: src.color }}><SourceIcon name={src.icon} size={15}/></span>
              {editingId === src.id ? (
                <input defaultValue={src.name} autoFocus
                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-sm text-slate-200 focus:outline-none focus:border-teal-600"
                  onBlur={e => { updateSrc.mutate({ id: src.id, data: { name: e.target.value } }); setEditingId(null) }}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                />
              ) : (
                <span className="flex-1 text-sm text-slate-200">{src.name}</span>
              )}
              <button onClick={() => setEditingId(src.id === editingId ? null : src.id)}
                className="text-slate-600 hover:text-slate-400 p-1 transition-colors"><Pencil size={12}/></button>
              <button onClick={() => deleteWithUndo(src.id)}
                className="text-slate-600 hover:text-red-400 p-1 transition-colors"><Trash2 size={12}/></button>
            </div>
          ))}
          {sources.length === 0 && (
            <p className="px-5 py-6 text-xs text-slate-600 text-center">No hay fuentes creadas todavía</p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-700 shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Agregar fuente</p>
          <div className="flex gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
              placeholder="Nombre de la fuente"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-600"/>
            <select value={newIcon} onChange={e => setNewIcon(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-sm text-slate-300 focus:outline-none focus:border-teal-600">
              {AVAILABLE_ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
            </select>
            <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
              className="w-10 h-9 bg-slate-800 border border-slate-700 rounded-lg cursor-pointer"/>
            <button onClick={handleCreate} disabled={!newName.trim() || createSrc.isPending}
              className="flex items-center gap-1 text-sm text-teal-300 bg-teal-900/40 hover:bg-teal-900/60 border border-teal-700 px-3 py-2 rounded-lg transition-colors disabled:opacity-50">
              <Plus size={14}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
