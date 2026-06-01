/**
 * polling.service.ts
 *
 * Reemplaza el webhook local. Consulta Evolution API en Railway cada 10s.
 * Usa deduplicación por message ID porque el filtro de timestamp de la API
 * no es confiable (devuelve los mismos 50 mensajes recientes en cada poll).
 */

import axios from 'axios'
import { questionsService } from './questions.service'
import { whatsappService } from './whatsapp.service'

const POLL_INTERVAL_MS = 10_000  // 10 segundos
const MESSAGES_TO_FETCH = 50     // últimos N mensajes por consulta
const MAX_TRACKED_IDS = 1000     // previene crecimiento ilimitado del Set

let pollTimer: ReturnType<typeof setInterval> | null = null

// Deduplicación por message ID — el filtro de timestamp de la API es ignorado
const processedMessageIds = new Set<string>()

export function startPolling(): void {
  console.log('[Polling] Iniciando polling de mensajes entrantes (cada 10s)')
  warmUpAndStart()
}

export function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
    console.log('[Polling] Detenido')
  }
}

/**
 * Marca los mensajes existentes como "ya vistos" antes de empezar a procesar.
 * Evita que mensajes viejos (como respuestas de pruebas anteriores) se auto-procesen
 * cuando se crea una nueva pregunta.
 */
async function warmUpAndStart(): Promise<void> {
  try {
    const config = whatsappService.getConfig()
    const apiUrl = config.url.replace(/\/$/, '')
    const apiKey = config.key

    const res = await axios.post(
      `${apiUrl}/chat/findMessages/flowtask`,
      { limit: MESSAGES_TO_FETCH },
      {
        headers: { apikey: apiKey, 'Content-Type': 'application/json' },
        timeout: 8000
      }
    )

    const messages: RawMessage[] = res.data?.messages?.records ?? res.data?.records ?? []
    messages.forEach((m) => { if (m.key?.id) processedMessageIds.add(m.key.id) })
    console.log(`[Polling] Warm-up: ${processedMessageIds.size} mensajes existentes marcados como vistos`)
  } catch (err) {
    console.warn('[Polling] Warm-up falló (no crítico):', (err as Error).message)
  }

  // Iniciar intervalo independientemente del resultado del warm-up
  pollTimer = setInterval(async () => {
    await pollIncomingMessages()
  }, POLL_INTERVAL_MS)
}

async function pollIncomingMessages(): Promise<void> {
  try {
    const config = whatsappService.getConfig()
    const apiUrl = config.url.replace(/\/$/, '')
    const apiKey = config.key

    const res = await axios.post(
      `${apiUrl}/chat/findMessages/flowtask`,
      { limit: MESSAGES_TO_FETCH },
      {
        headers: { apikey: apiKey, 'Content-Type': 'application/json' },
        timeout: 8000
      }
    )

    const allMessages: RawMessage[] = res.data?.messages?.records ?? res.data?.records ?? []

    // Filtrar mensajes:
    // 1. Descartar si ya procesamos este ID (dedup principal)
    // 2. Descartar grupos
    // 3. Non-LID con fromMe=true → son nuestros mensajes enviados
    // 4. Filtro de contenido → nuestros mensajes en chats LID
    const messages = allMessages.filter((m) => {
      const msgId = m.key?.id
      if (!msgId || processedMessageIds.has(msgId)) return false  // ya visto

      if (m.key?.remoteJid?.endsWith('@g.us')) return false  // ignorar grupos

      const text = extractText(m)
      if (!text || text === 'undefined') return false

      // Para mensajes NO-LID: fromMe es confiable
      const isLid = m.key?.remoteJid?.endsWith('@lid')
      if (!isLid && m.key?.fromMe === true) return false

      // Filtro de contenido (necesario para LID donde fromMe es unreliable)
      const trimmed = text.trim()
      if (trimmed.startsWith('📋 *Tarea:')) return false
      if (trimmed.startsWith('✅ Registrado:')) return false
      if (trimmed.startsWith('Tenés ') && trimmed.includes('preguntas pendientes')) return false

      return true
    })

    if (messages.length > 0) {
      console.log(`[Polling] ${messages.length} mensaje(s) nuevo(s)`)
    }

    for (const msg of messages) {
      // Marcar como procesado inmediatamente (antes de await para evitar doble procesamiento)
      const msgId = msg.key?.id
      if (msgId) {
        processedMessageIds.add(msgId)
        // Prevenir crecimiento ilimitado (Set no tiene límite nativo)
        if (processedMessageIds.size > MAX_TRACKED_IDS) {
          const oldest = processedMessageIds.values().next().value
          if (oldest) processedMessageIds.delete(oldest)
        }
      }

      const text = extractText(msg)
      const jid = msg.key?.remoteJid ?? ''
      // LID format: usar remoteJidAlt (tiene el número real)
      const from = jid.endsWith('@lid')
        ? (msg.key?.remoteJidAlt ?? jid)
        : jid

      if (!text || !from) continue

      const phone = from.replace('@s.whatsapp.net', '').replace(/\D/g, '')
      console.log(`[Polling] Mensaje de ${phone}: "${text}"`)
      await questionsService.handleIncomingWhatsApp(phone, text)
    }
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status !== 404 && status !== 400) {
      console.warn('[Polling] Error consultando mensajes:', (err as Error).message)
    }
  }
}

interface RawMessage {
  key?: {
    remoteJid?: string
    remoteJidAlt?: string
    fromMe?: boolean
    id?: string
  }
  message?: {
    conversation?: string
    extendedTextMessage?: { text?: string }
    buttonsResponseMessage?: { selectedDisplayText?: string }
    listResponseMessage?: { title?: string }
    templateButtonReplyMessage?: { selectedDisplayText?: string }
  }
  messageTimestamp?: number
}

function extractText(msg: RawMessage): string | null {
  const m = msg.message
  if (!m) return null
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.buttonsResponseMessage?.selectedDisplayText ??
    m.listResponseMessage?.title ??
    m.templateButtonReplyMessage?.selectedDisplayText ??
    null
  )
}
