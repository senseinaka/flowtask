import { findPendingByPhone, findPendingByCode, markAnswered, findAllPendingQuestions } from '../database/queries/task_questions'
import { getTask, updateTask } from '../database/queries/tasks'
import { getDelegatedTask, updateDelegatedTask } from '../database/queries/delegated'
import { whatsappService } from './whatsapp.service'
import type { QuestionOption, TaskStatus, DelegatedStatus, TaskQuestion } from '@shared/types'
import { STATUS_LABELS, DELEGATED_STATUS_LABELS } from '@shared/types'

type PushFn = (channel: string, data: unknown) => void

// ─── Message formatting ───────────────────────────────────────────────────────

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣']

export function formatQuestionMessage(
  taskTitle: string,
  question: string,
  options: QuestionOption[],
  refCode: string
): string {
  const optionLines = options.map((opt, i) => `${NUMBER_EMOJIS[i]}  ${opt.label}`).join('\n')
  return [
    `📋 *Tarea: ${taskTitle}*`,
    '',
    `❓ ${question}`,
    '',
    'Respondé con el número:',
    optionLines,
    '',
    `_Ref: ${refCode}_`
  ].join('\n')
}

// ─── Reply parsing ────────────────────────────────────────────────────────────

interface ParsedReply {
  optionIndex: number
  refCode?: string
}

export function parseReply(text: string, optionCount: number, options: QuestionOption[]): ParsedReply | null {
  const trimmed = text.trim()

  // "2 AB3X" or "2"
  const numericMatch = trimmed.match(/^(\d+)(?:\s+([A-Z0-9]{4}))?$/i)
  if (numericMatch) {
    const idx = parseInt(numericMatch[1]) - 1   // user sends 1-based
    if (idx >= 0 && idx < optionCount) {
      return { optionIndex: idx, refCode: numericMatch[2]?.toUpperCase() }
    }
  }

  // Fuzzy text match (e.g. "si", "sí", "no", "listo")
  const lower = trimmed.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  for (let i = 0; i < options.length; i++) {
    const optNorm = options[i].label
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9\s]/g, '')   // strip emojis
      .trim()
    const firstWord = optNorm.split(' ')[0]
    if (firstWord && lower.startsWith(firstWord)) return { optionIndex: i }
    if (optNorm.includes(lower) && lower.length >= 2) return { optionIndex: i }
  }

  return null
}

// ─── Action executor ──────────────────────────────────────────────────────────

async function applyAction(option: QuestionOption, question: TaskQuestion): Promise<string | null> {
  if (option.action === 'set_status' && option.action_value) {
    if (question.task_type === 'delegated') {
      updateDelegatedTask(question.task_id, { status: option.action_value as DelegatedStatus })
      return `Estado → ${DELEGATED_STATUS_LABELS[option.action_value as DelegatedStatus] ?? option.action_value}`
    } else {
      await updateTask(question.task_id, { status: option.action_value as TaskStatus })
      return `Estado → ${STATUS_LABELS[option.action_value as TaskStatus]}`
    }
  }
  if (option.action === 'save_only') {
    return 'Respuesta registrada'
  }
  return null
}

// ─── QuestionsService singleton ───────────────────────────────────────────────

class QuestionsService {
  private pushFn: PushFn | null = null

  setPushFn(push: PushFn): void {
    this.pushFn = push
  }

  /**
   * Called by the webhook server whenever a WhatsApp message arrives.
   * Tries to match the message to a pending question and process it.
   */
  async handleIncomingWhatsApp(from: string, text: string): Promise<void> {
    const phone = from.replace(/\D/g, '')
    console.log(`[Questions] Mensaje de ${phone}: "${text}"`)

    let pending = findPendingByPhone(phone)
    console.log(`[Questions] Preguntas pendientes para ${phone}: ${pending.length}`)

    // ── Phone normalization fallback ──────────────────────────────────────────
    // WhatsApp JIDs sometimes differ from the stored number by Argentina's "9"
    // mobile prefix (549XXXXXXXXXX vs 54XXXXXXXXXX). Try both variants.
    let effectivePhone = phone  // phone that actually matched the DB
    if (!pending.length) {
      let altPhone: string | null = null
      if (phone.startsWith('549') && phone.length >= 12) {
        altPhone = '54' + phone.slice(3)   // remove the 9
      } else if (phone.startsWith('54') && !phone.startsWith('549') && phone.length >= 11) {
        altPhone = '549' + phone.slice(2)  // insert the 9
      }
      if (altPhone) {
        pending = findPendingByPhone(altPhone)
        if (pending.length) {
          effectivePhone = altPhone
          console.log(`[Questions] Match via formato alternativo: ${altPhone} (original: ${phone})`)
        }
      }
    }

    // ── Diagnostic: show what IS in DB if still no match ─────────────────────
    if (!pending.length) {
      const allPending = findAllPendingQuestions()
      if (!allPending.length) {
        console.log(`[Questions] ⚠️  Sin preguntas pendientes en DB`)
      } else {
        console.log(`[Questions] ⚠️  ${allPending.length} preguntas en DB pero ninguna para "${phone}":`)
        allPending.forEach((q) =>
          console.log(`  → phone="${q.phone}" ref="${q.ref_code}" task="${q.task_id}"`)
        )
      }
      return
    }

    // First: check if text includes a ref code — match directly
    let matched: TaskQuestion | null = null
    const codeMatch = text.trim().match(/([A-Z0-9]{4})$/i)
    if (codeMatch) {
      matched = findPendingByCode(effectivePhone, codeMatch[1])
    }

    // El ref_code es OBLIGATORIO siempre: autentica la respuesta contra la
    // pregunta puntual (el código se envió sólo a ese destinatario). Sin él, un
    // "1" suelto desde el teléfono —o un mensaje con el `from` manipulado en la
    // instancia de Evolution— podría aplicar una acción sobre la única pregunta
    // pendiente sin probar que el remitente la recibió. No hay fallback a
    // pending[0].
    if (!matched) {
      const codes = pending.map((q) => q.ref_code).join(', ')
      const ejemplo = pending[0]?.ref_code ?? 'AB3X'
      await whatsappService.sendMessage(
        phone,
        pending.length === 1
          ? `Incluí el código al final de tu respuesta para confirmar (ej: "1 ${ejemplo}").`
          : `Tenés ${pending.length} preguntas pendientes. Incluí el código al final de tu respuesta (ej: "1 ${ejemplo}").\nCódigos activos: ${codes}`
      )
      return
    }

    // Parse the reply
    const parsed = parseReply(text, matched.options.length, matched.options)
    console.log(`[Questions] Parsed reply:`, parsed)
    if (!parsed) {
      console.log(`[Questions] No se pudo parsear la respuesta — ignorando`)
      return
    }

    const option = matched.options[parsed.optionIndex]
    console.log(`[Questions] Opción elegida: "${option.label}" acción: ${option.action}`)

    // Apply action to task (uses task_type stored in the question)
    const actionTaken = await applyAction(option, matched)
    console.log(`[Questions] Acción aplicada: ${actionTaken}`)

    // Mark question answered in DB
    markAnswered(matched.id, option.label, actionTaken)

    // Send confirmation back to user
    const confirmMsg = actionTaken
      ? `✅ Registrado: _"${option.label}"_\n${actionTaken}`
      : `✅ Registrado: _"${option.label}"_`
    await whatsappService.sendMessage(phone, confirmMsg)

    // Get task title for the push notification (personal or delegated)
    const taskTitle = matched.task_type === 'delegated'
      ? (getDelegatedTask(matched.task_id)?.title ?? '')
      : ((await getTask(matched.task_id))?.title ?? '')

    // Push event to renderer (toast + query invalidation)
    console.log(`[Questions] Push al renderer: question:answered, pushFn=${!!this.pushFn}`)
    this.pushFn?.('question:answered', {
      questionId: matched.id,
      taskId: matched.task_id,
      taskType: matched.task_type,
      taskTitle,
      answer: option.label,
      actionTaken
    })
  }
}

export const questionsService = new QuestionsService()
