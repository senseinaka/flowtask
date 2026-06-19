import { randomUUID } from 'crypto'
import { getDb } from '../db'
import type { CalendarWaReminder } from '@shared/types'

export function upsertWaReminder(eventId: string, phone: string, message: string, sendAt: number): CalendarWaReminder {
  const db = getDb()
  db.prepare('DELETE FROM calendar_wa_reminders WHERE event_id = ?').run(eventId)
  const id = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO calendar_wa_reminders (id, event_id, phone, message, send_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, eventId, phone, message, sendAt, now)
  return db.prepare('SELECT * FROM calendar_wa_reminders WHERE id = ?').get(id) as CalendarWaReminder
}

export function markWaReminderSent(eventId: string): void {
  getDb().prepare('UPDATE calendar_wa_reminders SET sent_at = ? WHERE event_id = ?').run(Date.now(), eventId)
}

export function deleteWaReminder(eventId: string): void {
  getDb().prepare('DELETE FROM calendar_wa_reminders WHERE event_id = ?').run(eventId)
}

export function getPendingWaReminders(): CalendarWaReminder[] {
  return getDb().prepare(
    'SELECT * FROM calendar_wa_reminders WHERE sent_at IS NULL ORDER BY send_at ASC'
  ).all() as CalendarWaReminder[]
}

export function getWaReminderForEvent(eventId: string): CalendarWaReminder | null {
  return getDb().prepare(
    'SELECT * FROM calendar_wa_reminders WHERE event_id = ? AND sent_at IS NULL'
  ).get(eventId) as CalendarWaReminder | null
}
