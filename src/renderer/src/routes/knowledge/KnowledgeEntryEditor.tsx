import { useState, useRef, useEffect } from 'react'
import { Loader2, Sparkles, X, Clock, GitBranch } from 'lucide-react'
import dayjs from 'dayjs'
import {
  useCreateKnowledgeEntry, useUpdateKnowledgeEntry, useDeleteKnowledgeEntry, useSummarizeKnowledgeEntry
} from '../../hooks/useKnowledge'
import KnowledgeRichTextEditor from './KnowledgeRichTextEditor'
import KnowledgeAttachmentStrip from './KnowledgeAttachmentStrip'
import { parseTags } from './KnowledgeHelpers'
import type { KnowledgeEntry, KnowledgeSource } from '@shared/types'

interface Props {
  entry: KnowledgeEntry | null
  defaultTopic: string
  userId: string
  sources: KnowledgeSource[]
  existingTopics: string[]
  parentId?: string | null
  onClose: () => void
}

export default function KnowledgeEntryEditor({
  entry, defaultTopic, userId, sources, existingTopics, parentId, onClose
}: Props) {
  const [savedId, setSavedId]     = useState<string | null>(entry?.id ?? null)
  const [title, setTitle]         = useState(entry?.title ?? '')
  const [topic, setTopic]         = useState(entry?.topic ?? defaultTopic)
  const [source, setSource]       = useState(entry?.source ?? '')
  const [tagsRaw, setTagsRaw]     = useState(() => parseTags(entry?.tags ?? '[]').join(', '))
  const [entryDate, setEntryDate] = useState(
    entry?.entry_date ? dayjs(entry.entry_date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
  )
  const [htmlBody, setHtmlBody]   = useState(entry?.body ?? '')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  const create    = useCreateKnowledgeEntry()
  const update    = useUpdateKnowledgeEntry()
  const del       = useDeleteKnowledgeEntry()
  const summarize = useSummarizeKnowledgeEntry()

  const r = useRef({ savedId, title, topic, source, tagsRaw, entryDate, htmlBody, userId })
  useEffect(() => { r.current = { savedId, title, topic, source, tagsRaw, entryDate, htmlBody, userId } })

  const performSaveRef = useRef<() => Promise<void>>(async () => {})
  useEffect(() => {
    performSaveRef.current = async () => {
      const { savedId: sid, title: t, topic: tp, source: src, tagsRaw: tr, entryDate: ed, htmlBody: body, userId: uid } = r.current
      if (!sid && !t && !body) return
      const tags = tr.split(',').map(s => s.trim()).filter(Boolean)
      const ms   = ed ? dayjs(ed).valueOf() : null
      setSaveStatus('saving')
      try {
        if (!sid) {
          const e = await create.mutateAsync({ data: { title: t, content_type: 'text', body, topic: tp, tags, source: src, entry_date: ms ?? undefined, parent_id: parentId ?? null }, userId: uid })
          setSavedId(e.id)
          r.current.savedId = e.id
        } else {
          await update.mutateAsync({ id: sid, data: { title: t, body, topic: tp, tags, source: src, entry_date: ms } })
        }
        setSaveStatus('saved')
      } catch { setSaveStatus('idle') }
    }
  })

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const schedule = () => {
    setSaveStatus('idle')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void performSaveRef.current() }, 1500)
  }

  const handleClose = async () => {
    if (timer.current) clearTimeout(timer.current)
    await performSaveRef.current()
    onClose()
  }

  const handleDiscard = () => {
    if (timer.current) clearTimeout(timer.current)
    if (!entry && savedId) {
      if (!confirm('¿Descartar la entrada sin guardar?')) return
      del.mutate(savedId)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-800 shrink-0">
        {parentId && (
          <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-900/40 text-violet-300 border border-violet-700/40 shrink-0">
            <GitBranch size={10}/>Hilo
          </span>
        )}
        <input
          value={title}
          onChange={e => { setTitle(e.target.value); schedule() }}
          placeholder={parentId ? 'Título de esta entrada del hilo...' : 'Título de la entrada...'}
          className="flex-1 bg-transparent text-lg font-semibold text-slate-100 placeholder-slate-600 focus:outline-none"
        />
        <span className="text-[11px] w-20 text-right shrink-0 text-slate-600">
          {saveStatus === 'saving' && <span className="flex items-center gap-1 justify-end"><Loader2 size={10} className="animate-spin"/>Guardando</span>}
          {saveStatus === 'saved'  && <span className="text-teal-600">Guardado</span>}
        </span>
        {savedId && (
          <button onClick={() => summarize.mutate(savedId)} disabled={summarize.isPending}
            className="flex items-center gap-1.5 text-xs text-teal-400 bg-teal-900/30 hover:bg-teal-900/50 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50">
            {summarize.isPending ? <Loader2 size={11} className="animate-spin"/> : <Sparkles size={11}/>}
            {entry?.ai_summary ? 'Re-resumir' : 'Resumir IA'}
          </button>
        )}
        <button onClick={handleClose}
          className="text-sm text-teal-300 bg-teal-900/40 hover:bg-teal-900/60 border border-teal-700 px-3 py-1.5 rounded-lg transition-colors">
          Guardar y cerrar
        </button>
        <button onClick={handleDiscard} className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-900/20 transition-colors">
          <X size={16}/>
        </button>
      </div>

      <div className="flex items-center gap-4 px-5 py-2.5 border-b border-slate-800 shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Clock size={11} className="text-slate-600"/>
          <input type="date" value={entryDate}
            onChange={e => { setEntryDate(e.target.value); schedule() }}
            className="bg-transparent text-xs text-slate-400 focus:outline-none cursor-pointer"/>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-600">Tema</span>
          <input value={topic} onChange={e => { setTopic(e.target.value); schedule() }}
            list="ke-topics" placeholder="Tema"
            className="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-300 w-36 focus:outline-none focus:border-teal-600"/>
          <datalist id="ke-topics">{existingTopics.map(t => <option key={t} value={t}/>)}</datalist>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-600">Fuente</span>
          <select value={source} onChange={e => { setSource(e.target.value); schedule() }}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-300 focus:outline-none focus:border-teal-600">
            <option value="">—</option>
            {sources.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-600">Tags</span>
          <input value={tagsRaw} onChange={e => { setTagsRaw(e.target.value); schedule() }}
            placeholder="tag1, tag2"
            className="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-300 w-40 focus:outline-none focus:border-teal-600"/>
        </div>
      </div>

      <KnowledgeRichTextEditor initialHtml={htmlBody} onChange={html => { setHtmlBody(html); schedule() }}/>

      {savedId && (
        <div className="px-5 pb-3 border-t border-slate-800 shrink-0 pt-2">
          <KnowledgeAttachmentStrip entryId={savedId}/>
        </div>
      )}
    </div>
  )
}
