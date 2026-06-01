import { randomUUID } from 'crypto'
import { getDb } from '../db'
import type {
  MessageTemplate, ScheduledMessage, CreateScheduledMessageInput,
  MessageRecurrence, MessageStatus, Contact
} from '@shared/types'
import dayjs from 'dayjs'

// ─── Templates ────────────────────────────────────────────────────────────────

export function listTemplates(): MessageTemplate[] {
  return getDb().prepare('SELECT * FROM message_templates ORDER BY name ASC').all() as MessageTemplate[]
}

export function createTemplate(name: string, body: string): MessageTemplate {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  db.prepare('INSERT INTO message_templates (id, name, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, name, body, now, now)
  return db.prepare('SELECT * FROM message_templates WHERE id = ?').get(id) as MessageTemplate
}

export function updateTemplate(id: string, name: string, body: string): MessageTemplate | null {
  const db = getDb()
  db.prepare('UPDATE message_templates SET name = ?, body = ?, updated_at = ? WHERE id = ?').run(name, body, Date.now(), id)
  return db.prepare('SELECT * FROM message_templates WHERE id = ?').get(id) as MessageTemplate | null
}

export function deleteTemplate(id: string): void {
  getDb().prepare('DELETE FROM message_templates WHERE id = ?').run(id)
}

// ─── Scheduled messages ────────────────────────────────────────────────────────

function hydrateMessage(row: Record<string, unknown>, contacts: Contact[]): ScheduledMessage {
  const contactIds: string[] = JSON.parse(row.contact_ids as string ?? '[]')
  return {
    ...(row as unknown as ScheduledMessage),
    contact_ids: contactIds,
    contacts: contacts.filter((c) => contactIds.includes(c.id))
  }
}

export function listScheduledMessages(status?: MessageStatus | MessageStatus[]): ScheduledMessage[] {
  const db = getDb()
  const contacts = db.prepare('SELECT * FROM contacts').all() as Contact[]

  let rows: Record<string, unknown>[]
  if (!status) {
    rows = db.prepare('SELECT * FROM scheduled_messages ORDER BY send_at ASC').all() as Record<string, unknown>[]
  } else {
    const statuses = Array.isArray(status) ? status : [status]
    const placeholders = statuses.map(() => '?').join(',')
    rows = db.prepare(`SELECT * FROM scheduled_messages WHERE status IN (${placeholders}) ORDER BY send_at ASC`).all(...statuses) as Record<string, unknown>[]
  }

  return rows.map((r) => hydrateMessage(r, contacts))
}

export function getPendingScheduledMessages(): ScheduledMessage[] {
  const db = getDb()
  const contacts = db.prepare('SELECT * FROM contacts').all() as Contact[]
  const rows = db.prepare(
    `SELECT * FROM scheduled_messages WHERE status = 'pending' AND send_at <= ? ORDER BY send_at ASC`
  ).all(Date.now() + 60_000) as Record<string, unknown>[]
  return rows.map((r) => hydrateMessage(r, contacts))
}

export function createScheduledMessage(input: CreateScheduledMessageInput): ScheduledMessage {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO scheduled_messages (id, contact_ids, template_id, message, send_at, recurrence, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(
    id,
    JSON.stringify(input.contact_ids),
    input.template_id ?? null,
    input.message,
    input.send_at,
    input.recurrence ?? 'none',
    now, now
  )
  const contacts = db.prepare('SELECT * FROM contacts').all() as Contact[]
  return hydrateMessage(db.prepare('SELECT * FROM scheduled_messages WHERE id = ?').get(id) as Record<string, unknown>, contacts)
}

export function updateScheduledMessage(id: string, data: { message?: string; send_at?: number; recurrence?: MessageRecurrence; contact_ids?: string[] }): void {
  const db = getDb()
  const sets: string[] = ['updated_at = ?']
  const vals: unknown[] = [Date.now()]
  if (data.message !== undefined) { sets.push('message = ?'); vals.push(data.message) }
  if (data.send_at !== undefined) { sets.push('send_at = ?'); vals.push(data.send_at) }
  if (data.recurrence !== undefined) { sets.push('recurrence = ?'); vals.push(data.recurrence) }
  if (data.contact_ids !== undefined) { sets.push('contact_ids = ?'); vals.push(JSON.stringify(data.contact_ids)) }
  vals.push(id)
  db.prepare(`UPDATE scheduled_messages SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
}

export function markMessageSent(id: string, success: boolean, error?: string): void {
  getDb().prepare(`
    UPDATE scheduled_messages
    SET status = ?, sent_at = ?, error = ?, updated_at = ?
    WHERE id = ?
  `).run(success ? 'sent' : 'failed', Date.now(), error ?? null, Date.now(), id)
}

export function markMessagePartial(id: string, error: string): void {
  getDb().prepare(`
    UPDATE scheduled_messages SET status = 'partial', error = ?, sent_at = ?, updated_at = ? WHERE id = ?
  `).run(error, Date.now(), Date.now(), id)
}

export function rescheduleRecurring(id: string, recurrence: MessageRecurrence): void {
  const nextMap: Record<string, [number, dayjs.ManipulateType]> = {
    daily: [1, 'day'],
    weekly: [7, 'day'],
    monthly: [1, 'month']
  }
  const [amount, unit] = nextMap[recurrence] ?? [1, 'day']
  const current = getDb().prepare('SELECT send_at FROM scheduled_messages WHERE id = ?').get(id) as { send_at: number }
  if (!current) return
  const nextAt = dayjs(current.send_at).add(amount, unit).valueOf()
  getDb().prepare(`
    UPDATE scheduled_messages SET status = 'pending', send_at = ?, sent_at = NULL, error = NULL, updated_at = ? WHERE id = ?
  `).run(nextAt, Date.now(), id)
}

export function deleteScheduledMessage(id: string): void {
  getDb().prepare('DELETE FROM scheduled_messages WHERE id = ?').run(id)
}

export function retryFailedMessage(id: string): void {
  getDb().prepare(`
    UPDATE scheduled_messages SET status = 'pending', error = NULL, sent_at = NULL, updated_at = ? WHERE id = ?
  `).run(Date.now(), id)
}
