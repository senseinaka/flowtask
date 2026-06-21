import jsPDF from 'jspdf'
import dayjs from 'dayjs'
import type { KnowledgeEntry } from '@shared/types'
import {
  Mail, Users, Globe, FileText, MessageCircle, Video, Image, File, StickyNote, Tag
} from 'lucide-react'

// ── Icon registry ─────────────────────────────────────────────────────────────

export const ICON_MAP: Record<string, React.ElementType> = {
  Mail, Users, Globe, FileText, MessageCircle, Video, Image, File, StickyNote, Tag
}
export const AVAILABLE_ICONS = Object.keys(ICON_MAP)

export function SourceIcon({ name, size = 14 }: { name: string; size?: number }) {
  const Ic = ICON_MAP[name] ?? Tag
  return <Ic size={size} />
}

// ── Text helpers ──────────────────────────────────────────────────────────────

export function parseTags(raw: string): string[] {
  try { return JSON.parse(raw) } catch { return [] }
}

export function fmtDate(ms: number): string {
  return dayjs(ms).format('DD/MM/YY')
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

// ── AI analysis section parser ────────────────────────────────────────────────

const AI_HEADERS = [
  'RESUMEN EJECUTIVO', 'INSIGHTS CLAVE', 'DECISIONES TOMADAS',
  'PENDIENTES Y PRÓXIMOS PASOS', 'CONTRADICCIONES O CONFLICTOS'
]

export function parseAnalysis(text: string): Record<string, string> {
  const sections: Record<string, string> = {}
  let current = ''
  const lines: string[] = []
  for (const line of text.split('\n')) {
    if (AI_HEADERS.includes(line.trim())) {
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

// ── Search ranking (Etapa 9 — semantic-ish scoring) ──────────────────────────

export function rankSearchResults(entries: KnowledgeEntry[], query: string): KnowledgeEntry[] {
  if (!query.trim()) return entries
  const terms = query.toLowerCase().split(/\W+/).filter(t => t.length > 1)

  const scored = entries.map(e => {
    const title   = (e.title || '').toLowerCase()
    const topic   = (e.topic || '').toLowerCase()
    const tags    = (e.tags || '').toLowerCase()
    const source  = (e.source || '').toLowerCase()
    const summary = (e.ai_summary || '').toLowerCase()
    const body    = stripHtml(e.body).toLowerCase()

    let score = 0
    for (const t of terms) {
      if (title === t)           score += 12
      else if (title.startsWith(t)) score += 8
      else if (title.includes(t))   score += 6
      if (topic.includes(t))        score += 4
      if (summary.includes(t))      score += 3
      if (tags.includes(t))         score += 3
      if (source.includes(t))       score += 2
      if (body.includes(t))         score += 1
    }
    return { e, score }
  })

  return scored
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.e)
}

// ── Export helpers ────────────────────────────────────────────────────────────

export function buildMarkdown(topic: string, entries: KnowledgeEntry[]): string {
  const lines: string[] = []
  lines.push(`# Knowledge: ${topic || 'Todas las entradas'}`)
  lines.push(`\n*Exportado: ${dayjs().format('DD/MM/YYYY HH:mm')}*\n`)

  for (const e of entries) {
    lines.push(`## ${e.title || '(sin título)'}`)
    if (e.source)     lines.push(`**Fuente:** ${e.source}`)
    if (e.entry_date) lines.push(`**Fecha:** ${dayjs(e.entry_date).format('DD/MM/YYYY')}`)
    if (e.topic)      lines.push(`**Tema:** ${e.topic}`)
    const tags = parseTags(e.tags)
    if (tags.length)  lines.push(`**Tags:** ${tags.join(', ')}`)
    if (e.ai_summary) lines.push(`\n> ${e.ai_summary}`)
    const body = stripHtml(e.body)
    if (body)         lines.push(`\n${body}`)
    lines.push('\n---\n')
  }
  return lines.join('\n')
}

export function exportTopicPDF(topic: string, entries: KnowledgeEntry[]): void {
  const doc = new jsPDF()
  const m  = 20
  const pw = 210 - m * 2
  let y    = m

  doc.setFontSize(18); doc.setTextColor(20, 184, 166)
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

// ── Default sources for seeding (Etapa 6) ────────────────────────────────────

export const DEFAULT_SOURCES = [
  { name: 'Reunión',    icon: 'Users',          color: '#818cf8' },
  { name: 'Email',      icon: 'Mail',           color: '#60a5fa' },
  { name: 'Web',        icon: 'Globe',          color: '#34d399' },
  { name: 'Documento',  icon: 'FileText',       color: '#fb923c' },
  { name: 'Llamada',    icon: 'MessageCircle',  color: '#a78bfa' },
  { name: 'Chat',       icon: 'MessageCircle',  color: '#4ade80' },
  { name: 'WhatsApp',   icon: 'MessageCircle',  color: '#22c55e' },
]
