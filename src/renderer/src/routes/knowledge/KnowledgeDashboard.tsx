import { useState, useMemo } from 'react'
import { Brain, Plus, Search, X, Tag, Calendar, FileText, Image, Loader2,
  Sparkles, ChevronDown, Trash2, File } from 'lucide-react'
import { useAuthSession } from '../../hooks/useCalendar'
import {
  useKnowledgeEntries, useKnowledgeTopics, useKnowledgeGlobalSummaries,
  useCreateKnowledgeEntry, useDeleteKnowledgeEntry,
  useSummarizeKnowledgeEntry, useUploadKnowledgeFile,
  useGenerateKnowledgeGlobalSummary, useDeleteKnowledgeGlobalSummary
} from '../../hooks/useKnowledge'
import type { KnowledgeEntry, KnowledgeGlobalSummary, KnowledgeContentType, KnowledgeListFilters } from '@shared/types'
import { KNOWLEDGE_CONTENT_TYPE_LABELS } from '@shared/types'
import dayjs from 'dayjs'

// ── helpers ───────────────────────────────────────────────────────────────────

function parseTags(raw: string): string[] {
  try { return JSON.parse(raw) } catch { return [] }
}

function fmt(ms: number) { return dayjs(ms).format('DD/MM/YY') }

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const TYPE_ICONS: Record<KnowledgeContentType, typeof FileText> = {
  text: FileText,
  file: File,
  image: Image
}

const TYPE_COLORS: Record<KnowledgeContentType, string> = {
  text:  'bg-amber-900/40 text-amber-300',
  file:  'bg-blue-900/40 text-blue-300',
  image: 'bg-purple-900/40 text-purple-300'
}

// ── Entry Card ────────────────────────────────────────────────────────────────

function EntryCard({ entry, onClick }: { entry: KnowledgeEntry; onClick: () => void }) {
  const tags = parseTags(entry.tags)
  const TypeIcon = TYPE_ICONS[entry.content_type]

  return (
    <button
      onClick={onClick}
      className="text-left w-full bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-teal-600 hover:bg-slate-750 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[entry.content_type]}`}>
          <span className="flex items-center gap-1">
            <TypeIcon size={10} />
            {KNOWLEDGE_CONTENT_TYPE_LABELS[entry.content_type]}
          </span>
        </span>
        <span className="text-[11px] text-slate-500 shrink-0">{fmt(entry.created_at)}</span>
      </div>

      <h3 className="text-sm font-semibold text-slate-100 mb-1 line-clamp-2">
        {entry.title || (entry.file_name ?? '(sin título)')}
      </h3>

      {entry.ai_summary ? (
        <p className="text-[12px] text-slate-400 line-clamp-3 mb-2">{entry.ai_summary}</p>
      ) : entry.body ? (
        <p className="text-[12px] text-slate-500 line-clamp-3 mb-2">{entry.body}</p>
      ) : null}

      <div className="flex flex-wrap gap-1 mt-2">
        {entry.topic && (
          <span className="text-[10px] text-teal-400 bg-teal-900/30 px-1.5 py-0.5 rounded">
            {entry.topic}
          </span>
        )}
        {tags.slice(0, 3).map(t => (
          <span key={t} className="text-[10px] text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded">
            {t}
          </span>
        ))}
      </div>
    </button>
  )
}

// ── Slide-over Panel ──────────────────────────────────────────────────────────

function EntryPanel({
  entry,
  onClose,
  onDeleted
}: {
  entry: KnowledgeEntry
  onClose: () => void
  onDeleted: () => void
}) {
  const TypeIcon  = TYPE_ICONS[entry.content_type]
  const summarize = useSummarizeKnowledgeEntry()
  const del       = useDeleteKnowledgeEntry()

  const handleSummarize = () => summarize.mutate(entry.id)
  const handleDelete = async () => {
    if (!confirm('¿Eliminar esta entrada?')) return
    del.mutate(entry.id, { onSuccess: () => { onClose(); onDeleted() } })
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-[480px] bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col">
      {/* header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
        <span className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[entry.content_type]}`}>
          <span className="flex items-center gap-1"><TypeIcon size={10}/>{KNOWLEDGE_CONTENT_TYPE_LABELS[entry.content_type]}</span>
        </span>
        <div className="flex items-center gap-2">
          <button onClick={handleSummarize} disabled={summarize.isPending}
            className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 bg-teal-900/30 hover:bg-teal-900/50 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50">
            {summarize.isPending ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>}
            {entry.ai_summary ? 'Re-resumir' : 'Resumir con IA'}
          </button>
          <button onClick={handleDelete} disabled={del.isPending}
            className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-900/20 transition-colors">
            <Trash2 size={14}/>
          </button>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-700 transition-colors">
            <X size={14}/>
          </button>
        </div>
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <h2 className="text-base font-semibold text-slate-100">
          {entry.title || entry.file_name || '(sin título)'}
        </h2>

        <div className="flex flex-wrap gap-2 text-[11px]">
          {entry.topic && (
            <span className="text-teal-400 bg-teal-900/30 px-2 py-0.5 rounded">{entry.topic}</span>
          )}
          {entry.source && (
            <span className="text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded">Fuente: {entry.source}</span>
          )}
          <span className="text-slate-500">{fmt(entry.created_at)}</span>
        </div>

        {parseTags(entry.tags).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {parseTags(entry.tags).map(t => (
              <span key={t} className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-700 px-1.5 py-0.5 rounded">
                <Tag size={8}/> {t}
              </span>
            ))}
          </div>
        )}

        {entry.ai_summary && (
          <div className="bg-teal-900/20 border border-teal-800/40 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-teal-400 mb-2">
              <Sparkles size={10}/> Resumen IA
            </div>
            <p className="text-[13px] text-slate-200 leading-relaxed">{entry.ai_summary}</p>
          </div>
        )}

        {entry.content_type === 'text' && entry.body && (
          <div className="text-[13px] text-slate-300 leading-relaxed whitespace-pre-wrap">
            {entry.body}
          </div>
        )}

        {(entry.content_type === 'file' || entry.content_type === 'image') && entry.file_name && (
          <div className="bg-slate-800 rounded-xl p-3 flex items-center gap-3">
            <File size={24} className="text-slate-400 shrink-0"/>
            <div>
              <p className="text-sm text-slate-200">{entry.file_name}</p>
              {entry.file_size && <p className="text-[11px] text-slate-500">{formatSize(entry.file_size)}</p>}
              {entry.drive_status === 'synced' && <p className="text-[11px] text-teal-400">Drive: sincronizado</p>}
              {entry.drive_status === 'error' && <p className="text-[11px] text-red-400">Drive: error al subir</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Create Modal ──────────────────────────────────────────────────────────────

function CreateModal({
  userId,
  existingTopics,
  onClose
}: {
  userId: string
  existingTopics: string[]
  onClose: () => void
}) {
  const [type, setType]   = useState<KnowledgeContentType>('text')
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [source, setSource] = useState('')
  const [tagsRaw, setTagsRaw] = useState('')
  const [body, setBody]   = useState('')
  const [filePath, setFilePath] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [uploading, setUploading] = useState(false)

  const create    = useCreateKnowledgeEntry()
  const upload    = useUploadKnowledgeFile()

  const handleSelectFile = async () => {
    const fp = await window.api.knowledge.entries.selectFile()
    if (fp) {
      setFilePath(fp)
      setFileName(fp.split(/[/\\]/).pop() ?? fp)
    }
  }

  const handleSubmit = async () => {
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
    const entry = await create.mutateAsync({
      data: { title, content_type: type, body, topic, tags, source },
      userId
    })

    if ((type === 'file' || type === 'image') && filePath) {
      setUploading(true)
      try {
        await upload.mutateAsync({ id: entry.id, filePath })
      } finally {
        setUploading(false)
      }
    }
    onClose()
  }

  const busy = create.isPending || uploading

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="text-sm font-semibold text-slate-100">Nueva entrada</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors"><X size={16}/></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* tipo */}
          <div className="flex gap-2">
            {(['text', 'file', 'image'] as KnowledgeContentType[]).map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${type === t ? 'bg-teal-900/40 border-teal-600 text-teal-300' : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                {KNOWLEDGE_CONTENT_TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Título</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-600"
              placeholder="Título de la entrada"/>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Tema</label>
              <input value={topic} onChange={e => setTopic(e.target.value)}
                list="knowledge-topics-list"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-600"
                placeholder="Ej: Estrategia"/>
              <datalist id="knowledge-topics-list">
                {existingTopics.map(t => <option key={t} value={t}/>)}
              </datalist>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Fuente</label>
              <input value={source} onChange={e => setSource(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-600"
                placeholder="Ej: Reunión, Web"/>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Etiquetas (coma separado)</label>
            <input value={tagsRaw} onChange={e => setTagsRaw(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-600"
              placeholder="tag1, tag2, tag3"/>
          </div>

          {type === 'text' && (
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Contenido</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={8}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-600 resize-y"
                placeholder="Pegá o escribí el contenido aquí..."/>
            </div>
          )}

          {(type === 'file' || type === 'image') && (
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Archivo</label>
              <div className="flex items-center gap-3">
                <button onClick={handleSelectFile}
                  className="flex items-center gap-2 text-sm text-teal-400 bg-teal-900/30 hover:bg-teal-900/50 border border-teal-800/50 px-3 py-2 rounded-lg transition-colors">
                  <File size={14}/>
                  Seleccionar archivo
                </button>
                {fileName && <span className="text-sm text-slate-300 truncate">{fileName}</span>}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-700">
          <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-200 px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={busy}
            className="flex items-center gap-2 text-sm text-teal-300 bg-teal-900/40 hover:bg-teal-900/60 border border-teal-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
            {busy && <Loader2 size={14} className="animate-spin"/>}
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Summary Card ──────────────────────────────────────────────────────────────

function SummaryCard({ summary, onDelete }: { summary: KnowledgeGlobalSummary; onDelete: () => void }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <span className="text-xs font-semibold text-teal-300">
            {summary.topic === '__all__' ? 'Todos los temas' : summary.topic}
          </span>
          <span className="ml-2 text-[11px] text-slate-500">{summary.entry_count} entradas</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500 shrink-0">
          <Calendar size={10}/>
          {fmt(summary.created_at)}
          <button onClick={onDelete} className="ml-1 text-slate-600 hover:text-red-400 transition-colors">
            <Trash2 size={12}/>
          </button>
        </div>
      </div>
      <p className="text-[13px] text-slate-300 leading-relaxed whitespace-pre-wrap">{summary.summary}</p>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function KnowledgeDashboard() {
  const { data: session } = useAuthSession()
  const userId = session?.userId ?? ''

  const [tab, setTab]             = useState<'entries' | 'summaries'>('entries')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null)

  const [filters, setFilters] = useState<KnowledgeListFilters>({})
  const [search, setSearch]   = useState('')

  const activeFilters = useMemo<KnowledgeListFilters>(() => ({
    ...filters,
    search: search.trim() || undefined
  }), [filters, search])

  const { data: entries = [], isLoading: loadingEntries } = useKnowledgeEntries(activeFilters)
  const { data: topics  = [] } = useKnowledgeTopics()
  const { data: summaries = [], isLoading: loadingSummaries } = useKnowledgeGlobalSummaries()

  const genSummary = useGenerateKnowledgeGlobalSummary()
  const delSummary = useDeleteKnowledgeGlobalSummary()

  const [summaryTopic, setSummaryTopic] = useState<string>('__all__')

  const handleGenerate = () => {
    const t = summaryTopic === '__all__' ? null : summaryTopic
    genSummary.mutate({ topic: t, userId })
  }

  const clearFilters = () => { setFilters({}); setSearch('') }
  const hasFilters = search || filters.topic || filters.content_type || filters.source

  const uniqueSources = useMemo(() => {
    const s = new Set(entries.map(e => e.source).filter(Boolean))
    return [...s].sort()
  }, [entries])

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">
      {/* header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Brain size={20} className="text-teal-400"/>
          <h1 className="text-lg font-semibold">Knowledge</h1>
        </div>
        {tab === 'entries' && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 text-sm text-teal-300 bg-teal-900/30 hover:bg-teal-900/50 border border-teal-700 px-3 py-1.5 rounded-lg transition-colors">
            <Plus size={14}/> Nueva entrada
          </button>
        )}
      </div>

      {/* tabs */}
      <div className="flex border-b border-slate-800 px-6">
        {(['entries', 'summaries'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-sm font-medium px-4 py-3 border-b-2 transition-colors ${tab === t ? 'border-teal-500 text-teal-300' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            {t === 'entries' ? `Entradas${entries.length > 0 ? ` (${entries.length})` : ''}` : 'Resúmenes IA'}
          </button>
        ))}
      </div>

      {/* ── TAB ENTRADAS ─────────────────────────────────────────────────────── */}
      {tab === 'entries' && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* filters bar */}
          <div className="px-6 py-3 border-b border-slate-800 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-600"
                placeholder="Buscar en todas las entradas..."/>
            </div>

            <div className="relative">
              <select value={filters.topic ?? ''}
                onChange={e => setFilters(f => ({ ...f, topic: e.target.value || undefined }))}
                className="appearance-none bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-7 py-2 text-sm text-slate-300 focus:outline-none focus:border-teal-600 cursor-pointer">
                <option value="">Todos los temas</option>
                {topics.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"/>
            </div>

            <div className="relative">
              <select value={filters.content_type ?? ''}
                onChange={e => setFilters(f => ({ ...f, content_type: (e.target.value as KnowledgeContentType) || undefined }))}
                className="appearance-none bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-7 py-2 text-sm text-slate-300 focus:outline-none focus:border-teal-600 cursor-pointer">
                <option value="">Todo el contenido</option>
                <option value="text">Texto</option>
                <option value="file">Archivo</option>
                <option value="image">Imagen</option>
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"/>
            </div>

            {uniqueSources.length > 0 && (
              <div className="relative">
                <select value={filters.source ?? ''}
                  onChange={e => setFilters(f => ({ ...f, source: e.target.value || undefined }))}
                  className="appearance-none bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-7 py-2 text-sm text-slate-300 focus:outline-none focus:border-teal-600 cursor-pointer">
                  <option value="">Todas las fuentes</option>
                  {uniqueSources.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"/>
              </div>
            )}

            {hasFilters && (
              <button onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-2.5 py-2 rounded-lg hover:bg-slate-700 transition-colors">
                <X size={12}/> Limpiar
              </button>
            )}
          </div>

          {/* entries grid */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loadingEntries ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 size={24} className="animate-spin text-teal-400"/>
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                <Brain size={40} className="mb-3 text-slate-700"/>
                <p className="text-sm">No hay entradas{hasFilters ? ' con esos filtros' : ''}</p>
                {!hasFilters && (
                  <button onClick={() => setShowCreate(true)}
                    className="mt-3 text-sm text-teal-400 hover:text-teal-300 transition-colors">
                    Crear primera entrada
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {entries.map(e => (
                  <EntryCard key={e.id} entry={e} onClick={() => setSelectedEntry(e)}/>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB RESÚMENES IA ─────────────────────────────────────────────────── */}
      {tab === 'summaries' && (
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* generate bar */}
          <div className="flex items-center gap-3 mb-6 p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
            <div className="relative flex-1">
              <select value={summaryTopic}
                onChange={e => setSummaryTopic(e.target.value)}
                className="appearance-none w-full bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-7 py-2 text-sm text-slate-300 focus:outline-none focus:border-teal-600 cursor-pointer">
                <option value="__all__">Todos los temas</option>
                {topics.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"/>
            </div>
            <button onClick={handleGenerate} disabled={genSummary.isPending}
              className="flex items-center gap-2 text-sm text-teal-300 bg-teal-900/40 hover:bg-teal-900/60 border border-teal-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 shrink-0">
              {genSummary.isPending ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}
              Generar resumen IA
            </button>
          </div>

          {loadingSummaries ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={24} className="animate-spin text-teal-400"/>
            </div>
          ) : summaries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500">
              <Sparkles size={40} className="mb-3 text-slate-700"/>
              <p className="text-sm">No hay resúmenes generados</p>
              <p className="text-xs mt-1">Seleccioná un tema y presioná "Generar resumen IA"</p>
            </div>
          ) : (
            <div className="space-y-4">
              {summaries.map(s => (
                <SummaryCard key={s.id} summary={s}
                  onDelete={() => delSummary.mutate(s.id)}/>
              ))}
            </div>
          )}
        </div>
      )}

      {/* overlays */}
      {selectedEntry && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setSelectedEntry(null)}/>
          <EntryPanel
            entry={selectedEntry}
            onClose={() => setSelectedEntry(null)}
            onDeleted={() => setSelectedEntry(null)}
          />
        </>
      )}

      {showCreate && (
        <CreateModal userId={userId} existingTopics={topics} onClose={() => setShowCreate(false)}/>
      )}
    </div>
  )
}
