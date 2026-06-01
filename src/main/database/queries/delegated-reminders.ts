import { randomUUID } from 'crypto'
import { getDb } from '../db'
import type { Reminder, CreateReminderInput } from '@shared/types'

export function listDelegatedReminders(taskId: string): Reminder[] {
  return getDb()
    .prepare('SELECT * FROM delegated_reminders WHERE task_id = ? ORDER BY remind_at ASC')
    .all(taskId) as Reminder[]
}

export function getPendingDelegatedReminders(): Reminder[] {
  return getDb()
    .prepare('SELECT * FROM delegated_reminders WHERE sent = 0 AND remind_at > ? ORDER BY remind_at ASC')
    .all(Date.now()) as Reminder[]
}

export function createDelegatedReminder(input: CreateReminderInput): Reminder {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  db.prepare(
    `INSERT INTO delegated_reminders (id, task_id, remind_at, phone_number, message, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, input.task_id, input.remind_at, input.phone_number, input.message, now)
  return db.prepare('SELECT * FROM delegated_reminders WHERE id = ?').get(id) as Reminder
}

export function markDelegatedReminderSent(id: string, success: boolean): void {
  getDb()
    .prepare('UPDATE delegated_reminders SET sent = ?, sent_at = ? WHERE id = ?')
    .run(success ? 1 : 2, Date.now(), id)
}

export function deleteDelegatedReminder(id: string): void {
  getDb().prepare('DELETE FROM delegated_reminders WHERE id = ?').run(id)
}
