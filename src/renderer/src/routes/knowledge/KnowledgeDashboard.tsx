import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Brain, Plus, Search, X, Loader2, Sparkles, Trash2, Settings,
  Bold, Italic, Underline, List, Link2, Download, FileText,
  Image, Clock, Pencil, ChevronDown, Tag, GitBranch, CheckSquare, Square,
  Mail, Users, Globe, MessageCircle, Video, File, StickyNote,
  Paperclip, CloudUpload, CheckCircle2, AlertCircle, ExternalLink, RefreshCw
} from 'lucide-react'
import jsPDF from 'jspdf'
import dayjs from 'dayjs'
import { useAuthSession } from '../../hooks/useCalendar'
import {
  useKnowledgeSources, useCreateKnowledgeSource, useUpdateKnowledgeSource, useDeleteKnowledgeSource,
  useKnowledgeEntries, useKnowledgeTopics,
  useCreateKnowledgeEntry, useUpdateKnowledgeEntry, useDeleteKnowledgeEntry,
  useSummarizeKnowledgeEntry,
  useKnowledgeSubEntries, useGenerateEntryDocument,
  useAnalyzeTopic, useTopicLatestSummary,
  useKnowledgeEntryFiles, useUploadEntryFile, useDeleteEntryFile,
  useThreadDoc, useSaveThreadDoc
} from '../../hooks/useKnowledge'
import type { KnowledgeEntry, KnowledgeSource, KnowledgeEntryFile } from '@shared/types'

// ── Icon registry ─────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  Mail, Users, Globe, FileText, MessageCircle, Video, Image, File, StickyNote, Tag
}
const AVAILABLE_ICONS = Object.keys(ICON_MAP)

function SourceIcon({ name, size = 14 }: { name: string; size?: number }) {
  const Ic = ICON_MAP[name] ?? Tag
  return <Ic size={size} />
}

// ── File helpers ──────────────────────────────────────────────────────────────

function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileIcon({ mime, size = 12 }: { mime: string; size?: number }) {
  if (mime.startsWith('image/')) return <Image size={size} />
  if (mime.includes('pdf') || mime.includes('word') || mime.includes('text'))
    return <FileText size={size} />
  return <File size={size} />
}

function DriveStatusIcon({ status }: { status: string }) {
  if (status === 'synced')    return <CheckCircle2 size={10} className="text-green-500" />
  if (status === 'uploading') return <CloudUpload size={10} className="text-amber-400 animate-pulse" />
  if (status === 'error')     return <AlertCircle size={10} className="text-red-500" />
  return null
}

// ── AttachmentStrip — shared by main entries and sub-entries ──────────────────

function AttachmentStrip({
  entryId,
  rootEntryId,
  compact = false
}: {
  entryId: string
  rootEntryId?: string
  compact?: boolean
}) {
  const { data: files = [], isLoading } = useKnowledgeEntryFiles(entryId)
  const upload = useUploadEntryFile()
  const remove = useDeleteEntryFile()
  const [isDragging, setIsDragging] = useState(false)

  async function handleAttach() {
    const filePath = await window.api.knowledge.files.selectFile()
    if (!filePath) return
    upload.mutate({ entryId, filePath, rootEntryId })
  }

  function handleDelete(f: KnowledgeEntryFile, e: React.MouseEvent) {
    e.stopPropagation()
    remove.mutate({ id: f.id, entryId })
  }

  function handleOpenInDrive(f: KnowledgeEntryFile, e: React.MouseEvent) {
    e.stopPropagation()
    if (f.drive_file_id && f.drive_status === 'synced') {
      window.api.knowledge.files.openInDrive(f.drive_file_id)
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    if (!isDragging) setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false)
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    for (const file of Array.from(e.dataTransfer.files)) {
      const filePath = window.api.knowledge.files.getFilePath(file)
      if (filePath) upload.mutate({ entryId, filePath, rootEntryId })
    }
  }

  if (compact) {
    return (
      <div
        className="flex items-center gap-1 flex-wrap mt-1"
        onClick={e => e.stopPropagation()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}>
        {files.map(f => (
          <span key={f.id}
            onClick={e => handleOpenInDrive(f, e)}
            title={f.drive_status === 'synced' ? 'Abrir en Drive' : f.file_name}
            className={`flex items-center gap-1 text-[10px] bg-slate-700/60 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 group ${f.drive_status === 'synced' ? 'cursor-pointer hover:border-teal-700 hover:text-teal-300' : ''}`}>
            <FileIcon mime={f.file_mime_type} size={10}/>
            <span className="truncate max-w-[100px]">{f.file_name}</span>
            <DriveStatusIcon status={f.drive_status}/>
            <button
              onClick={e => handleDelete(f, e)}
              className="text-slate-600 hover:text-red-400 ml-0.5 hidden group-hover:inline">
              <X size={9}/>
            </button>
          </span>
        ))}
        <button
          onClick={e => { e.stopPropagation(); handleAttach() }}
          disabled={upload.isPending}
          className="flex items-center gap-0.5 text-[10px] text-slate-600 hover:text-teal-400 transition-colors px-1 py-0.5 rounded hover:bg-slate-800">
          {upload.isPending ? <Loader2 size={10} className="animate-spin"/> : <Paperclip size={10}/>}
          {files.length === 0 && !upload.isPending && <span>Adjuntar</span>}
        </button>
      </div>
    )
  }

  return (
    <div className="mt-3 pt-2.5 border-t border-slate-800/60">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] uppercase tracking-widest text-slate-700 flex items-center gap-1">
          <Paperclip size={9}/>Adjuntos{files.length > 0 && ` (${files.length})`}
        </span>
        <button
          onClick={handleAttach}
          disabled={upload.isPending}
          className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-teal-400 transition-colors px-1.5 py-0.5 rounded hover:bg-slate-800">
          {upload.isPending ? <Loader2 size={10} className="animate-spin"/> : <Plus size={10}/>}
          {upload.isPending ? 'Subiendo...' : 'Adjuntar archivo'}
        </button>
      </div>
      {isLoading ? (
        <div className="text-[10px] text-slate-700">Cargando...</div>
      ) : files.length === 0 ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleAttach}
          className={`w-full flex flex-col items-center gap-1 py-3 border border-dashed rounded-lg cursor-pointer transition-colors ${isDragging ? 'border-teal-600 bg-teal-900/10 text-teal-400' : 'border-slate-800 text-slate-700 hover:border-slate-600 hover:text-slate-500'}`}>
          <Paperclip size={14}/>
          <span className="text-[10px]">{isDragging ? 'Soltá para adjuntar' : 'Arrastrá o hacé clic para adjuntar'}</span>
        </div>
      ) : (
        <div
          className={`flex flex-col gap-1 rounded-lg transition-colors ${isDragging ? 'bg-teal-900/10 ring-1 ring-teal-700' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}>
          {files.map(f => (
            <div key={f.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-800/50 border border-slate-800 group transition-colors ${f.drive_status === 'synced' ? 'hover:border-teal-800 cursor-pointer' : 'hover:border-slate-700'}`}
              onClick={e => handleOpenInDrive(f, e)}
              title={f.drive_status === 'synced' ? 'Abrir en Google Drive' : undefined}>
              <FileIcon mime={f.file_mime_type} size={13}/>
              <span className="flex-1 text-[11px] text-slate-300 truncate">{f.file_name}</span>
              <span className="text-[10px] text-slate-600 shrink-0">{fmtFileSize(f.file_size)}</span>
              <DriveStatusIcon status={f.drive_status}/>
              {f.drive_status === 'synced' && (
                <ExternalLink size={9} className="text-slate-700 group-hover:text-teal-500 transition-colors shrink-0"/>
              )}
              <button
                onClick={e => handleDelete(f, e)}
                className="text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                <X size={11}/>
              </button>
            </div>
          ))}
          <button
            onClick={handleAttach}
            disabled={upload.isPending}
            className="flex items-center gap-1.5 text-[10px] text-slate-600 hover:text-slate-400 mt-0.5 transition-colors px-1">
            {upload.isPending ? <Loader2 size={10} className="animate-spin"/> : <Plus size={10}/>}
            Adjuntar otro archivo
          </button>
        </div>
      )}
    </div>
  )
}

// ── helpers ───────────────────────────────────────────────────────────────────

function parseTags(raw: string): string[] {
  try { return JSON.parse(raw) } catch { return [] }
}

function fmtDate(ms: number) { return dayjs(ms).format('DD/MM/YY') }

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

function parseAnalysis(text: string): Record<string, string> {
  const headers = [
    'RESUMEN EJECUTIVO', 'INSIGHTS CLAVE', 'DECISIONES TOMADAS',
    'PENDIENTES Y PRÓXIMOS PASOS', 'CONTRADICCIONES O CONFLICTOS'
  ]
  const sections: Record<string, string> = {}
  let current = ''
  const lines: string[] = []
  for (const line of text.split('\n')) {
    if (headers.includes(line.trim())) {
      if (current) sections[current] = lines.join('\n').trim()
      current = line.trim()
      lines.length = 0
    } else {
      lines.push(line)
    }
  }
  if (current) sections[current] = lines.join('\n').trim()
  return sections
}

function exportTopicPDF(topic: string, entries: KnowledgeEntry[]) {
  const doc = new jsPDF()
  const m = 20
  const pw = 210 - m * 2
  let y = m

  doc.setFontSize(18)
  doc.setTextColor(20, 184, 166)
  doc.text(topic || 'Knowledge', m, y); y += 10

  doc.setFontSize(8); doc.setTextColor(130)
  doc.text(`${dayjs().format('DD/MM/YYYY')} — ${entries.length} entradas`, m, y); y += 12

  for (const e of entries) {
    if (y > 258) { doc.addPage(); y = m }
    doc.setFontSize(11); doc.setTextColor(30)
    const tl = doc.splitTextToSize(e.title || '(sin título)', pw)
    doc.text(tl, m, y); y += tl.length * 6

    doc.setFontSize(8); doc.setTextColor(120)
    doc.text(`${fmtDate(e.entry_date ?? e.created_at)} · ${e.source || '—'}`, m, y); y += 6

    if (e.ai_summary) {
      if (y > 258) { doc.addPage(); y = m }
      doc.setFontSize(8); doc.setTextColor(20, 184, 166)
      const sl = doc.splitTextToSize(`Resumen IA: ${e.ai_summary}`, pw)
      doc.text(sl, m, y); y += sl.length * 5 + 3
    }

    const body = stripHtml(e.body)
    if (body) {
      if (y > 258) { doc.addPage(); y = m }
      doc.setFontSize(8); doc.setTextColor(60)
      const bl = doc.splitTextToSize(body, pw).slice(0, 50) as string[]
      doc.text(bl, m, y); y += bl.length * 4.5
    }
    y += 4
    if (y < 265) { doc.setDrawColor(210); doc.line(m, y, 210 - m, y); y += 7 }
  }

  doc.save(`knowledge-${(topic || 'all').replace(/\s+/g, '-').toLowerCase()}-${dayjs().format('YYYYMMDD')}.pdf`)
}

// ── RichTextEditor ────────────────────────────────────────────────────────────

function RichTextEditor({ initialHtml, onChange }: { initialHtml: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml
  }, []) // mount only

  const exec = (cmd: string, val?: string) => {
    ref.current?.focus()
    document.execCommand(cmd, false, val)
    onChange(ref.current?.innerHTML ?? '')
  }

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    for (const item of Array.from(e.clipboardData.items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue
        const ab = await file.arrayBuffer()
        const res = await window.api.knowledge.entries.saveClipboardImage(ab, file.type)
        document.execCommand('insertImage', false, `file://${res.localPath}`)
        onChange(ref.current?.innerHTML ?? '')
        return
      }
    }
  }

  const btn = 'p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors'

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-slate-700 shrink-0">
        <button className={btn} onClick={() => exec('bold')}><Bold size={13}/></button>
        <button className={btn} onClick={() => exec('italic')}><Italic size={13}/></button>
        <button className={btn} onClick={() => exec('underline')}><Underline size={13}/></button>
        <div className="w-px h-4 bg-slate-700 mx-1"/>
        <button className={btn} onClick={() => exec('insertUnorderedList')}><List size={13}/></button>
        <button className={btn} onClick={() => {
          const url = prompt('URL del enlace:')
          if (url) exec('createLink', url)
        }}><Link2 size={13}/></button>
        <span className="ml-auto text-[10px] text-slate-700">Ctrl+V para pegar imagen</span>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML ?? '')}
        onPaste={handlePaste}
        className={[
          'flex-1 overflow-y-auto px-6 py-4 text-sm text-slate-200 leading-relaxed focus:outline-none',
          '[&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2',
          '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
          '[&_a]:text-teal-400 [&_a]:underline',
          'empty:before:content-[attr(data-placeholder)] empty:before:text-slate-600'
        ].join(' ')}
        data-placeholder="Escribí o pegá contenido aquí..."
      />
    </div>
  )
}

// ── EntryEditorModal ──────────────────────────────────────────────────────────

function EntryEditorModal({
  entry, defaultTopic, userId, sources, existingTopics, parentId, onClose
}: {
  entry: KnowledgeEntry | null
  defaultTopic: string
  userId: string
  sources: KnowledgeSource[]
  existingTopics: string[]
  parentId?: string | null
  onClose: () => void
}) {
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

  // Refs so autosave closure always has latest values
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
      {/* header */}
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

      {/* metadata */}
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

      <RichTextEditor initialHtml={htmlBody} onChange={html => { setHtmlBody(html); schedule() }}/>
    </div>
  )
}

// ── Sources Manager ───────────────────────────────────────────────────────────

function SourcesManagerModal({ onClose }: { onClose: () => void }) {
  const { data: sources = [] } = useKnowledgeSources()
  const createSrc = useCreateKnowledgeSource()
  const updateSrc = useUpdateKnowledgeSource()
  const deleteSrc = useDeleteKnowledgeSource()

  const [newName, setNewName]   = useState('')
  const [newIcon, setNewIcon]   = useState('Tag')
  const [newColor, setNewColor] = useState('#64748b')
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
          {sources.map(src => (
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
              <button onClick={() => { if (confirm(`¿Eliminar fuente "${src.name}"?`)) deleteSrc.mutate(src.id) }}
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

// ── AI Analysis Panel ─────────────────────────────────────────────────────────

const SECTION_COLOR: Record<string, string> = {
  'RESUMEN EJECUTIVO':            'text-teal-300',
  'INSIGHTS CLAVE':               'text-amber-300',
  'DECISIONES TOMADAS':           'text-blue-300',
  'PENDIENTES Y PRÓXIMOS PASOS':  'text-purple-300',
  'CONTRADICCIONES O CONFLICTOS': 'text-red-300'
}

function AIAnalysisPanel({ topic, userId, onClose }: { topic: string; userId: string; onClose: () => void }) {
  const { data: latest, isLoading } = useTopicLatestSummary(topic)
  const analyze = useAnalyzeTopic()
  const sections = useMemo(() => latest?.summary ? parseAnalysis(latest.summary) : null, [latest?.summary])

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-[460px] bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Sparkles size={14} className="text-teal-400"/>Análisis IA
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">{topic}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => analyze.mutate({ topic, userId })} disabled={analyze.isPending}
            className="flex items-center gap-1.5 text-xs text-teal-400 bg-teal-900/30 hover:bg-teal-900/50 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50">
            {analyze.isPending ? <Loader2 size={11} className="animate-spin"/> : <Sparkles size={11}/>}
            {latest ? 'Re-analizar' : 'Analizar'}
          </button>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
            <X size={14}/>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {(isLoading || analyze.isPending) ? (
          <div className="flex items-center justify-center h-32"><Loader2 size={22} className="animate-spin text-teal-400"/></div>
        ) : !sections ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500">
            <Sparkles size={32} className="mb-3 text-slate-800"/>
            <p className="text-sm text-center">No hay análisis para este tema.</p>
            <p className="text-xs mt-1 text-slate-600">Presioná "Analizar" para generarlo con IA.</p>
          </div>
        ) : (
          <>
            {latest && <p className="text-[10px] text-slate-600">{fmtDate(latest.created_at)} · {latest.entry_count} entradas</p>}
            {Object.entries(sections).map(([h, content]) => (
              <div key={h}>
                <h4 className={`text-[10px] uppercase tracking-wider font-semibold mb-2 ${SECTION_COLOR[h] ?? 'text-slate-400'}`}>{h}</h4>
                <p className="text-[13px] text-slate-300 leading-relaxed whitespace-pre-wrap">{content}</p>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ── Entry Document Modal ──────────────────────────────────────────────────────

function EntryDocumentModal({
  entry,
  subEntries,
  onClose
}: {
  entry: KnowledgeEntry
  subEntries: KnowledgeEntry[]
  onClose: () => void
}) {
  const generateDoc = useGenerateEntryDocument()
  const saveDoc     = useSaveThreadDoc()
  const [doc, setDoc] = useState<{ synthesis: string; keyData: string[]; nextSteps: string[] } | null>(null)
  const [checks, setChecks] = useState<boolean[]>([])

  useEffect(() => {
    generateDoc.mutate(entry.id, {
      onSuccess: (d) => {
        setDoc(d)
        setChecks(d.nextSteps.map(() => false))
      }
    })
  }, [entry.id])

  async function handleSave() {
    if (!doc) return
    await saveDoc.mutateAsync({
      entryId:    entry.id,
      synthesis:  doc.synthesis,
      keyData:    doc.keyData,
      nextSteps:  doc.nextSteps,
      checks:     checks,
      entryCount: subEntries.length + 1
    })
    onClose()
  }

  const timeline = useMemo(() => {
    return [entry, ...subEntries].sort(
      (a, b) => (a.entry_date ?? a.created_at) - (b.entry_date ?? b.created_at)
    )
  }, [entry, subEntries])

  const toggleCheck = (i: number) => setChecks(prev => prev.map((v, j) => j === i ? !v : v))

  const DOT_COLORS = [
    'bg-blue-200 border-blue-400',
    'bg-green-200 border-green-400',
    'bg-yellow-200 border-yellow-400',
    'bg-purple-200 border-purple-400',
    'bg-rose-200 border-rose-400',
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/60 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-4">

        {/* doc header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-violet-600"/>
            <span className="text-sm font-medium text-slate-800">Documento resumen</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-violet-100 text-violet-700">IA · Sonnet 4.6</span>
          </div>
          <div className="flex items-center gap-2">
            {doc && (
              <>
                <button
                  onClick={() => { setDoc(null); generateDoc.mutate(entry.id, { onSuccess: (d) => { setDoc(d); setChecks(d.nextSteps.map(() => false)) } }) }}
                  className="flex items-center gap-1.5 text-xs text-slate-500 border border-slate-200 hover:border-slate-300 px-2.5 py-1.5 rounded-lg transition-colors">
                  <RefreshCw size={11}/>Regenerar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saveDoc.isPending}
                  className="flex items-center gap-1.5 text-xs text-violet-700 bg-violet-100 hover:bg-violet-200 border border-violet-200 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                  {saveDoc.isPending ? <Loader2 size={11} className="animate-spin"/> : <CheckCircle2 size={11}/>}
                  Guardar en la entrada
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 hover:border-slate-300 text-slate-400 hover:text-slate-600 transition-colors">
              <X size={13}/>
            </button>
          </div>
        </div>

        <div className="px-8 py-7">

          {/* title */}
          <h1 className="text-xl font-medium text-slate-800 mb-1">{entry.title || '(sin título)'}</h1>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-7 flex-wrap">
            <span>{dayjs(entry.entry_date ?? entry.created_at).format('DD/MM/YYYY')} – {dayjs((subEntries[subEntries.length - 1]?.entry_date ?? subEntries[subEntries.length - 1]?.created_at) ?? (entry.entry_date ?? entry.created_at)).format('DD/MM/YYYY')}</span>
            <span>·</span>
            <span><GitBranch size={11} className="inline -mt-0.5 mr-0.5"/>{timeline.length} entrada{timeline.length !== 1 ? 's' : ''} en el hilo</span>
          </div>

          {generateDoc.isPending || !doc ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 size={28} className="animate-spin text-violet-400 mb-3"/>
              <p className="text-sm">Generando documento...</p>
            </div>
          ) : (
            <>
              {/* Síntesis */}
              <div className="mb-7">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-0.5 h-4 bg-violet-500 rounded-full"/>
                  <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider">Síntesis</span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{doc.synthesis}</p>
              </div>

              {/* Línea de tiempo */}
              <div className="mb-7">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-0.5 h-4 bg-violet-500 rounded-full"/>
                  <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider">Línea de tiempo</span>
                </div>
                <div>
                  {timeline.map((e, i) => (
                    <div key={e.id} className="flex gap-3 items-start">
                      <div className="text-[10px] font-medium text-slate-400 min-w-[42px] text-right pt-0.5">
                        {dayjs(e.entry_date ?? e.created_at).format('DD MMM')}
                      </div>
                      <div className="flex flex-col items-center shrink-0">
                        <div className={`w-2 h-2 rounded-full border-[1.5px] mt-1 ${DOT_COLORS[i % DOT_COLORS.length]}`}/>
                        {i < timeline.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1 mb-1 min-h-[20px]"/>}
                      </div>
                      <div className="flex-1 pb-3">
                        <p className="text-xs text-slate-700 leading-relaxed">
                          {e.source && <span className="font-medium text-slate-500">[{e.source}] </span>}
                          {e.title || '(sin título)'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Datos clave */}
              {doc.keyData.length > 0 && (
                <div className="mb-7">
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-0.5 h-4 bg-violet-500 rounded-full"/>
                    <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider">Datos clave</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {doc.keyData.map((item, i) => {
                      const [label, ...rest] = item.split(':')
                      const value = rest.join(':').trim()
                      return (
                        <div key={i} className="bg-slate-50 rounded-lg px-3 py-2.5">
                          <div className="text-[10px] text-slate-400 mb-0.5">{label}</div>
                          <div className="text-sm font-medium text-slate-700">{value || item}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Próximos pasos */}
              {doc.nextSteps.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-0.5 h-4 bg-violet-500 rounded-full"/>
                    <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider">Próximos pasos</span>
                  </div>
                  <div className="space-y-2">
                    {doc.nextSteps.map((step, i) => (
                      <button
                        key={i}
                        onClick={() => toggleCheck(i)}
                        className="flex items-start gap-2.5 w-full text-left group"
                      >
                        {checks[i]
                          ? <CheckSquare size={14} className="mt-0.5 shrink-0 text-violet-500"/>
                          : <Square size={14} className="mt-0.5 shrink-0 text-slate-300 group-hover:text-slate-400"/>
                        }
                        <span className={`text-xs leading-relaxed ${checks[i] ? 'line-through text-slate-400' : 'text-slate-600'}`}>
                          {step}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Thread Sub-Entry Row — separate component so hooks work inside map ────────

function ThreadSubEntry({
  sub, dotClass, isLast, isExpanded, rootEntryId, onToggle, onEdit
}: {
  sub: KnowledgeEntry
  dotClass: string
  isLast: boolean
  isExpanded: boolean
  rootEntryId: string
  onToggle: () => void
  onEdit: () => void
}) {
  const subDate    = sub.entry_date ?? sub.created_at
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
            <span className="text-[10px] font-medium text-slate-600">{dayjs(subDate).format('DD MMM YY')}</span>
            {sub.source && (
              <span className="text-[10px] px-1.5 py-px rounded-full bg-slate-700 text-slate-400">{sub.source}</span>
            )}
            <span className="flex-1 text-xs text-slate-300 truncate">{sub.title || '(sin título)'}</span>
            <button
              onClick={e => { e.stopPropagation(); onEdit() }}
              className="text-slate-700 hover:text-teal-400 p-0.5 rounded transition-colors shrink-0">
              <Pencil size={9}/>
            </button>
            <ChevronDown size={11} className={`text-slate-600 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}/>
          </div>
          {isExpanded && (
            <div className="mt-2 pt-2 border-t border-slate-700/60" onClick={e => e.stopPropagation()}>
              {subHasHtml ? (
                <div
                  className="text-[12px] text-slate-400 leading-relaxed [&_img]:max-w-full [&_img]:rounded [&_ul]:list-disc [&_ul]:pl-4 [&_a]:text-teal-400"
                  dangerouslySetInnerHTML={{ __html: sub.body }}
                />
              ) : (
                <p className="text-[12px] text-slate-400 leading-relaxed whitespace-pre-wrap">{subPreview || '(sin contenido)'}</p>
              )}
              <AttachmentStrip entryId={sub.id} rootEntryId={rootEntryId} compact={true}/>
            </div>
          )}
        </button>
      </div>
    </div>
  )
}

// ── Entry Dossier Card ────────────────────────────────────────────────────────

function EntryDossierCard({
  entry, source, onEdit, onDelete, onAddToThread, onShowDocument, onEditSub
}: {
  entry: KnowledgeEntry
  source: KnowledgeSource | undefined
  onEdit: () => void
  onDelete: () => void
  onAddToThread: () => void
  onShowDocument: () => void
  onEditSub: (sub: KnowledgeEntry) => void
}) {
  const [expanded,     setExpanded]     = useState(false)
  const [threadOpen,   setThreadOpen]   = useState(false)
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set())

  const { data: subEntries = [] } = useKnowledgeSubEntries(entry.id)
  const { data: savedDoc }        = useThreadDoc(entry.id)

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

  const SUB_DOT = ['bg-green-200 border-green-400', 'bg-yellow-200 border-yellow-400', 'bg-blue-200 border-blue-400', 'bg-rose-200 border-rose-400', 'bg-purple-200 border-purple-400']

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors">
      {/* ── main entry ─────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 p-4">
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
                onClick={() => {
                  const next = !threadOpen
                  setThreadOpen(next)
                  if (next) setExpandedSubs(new Set(subEntries.map(s => s.id)))
                }}
                className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-900/30 text-violet-400 border border-violet-800/40 hover:bg-violet-900/50 transition-colors">
                <GitBranch size={9}/>{subEntries.length} en el hilo
              </button>
            )}
          </div>

          <h3 className="text-sm font-medium text-slate-100 mb-1">{entry.title || '(sin título)'}</h3>

          {savedDoc ? (
            <div className="mb-1.5">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-violet-900/30 text-violet-400 border border-violet-800/40">
                  <FileText size={8}/>Documento IA guardado
                </span>
                <button
                  onClick={onShowDocument}
                  className="text-[9px] text-violet-500 hover:text-violet-300 transition-colors">
                  Ver documento completo
                </button>
              </div>
              <p className="text-[12px] text-slate-400 line-clamp-2">{savedDoc.synthesis}</p>
            </div>
          ) : entry.ai_summary ? (
            <p className="text-[12px] text-teal-200/70 line-clamp-2 mb-1.5">{entry.ai_summary}</p>
          ) : preview ? (
            <p className="text-[12px] text-slate-500 line-clamp-2 mb-1.5">{preview}</p>
          ) : null}

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map(t => (
                <span key={t} className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{t}</span>
              ))}
            </div>
          )}

          {expanded && (
            <div className="mt-3">
              {entry.body && (
                <div className="pt-3 border-t border-slate-800">
                  {hasHtml ? (
                    <div
                      className="text-[13px] text-slate-300 leading-relaxed [&_img]:max-w-full [&_img]:rounded-lg [&_ul]:list-disc [&_ul]:pl-4 [&_a]:text-teal-400 [&_a]:underline"
                      dangerouslySetInnerHTML={{ __html: entry.body }}
                    />
                  ) : (
                    <p className="text-[13px] text-slate-300 leading-relaxed whitespace-pre-wrap">{entry.body}</p>
                  )}
                </div>
              )}
              <AttachmentStrip entryId={entry.id}/>
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => setExpanded(v => !v)}
            className="text-slate-700 hover:text-slate-400 p-1.5 rounded hover:bg-slate-800 transition-colors">
            <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`}/>
          </button>
          <button onClick={onEdit} className="text-slate-700 hover:text-teal-400 p-1.5 rounded hover:bg-slate-800 transition-colors">
            <Pencil size={11}/>
          </button>
          <button onClick={onDelete} className="text-slate-700 hover:text-red-400 p-1.5 rounded hover:bg-slate-800 transition-colors">
            <Trash2 size={11}/>
          </button>
        </div>
      </div>

      {/* ── thread section ──────────────────────────────────────────────────── */}
      {threadOpen && (
        <div className="px-4 pb-3 border-t border-slate-800/60 pt-3">
          <div className="text-[9px] uppercase tracking-widest text-slate-700 mb-2.5 flex items-center gap-1.5">
            <GitBranch size={9}/>HILO DE SEGUIMIENTO
          </div>

          {subEntries.map((sub, i) => (
            <ThreadSubEntry
              key={sub.id}
              sub={sub}
              dotClass={SUB_DOT[i % SUB_DOT.length]}
              isLast={i === subEntries.length - 1}
              isExpanded={expandedSubs.has(sub.id)}
              rootEntryId={entry.id}
              onToggle={() => toggleSub(sub.id)}
              onEdit={() => onEditSub(sub)}
            />
          ))}

          <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/60">
            <button
              onClick={onAddToThread}
              className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors border border-slate-800 hover:border-slate-700">
              <Plus size={11}/>Agregar al hilo
            </button>
            {subEntries.length > 0 && (
              <button
                onClick={onShowDocument}
                className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg transition-colors border ${savedDoc ? 'text-violet-300 bg-violet-900/30 border-violet-700/40 hover:bg-violet-900/50' : 'text-violet-400 bg-violet-900/20 border-violet-800/30 hover:bg-violet-900/40 hover:border-violet-700/50'}`}>
                {savedDoc ? <><RefreshCw size={11}/>Regenerar documento</> : <><Sparkles size={11}/>Generar documento resumen</>}
              </button>
            )}
          </div>
        </div>
      )}

      {/* "Agregar al hilo" shortcut when thread is closed */}
      {!threadOpen && (
        <div className="flex items-center gap-1 px-4 pb-2 pt-0">
          <button
            onClick={onAddToThread}
            className="flex items-center gap-1 text-[10px] text-slate-700 hover:text-slate-400 transition-colors">
            <Plus size={10}/>Agregar al hilo
          </button>
          {subEntries.length > 0 && (
            <button
              onClick={onShowDocument}
              className="ml-auto flex items-center gap-1 text-[10px] text-violet-600 hover:text-violet-400 transition-colors">
              {savedDoc ? <><RefreshCw size={10}/>Regenerar</> : <><Sparkles size={10}/>Generar documento</>}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function KnowledgeDashboard() {
  const { data: session } = useAuthSession()
  const userId = session?.userId ?? ''

  const { data: sources  = [] } = useKnowledgeSources()
  const { data: allEntries = [], isLoading } = useKnowledgeEntries({})
  const { data: topics   = [] } = useKnowledgeTopics()

  const [selectedTopic, setSelectedTopic]   = useState<string | null>(null)
  const [topicSearch, setTopicSearch]       = useState('')
  const [editorOpen, setEditorOpen]         = useState(false)
  const [editingEntry, setEditingEntry]     = useState<KnowledgeEntry | null>(null)
  const [addingToThread, setAddingToThread] = useState<KnowledgeEntry | null>(null)
  const [documentEntry, setDocumentEntry]   = useState<KnowledgeEntry | null>(null)
  const [showSources, setShowSources]       = useState(false)
  const [showAIPanel, setShowAIPanel]       = useState(false)

  const del = useDeleteKnowledgeEntry()
  const { data: documentSubEntries = [] } = useKnowledgeSubEntries(documentEntry?.id ?? null)

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

  const dossierEntries = useMemo(() =>
    selectedTopic === null ? allEntries : allEntries.filter(e => e.topic === selectedTopic),
    [allEntries, selectedTopic]
  )

  const sourceByName = useMemo(() => {
    const m: Record<string, KnowledgeSource> = {}
    for (const s of sources) m[s.name] = s
    return m
  }, [sources])

  const openNewEntry = () => { setEditingEntry(null); setAddingToThread(null); setEditorOpen(true) }
  const openEditEntry = (e: KnowledgeEntry) => { setEditingEntry(e); setAddingToThread(null); setEditorOpen(true) }
  const openAddToThread = (parent: KnowledgeEntry) => { setEditingEntry(null); setAddingToThread(parent); setEditorOpen(true) }
  const closeEditor = () => { setEditorOpen(false); setEditingEntry(null); setAddingToThread(null) }
  const handleDelete = (id: string) => { if (confirm('¿Eliminar esta entrada?')) del.mutate(id) }

  return (
    <div className="flex h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* ── Topic sidebar ─────────────────────────────────────────────────── */}
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
          <button onClick={() => setSelectedTopic(null)}
            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${selectedTopic === null ? 'bg-teal-900/30 text-teal-300 border-r-2 border-teal-500' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
            <span>Todas</span>
            <span className="text-[11px] opacity-60">{allEntries.length}</span>
          </button>

          {filteredTopics.map(t => (
            <button key={t} onClick={() => setSelectedTopic(t)}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${selectedTopic === t ? 'bg-teal-900/30 text-teal-300 border-r-2 border-teal-500' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
              <span className="truncate">{t}</span>
              <span className="text-[11px] opacity-60 shrink-0 ml-1">{topicCounts[t] ?? 0}</span>
            </button>
          ))}

          {topics.length === 0 && !isLoading && (
            <p className="px-4 py-6 text-[11px] text-slate-600 text-center">
              Los temas aparecen aquí cuando creas entradas
            </p>
          )}
        </div>
      </div>

      {/* ── Dossier panel ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <h2 className="text-sm font-semibold text-slate-100">
            {selectedTopic ?? 'Todas las entradas'}
            {dossierEntries.length > 0 && (
              <span className="ml-2 text-[11px] text-slate-500 font-normal">
                {dossierEntries.length} entrada{dossierEntries.length !== 1 ? 's' : ''}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            {selectedTopic && (
              <>
                <button onClick={() => setShowAIPanel(v => !v)}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${showAIPanel ? 'bg-teal-900/40 border-teal-600 text-teal-300' : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'}`}>
                  <Sparkles size={11}/>Análisis IA
                </button>
                <button onClick={() => exportTopicPDF(selectedTopic, dossierEntries)}
                  className="flex items-center gap-1.5 text-xs border border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200 px-2.5 py-1.5 rounded-lg transition-colors">
                  <Download size={11}/>PDF
                </button>
              </>
            )}
            <button onClick={openNewEntry}
              className="flex items-center gap-1.5 text-xs text-teal-300 bg-teal-900/30 hover:bg-teal-900/50 border border-teal-700 px-2.5 py-1.5 rounded-lg transition-colors">
              <Plus size={11}/>Nueva entrada
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={22} className="animate-spin text-teal-400"/>
            </div>
          ) : dossierEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500">
              <Brain size={38} className="mb-3 text-slate-800"/>
              <p className="text-sm">{selectedTopic ? `No hay entradas en "${selectedTopic}"` : 'No hay entradas aún'}</p>
              <button onClick={openNewEntry} className="mt-3 text-sm text-teal-400 hover:text-teal-300 transition-colors">
                Crear primera entrada
              </button>
            </div>
          ) : (
            dossierEntries.map(e => (
              <EntryDossierCard
                key={e.id}
                entry={e}
                source={sourceByName[e.source]}
                onEdit={() => openEditEntry(e)}
                onDelete={() => handleDelete(e.id)}
                onAddToThread={() => openAddToThread(e)}
                onShowDocument={() => setDocumentEntry(e)}
                onEditSub={sub => openEditEntry(sub)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Overlays ──────────────────────────────────────────────────────── */}

      {editorOpen && (
        <EntryEditorModal
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
        <EntryDocumentModal
          entry={documentEntry}
          subEntries={documentSubEntries}
          onClose={() => setDocumentEntry(null)}
        />
      )}

      {showSources && <SourcesManagerModal onClose={() => setShowSources(false)}/>}

      {showAIPanel && selectedTopic && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowAIPanel(false)}/>
          <AIAnalysisPanel topic={selectedTopic} userId={userId} onClose={() => setShowAIPanel(false)}/>
        </>
      )}
    </div>
  )
}
