import { useState } from 'react'
import { Plus, FileText, Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import {
  useQuoteNotes, useDeleteQuoteNote,
  useKnowledgeSources, useKnowledgeSubEntries
} from '../../hooks/useKnowledge'
import KnowledgeEntryCard from '../knowledge/KnowledgeEntryCard'
import KnowledgeEntryEditor from '../knowledge/KnowledgeEntryEditor'
import KnowledgeThreadDocModal from '../knowledge/KnowledgeThreadDocModal'
import type { KnowledgeEntry, KnowledgeSource } from '@shared/types'

interface Props {
  quoteId: string
  userId: string
}

// Wrapper para cargar sub-entries de cada nota y poder abrir el modal de hilo
interface WrapperProps {
  note: KnowledgeEntry
  sources: KnowledgeSource[]
  quoteId: string
  onEdit: () => void
  onDelete: () => void
  onAddToThread: () => void
  onEditSub: (sub: KnowledgeEntry) => void
  onShowDocument: (entry: KnowledgeEntry, subEntries: KnowledgeEntry[]) => void
}

function NoteCardWrapper({ note, sources, quoteId: _quoteId, onEdit, onDelete, onAddToThread, onEditSub, onShowDocument }: WrapperProps) {
  const { data: subEntries = [] } = useKnowledgeSubEntries(note.id)
  const source = sources.find(s => s.name === note.source)

  return (
    <KnowledgeEntryCard
      entry={note}
      source={source}
      onEdit={onEdit}
      onDelete={onDelete}
      onAddToThread={onAddToThread}
      onShowDocument={() => onShowDocument(note, subEntries)}
      onEditSub={onEditSub}
    />
  )
}

interface DocModal {
  entry: KnowledgeEntry
  subEntries: KnowledgeEntry[]
}

interface EditorState {
  entry: KnowledgeEntry | null
  parentId?: string | null
}

export default function QuoteNotePanel({ quoteId, userId }: Props) {
  const qc = useQueryClient()
  const { data: notes = [], isLoading } = useQuoteNotes(quoteId)
  const { data: sources = [] } = useKnowledgeSources()
  const remove = useDeleteQuoteNote()

  const [editor,   setEditor]   = useState<EditorState | null>(null)
  const [docModal, setDocModal] = useState<DocModal | null>(null)

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['knowledge-quote-notes', quoteId] })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800">
        <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">
          {notes.length > 0 ? `${notes.length} nota${notes.length !== 1 ? 's' : ''}` : 'Sin notas'}
        </span>
        <button
          onClick={() => setEditor({ entry: null })}
          className="flex items-center gap-1 text-[11px] text-teal-400 hover:text-teal-300 px-2 py-1 rounded-lg hover:bg-teal-900/20 transition-colors">
          <Plus size={11}/>Nueva nota
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={18} className="animate-spin text-slate-600"/>
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <FileText size={22} className="text-slate-700 mb-2"/>
            <p className="text-[12px] text-slate-600">Sin notas todavía</p>
            <button
              onClick={() => setEditor({ entry: null })}
              className="mt-2 text-[11px] text-teal-500 hover:text-teal-400 transition-colors">
              Agregar la primera nota
            </button>
          </div>
        ) : (
          notes.map(note => (
            <NoteCardWrapper
              key={note.id}
              note={note}
              sources={sources}
              quoteId={quoteId}
              onEdit={() => setEditor({ entry: note })}
              onDelete={() => remove.mutate({ id: note.id, quoteId })}
              onAddToThread={() => setEditor({ entry: null, parentId: note.id })}
              onEditSub={sub => setEditor({ entry: sub })}
              onShowDocument={(entry, subEntries) => setDocModal({ entry, subEntries })}
            />
          ))
        )}
      </div>

      {editor !== null && (
        <KnowledgeEntryEditor
          entry={editor.entry}
          defaultTopic=""
          userId={userId}
          sources={sources}
          existingTopics={[]}
          parentId={editor.parentId ?? null}
          quoteId={quoteId}
          onSaved={invalidate}
          onClose={() => { setEditor(null); invalidate() }}
        />
      )}

      {docModal && (
        <KnowledgeThreadDocModal
          entry={docModal.entry}
          subEntries={docModal.subEntries}
          onClose={() => setDocModal(null)}
        />
      )}
    </div>
  )
}
