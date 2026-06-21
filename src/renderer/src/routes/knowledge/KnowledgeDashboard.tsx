import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Brain, Plus, Search, X, Loader2, Settings, Download,
  Zap, FileText, Trash2, Tag, Filter, CheckSquare
} from 'lucide-react'
import { useAuthSession } from '../../hooks/useCalendar'
import {
  useKnowledgeSources, useCreateKnowledgeSource,
  useKnowledgeEntries, useKnowledgeTopics,
  useDeleteKnowledgeEntry, useKnowledgeSearch,
  useUpdateKnowledgeEntry, useKnowledgeSubEntries
} from '../../hooks/useKnowledge'
import type { KnowledgeEntry, KnowledgeSource } from '@shared/types'

import KnowledgeEntryCard      from './KnowledgeEntryCard'
import KnowledgeEntryEditor    from './KnowledgeEntryEditor'
import KnowledgeSourcesModal   from './KnowledgeSourcesModal'
import KnowledgeAIPanel        from './KnowledgeAIPanel'
import KnowledgeThreadDocModal from './KnowledgeThreadDocModal'
import KnowledgeQuickCapture   from './KnowledgeQuickCapture'
import {
  parseTags, rankSearchResults, exportTopicPDF, buildMarkdown, DEFAULT_SOURCES
} from './KnowledgeHelpers'

// ── Main ──────────────────────────────────────────────────────────────────────

export default function KnowledgeDashboard() {
  const { data: session } = useAuthSession()
  const userId = session?.userId ?? ''

  const { data: sources = [], isLoading: sourcesLoading } = useKnowledgeSources()
  const createSrc = useCreateKnowledgeSource()
  const { data: allEntries = [], isLoading } = useKnowledgeEntries({})
  const { data: topics = [] } = useKnowledgeTopics()

  // ── Topic sidebar ──────────────────────────────────────────────────────────
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [topicSearch, setTopicSearch]     = useState('')

  // ── Editor overlays ────────────────────────────────────────────────────────
  const [editorOpen, setEditorOpen]         = useState(false)
  const [editingEntry, setEditingEntry]     = useState<KnowledgeEntry | null>(null)
  const [addingToThread, setAddingToThread] = useState<KnowledgeEntry | null>(null)
  const [documentEntry, setDocumentEntry]   = useState<KnowledgeEntry | null>(null)
  const [showSources, setShowSources]       = useState(false)
  const [showAIPanel, setShowAIPanel]       = useState(false)

  // ── Etapa 2: Global search ─────────────────────────────────────────────────
  const [globalSearch, setGlobalSearch] = useState('')
  const [searchActive, setSearchActive] = useState(false)
  const { data: searchResults = [] } = useKnowledgeSearch(globalSearch)
  const rankedSearchResults = useMemo(
    () => rankSearchResults(searchResults, globalSearch),
    [searchResults, globalSearch]
  )

  // ── Etapa 3: Filters ───────────────────────────────────────────────────────
  const [filterSource, setFilterSource]     = useState<string>('')
  const [filterTag, setFilterTag]           = useState<string>('')
  const [filterDateFrom, setFilterDateFrom] = useState<string>('')
  const [filterDateTo, setFilterDateTo]     = useState<string>('')
  const [showFilterBar, setShowFilterBar]   = useState(false)

  const allTags = useMemo(() => {
    const s = new Set<string>()
    for (const e of allEntries) for (const t of parseTags(e.tags)) s.add(t)
    return [...s].sort()
  }, [allEntries])

  const hasActiveFilter = !!(filterSource || filterTag || filterDateFrom || filterDateTo)

  // ── Etapa 4: Quick capture ─────────────────────────────────────────────────
  const [quickCapture, setQuickCapture] = useState(false)

  // ── Etapa 7: Bulk selection ────────────────────────────────────────────────
  const [selectMode, setSelectMode]     = useState(false)
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [bulkMoveTarget, setBulkMoveTarget] = useState('')
  const del    = useDeleteKnowledgeEntry()
  const update = useUpdateKnowledgeEntry()

  const { data: documentSubEntries = [] } = useKnowledgeSubEntries(documentEntry?.id ?? null)

  // ── Etapa 6: Seed default sources ─────────────────────────────────────────
  const seededRef = useRef(false)
  useEffect(() => {
    if (sourcesLoading || seededRef.current || sources.length > 0) return
    seededRef.current = true
    DEFAULT_SOURCES.forEach(d => createSrc.mutate(d))
  }, [sourcesLoading, sources.length]) // eslint-disable-line

  // ── Derived lists ──────────────────────────────────────────────────────────
  const topicCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const e of allEntries) if (e.topic) c[e.topic] = (c[e.topic] ?? 0) + 1
    return c
  }, [allEntries])

  const filteredTopics = useMemo(() => {
    if (!topicSearch.trim()) return topics
    const q = topicSearch.toLowerCase()
    return topics.filter(t => t.toLowerCase().includes(q))
  }, [topics, topicSearch])

  const dossierEntries = useMemo(() => {
    let entries = selectedTopic === null ? allEntries : allEntries.filter(e => e.topic === selectedTopic)
    if (filterSource)   entries = entries.filter(e => e.source === filterSource)
    if (filterTag)      entries = entries.filter(e => parseTags(e.tags).includes(filterTag))
    if (filterDateFrom) entries = entries.filter(e => (e.entry_date ?? e.created_at) >= new Date(filterDateFrom).getTime())
    if (filterDateTo)   entries = entries.filter(e => (e.entry_date ?? e.created_at) <= new Date(filterDateTo).getTime() + 86399999)
    return entries
  }, [allEntries, selectedTopic, filterSource, filterTag, filterDateFrom, filterDateTo])

  const displayEntries = searchActive && globalSearch.trim().length >= 2
    ? rankedSearchResults
    : dossierEntries

  const sourceByName = useMemo(() => {
    const m: Record<string, KnowledgeSource> = {}
    for (const s of sources) m[s.name] = s
    return m
  }, [sources])

  // ── Actions ────────────────────────────────────────────────────────────────
  const openNewEntry    = () => { setEditingEntry(null); setAddingToThread(null); setEditorOpen(true) }
  const openEditEntry   = (e: KnowledgeEntry) => { setEditingEntry(e); setAddingToThread(null); setEditorOpen(true) }
  const openAddToThread = (parent: KnowledgeEntry) => { setEditingEntry(null); setAddingToThread(parent); setEditorOpen(true) }
  const closeEditor     = () => { setEditorOpen(false); setEditingEntry(null); setAddingToThread(null) }
  const handleDelete    = (id: string) => { if (confirm('¿Eliminar esta entrada?')) del.mutate(id) }

  function toggleSelectEntry(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
    setSelectMode(false)
    setBulkMoveTarget('')
  }

  async function handleBulkDelete() {
    if (!confirm(`¿Eliminar ${selectedIds.size} entrada${selectedIds.size !== 1 ? 's' : ''}?`)) return
    for (const id of [...selectedIds]) await del.mutateAsync(id)
    clearSelection()
  }

  async function handleBulkMove() {
    if (!bulkMoveTarget.trim()) return
    for (const id of [...selectedIds]) await update.mutateAsync({ id, data: { topic: bulkMoveTarget.trim() } })
    clearSelection()
  }

  async function handleExportMarkdown() {
    const entries = selectedIds.size > 0
      ? displayEntries.filter(e => selectedIds.has(e.id))
      : displayEntries
    const md = buildMarkdown(selectedTopic ?? 'Todas', entries)
    const defaultName = `knowledge-${(selectedTopic || 'todas').replace(/\s+/g, '-').toLowerCase()}.md`
    await window.api.knowledge.exportMarkdown(defaultName, md)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full bg-slate-950 text-slate-100 overflow-hidden">

      {/* ── Topic sidebar ──────────────────────────────────────────────────── */}
      <div className="w-64 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <Brain size={15} className="text-teal-400"/>
            <span className="text-sm font-semibold text-slate-100">Knowledge</span>
          </div>
          <button onClick={() => setShowSources(true)} title="Gestionar fuentes"
            className="text-slate-600 hover:text-slate-400 p-1 rounded hover:bg-slate-800 transition-colors">
            <Settings size={14}/>
          </button>
        </div>

        <div className="px-3 py-2 shrink-0">
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600"/>
            <input value={topicSearch} onChange={e => setTopicSearch(e.target.value)}
              placeholder="Buscar temas..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-teal-600"/>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <button onClick={() => { setSelectedTopic(null); setSearchActive(false) }}
            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${selectedTopic === null && !searchActive ? 'bg-teal-900/30 text-teal-300 border-r-2 border-teal-500' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
            <span>Todas</span>
            <span className="text-[11px] opacity-60">{allEntries.length}</span>
          </button>

          {filteredTopics.map(t => (
            <button key={t} onClick={() => { setSelectedTopic(t); setSearchActive(false) }}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${selectedTopic === t && !searchActive ? 'bg-teal-900/30 text-teal-300 border-r-2 border-teal-500' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
              <span className="truncate">{t}</span>
              <span className="text-[11px] opacity-60 shrink-0 ml-1">{topicCounts[t] ?? 0}</span>
            </button>
          ))}

          {topics.length === 0 && !isLoading && (
            <p className="px-4 py-6 text-[11px] text-slate-600 text-center">
              Los temas aparecen cuando creas entradas
            </p>
          )}
        </div>
      </div>

      {/* ── Main panel ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-800 shrink-0 flex-wrap">
          {searchActive ? (
            <div className="flex-1 relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
              <input
                autoFocus
                value={globalSearch}
                onChange={e => setGlobalSearch(e.target.value)}
                placeholder="Buscar en todas las entradas..."
                className="w-full bg-slate-800 border border-teal-700/50 rounded-lg pl-8 pr-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-600"
              />
              {globalSearch && (
                <button onClick={() => setGlobalSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                  <X size={12}/>
                </button>
              )}
            </div>
          ) : (
            <h2 className="flex-1 text-sm font-semibold text-slate-100">
              {selectedTopic ?? 'Todas las entradas'}
              {displayEntries.length > 0 && (
                <span className="ml-2 text-[11px] text-slate-500 font-normal">
                  {displayEntries.length} entrada{displayEntries.length !== 1 ? 's' : ''}
                </span>
              )}
            </h2>
          )}

          <button
            onClick={() => { setSearchActive(v => !v); setGlobalSearch('') }}
            title="Buscar"
            className={`p-1.5 rounded-lg transition-colors ${searchActive ? 'bg-teal-900/40 text-teal-300' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}>
            <Search size={14}/>
          </button>
          <button
            onClick={() => setShowFilterBar(v => !v)}
            title="Filtros"
            className={`relative p-1.5 rounded-lg transition-colors ${(showFilterBar || hasActiveFilter) ? 'bg-amber-900/40 text-amber-300' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}>
            <Filter size={14}/>
            {hasActiveFilter && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400"/>}
          </button>
          <button
            onClick={() => { setSelectMode(v => !v); if (selectMode) clearSelection() }}
            title="Selección múltiple"
            className={`p-1.5 rounded-lg transition-colors ${selectMode ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}>
            <CheckSquare size={14}/>
          </button>
          {selectedTopic && (
            <>
              <button onClick={() => setShowAIPanel(v => !v)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${showAIPanel ? 'bg-teal-900/40 border-teal-600 text-teal-300' : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'}`}>
                Análisis IA
              </button>
              <button onClick={() => exportTopicPDF(selectedTopic, displayEntries)}
                className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                title="Exportar PDF">
                <Download size={14}/>
              </button>
            </>
          )}
          <button onClick={() => void handleExportMarkdown()}
            className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
            title="Exportar Markdown">
            <FileText size={14}/>
          </button>
          <button onClick={() => setQuickCapture(true)} title="Captura rápida"
            className="p-1.5 text-amber-500 hover:text-amber-300 hover:bg-amber-900/20 rounded-lg transition-colors">
            <Zap size={14}/>
          </button>
          <button onClick={openNewEntry}
            className="flex items-center gap-1.5 text-xs text-teal-300 bg-teal-900/30 hover:bg-teal-900/50 border border-teal-700 px-2.5 py-1.5 rounded-lg transition-colors">
            <Plus size={11}/>Nueva entrada
          </button>
        </div>

        {/* Etapa 3: Filter bar */}
        {showFilterBar && (
          <div className="flex items-center gap-2 px-6 py-2.5 border-b border-slate-800 bg-slate-900/60 shrink-0 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-slate-600">Filtrar</span>
            <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-teal-600">
              <option value="">Fuente: todas</option>
              {sources.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <select value={filterTag} onChange={e => setFilterTag(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-teal-600">
              <option value="">Tag: todos</option>
              {allTags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-600">Desde</span>
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-teal-600"/>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-600">Hasta</span>
              <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-teal-600"/>
            </div>
            {hasActiveFilter && (
              <button
                onClick={() => { setFilterSource(''); setFilterTag(''); setFilterDateFrom(''); setFilterDateTo('') }}
                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors">
                <X size={11}/>Limpiar
              </button>
            )}
          </div>
        )}

        {/* Etapa 7: Bulk action bar */}
        {selectMode && selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-6 py-2.5 border-b border-slate-700 bg-slate-800/80 shrink-0 flex-wrap">
            <span className="text-xs font-medium text-slate-300">
              {selectedIds.size} seleccionada{selectedIds.size !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-1.5 flex-1">
              <input
                value={bulkMoveTarget}
                onChange={e => setBulkMoveTarget(e.target.value)}
                list="bulk-topics"
                placeholder="Mover a tema..."
                className="bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-600 w-44"/>
              <datalist id="bulk-topics">{topics.map(t => <option key={t} value={t}/>)}</datalist>
              <button onClick={() => void handleBulkMove()} disabled={!bulkMoveTarget.trim()}
                className="flex items-center gap-1 text-xs text-indigo-300 bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-700 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50">
                <Tag size={10}/>Mover
              </button>
            </div>
            <button
              onClick={() => exportTopicPDF('Selección', displayEntries.filter(e => selectedIds.has(e.id)))}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 px-2.5 py-1 rounded-lg transition-colors">
              <Download size={10}/>PDF
            </button>
            <button
              onClick={() => void handleExportMarkdown()}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 px-2.5 py-1 rounded-lg transition-colors">
              <FileText size={10}/>MD
            </button>
            <button onClick={() => void handleBulkDelete()}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 border border-red-900/40 px-2.5 py-1 rounded-lg transition-colors">
              <Trash2 size={10}/>Eliminar
            </button>
            <button onClick={clearSelection}
              className="text-slate-500 hover:text-slate-300 transition-colors p-1">
              <X size={12}/>
            </button>
          </div>
        )}

        {/* Search hint */}
        {searchActive && globalSearch.trim().length >= 2 && (
          <div className="px-6 pt-3 pb-1 text-[10px] text-slate-600 shrink-0">
            {rankedSearchResults.length > 0
              ? `${rankedSearchResults.length} resultado${rankedSearchResults.length !== 1 ? 's' : ''} — ordenados por relevancia`
              : 'Sin resultados'
            }
          </div>
        )}

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={22} className="animate-spin text-teal-400"/>
            </div>
          ) : displayEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500">
              <Brain size={38} className="mb-3 text-slate-800"/>
              <p className="text-sm">
                {searchActive
                  ? 'Sin resultados para esa búsqueda'
                  : selectedTopic
                    ? `No hay entradas en "${selectedTopic}"`
                    : 'No hay entradas aún'
                }
              </p>
              {!searchActive && (
                <button onClick={openNewEntry}
                  className="mt-3 text-sm text-teal-400 hover:text-teal-300 transition-colors">
                  Crear primera entrada
                </button>
              )}
            </div>
          ) : (
            displayEntries.map(e => (
              <KnowledgeEntryCard
                key={e.id}
                entry={e}
                source={sourceByName[e.source]}
                onEdit={() => openEditEntry(e)}
                onDelete={() => handleDelete(e.id)}
                onAddToThread={() => openAddToThread(e)}
                onShowDocument={() => setDocumentEntry(e)}
                onEditSub={sub => openEditEntry(sub)}
                selectMode={selectMode}
                selected={selectedIds.has(e.id)}
                onToggleSelect={() => toggleSelectEntry(e.id)}
              />
            ))
          )}
        </div>

        {/* Etapa 4: Quick capture FAB */}
        {!quickCapture && !editorOpen && (
          <button
            onClick={() => setQuickCapture(true)}
            title="Captura rápida (Zap)"
            className="fixed bottom-6 right-6 w-11 h-11 rounded-2xl bg-amber-500 hover:bg-amber-400 text-white flex items-center justify-center shadow-xl transition-colors z-20">
            <Zap size={18}/>
          </button>
        )}
      </div>

      {/* ── Overlays ──────────────────────────────────────────────────────── */}

      {editorOpen && (
        <KnowledgeEntryEditor
          entry={editingEntry}
          defaultTopic={addingToThread?.topic ?? selectedTopic ?? ''}
          userId={userId}
          sources={sources}
          existingTopics={topics}
          parentId={addingToThread?.id ?? null}
          onClose={closeEditor}
        />
      )}

      {documentEntry && (
        <KnowledgeThreadDocModal
          entry={documentEntry}
          subEntries={documentSubEntries}
          onClose={() => setDocumentEntry(null)}
        />
      )}

      {showSources && <KnowledgeSourcesModal onClose={() => setShowSources(false)}/>}

      {showAIPanel && selectedTopic && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowAIPanel(false)}/>
          <KnowledgeAIPanel topic={selectedTopic} userId={userId} onClose={() => setShowAIPanel(false)}/>
        </>
      )}

      {quickCapture && (
        <KnowledgeQuickCapture
          defaultTopic={selectedTopic ?? ''}
          userId={userId}
          topics={topics}
          sources={sources}
          onClose={() => setQuickCapture(false)}
        />
      )}
    </div>
  )
}
