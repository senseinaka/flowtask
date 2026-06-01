import { randomUUID } from 'crypto'
import { getDb } from '../db'
import type { Reminder, CreateReminderInput } from '@shared/types'

export function listReminders(taskId: string): Reminder[] {
  return getDb()
    .prepare('SELECT * FROM reminders WHERE task_id = ? ORDER BY remind_at ASC')
    .all(taskId) as Reminder[]
}

export function getPendingReminders(): Reminder[] {
  return getDb()
    .prepare('SELECT * FROM reminders WHERE sent = 0 AND remind_at > ? ORDER BY remind_at ASC')
    .all(Date.now()) as Reminder[]
}

export function createReminder(input: CreateReminderInput): Reminder {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  db.prepare(
    `INSERT INTO reminders (id, task_id, remind_at, phone_number, message, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, input.task_id, input.remind_at, input.phone_number, input.message, now)
  return getReminder(id)!
}

export function getReminder(id: string): Reminder | null {
  return (getDb().prepare('SELECT * FROM reminders WHERE id = ?').get(id) as Reminder) ?? null
}

export function markReminderSent(id: string, success: boolean): void {
  getDb()
    .prepare('UPDATE reminders SET sent = ?, sent_at = ? WHERE id = ?')
    .run(success ? 1 : 2, Date.now(), id)
}

export function deleteReminder(id: string): void {
  getDb().prepare('DELETE FROM reminders WHERE id = ?').run(id)
}

export function exportAllReminders(): Reminder[] {
  return getDb().prepare('SELECT * FROM reminders ORDER BY remind_at ASC').all() as Reminder[]
}

