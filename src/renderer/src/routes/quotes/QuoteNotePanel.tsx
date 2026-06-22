import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, X, FileText, Loader2 } from 'lucide-react'
import dayjs from 'dayjs'
import { useQuoteNotes, useCreateQuoteNote, useUpdateQuoteNote, useDeleteQuoteNote } from '../../hooks/useKnowledge'
import KnowledgeAttachmentStrip from '../knowledge/KnowledgeAttachmentStrip'
import { stripHtml } from '../knowledge/KnowledgeHelpers'
import type { KnowledgeEntry } from '@shared/types'

interface Props {
  quoteId: string
  userId: string
}

interface NoteCardProps {
  note: KnowledgeEntry
  quoteId: string
  onEdit: () => void
}

function NoteCard({ note, quoteId, onEdit }: NoteCardProps) {
  const [expanded, setExpanded] = useState(false)
  const remove = useDeleteQuoteNote()

  const hasHtml = note.body.startsWith('<')
  const preview = hasHtml ? stripHtml(note.body).slice(0, 200) : note.body.slice(0, 200)

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors">
      <div
        className="p-3.5 cursor-pointer"
        onClick={() => setExpanded(v => !v)}>
        <div className="flex items-start gap-2">
          <FileText size={13} className="text-slate-600 shrink-0 mt-0.5"/>
          <div className="flex-1 min-w-0">
            {note.title && (
              <p className="text-[12px] font-medium text-slate-300 mb-0.5 truncate">{note.title}</p>
            )}
            <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
              {preview || '(sin contenido)'}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            <span className="text-[10px] text-slate-700">{dayjs(note.entry_date ?? note.created_at).format('DD/MM')}</span>
            <button
              onClick={e => { e.stopPropagation(); onEdit() }}
              className="text-slate-700 hover:text-teal-400 p-1 rounded transition-colors">
              <Pencil size={10}/>
            </button>
            <button
              onClick={e => {
                e.stopPropagation()
                remove.mutate({ id: note.id, quoteId })
              }}
              disabled={remove.isPending}
              className="text-slate-700 hover:text-red-400 p-1 rounded transition-colors">
              <Trash2 size={10}/>
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-3.5 pb-3.5 border-t border-slate-800/60 pt-2.5" onClick={e => e.stopPropagation()}>
          {hasHtml ? (
            <div
              className="text-[12px] text-slate-300 leading-relaxed [&_ul]:list-disc [&_ul]:pl-4 [&_a]:text-teal-400"
              dangerouslySetInnerHTML={{ __html: note.body }}/>
          ) : (
            <p className="text-[12px] text-slate-300 leading-relaxed whitespace-pre-wrap">{note.body}</p>
          )}
          <KnowledgeAttachmentStrip entryId={note.id} compact/>
        </div>
      )}
    </div>
  )
}

interface EditorState {
  id?: string
  title: string
  body: string
}

export default function QuoteNotePanel({ quoteId, userId }: Props) {
  const { data: notes = [], isLoading } = useQuoteNotes(quoteId)
  const createNote  = useCreateQuoteNote()
  const updateNote  = useUpdateQuoteNote()

  const [editor, setEditor] = useState<EditorState | null>(null)

  function openNew() {
    setEditor({ title: '', body: '' })
  }

  function openEdit(note: KnowledgeEntry) {
    setEditor({ id: note.id, title: note.title, body: note.body })
  }

  function cancelEditor() {
    setEditor(null)
  }

  async function handleSave() {
    if (!editor) return
    const body = editor.body.trim()
    if (!body) return

    if (editor.id) {
      await updateNote.mutateAsync({ id: editor.id, quoteId, title: editor.title, body })
    } else {
      await createNote.mutateAsync({ quoteId, title: editor.title, body, userId })
    }
    setEditor(null)
  }

  const isPending = createNote.isPending || updateNote.isPending

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800">
        <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">
          {notes.length > 0 ? `${notes.length} nota${notes.length !== 1 ? 's' : ''}` : 'Sin notas'}
        </span>
        <button
          onClick={openNew}
          className="flex items-center gap-1 text-[11px] text-teal-400 hover:text-teal-300 px-2 py-1 rounded-lg hover:bg-teal-900/20 transition-colors">
          <Plus size={11}/>Nueva nota
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {editor && (
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
            <input
              type="text"
              placeholder="Título (opcional)"
              value={editor.title}
              onChange={e => setEditor(s => s ? { ...s, title: e.target.value } : s)}
              className="w-full bg-transparent text-[12px] text-slate-200 placeholder-slate-600 border-b border-slate-700 pb-1.5 mb-2 focus:outline-none focus:border-teal-600"
            />
            <textarea
              autoFocus
              rows={5}
              placeholder="Escribí la nota aquí..."
              value={editor.body}
              onChange={e => setEditor(s => s ? { ...s, body: e.target.value } : s)}
              className="w-full bg-transparent text-[12px] text-slate-300 placeholder-slate-600 resize-none focus:outline-none leading-relaxed"
            />
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-700/60">
              <button
                onClick={handleSave}
                disabled={!editor.body.trim() || isPending}
                className="flex items-center gap-1 text-[11px] bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition-colors">
                {isPending ? <Loader2 size={10} className="animate-spin"/> : <Check size={10}/>}
                {editor.id ? 'Guardar cambios' : 'Crear nota'}
              </button>
              <button
                onClick={cancelEditor}
                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
                <X size={10}/>Cancelar
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={18} className="animate-spin text-slate-600"/>
          </div>
        ) : notes.length === 0 && !editor ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <FileText size={22} className="text-slate-700 mb-2"/>
            <p className="text-[12px] text-slate-600">Sin notas todavía</p>
            <button
              onClick={openNew}
              className="mt-2 text-[11px] text-teal-500 hover:text-teal-400 transition-colors">
              Agregar la primera nota
            </button>
          </div>
        ) : (
          notes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              quoteId={quoteId}
              onEdit={() => openEdit(note)}
            />
          ))
        )}
      </div>
    </div>
  )
}
