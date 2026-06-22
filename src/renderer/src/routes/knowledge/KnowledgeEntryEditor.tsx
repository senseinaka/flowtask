import { useState, useRef, useEffect } from 'react'
import { Loader2, Sparkles, X, Clock, GitBranch, Eye, Pencil, Brain } from 'lucide-react'
import dayjs from 'dayjs'
import {
  useCreateKnowledgeEntry, useUpdateKnowledgeEntry, useDeleteKnowledgeEntry, useSummarizeKnowledgeEntry
} from '../../hooks/useKnowledge'
import KnowledgeRichTextEditor from './KnowledgeRichTextEditor'
import KnowledgeAIPanel from './KnowledgeAIPanel'
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

// ── Inline style helpers ────────────────────────────────────────────
const metaInput: React.CSSProperties = {
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '3px 8px',
  fontSize: 12,
  color: 'var(--text-body)',
  outline: 'none',
}
const metaSelect: React.CSSProperties = {
  ...metaInput,
  cursor: 'pointer',
  paddingRight: 4,
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
  const [mode, setMode]           = useState<'edit' | 'read'>('edit')
  const [panelOpen, setPanelOpen] = useState(false)

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

  // Latest ai_summary from the live entry (if summarize mutated it)
  const aiSummary = summarize.data?.ai_summary ?? entry?.ai_summary ?? ''

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px',
        borderBottom: '1px solid var(--border)', background: 'var(--surface-card)',
        flexShrink: 0,
      }}>
        {parentId && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10, fontWeight: 600, padding: '2px 8px',
            borderRadius: 999, background: 'rgba(139,92,246,.15)',
            color: '#a78bfa', border: '1px solid rgba(139,92,246,.3)', flexShrink: 0,
          }}>
            <GitBranch size={9}/> Hilo
          </span>
        )}

        <input
          value={title}
          onChange={e => { setTitle(e.target.value); schedule() }}
          placeholder={parentId ? 'Título de esta entrada del hilo...' : 'Título de la entrada...'}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontSize: 17, fontWeight: 700, color: 'var(--text-strong)',
          }}
        />

        {/* Save status */}
        <span style={{ fontSize: 10, color: 'var(--text-faint)', minWidth: 64, textAlign: 'right', flexShrink: 0 }}>
          {saveStatus === 'saving' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Loader2 size={9} className="animate-spin"/> Guardando
            </span>
          )}
          {saveStatus === 'saved' && <span style={{ color: 'var(--success)' }}>Guardado</span>}
        </span>

        {/* Mode toggle */}
        <div style={{
          display: 'flex', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden', flexShrink: 0,
        }}>
          <ModeBtn active={mode === 'edit'} onClick={() => setMode('edit')} icon={<Pencil size={11}/>} label="Editar"/>
          <ModeBtn active={mode === 'read'} onClick={() => setMode('read')} icon={<Eye size={11}/>}    label="Leer"/>
        </div>

        {/* AI panel toggle */}
        <button
          onClick={() => setPanelOpen(v => !v)}
          title={panelOpen ? 'Cerrar panel IA' : 'Abrir análisis IA del tema'}
          style={{
            display: 'inline-flex', alignItems: 'center', padding: '4px 9px', gap: 4,
            border: panelOpen ? '1px solid rgba(45,212,191,.4)' : '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', background: panelOpen ? 'rgba(45,212,191,.1)' : 'transparent',
            color: panelOpen ? '#2dd4bf' : 'var(--text-muted)', cursor: 'pointer', fontSize: 11, flexShrink: 0,
          }}
        >
          <Brain size={11}/> IA
        </button>

        {/* AI summarize */}
        {savedId && (
          <button
            onClick={() => summarize.mutate(savedId)}
            disabled={summarize.isPending}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 11, padding: '4px 10px', border: '1px solid rgba(20,184,166,.3)',
              borderRadius: 'var(--radius-lg)', background: 'rgba(20,184,166,.1)',
              color: '#2dd4bf', cursor: 'pointer', opacity: summarize.isPending ? 0.6 : 1, flexShrink: 0,
            }}
          >
            {summarize.isPending ? <Loader2 size={10} className="animate-spin"/> : <Sparkles size={10}/>}
            {aiSummary ? 'Re-resumir' : 'Resumir IA'}
          </button>
        )}

        <button
          onClick={handleClose}
          style={{
            fontSize: 11, padding: '5px 12px', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-strong)', background: 'var(--slate-700)',
            color: 'var(--text-body)', cursor: 'pointer', flexShrink: 0,
          }}
        >
          Guardar y cerrar
        </button>

        <button
          onClick={handleDiscard}
          style={{
            display: 'inline-flex', alignItems: 'center', padding: 5,
            border: 'none', background: 'transparent',
            color: 'var(--text-faint)', cursor: 'pointer', borderRadius: 'var(--radius-md)',
            flexShrink: 0,
          }}
          title="Descartar"
        >
          <X size={15}/>
        </button>
      </div>

      {/* ── Metadata bar ───────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: '6px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface-card)', flexShrink: 0,
      }}>
        <MetaField label="Fecha" icon={<Clock size={10}/>}>
          <input type="date" value={entryDate}
            onChange={e => { setEntryDate(e.target.value); schedule() }}
            style={{ ...metaInput, cursor: 'pointer' }}/>
        </MetaField>

        <MetaField label="Tema">
          <input value={topic} onChange={e => { setTopic(e.target.value); schedule() }}
            list="ke-topics" placeholder="Sin tema"
            style={{ ...metaInput, width: 130 }}/>
          <datalist id="ke-topics">{existingTopics.map(t => <option key={t} value={t}/>)}</datalist>
        </MetaField>

        <MetaField label="Fuente">
          <select value={source} onChange={e => { setSource(e.target.value); schedule() }}
            style={{ ...metaSelect }}>
            <option value="">—</option>
            {sources.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </MetaField>

        <MetaField label="Tags">
          <input value={tagsRaw} onChange={e => { setTagsRaw(e.target.value); schedule() }}
            placeholder="tag1, tag2"
            style={{ ...metaInput, width: 150 }}/>
        </MetaField>
      </div>

      {/* ── AI summary band (read mode only) ──────────────────────── */}
      {mode === 'read' && aiSummary && (
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'color-mix(in srgb, var(--primary) 6%, var(--surface-card))',
          flexShrink: 0,
        }}>
          <div style={{ maxWidth: 780, margin: '0 auto' }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={9}/> Resumen IA
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-body)', lineHeight: 1.65, margin: 0 }}>{aiSummary}</p>
          </div>
        </div>
      )}

      {/* ── Editor + optional AI panel ─────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <KnowledgeRichTextEditor
          initialHtml={htmlBody}
          onChange={html => { setHtmlBody(html); schedule() }}
          readOnly={mode === 'read'}
        />
        {panelOpen && (
          <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <KnowledgeAIPanel
              topic={topic || defaultTopic}
              userId={userId}
              onClose={() => setPanelOpen(false)}
              embedded
            />
          </div>
        )}
      </div>

      {/* ── Attachment strip ───────────────────────────────────────── */}
      {savedId && (
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <KnowledgeAttachmentStrip entryId={savedId}/>
        </div>
      )}
    </div>
  )
}

// ── Small helpers ───────────────────────────────────────────────────
function MetaField({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      {icon && <span style={{ color: 'var(--text-faint)' }}>{icon}</span>}
      <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)', fontWeight: 600 }}>
        {label}
      </span>
      {children}
    </div>
  )
}

function ModeBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 9px', border: 'none', cursor: 'pointer', fontSize: 11,
      background: active ? 'var(--primary)' : 'transparent',
      color: active ? '#fff' : 'var(--text-muted)',
      transition: 'background 0.1s',
    }}>
      {icon} {label}
    </button>
  )
}
