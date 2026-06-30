import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from '../../store/toast.store'
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
import { TextStyle, FontFamily, FontSize } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import {
  Bold, Italic, Underline as UIcon, Strikethrough, Highlighter,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, ListChecks, Quote, Code2,
  Table as TableIcon, Link2, Minus, Undo2, Redo2,
  Heading1, Heading2, Heading3, Type, ChevronDown, Film,
  Sparkles, Loader2, LayoutTemplate, Baseline
} from 'lucide-react'
import { useTransformKnowledgeText } from '../../hooks/useKnowledge'

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

/**
 * Sólo se permiten iframes de embed de YouTube/Vimeo. El atributo `src` del nodo
 * puede provenir de una entrada sincronizada por otro usuario (no confiable);
 * sin esta validación un `src="javascript:..."` u origen arbitrario podría
 * inyectar un iframe hostil. Devuelve null si no es un embed confiable.
 */
function safeEmbedSrc(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:') return null
    if (u.hostname === 'www.youtube.com' && u.pathname.startsWith('/embed/')) return u.toString()
    if (u.hostname === 'player.vimeo.com' && u.pathname.startsWith('/video/')) return u.toString()
    return null
  } catch {
    return null
  }
}

function VideoEmbedView({ node }: NodeViewProps) {
  const src = safeEmbedSrc((node.attrs as { src: string }).src)
  return (
    <NodeViewWrapper>
      <div contentEditable={false} style={{ position: 'relative', paddingBottom: '56.25%', height: 0, margin: '1rem 0', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--surface-sunken)' }}>
        {src && (
          <iframe
            src={src}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
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

// ── Color palette ──────────────────────────────────────────────────
const COLORS = [
  { label: 'Blanco',   value: '#f1f5f9' },
  { label: 'Gris',     value: '#94a3b8' },
  { label: 'Rojo',     value: '#f87171' },
  { label: 'Naranja',  value: '#fb923c' },
  { label: 'Amarillo', value: '#fbbf24' },
  { label: 'Verde',    value: '#4ade80' },
  { label: 'Teal',     value: '#2dd4bf' },
  { label: 'Azul',     value: '#60a5fa' },
  { label: 'Violeta',  value: '#a78bfa' },
  { label: 'Rosa',     value: '#f472b6' },
]

// ── Font families ───────────────────────────────────────────────────
const FONTS = [
  { label: 'Sistema',       value: '' },
  { label: 'Arial',         value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia',       value: 'Georgia, serif' },
  { label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
  { label: 'Trebuchet MS',  value: "'Trebuchet MS', Tahoma, sans-serif" },
  { label: 'Monoespaciada', value: "'Cascadia Code', Consolas, monospace" },
]

// ── Templates ───────────────────────────────────────────────────────
const TEMPLATES = [
  {
    label: 'Reunión',
    html: `<h2>Reunión</h2>
<p><strong>Fecha:</strong> </p>
<p><strong>Participantes:</strong> </p>
<h3>Agenda</h3>
<ul><li></li></ul>
<h3>Puntos tratados</h3>
<ul><li></li></ul>
<h3>Decisiones</h3>
<ul><li></li></ul>
<h3>Próximos pasos</h3>
<ul data-type="taskList"><li data-checked="false"><div></div></li></ul>`,
  },
  {
    label: 'Proveedor',
    html: `<h2>Ficha de Proveedor</h2>
<p><strong>Empresa:</strong> </p>
<p><strong>Contacto:</strong> </p>
<p><strong>Email / Tel:</strong> </p>
<h3>Condiciones comerciales</h3>
<ul><li><strong>Moneda:</strong> </li><li><strong>Plazo de pago:</strong> </li><li><strong>Lead time:</strong> </li><li><strong>MOQ:</strong> </li></ul>
<h3>Productos / Categorías</h3>
<ul><li></li></ul>
<h3>Observaciones</h3>
<p></p>`,
  },
  {
    label: 'Nota técnica',
    html: `<h2>Nota Técnica</h2>
<h3>Contexto</h3>
<p></p>
<h3>Problema / Objetivo</h3>
<p></p>
<h3>Análisis</h3>
<p></p>
<h3>Solución / Propuesta</h3>
<p></p>
<h3>Conclusión</h3>
<p></p>`,
  },
  {
    label: 'Informe',
    html: `<h2>Informe</h2>
<h3>Resumen ejecutivo</h3>
<p></p>
<h3>Antecedentes</h3>
<p></p>
<h3>Hallazgos</h3>
<ul><li></li></ul>
<h3>Recomendaciones</h3>
<ol><li></li></ol>`,
  },
  {
    label: 'Seguimiento',
    html: `<h2>Nota de Seguimiento</h2>
<p><strong>Contexto:</strong> </p>
<h3>Estado actual</h3>
<p></p>
<h3>Pendientes</h3>
<ul data-type="taskList"><li data-checked="false"><div></div></li></ul>
<h3>Próxima revisión</h3>
<p></p>`,
  },
]

// ── AI actions ──────────────────────────────────────────────────────
const AI_ACTIONS = [
  { id: 'rewrite',      label: 'Reescribir' },
  { id: 'expand',       label: 'Expandir' },
  { id: 'shorten',      label: 'Acortar' },
  { id: 'translate_en', label: 'Traducir al inglés' },
  { id: 'bullets',      label: 'Extraer puntos clave' },
]

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
    if (!embedUrl) { toast.error('URL no reconocida. Usá youtube.com o vimeo.com.'); return }
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

// ── Font family dropdown ────────────────────────────────────────────
function FontDrop({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const current = editor.getAttributes('textStyle').fontFamily as string | undefined
  const label = FONTS.find(f => f.value === (current ?? ''))?.label ?? 'Fuente'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(v => !v)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        height: 27, padding: '0 7px', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)',
        color: 'var(--text-body)', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', maxWidth: 110,
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        <ChevronDown size={10} style={{ flexShrink: 0 }}/>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 3, zIndex: 200,
          background: 'var(--surface-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 24px rgba(0,0,0,.4)',
          minWidth: 160, overflow: 'hidden',
        }}>
          {FONTS.map(f => (
            <button key={f.label} type="button"
              onClick={() => {
                if (f.value) editor.chain().focus().setFontFamily(f.value).run()
                else editor.chain().focus().unsetFontFamily().run()
                setOpen(false)
              }}
              style={{
                display: 'block', width: '100%', padding: '6px 12px', border: 'none',
                textAlign: 'left', background: 'transparent', color: 'var(--text-body)',
                fontSize: 12, cursor: 'pointer', fontFamily: f.value || 'inherit',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--slate-700)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Template dropdown ───────────────────────────────────────────────
function TemplDrop({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(v => !v)} title="Plantillas" style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        height: 27, padding: '0 7px', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)',
        color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
      }}>
        <LayoutTemplate size={11}/> <ChevronDown size={9}/>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 3, zIndex: 200,
          background: 'var(--surface-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 24px rgba(0,0,0,.4)',
          minWidth: 160, overflow: 'hidden',
        }}>
          {TEMPLATES.map(t => (
            <button key={t.label} type="button"
              onClick={() => {
                editor.chain().focus().setContent(t.html).run()
                setOpen(false)
              }}
              style={{
                display: 'block', width: '100%', padding: '6px 12px', border: 'none',
                textAlign: 'left', background: 'transparent', color: 'var(--text-body)',
                fontSize: 12, cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--slate-700)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Color picker button ─────────────────────────────────────────────
function ColorBtn({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const current = editor.getAttributes('textStyle').color as string | undefined

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button type="button" onClick={() => setOpen(v => !v)} title="Color de texto"
        style={{
          display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          width: 27, height: 27, border: 'none', borderRadius: 'var(--radius-md)',
          background: 'transparent', cursor: 'pointer', padding: '2px 4px', gap: 1,
        }}>
        <Baseline size={13} style={{ color: 'var(--text-muted)' }}/>
        <div style={{ width: 16, height: 3, borderRadius: 2, background: current ?? '#f1f5f9' }}/>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 3, zIndex: 250,
          background: 'var(--surface-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 24px rgba(0,0,0,.5)',
          padding: 8, width: 152,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5, marginBottom: 6 }}>
            {COLORS.map(c => (
              <button key={c.value} type="button" title={c.label}
                onClick={() => { editor.chain().focus().setColor(c.value).run(); setOpen(false) }}
                style={{
                  width: 22, height: 22, borderRadius: 5, padding: 0, cursor: 'pointer',
                  background: c.value, boxSizing: 'border-box',
                  border: current === c.value ? '2px solid #fff' : '1px solid rgba(255,255,255,.15)',
                }}
              />
            ))}
          </div>
          <button type="button"
            onClick={() => { editor.chain().focus().unsetColor().run(); setOpen(false) }}
            style={{
              display: 'block', width: '100%', padding: '4px 0', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', background: 'transparent',
              color: 'var(--text-muted)', fontSize: 10, cursor: 'pointer',
            }}>
            Sin color
          </button>
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

// ── Font size helper ────────────────────────────────────────────────
function adjustFontSize(editor: Editor, delta: number) {
  const raw = editor.getAttributes('textStyle').fontSize as string | undefined
  const current = raw ? parseInt(raw) : 15
  const next = Math.max(8, Math.min(60, current + delta))
  editor.chain().focus().setFontSize(`${next}px`).run()
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
      <FontDrop editor={e} />
      <Sep />
      <TBtn active={false} disabled={!e.can().undo()} title="Deshacer (Ctrl+Z)" onClick={() => e.chain().focus().undo().run()}><Undo2 size={12}/></TBtn>
      <TBtn active={false} disabled={!e.can().redo()} title="Rehacer (Ctrl+Y)" onClick={() => e.chain().focus().redo().run()}><Redo2 size={12}/></TBtn>
      <Sep />
      {/* Font size */}
      <TBtn active={false} title="Reducir tamaño (A-)" onClick={() => adjustFontSize(e, -2)}>
        <span style={{ fontSize: 9, fontWeight: 700 }}>A</span>
      </TBtn>
      <TBtn active={false} title="Aumentar tamaño (A+)" onClick={() => adjustFontSize(e, 2)}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>A</span>
      </TBtn>
      <Sep />
      {/* Color de texto */}
      <ColorBtn editor={e} />
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
      <TBtn active={e.isActive('bulletList')}  title="Lista"             onClick={() => e.chain().focus().toggleBulletList().run()}><List size={12}/></TBtn>
      <TBtn active={e.isActive('orderedList')} title="Lista numerada"    onClick={() => e.chain().focus().toggleOrderedList().run()}><ListOrdered size={12}/></TBtn>
      <TBtn active={e.isActive('taskList')}    title="Checklist"         onClick={() => e.chain().focus().toggleTaskList().run()}><ListChecks size={12}/></TBtn>
      <TBtn active={e.isActive('blockquote')}  title="Cita"              onClick={() => e.chain().focus().toggleBlockquote().run()}><Quote size={12}/></TBtn>
      <TBtn active={e.isActive('codeBlock')}   title="Bloque de código"  onClick={() => e.chain().focus().toggleCodeBlock().run()}><Code2 size={12}/></TBtn>
      <Sep />
      <TBtn active={false} title="Insertar tabla" onClick={() => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon size={12}/></TBtn>
      <TBtn active={e.isActive('link')} title="Enlace" onClick={setLink}><Link2 size={12}/></TBtn>
      <TBtn active={false} title="Separador" onClick={() => e.chain().focus().setHorizontalRule().run()}><Minus size={12}/></TBtn>
      <Sep />
      <TemplDrop editor={e} />
    </div>
  )
}

// ── Slash command menu ──────────────────────────────────────────────
type SlashState = { query: string; from: number; filtered: SlashCmd[]; idx: number } | null

export default function KnowledgeRichTextEditor({ initialHtml, onChange, readOnly = false }: Props) {
  const slashRef  = useRef<SlashState>(null)
  const [slash, setSlash]   = useState<SlashState>(null)
  const [slashXY, setSlashXY] = useState<{ x: number; y: number } | null>(null)
  const [aiMenu, setAiMenu] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const transformAI = useTransformKnowledgeText()

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
      TextStyle,
      FontFamily,
      FontSize,
      Color.configure({ types: ['textStyle'] }),
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

  // Close AI menu on click outside
  useEffect(() => {
    if (!aiMenu) return
    const close = () => setAiMenu(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [aiMenu])

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

  // AI inline transform
  const handleAIAction = useCallback(async (actionId: string) => {
    if (!editor) return
    setAiMenu(false)
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to, ' ')
    if (!text.trim()) return
    const result = await transformAI.mutateAsync({ text, action: actionId })
    editor.chain().focus().insertContentAt({ from, to }, result).run()
  }, [editor, transformAI])

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
            <TBtn active={false} title="Reducir tamaño" onClick={() => adjustFontSize(editor, -2)}>
              <span style={{ fontSize: 8, fontWeight: 700 }}>A</span>
            </TBtn>
            <TBtn active={false} title="Aumentar tamaño" onClick={() => adjustFontSize(editor, 2)}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>A</span>
            </TBtn>
            <ColorBtn editor={editor}/>
            <Sep/>
            <TBtn active={editor.isActive('link')} title="Enlace" onClick={() => {
              const url = prompt('URL:', editor.getAttributes('link').href ?? '')
              if (url === null) return
              if (!url) { editor.chain().focus().unsetLink().run(); return }
              editor.chain().focus().setLink({ href: url }).run()
            }}><Link2 size={11}/></TBtn>
            <Sep/>
            {/* AI inline actions */}
            <div style={{ position: 'relative' }} onMouseDown={e => e.stopPropagation()}>
              <button
                type="button"
                title="Acciones IA"
                disabled={transformAI.isPending}
                onClick={() => setAiMenu(v => !v)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  height: 27, padding: '0 6px', border: 'none', borderRadius: 'var(--radius-md)',
                  background: aiMenu ? 'rgba(20,184,166,.15)' : 'transparent',
                  color: '#2dd4bf', cursor: transformAI.isPending ? 'wait' : 'pointer',
                  fontSize: 10, fontWeight: 600,
                }}
              >
                {transformAI.isPending
                  ? <Loader2 size={10} className="animate-spin"/>
                  : <Sparkles size={10}/>
                }
                IA
              </button>
              {aiMenu && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 400,
                  background: 'var(--surface-card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 24px rgba(0,0,0,.5)',
                  minWidth: 160, overflow: 'hidden',
                }}>
                  {AI_ACTIONS.map(a => (
                    <button key={a.id} type="button"
                      onClick={() => void handleAIAction(a.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        width: '100%', padding: '6px 12px', border: 'none',
                        background: 'transparent', color: 'var(--text-body)',
                        fontSize: 12, cursor: 'pointer', textAlign: 'left',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--slate-700)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Sparkles size={10} style={{ color: '#2dd4bf', flexShrink: 0 }}/>
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
