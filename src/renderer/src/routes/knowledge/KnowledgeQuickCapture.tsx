import { useState } from 'react'
import { Zap, X, Loader2 } from 'lucide-react'
import dayjs from 'dayjs'
import { useCreateKnowledgeEntry } from '../../hooks/useKnowledge'
import type { KnowledgeSource } from '@shared/types'

interface Props {
  defaultTopic: string
  userId: string
  topics: string[]
  sources: KnowledgeSource[]
  onClose: () => void
}

export default function KnowledgeQuickCapture({ defaultTopic, userId, topics, sources, onClose }: Props) {
  const [title, setTitle]     = useState('')
  const [body, setBody]       = useState('')
  const [topic, setTopic]     = useState(defaultTopic)
  const [source, setSource]   = useState('')
  const [tags, setTags]       = useState('')

  const create = useCreateKnowledgeEntry()

  async function handleSave() {
    if (!title.trim() && !body.trim()) return
    await create.mutateAsync({
      data: {
        title: title.trim(),
        content_type: 'text',
        body: body.trim(),
        topic: topic.trim(),
        source,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        entry_date: dayjs().valueOf()
      },
      userId
    })
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void handleSave()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 pointer-events-none">
      <div
        className="pointer-events-auto w-[400px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl"
        onKeyDown={handleKeyDown}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
            <Zap size={13} className="text-amber-400"/>Captura rápida
          </span>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1 rounded transition-colors">
            <X size={14}/>
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-3">
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Título..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-600"
          />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Contenido..."
            rows={4}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-600 resize-none"
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-600 mb-1">Tema</label>
              <input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                list="qc-topics"
                placeholder="Tema..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-teal-600"
              />
              <datalist id="qc-topics">{topics.map(t => <option key={t} value={t}/>)}</datalist>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-600 mb-1">Fuente</label>
              <select
                value={source}
                onChange={e => setSource(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-teal-600">
                <option value="">—</option>
                {sources.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <input
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="Tags (separados por coma)..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-teal-600"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-4 pb-4">
          <span className="text-[10px] text-slate-600">Ctrl+Enter para guardar · Esc para cerrar</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
              Cancelar
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={(!title.trim() && !body.trim()) || create.isPending}
              className="flex items-center gap-1.5 text-xs text-teal-300 bg-teal-900/40 hover:bg-teal-900/60 border border-teal-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              {create.isPending ? <Loader2 size={11} className="animate-spin"/> : <Zap size={11}/>}
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
