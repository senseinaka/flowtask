import { useState } from 'react'
import {
  ChevronDown, Pencil, Trash2, Plus, GitBranch, Sparkles, Paperclip
} from 'lucide-react'
import dayjs from 'dayjs'
import { useKnowledgeSubEntries, useThreadDoc, useKnowledgeEntryFiles } from '../../hooks/useKnowledge'
import KnowledgeAttachmentStrip from './KnowledgeAttachmentStrip'
import { parseTags, stripHtml, SourceIcon } from './KnowledgeHelpers'
import { sanitizeHtml } from '../../lib/sanitize'
import type { KnowledgeEntry, KnowledgeSource } from '@shared/types'

// ── Thread sub-entry ──────────────────────────────────────────────────────────

interface SubEntryProps {
  sub: KnowledgeEntry
  dotClass: string
  isLast: boolean
  isExpanded: boolean
  rootEntryId: string
  onToggle: () => void
  onEdit: () => void
}

function ThreadSubEntry({ sub, dotClass, isLast, isExpanded, rootEntryId, onToggle, onEdit }: SubEntryProps) {
  const subHasHtml = sub.body.startsWith('<')
  const subPreview = subHasHtml ? stripHtml(sub.body).slice(0, 160) : sub.body.slice(0, 160)

  return (
    <div className="flex gap-2.5 mb-1">
      <div className="flex flex-col items-center shrink-0 pt-1.5">
        {isLast
          ? <div className="w-px h-3 bg-slate-800"/>
          : <div className="w-px flex-1 bg-slate-800 min-h-[28px]"/>
        }
        <div className={`w-2 h-2 rounded-full border-[1.5px] shrink-0 absolute mt-[2px] ml-[-3px] ${dotClass}`} style={{ position: 'relative' }}/>
      </div>
      <div className="flex-1 min-w-0 pb-2">
        <button
          onClick={onToggle}
          className="w-full text-left px-2.5 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors border border-slate-800/0 hover:border-slate-700/60">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-medium text-slate-600">{dayjs(sub.entry_date ?? sub.created_at).format('DD MMM YY')}</span>
            {sub.source && <span className="text-[10px] px-1.5 py-px rounded-full bg-slate-700 text-slate-400">{sub.source}</span>}
            <span className="flex-1 text-xs text-slate-300 truncate">{sub.title || '(sin título)'}</span>
            <button onClick={e => { e.stopPropagation(); onEdit() }} className="text-slate-700 hover:text-teal-400 p-0.5 rounded transition-colors shrink-0">
              <Pencil size={9}/>
            </button>
            <ChevronDown size={11} className={`text-slate-600 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}/>
          </div>
          {isExpanded && (
            <div className="mt-2 pt-2 border-t border-slate-700/60" onClick={e => e.stopPropagation()}>
              {subHasHtml ? (
                <div className="text-[12px] text-slate-400 leading-relaxed [&_img]:max-w-full [&_img]:rounded [&_ul]:list-disc [&_ul]:pl-4 [&_a]:text-teal-400"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(sub.body) }}/>
              ) : (
                <p className="text-[12px] text-slate-400 leading-relaxed whitespace-pre-wrap">{subPreview || '(sin contenido)'}</p>
              )}
              <KnowledgeAttachmentStrip entryId={sub.id} rootEntryId={rootEntryId} compact/>
            </div>
          )}
        </button>
      </div>
    </div>
  )
}

// ── Entry card ────────────────────────────────────────────────────────────────

const SUB_DOT = ['bg-green-200 border-green-400', 'bg-yellow-200 border-yellow-400', 'bg-blue-200 border-blue-400', 'bg-rose-200 border-rose-400', 'bg-purple-200 border-purple-400']

interface CardProps {
  entry: KnowledgeEntry
  source: KnowledgeSource | undefined
  onEdit: () => void
  onDelete: () => void
  onAddToThread: () => void
  onShowDocument: () => void
  onEditSub: (sub: KnowledgeEntry) => void
  selectMode?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}

export default function KnowledgeEntryCard({
  entry, source, onEdit, onDelete, onAddToThread, onShowDocument, onEditSub,
  selectMode, selected, onToggleSelect
}: CardProps) {
  const [expanded,     setExpanded]     = useState(false)
  const [threadOpen,   setThreadOpen]   = useState(false)
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set())
  const [showFiles,    setShowFiles]    = useState(false)

  const { data: subEntries = [] } = useKnowledgeSubEntries(entry.id)
  const { data: savedDoc }        = useThreadDoc(entry.id)
  const { data: files = [] }      = useKnowledgeEntryFiles(entry.id)

  const date    = entry.entry_date ?? entry.created_at
  const tags    = parseTags(entry.tags)
  const hasHtml = entry.body.startsWith('<')
  const preview = hasHtml ? stripHtml(entry.body).slice(0, 200) : entry.body.slice(0, 200)

  const toggleSub = (id: string) =>
    setExpandedSubs(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  return (
    <div
      className={`bg-slate-900 border rounded-xl transition-colors ${selected ? 'border-teal-600 bg-teal-900/10' : 'border-slate-800 hover:border-slate-700'}`}
      onDoubleClick={onEdit}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Selection checkbox (Etapa 7) */}
        {selectMode && (
          <button
            onClick={e => { e.stopPropagation(); onToggleSelect?.() }}
            className="shrink-0 mt-0.5 w-4 h-4 rounded border border-slate-600 flex items-center justify-center hover:border-teal-500 transition-colors">
            {selected && <div className="w-2 h-2 rounded-sm bg-teal-400"/>}
          </button>
        )}

        <div className="shrink-0 text-center w-12 pt-0.5">
          <div className="text-[11px] font-medium text-slate-400">{dayjs(date).format('DD/MM')}</div>
          <div className="text-[10px] text-slate-700">{dayjs(date).format('YYYY')}</div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {source ? (
              <span style={{ color: source.color }} className="flex items-center gap-1 text-[10px] font-medium">
                <SourceIcon name={source.icon} size={10}/>{source.name}
              </span>
            ) : entry.source ? (
              <span className="text-[10px] text-slate-600">{entry.source}</span>
            ) : null}
            {subEntries.length > 0 && (
              <button
                onClick={() => { const next = !threadOpen; setThreadOpen(next); if (next) setExpandedSubs(new Set(subEntries.map(s => s.id))) }}
                className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-900/30 text-violet-400 border border-violet-800/40 hover:bg-violet-900/50 transition-colors">
                <GitBranch size={9}/>{subEntries.length} en el hilo
              </button>
            )}
          </div>

          <h3 className="text-sm font-medium text-slate-100 mb-1">{entry.title || '(sin título)'}</h3>

          {savedDoc ? (
            <p className="text-[12px] text-slate-400 line-clamp-2 mb-1.5 flex items-start gap-1">
              <Sparkles size={9} className="shrink-0 mt-[3px] text-violet-500/70"/>
              <span>{savedDoc.synthesis}</span>
            </p>
          ) : entry.ai_summary ? (
            <p className="text-[12px] text-teal-200/70 line-clamp-2 mb-1.5 flex items-start gap-1">
              <Sparkles size={9} className="shrink-0 mt-[3px] text-teal-500/70"/>
              <span>{entry.ai_summary}</span>
            </p>
          ) : preview ? (
            <p className="text-[12px] text-slate-500 line-clamp-2 mb-1.5">{preview}</p>
          ) : null}

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map(t => <span key={t} className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{t}</span>)}
            </div>
          )}

          {expanded && (
            <div className="mt-3">
              {entry.body && (
                <div className="pt-3 border-t border-slate-800">
                  {hasHtml ? (
                    <div className="text-[13px] text-slate-300 leading-relaxed [&_img]:max-w-full [&_img]:rounded-lg [&_ul]:list-disc [&_ul]:pl-4 [&_a]:text-teal-400 [&_a]:underline"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(entry.body) }}/>
                  ) : (
                    <p className="text-[13px] text-slate-300 leading-relaxed whitespace-pre-wrap">{entry.body}</p>
                  )}
                </div>
              )}
              <KnowledgeAttachmentStrip entryId={entry.id}/>
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => setExpanded(v => !v)} className="text-slate-700 hover:text-slate-400 p-1.5 rounded hover:bg-slate-800 transition-colors">
            <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`}/>
          </button>
        </div>
      </div>

      {showFiles && !expanded && (
        <div className="px-4 pb-3 border-t border-slate-800/50" onClick={e => e.stopPropagation()}>
          <KnowledgeAttachmentStrip entryId={entry.id} compact/>
        </div>
      )}

      {threadOpen && (
        <div className="px-4 pb-3 border-t border-slate-800/60 pt-3">
          <div className="text-[9px] uppercase tracking-widest text-slate-700 mb-2.5 flex items-center gap-1.5">
            <GitBranch size={9}/>HILO DE SEGUIMIENTO
          </div>
          {subEntries.map((sub, i) => (
            <ThreadSubEntry
              key={sub.id} sub={sub} dotClass={SUB_DOT[i % SUB_DOT.length]}
              isLast={i === subEntries.length - 1} isExpanded={expandedSubs.has(sub.id)}
              rootEntryId={entry.id} onToggle={() => toggleSub(sub.id)} onEdit={() => onEditSub(sub)}
            />
          ))}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/60">
            <button onClick={onAddToThread}
              className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors border border-slate-800 hover:border-slate-700">
              <Plus size={11}/>Agregar al hilo
            </button>
            {subEntries.length > 0 && (
              <button onClick={onShowDocument}
                className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg transition-colors border ${savedDoc ? 'text-violet-300 bg-violet-900/30 border-violet-700/40 hover:bg-violet-900/50' : 'text-violet-400 bg-violet-900/20 border-violet-800/30 hover:bg-violet-900/40 hover:border-violet-700/50'}`}>
                <Sparkles size={11}/>
                {savedDoc ? 'Ver resumen con IA' : 'Hacer resumen con IA'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Action footer bar ─────────────────────────────────── */}
      <div className="flex items-center gap-1 px-3 pb-2.5 pt-1 border-t border-slate-800/50">
        <button
          onClick={e => { e.stopPropagation(); onEdit() }}
          className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300 hover:text-teal-300 px-2.5 py-1.5 rounded-lg hover:bg-teal-900/20 transition-colors border border-transparent hover:border-teal-800/40">
          <Pencil size={11}/>Editar
        </button>
        <button
          onClick={e => { e.stopPropagation(); onAddToThread() }}
          className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-400 px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
          <Plus size={10}/>Agregar al hilo
        </button>
        {files.length > 0 && (
          <button
            onClick={e => { e.stopPropagation(); setShowFiles(v => !v) }}
            className={`flex items-center gap-1 text-[10px] px-2 py-1.5 rounded-lg transition-colors ${showFiles ? 'text-teal-300 bg-teal-900/20' : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800'}`}>
            <Paperclip size={10}/>{files.length}
          </button>
        )}
        <div className="flex-1"/>
        {(savedDoc || subEntries.length > 0) && (
          <button
            onClick={e => { e.stopPropagation(); onShowDocument() }}
            className={`flex items-center gap-1 text-[11px] px-2 py-1.5 rounded-lg transition-colors ${savedDoc ? 'text-violet-400 hover:text-violet-300 hover:bg-violet-900/20' : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800'}`}>
            <Sparkles size={10}/>
            {savedDoc ? 'Ver resumen con IA' : 'Hacer resumen con IA'}
          </button>
        )}
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="text-slate-700 hover:text-red-400 p-1.5 rounded hover:bg-slate-800 transition-colors ml-1">
          <Trash2 size={11}/>
        </button>
      </div>
    </div>
  )
}
