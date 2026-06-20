import { getClient } from './ai.service'
import type { KnowledgeContentType, KnowledgeEntry } from '@shared/types'

const MODEL_SUMMARY = 'claude-haiku-4-5-20251001'
const MODEL_GLOBAL  = 'claude-sonnet-4-6'

export async function summarizeKnowledgeEntry(
  title: string,
  body: string,
  contentType: KnowledgeContentType,
  fileName?: string
): Promise<string> {
  const client = getClient()

  let userContent: string
  if (contentType === 'text') {
    userContent = `Título: ${title || '(sin título)'}\n\nContenido:\n${body}`
  } else {
    userContent = `Archivo: ${fileName ?? title}\nTipo: ${contentType}`
  }

  const resp = await client.messages.create({
    model: MODEL_SUMMARY,
    max_tokens: 300,
    system: `Sos un asistente de gestión de conocimiento. Resumí el contenido en 2-3 frases breves en español, destacando los puntos clave y el valor principal de la información. No repitas el título. Sé conciso y directo.`,
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
      const summary = e.ai_summary || e.body?.slice(0, 200) || '(sin contenido)'
      return `[${i + 1}] ${e.title || '(sin título)'} (fuente: ${e.source || '—'})\n${summary}`
    })
    .join('\n\n')

  const resp = await client.messages.create({
    model: MODEL_GLOBAL,
    max_tokens: 1000,
    system: `Sos un analista estratégico. Analizá un conjunto de entradas de conocimiento y generá un resumen ejecutivo estructurado en español. El resumen debe incluir: los insights más importantes, patrones o tendencias identificadas, y recomendaciones concretas de acción. Usá formato de texto claro, sin markdown complejo.`,
    messages: [{
      role: 'user',
      content: `Analizá las siguientes ${entries.length} entradas de conocimiento sobre ${topicLabel} y generá un resumen ejecutivo:\n\n${entriesText}`
    }]
  })

  const block = resp.content.find(b => b.type === 'text')
  return block?.type === 'text' ? block.text.trim() : ''
}
