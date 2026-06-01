import { randomUUID } from 'crypto'
import { getDb } from '../db'
import type { DelegatedTask, CreateDelegatedTaskInput } from '@shared/types'
import { logStatusChange } from './task-log'

const WITH_CONTACT = `
  SELECT d.*, c.name as contact_name, c.phone as contact_phone
  FROM delegated_tasks d
  LEFT JOIN contacts c ON c.id = d.contact_id
`

function hydrate(row: Record<string, unknown>): DelegatedTask {
  const { contact_name, contact_phone, ...rest } = row
  return {
    ...rest,
    contact: contact_name
      ? { id: rest.contact_id as string, name: contact_name as string, phone: contact_phone as string, created_at: 0, updated_at: 0 }
      : undefined
  } as DelegatedTask
}

export function getDelegatedTask(id: string): DelegatedTask | null {
  const row = getDb().prepare(`${WITH_CONTACT} WHERE d.id = ?`).get(id)
  return row ? hydrate(row as Record<string, unknown>) : null
}

export function listDelegatedTasks(): DelegatedTask[] {
  const rows = getDb().prepare(`${WITH_CONTACT} ORDER BY d.status ASC, d.priority ASC, d.due_date ASC`).all()
  return (rows as Record<string, unknown>[]).map(hydrate)
}

export function createDelegatedTask(input: CreateDelegatedTaskInput): DelegatedTask {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO delegated_tasks (id, contact_id, title, description, status, priority, due_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)
  `).run(id, input.contact_id, input.title, input.description ?? '', input.priority ?? 3, input.due_date ?? null, now, now)
  logStatusChange(id, 'delegated', null, 'pending')
  return hydrate(db.prepare(`${WITH_CONTACT} WHERE d.id = ?`).get(id) as Record<string, unknown>)
}

export function updateDelegatedTask(id: string, data: Partial<DelegatedTask>): DelegatedTask | null {
  const db = getDb()
  const allowed = ['title', 'description', 'status', 'priority', 'due_date']
  const sets: string[] = ['updated_at = ?']
  const vals: unknown[] = [Date.now()]

  // Capture previous status for log
  const prevRow = db.prepare('SELECT status FROM delegated_tasks WHERE id = ?').get(id) as { status: string } | undefined
  const prevStatus = prevRow?.status ?? null

  for (const key of allowed) {
    if (key in data) { sets.push(`${key} = ?`); vals.push((data as Record<string, unknown>)[key]) }
  }

  if (data.status === 'done') {
    sets.push('completed_at = ?')
    vals.push(data.status === 'done' ? Date.now() : null)
  } else if (data.status && data.status !== 'done') {
    sets.push('completed_at = ?')
    vals.push(null)
  }

  vals.push(id)
  db.prepare(`UPDATE delegated_tasks SET ${sets.join(', ')} WHERE id = ?`).run(...vals)

  // Log status transition
  if (data.status && data.status !== prevStatus) {
    logStatusChange(id, 'delegated', prevStatus, data.status)
  }

  const row = db.prepare(`${WITH_CONTACT} WHERE d.id = ?`).get(id)
  return row ? hydrate(row as Record<string, unknown>) : null
}

export function deleteDelegatedTask(id: string): void {
  getDb().prepare('DELETE FROM delegated_tasks WHERE id = ?').run(id)
}
