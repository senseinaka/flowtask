import { getClient } from './ai.service'
import type { KnowledgeContentType, KnowledgeEntry } from '@shared/types'

const MODEL_ENTRY   = 'claude-haiku-4-5-20251001'
const MODEL_TOPIC   = 'claude-sonnet-4-6'

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

export async function summarizeKnowledgeEntry(
  title: string,
  body: string,
  contentType: KnowledgeContentType,
  fileName?: string
): Promise<string> {
  const client = getClient()

  const userContent = contentType === 'text'
    ? `Título: ${title || '(sin título)'}\n\nContenido:\n${body}`
    : `Archivo: ${fileName ?? title}\nTipo: ${contentType}`

  const resp = await client.messages.create({
    model: MODEL_ENTRY,
    max_tokens: 300,
    system: `Sos un asistente de gestión de conocimiento. Resumí el contenido en 2-3 frases breves en español, destacando los puntos clave. No repitas el título. Sé conciso y directo.`,
    messages: [{ role: 'user', content: userContent }]
  })

  const block = resp.content.find(b => b.type === 'text')
  return block?.type === 'text' ? block.text.trim() : ''
}

export async function generateKnowledgeGlobalSummary(
  entries: Pick<KnowledgeEntry, 'title' | 'body' | 'ai_summary' | 'topic' | 'source'>[],
  topic: string
): Promise<string> {
  const client = getClient()
  const topicLabel = topic === '__all__' ? 'todos los temas' : `el tema "${topic}"`

  const entriesText = entries
    .map((e, i) => {
      const content = e.ai_summary || stripHtml(e.body).slice(0, 200) || '(sin contenido)'
      return `[${i + 1}] ${e.title || '(sin título)'} (fuente: ${e.source || '—'})\n${content}`
    })
    .join('\n\n')

  const resp = await client.messages.create({
    model: MODEL_TOPIC,
    max_tokens: 800,
    system: `Sos un analista estratégico. Generá un resumen ejecutivo conciso en español de un conjunto de entradas de conocimiento. El resumen debe ser útil y accionable. Usá texto plano sin markdown.`,
    messages: [{
      role: 'user',
      content: `Analizá las siguientes ${entries.length} entradas sobre ${topicLabel} y generá un resumen ejecutivo:\n\n${entriesText}`
    }]
  })

  const block = resp.content.find(b => b.type === 'text')
  return block?.type === 'text' ? block.text.trim() : ''
}

export async function analyzeTopicEntries(
  entries: KnowledgeEntry[],
  topic: string
): Promise<string> {
  const client = getClient()

  const entriesText = entries
    .map((e, i) => {
      const content = e.ai_summary || stripHtml(e.body).slice(0, 300) || '(sin contenido)'
      const date = e.entry_date ?? e.created_at
      const d = new Date(date)
      const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}`
      return `[${i + 1}] ${dateStr} | ${e.source || 'Sin fuente'} | ${e.title || '(sin título)'}\n${content}`
    })
    .join('\n\n')

  const resp = await client.messages.create({
    model: MODEL_TOPIC,
    max_tokens: 1500,
    system: `Sos un analista estratégico experto. Analizá un conjunto de entradas de conocimiento y producí un análisis estructurado en español. Organizá tu respuesta en las siguientes secciones separadas por líneas en blanco:

RESUMEN EJECUTIVO
(2-3 párrafos con la síntesis del tema)

INSIGHTS CLAVE
(lista de los 3-5 aprendizajes o hallazgos más importantes)

DECISIONES TOMADAS
(lista de decisiones concretas que surgen de las entradas, o "Ninguna identificada" si no hay)

PENDIENTES Y PRÓXIMOS PASOS
(lista de acciones o temas pendientes de resolución)

CONTRADICCIONES O CONFLICTOS
(puntos donde las entradas tienen información contradictoria o tensiones sin resolver, o "Ninguna identificada")

Usá texto plano. No uses markdown ni asteriscos.`,
    messages: [{
      role: 'user',
      content: `Analizá las siguientes ${entries.length} entradas de conocimiento sobre el tema "${topic}":\n\n${entriesText}`
    }]
  })

  const block = resp.content.find(b => b.type === 'text')
  return block?.type === 'text' ? block.text.trim() : ''
}
