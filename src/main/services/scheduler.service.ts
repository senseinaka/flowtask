import { getPendingReminders, markReminderSent } from '../database/queries/reminders'
import {
  getPendingDelegatedReminders,
  markDelegatedReminderSent
} from '../database/queries/delegated-reminders'
import {
  getPendingScheduledMessages, markMessageSent,
  markMessagePartial, rescheduleRecurring
} from '../database/queries/messages'
import { whatsappService } from './whatsapp.service'
import type { Reminder, ScheduledMessage } from '@shared/types'

type PushFn = (channel: string, data: unknown) => void

class SchedulerService {
  private timers          = new Map<string, ReturnType<typeof setTimeout>>()
  private delegatedTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private pushFn: PushFn | null = null
  private pollInterval: ReturnType<typeof setInterval> | null = null

  start(push: PushFn): void {
    this.pushFn = push
    this.loadPendingReminders()
    this.loadPendingDelegatedReminders()
    this.loadPendingMessages()
    this.pollInterval = setInterval(() => {
      this.loadPendingReminders()
      this.loadPendingDelegatedReminders()
      this.loadPendingMessages()
    }, 60_000)
  }

  stop(): void {
    if (this.pollInterval) clearInterval(this.pollInterval)
    this.timers.forEach((t) => clearTimeout(t))
    this.delegatedTimers.forEach((t) => clearTimeout(t))
    this.timers.clear()
    this.delegatedTimers.clear()
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

  // ─── Shared ───────────────────────────────────────────────────────────────

  private cancelTimer(key: string): void {
    const t = this.timers.get(key)
    if (t) { clearTimeout(t); this.timers.delete(key) }
  }
}

export const schedulerService = new SchedulerService()
