import { getPendingReminders, markReminderSent } from '../database/queries/reminders'
import {
  getPendingDelegatedReminders,
  markDelegatedReminderSent
} from '../database/queries/delegated-reminders'
import {
  getPendingScheduledMessages, markMessageSent,
  markMessagePartial, rescheduleRecurring
} from '../database/queries/messages'
import {
  upsertWaReminder,
  markWaReminderSent,
  deleteWaReminder,
  getPendingWaReminders
} from '../database/queries/calendar-wa-reminders'
import { whatsappService } from './whatsapp.service'
import type { Reminder, ScheduledMessage, CalendarWaReminder } from '@shared/types'

type PushFn = (channel: string, data: unknown) => void

class SchedulerService {
  private timers          = new Map<string, ReturnType<typeof setTimeout>>()
  private delegatedTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private waTimers        = new Map<string, ReturnType<typeof setTimeout>>()
  private pushFn: PushFn | null = null
  private pollInterval: ReturnType<typeof setInterval> | null = null

  start(push: PushFn): void {
    this.pushFn = push
    this.loadPendingReminders()
    this.loadPendingDelegatedReminders()
    this.loadPendingMessages()
    this.loadPendingWaReminders()
    this.pollInterval = setInterval(() => {
      this.loadPendingReminders()
      this.loadPendingDelegatedReminders()
      this.loadPendingMessages()
      this.loadPendingWaReminders()
    }, 60_000)
  }

  stop(): void {
    if (this.pollInterval) clearInterval(this.pollInterval)
    this.timers.forEach((t) => clearTimeout(t))
    this.delegatedTimers.forEach((t) => clearTimeout(t))
    this.waTimers.forEach((t) => clearTimeout(t))
    this.timers.clear()
    this.delegatedTimers.clear()
    this.waTimers.clear()
  }

  // ─── Personal Reminders ───────────────────────────────────────────────────

  scheduleReminder(reminder: Reminder): void {
    const delay = reminder.remind_at - Date.now()
    if (delay <= 0) return
    this.cancelTimer(reminder.id)
    const timer = setTimeout(() => this.fireReminder(reminder), delay)
    this.timers.set(reminder.id, timer)
  }

  cancelReminder(id: string): void {
    this.cancelTimer(id)
  }

  private loadPendingReminders(): void {
    const pending = getPendingReminders()
    for (const r of pending) {
      if (!this.timers.has(r.id)) this.scheduleReminder(r)
    }
  }

  private async fireReminder(reminder: Reminder): Promise<void> {
    this.timers.delete(reminder.id)
    try {
      const ok = await whatsappService.sendMessage(reminder.phone_number, reminder.message)
      markReminderSent(reminder.id, ok)
      this.pushFn?.('reminder:sent', { reminderId: reminder.id, success: ok })
    } catch {
      markReminderSent(reminder.id, false)
    }
  }

  // ─── Delegated Reminders ──────────────────────────────────────────────────

  scheduleDelegatedReminder(reminder: Reminder): void {
    const delay = reminder.remind_at - Date.now()
    if (delay <= 0) return
    const prev = this.delegatedTimers.get(reminder.id)
    if (prev) clearTimeout(prev)
    const timer = setTimeout(() => this.fireDelegatedReminder(reminder), delay)
    this.delegatedTimers.set(reminder.id, timer)
  }

  cancelDelegatedReminder(id: string): void {
    const t = this.delegatedTimers.get(id)
    if (t) { clearTimeout(t); this.delegatedTimers.delete(id) }
  }

  private loadPendingDelegatedReminders(): void {
    const pending = getPendingDelegatedReminders()
    for (const r of pending) {
      if (!this.delegatedTimers.has(r.id)) this.scheduleDelegatedReminder(r)
    }
  }

  private async fireDelegatedReminder(reminder: Reminder): Promise<void> {
    this.delegatedTimers.delete(reminder.id)
    try {
      const ok = await whatsappService.sendMessage(reminder.phone_number, reminder.message)
      markDelegatedReminderSent(reminder.id, ok)
      this.pushFn?.('reminder:sent', { reminderId: reminder.id, success: ok })
    } catch {
      markDelegatedReminderSent(reminder.id, false)
    }
  }

  // ─── Scheduled messages ────────────────────────────────────────────────────

  scheduleMessage(msg: ScheduledMessage): void {
    const delay = msg.send_at - Date.now()
    if (delay <= 0) return
    const key = `msg:${msg.id}`
    this.cancelTimer(key)
    const timer = setTimeout(() => this.fireMessage(msg), delay)
    this.timers.set(key, timer)
  }

  cancelMessage(id: string): void {
    this.cancelTimer(`msg:${id}`)
  }

  private loadPendingMessages(): void {
    const pending = getPendingScheduledMessages()
    for (const m of pending) {
      const key = `msg:${m.id}`
      if (!this.timers.has(key)) this.scheduleMessage(m)
    }
  }

  private async fireMessage(msg: ScheduledMessage): Promise<void> {
    const key = `msg:${msg.id}`
    this.timers.delete(key)

    const contacts = msg.contacts ?? []
    const errors: string[] = []

    for (const contact of contacts) {
      const text = msg.message.replace(/\{\{nombre\}\}/gi, contact.name)
      try {
        const ok = await whatsappService.sendMessage(contact.phone, text)
        if (!ok) errors.push(contact.name)
      } catch (err) {
        errors.push(contact.name)
      }
    }

    const success = errors.length === 0
    const partial = errors.length > 0 && errors.length < contacts.length

    if (partial) {
      markMessagePartial(msg.id, `Falló para: ${errors.join(', ')}`)
    } else {
      markMessageSent(msg.id, success, success ? undefined : 'No se pudo enviar')
    }

    // Handle recurrence
    if ((success || partial) && msg.recurrence !== 'none') {
      rescheduleRecurring(msg.id, msg.recurrence)
      // Re-schedule the next occurrence
      const updated = getPendingScheduledMessages().find((m) => m.id === msg.id)
      if (updated) this.scheduleMessage(updated)
    }

    this.pushFn?.('message:sent', { messageId: msg.id, success, partial, errors })
  }

  // ─── Calendar WA reminders (persistidos en calendar_wa_reminders) ────────

  scheduleDirectWaReminder(id: string, phone: string, message: string, sendAt: number): void {
    const delay = sendAt - Date.now()
    if (delay <= 0) {
      console.warn(`[WA Reminder] id=${id} ignorado: delay=${delay}ms (evento en el pasado o inmediato)`)
      return
    }
    upsertWaReminder(id, phone, message, sendAt)
    this.cancelDirectWaReminderTimer(id)
    const mins = Math.round(delay / 60_000)
    console.log(`[WA Reminder] Programado id=${id} phone=${phone} en ${mins} min (${delay}ms)`)
    const timer = setTimeout(async () => {
      this.waTimers.delete(id)
      console.log(`[WA Reminder] Enviando a ${phone}...`)
      const ok = await whatsappService.sendMessage(phone, message)
      console.log(`[WA Reminder] Resultado: ${ok ? 'OK' : 'FALLO'} phone=${phone}`)
      markWaReminderSent(id, ok)
      this.pushFn?.('calendar:wa-reminder:sent', { id, ok })
    }, delay)
    this.waTimers.set(id, timer)
  }

  cancelDirectWaReminder(id: string): void {
    this.cancelDirectWaReminderTimer(id)
    deleteWaReminder(id)
  }

  private cancelDirectWaReminderTimer(id: string): void {
    const t = this.waTimers.get(id)
    if (t) { clearTimeout(t); this.waTimers.delete(id) }
  }

  private loadPendingWaReminders(): void {
    try {
      const pending = getPendingWaReminders()
      for (const r of pending) {
        if (!this.waTimers.has(r.event_id)) this.scheduleWaReminderFromDb(r)
      }
    } catch (err) {
      console.error('[WA Reminder] Error restaurando reminders pendientes:', err)
    }
  }

  private scheduleWaReminderFromDb(r: CalendarWaReminder): void {
    const delay = r.send_at - Date.now()
    if (delay <= 0) {
      const lateMs = -delay
      const TWO_HOURS = 2 * 60 * 60_000
      if (lateMs <= TWO_HOURS) {
        // Llegó tarde pero dentro de margen razonable — intentar de todas formas
        console.log(`[WA Reminder] Tardío (${Math.round(lateMs / 60_000)} min), intentando enviar event_id=${r.event_id}`)
        whatsappService.sendMessage(r.phone, r.message).then(ok => {
          markWaReminderSent(r.event_id, ok)
          this.pushFn?.('calendar:wa-reminder:sent', { id: r.event_id, ok })
        }).catch(() => markWaReminderSent(r.event_id, false))
      } else {
        console.warn(`[WA Reminder] event_id=${r.event_id} expiró hace más de 2h — marcado como fallido sin enviar`)
        markWaReminderSent(r.event_id, false)
      }
      return
    }
    const mins = Math.round(delay / 60_000)
    console.log(`[WA Reminder] Restaurado event_id=${r.event_id} phone=${r.phone} en ${mins} min`)
    const timer = setTimeout(async () => {
      this.waTimers.delete(r.event_id)
      console.log(`[WA Reminder] Enviando a ${r.phone}...`)
      const ok = await whatsappService.sendMessage(r.phone, r.message)
      console.log(`[WA Reminder] Resultado: ${ok ? 'OK' : 'FALLO'} phone=${r.phone}`)
      markWaReminderSent(r.event_id, ok)
      this.pushFn?.('calendar:wa-reminder:sent', { id: r.event_id, ok })
    }, delay)
    this.waTimers.set(r.event_id, timer)
  }

  // ─── Shared ───────────────────────────────────────────────────────────────

  private cancelTimer(key: string): void {
    const t = this.timers.get(key)
    if (t) { clearTimeout(t); this.timers.delete(key) }
  }
}

export const schedulerService = new SchedulerService()
