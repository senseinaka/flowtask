import { useState, useEffect, useRef, useCallback } from 'react'
import { useEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { Node as TiptapNode, mergeAttributes } from '@tiptap/core'
import type { Editor, NodeViewProps } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold, Italic, Underline as UIcon, Strikethrough, Highlighter,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, ListChecks, Quote, Code2,
  Table as TableIcon, Link2, Minus, Undo2, Redo2,
  Heading1, Heading2, Heading3, Type, ChevronDown, Film
} from 'lucide-react'

interface Props {
  initialHtml: string
  onChange: (html: string) => void
  readOnly?: boolean
}

// ── Video embed helpers ─────────────────────────────────────────────
function toEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vm = url.match(/vimeo\.com\/(\d+)/)
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`
  return null
}

function VideoEmbedView({ node }: NodeViewProps) {
  const src = (node.attrs as { src: string }).src
  return (
    <NodeViewWrapper>
      <div contentEditable={false} style={{ position: 'relative', paddingBottom: '56.25%', height: 0, margin: '1rem 0', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--surface-sunken)' }}>
        <iframe
          src={src}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </NodeViewWrapper>
  )
}

const VideoEmbed = TiptapNode.create({
  name: 'videoEmbed',
  group: 'block',
  atom: true,
  addAttributes() {
    return { src: { default: null } }
  },
  parseHTML() {
    return [{ tag: 'div[data-video-embed]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-video-embed': '' }, HTMLAttributes)]
  },
  addNodeView() {
    return ReactNodeViewRenderer(VideoEmbedView)
  },
})

// ── Slash commands ──────────────────────────────────────────────────
type SlashCmd = {
  id: string
  label: string
  icon: React.ElementType
  action: (e: Editor) => void
}
const SLASH_COMMANDS: SlashCmd[] = [
  { id: 'p',    label: 'Párrafo',        icon: Type,        action: e => e.chain().focus().setParagraph().run() },
  { id: 'h1',   label: 'Título 1',       icon: Heading1,    action: e => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { id: 'h2',   label: 'Título 2',       icon: Heading2,    action: e => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { id: 'h3',   label: 'Título 3',       icon: Heading3,    action: e => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { id: 'ul',   label: 'Lista',          icon: List,        action: e => e.chain().focus().toggleBulletList().run() },
  { id: 'ol',   label: 'Lista numerada', icon: ListOrdered, action: e => e.chain().focus().toggleOrderedList().run() },
  { id: 'todo', label: 'Checklist',      icon: ListChecks,  action: e => e.chain().focus().toggleTaskList().run() },
  { id: 'bq',   label: 'Cita',           icon: Quote,       action: e => e.chain().focus().toggleBlockquote().run() },
  { id: 'code', label: 'Código',         icon: Code2,       action: e => e.chain().focus().toggleCodeBlock().run() },
  { id: 'hr',   label: 'Separador',      icon: Minus,       action: e => e.chain().focus().setHorizontalRule().run() },
  { id: 'tbl',  label: 'Tabla',          icon: TableIcon,   action: e => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { id: 'video', label: 'Video',         icon: Film,        action: e => {
    const url = prompt('URL de YouTube o Vimeo:')
    if (!url) return
    const embedUrl = toEmbedUrl(url)
    if (!embedUrl) { alert('URL no reconocida. Usá youtube.com o vimeo.com.'); return }
    e.chain().focus().insertContent({ type: 'videoEmbed', attrs: { src: embedUrl } }).run()
  }},
]

// ── Small toolbar button ────────────────────────────────────────────
function TBtn({ active, title, disabled, onClick, children }: {
  active?: boolean; title: string; disabled?: boolean
  onClick: () => void; children: React.ReactNode
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 27, height: 27, border: 'none', borderRadius: 'var(--radius-md)',
        background: active ? 'var(--primary)' : hov ? 'var(--slate-700)' : 'transparent',
        color: active ? '#fff' : 'var(--text-muted)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        flexShrink: 0,
        transition: 'background 0.1s',
      }}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 3px', flexShrink: 0 }} />
}

// ── Heading dropdown ────────────────────────────────────────────────
function HeadingDrop({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const label = editor.isActive('heading', { level: 1 }) ? 'Título 1'
    : editor.isActive('heading', { level: 2 }) ? 'Título 2'
    : editor.isActive('heading', { level: 3 }) ? 'Título 3' : 'Normal'

  const opts = [
    { label: 'Normal',   fn: () => editor.chain().focus().setParagraph().run() },
    { label: 'Título 1', fn: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: 'Título 2', fn: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: 'Título 3', fn: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
  ]

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(v => !v)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        height: 27, padding: '0 7px', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)',
        color: 'var(--text-body)', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
      }}>
        {label} <ChevronDown size={10} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 3, zIndex: 200,
          background: 'var(--surface-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 24px rgba(0,0,0,.4)',
          minWidth: 120, overflow: 'hidden',
        }}>
          {opts.map(o => (
            <OptBtn key={o.label} label={o.label} onClick={() => { o.fn(); setOpen(false) }} />
          ))}
        </div>
      )}
    </div>
  )
}

function OptBtn({ label, onClick }: { label: string; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'block', width: '100%', padding: '6px 12px', border: 'none',
        textAlign: 'left', background: hov ? 'var(--slate-700)' : 'transparent',
        color: 'var(--text-body)', fontSize: 12, cursor: 'pointer',
      }}>
      {label}
    </button>
  )
}

// ── Main toolbar ────────────────────────────────────────────────────
function Toolbar({ editor }: { editor: Editor }) {
  const e = editor
  const setLink = useCallback(() => {
    const prev = e.getAttributes('link').href as string | undefined
    const url = prompt('URL del enlace:', prev ?? '')
    if (url === null) return
    if (url === '') { e.chain().focus().unsetLink().run(); return }
    e.chain().focus().setLink({ href: url }).run()
  }, [e])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
      padding: '5px 10px', borderBottom: '1px solid var(--border)',
      background: 'var(--surface-card)', flexShrink: 0,
    }}>
      <HeadingDrop editor={e} />
      <Sep />
      <TBtn active={e.isActive('bold')}      title="Negrita (Ctrl+B)"   onClick={() => e.chain().focus().toggleBold().run()}><Bold size={12}/></TBtn>
      <TBtn active={e.isActive('italic')}    title="Cursiva (Ctrl+I)"   onClick={() => e.chain().focus().toggleItalic().run()}><Italic size={12}/></TBtn>
      <TBtn active={e.isActive('underline')} title="Subrayado (Ctrl+U)" onClick={() => e.chain().focus().toggleUnderline().run()}><UIcon size={12}/></TBtn>
      <TBtn active={e.isActive('strike')}    title="Tachado"            onClick={() => e.chain().focus().toggleStrike().run()}><Strikethrough size={12}/></TBtn>
      <TBtn active={e.isActive('highlight')} title="Resaltar"           onClick={() => e.chain().focus().toggleHighlight().run()}><Highlighter size={12}/></TBtn>
      <Sep />
      <TBtn active={e.isActive({ textAlign: 'left' })}   title="Alinear izq." onClick={() => e.chain().focus().setTextAlign('left').run()}><AlignLeft size={12}/></TBtn>
      <TBtn active={e.isActive({ textAlign: 'center' })} title="Centrar"      onClick={() => e.chain().focus().setTextAlign('center').run()}><AlignCenter size={12}/></TBtn>
      <TBtn active={e.isActive({ textAlign: 'right' })}  title="Alinear der." onClick={() => e.chain().focus().setTextAlign('right').run()}><AlignRight size={12}/></TBtn>
      <Sep />
      <TBtn active={e.isActive('bulletList')}  title="Lista (/ + lista)"          onClick={() => e.chain().focus().toggleBulletList().run()}><List size={12}/></TBtn>
      <TBtn active={e.isActive('orderedList')} title="Lista numerada"             onClick={() => e.chain().focus().toggleOrderedList().run()}><ListOrdered size={12}/></TBtn>
      <TBtn active={e.isActive('taskList')}    title="Checklist"                  onClick={() => e.chain().focus().toggleTaskList().run()}><ListChecks size={12}/></TBtn>
      <TBtn active={e.isActive('blockquote')}  title="Cita"                       onClick={() => e.chain().focus().toggleBlockquote().run()}><Quote size={12}/></TBtn>
      <TBtn active={e.isActive('codeBlock')}   title="Bloque de código"           onClick={() => e.chain().focus().toggleCodeBlock().run()}><Code2 size={12}/></TBtn>
      <Sep />
      <TBtn active={false} title="Insertar tabla" onClick={() => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon size={12}/></TBtn>
      <TBtn active={e.isActive('link')}  title="Enlace" onClick={setLink}><Link2 size={12}/></TBtn>
      <TBtn active={false} title="Separador" onClick={() => e.chain().focus().setHorizontalRule().run()}><Minus size={12}/></TBtn>
      <div style={{ flex: 1 }} />
      <TBtn active={false} disabled={!e.can().undo()} title="Deshacer (Ctrl+Z)" onClick={() => e.chain().focus().undo().run()}><Undo2 size={12}/></TBtn>
      <TBtn active={false} disabled={!e.can().redo()} title="Rehacer (Ctrl+Y)" onClick={() => e.chain().focus().redo().run()}><Redo2 size={12}/></TBtn>
    </div>
  )
}

// ── Slash command menu ──────────────────────────────────────────────
type SlashState = { query: string; from: number; filtered: SlashCmd[]; idx: number } | null

export default function KnowledgeRichTextEditor({ initialHtml, onChange, readOnly = false }: Props) {
  const slashRef  = useRef<SlashState>(null)
  const [slash, setSlash]   = useState<SlashState>(null)
  const [slashXY, setSlashXY] = useState<{ x: number; y: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const closeSlash = useCallback(() => {
    slashRef.current = null
    setSlash(null)
    setSlashXY(null)
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
      Image.configure({ allowBase64: true, resize: { enabled: true, minWidth: 60 } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({ placeholder: 'Escribí, pegá contenido o usá "/" para comandos...' }),
      VideoEmbed,
    ],
    content: initialHtml || '',
    editable: !readOnly,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML())

      if (readOnly) return
      const { state, view } = e
      const { selection } = state
      const { $from } = selection

      if (!selection.empty) { closeSlash(); return }

      const blockStart  = $from.start()
      const textBefore  = state.doc.textBetween(blockStart, $from.pos)

      if (textBefore.startsWith('/') && !/\s/.test(textBefore)) {
        const query    = textBefore.slice(1)
        const filtered = SLASH_COMMANDS.filter(c => !query || c.label.toLowerCase().includes(query.toLowerCase()))
        if (filtered.length === 0) { closeSlash(); return }

        const coords  = view.coordsAtPos(blockStart)
        const next: SlashState = { query, from: blockStart, filtered, idx: 0 }
        slashRef.current = next
        setSlash(next)
        setSlashXY({ x: coords.left, y: coords.bottom + 6 })
      } else {
        closeSlash()
      }
    },
  })

  // Sync readOnly
  useEffect(() => { editor?.setEditable(!readOnly) }, [editor, readOnly])

  // Capture-phase keyboard handler for slash menu navigation
  useEffect(() => {
    const el = wrapRef.current
    if (!el || !editor) return

    const onKeyDown = (e: KeyboardEvent) => {
      const s = slashRef.current
      if (!s) return

      if (e.key === 'ArrowDown') {
        e.preventDefault(); e.stopPropagation()
        const next = { ...s, idx: (s.idx + 1) % s.filtered.length }
        slashRef.current = next; setSlash({ ...next })
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation()
        const next = { ...s, idx: (s.idx - 1 + s.filtered.length) % s.filtered.length }
        slashRef.current = next; setSlash({ ...next })
      } else if (e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation()
        const cmd = s.filtered[s.idx]
        if (cmd) {
          const to = editor.state.selection.from
          editor.chain().focus().deleteRange({ from: s.from, to }).run()
          cmd.action(editor)
        }
        closeSlash()
      } else if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation()
        closeSlash()
      }
    }

    el.addEventListener('keydown', onKeyDown, { capture: true })
    return () => el.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [editor, closeSlash])

  // Image paste
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    for (const item of Array.from(e.clipboardData.items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file || !editor) continue
        const ab  = await file.arrayBuffer()
        const res = await window.api.knowledge.entries.saveClipboardImage(ab, file.type)
        editor.chain().focus().setImage({ src: `file://${res.localPath}` }).run()
        return
      }
    }
  }, [editor])

  const execSlash = useCallback((cmd: SlashCmd) => {
    if (!editor || !slashRef.current) return
    const to = editor.state.selection.from
    editor.chain().focus().deleteRange({ from: slashRef.current.from, to }).run()
    cmd.action(editor)
    closeSlash()
  }, [editor, closeSlash])

  return (
    <div ref={wrapRef} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}>
      {!readOnly && editor && <Toolbar editor={editor} />}

      {/* Bubble menu — shows on text selection */}
      {editor && !readOnly && (
        <BubbleMenu editor={editor}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 1, padding: '3px 4px',
            background: 'var(--surface-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 24px rgba(0,0,0,.5)',
          }}>
            <TBtn active={editor.isActive('bold')}      title="Negrita"   onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={11}/></TBtn>
            <TBtn active={editor.isActive('italic')}    title="Cursiva"   onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={11}/></TBtn>
            <TBtn active={editor.isActive('underline')} title="Subrayado" onClick={() => editor.chain().focus().toggleUnderline().run()}><UIcon size={11}/></TBtn>
            <TBtn active={editor.isActive('strike')}    title="Tachado"   onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={11}/></TBtn>
            <TBtn active={editor.isActive('highlight')} title="Resaltar"  onClick={() => editor.chain().focus().toggleHighlight().run()}><Highlighter size={11}/></TBtn>
            <Sep/>
            <TBtn active={editor.isActive('link')} title="Enlace" onClick={() => {
              const url = prompt('URL:', editor.getAttributes('link').href ?? '')
              if (url === null) return
              if (!url) { editor.chain().focus().unsetLink().run(); return }
              editor.chain().focus().setLink({ href: url }).run()
            }}><Link2 size={11}/></TBtn>
          </div>
        </BubbleMenu>
      )}

      {/* Editor canvas */}
      <div className="tiptap-canvas" onPaste={handlePaste}
        style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <EditorContent editor={editor} style={{ flex: 1 }} />
      </div>

      {/* Slash command menu */}
      {slash && slashXY && (
        <div style={{
          position: 'fixed', top: slashXY.y, left: slashXY.x, zIndex: 300,
          background: 'var(--surface-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: '0 12px 32px rgba(0,0,0,.5)',
          minWidth: 190, maxHeight: 280, overflowY: 'auto',
        }}>
          {slash.filtered.map((cmd, i) => {
            const Ic = cmd.icon
            return (
              <SlashItem key={cmd.id} label={cmd.label} icon={<Ic size={13}/>}
                active={i === slash.idx}
                onClick={() => execSlash(cmd)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function SlashItem({ label, icon, active, onClick }: {
  label: string; icon: React.ReactNode; active: boolean; onClick: () => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '7px 12px', border: 'none',
        background: active || hov ? 'var(--slate-700)' : 'transparent',
        color: 'var(--text-body)', fontSize: 13, cursor: 'pointer', textAlign: 'left',
      }}>
      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{icon}</span>
      {label}
    </button>
  )
}
