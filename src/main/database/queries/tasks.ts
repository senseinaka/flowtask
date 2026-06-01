import { randomUUID } from 'crypto'
import { getDb } from '../db'
import type { Task, TaskFilters, CreateTaskInput, TaskStatus, Priority } from '@shared/types'
import { logStatusChange } from './task-log'

export function listTasks(filters: TaskFilters = {}): Task[] {
  const db = getDb()
  const conditions: string[] = []
  const params: unknown[] = []

  if (filters.status?.length) {
    conditions.push(`t.status IN (${filters.status.map(() => '?').join(',')})`)
    params.push(...filters.status)
  }
  if (filters.priority?.length) {
    conditions.push(`t.priority IN (${filters.priority.map(() => '?').join(',')})`)
    params.push(...filters.priority)
  }
  if (filters.project_id) {
    conditions.push('t.project_id = ?')
    params.push(filters.project_id)
  }
  if (filters.search) {
    conditions.push('(t.title LIKE ? OR t.description LIKE ?)')
    params.push(`%${filters.search}%`, `%${filters.search}%`)
  }
  if (filters.due_before) {
    conditions.push('t.due_date <= ?')
    params.push(filters.due_before)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const rows = db
    .prepare(
      `SELECT t.*, p.name as project_name, p.color as project_color
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
       ${where}
       ORDER BY t.priority ASC, t.due_date ASC NULLS LAST, t.created_at DESC`
    )
    .all(...params) as Record<string, unknown>[]

  return rows.map(mapRow)
}

export function getTask(id: string): Task | null {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT t.*, p.name as project_name, p.color as project_color
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
       WHERE t.id = ?`
    )
    .get(id) as Record<string, unknown> | undefined

  return row ? mapRow(row) : null
}

export function createTask(input: CreateTaskInput): Task {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()

  const initialStatus = input.status ?? 'pending'

  db.prepare(
    `INSERT INTO tasks (id, project_id, title, description, status, priority, due_date, due_time, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.project_id ?? null,
    input.title,
    input.description ?? '',
    initialStatus,
    input.priority ?? 3,
    input.due_date ?? null,
    input.due_time ?? null,
    now,
    now
  )

  logStatusChange(id, 'personal', null, initialStatus)
  return getTask(id)!
}

export function updateTask(id: string, data: Partial<Task>): Task | null {
  const db = getDb()
  const allowed = [
    'title',
    'description',
    'status',
    'priority',
    'due_date',
    'due_time',
    'project_id',
    'completed_at',
    'synced_at',
    'drive_file_id'
  ]

  const updates: string[] = []
  const params: unknown[] = []

  for (const key of allowed) {
    if (key in data) {
      updates.push(`${key} = ?`)
      params.push((data as Record<string, unknown>)[key] ?? null)
    }
  }

  if (updates.length === 0) return getTask(id)

  // Capture current status before update (for log)
  const currentRow = db.prepare('SELECT status FROM tasks WHERE id = ?').get(id) as { status: string } | undefined
  const prevStatus = currentRow?.status ?? null

  // Auto-set completed_at when marking done
  if (data.status === 'done' && !('completed_at' in data)) {
    updates.push('completed_at = ?')
    params.push(Date.now())
  } else if (data.status && data.status !== 'done' && !('completed_at' in data)) {
    updates.push('completed_at = ?')
    params.push(null)
  }

  updates.push('updated_at = ?')
  params.push(Date.now())
  params.push(id)

  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params)

  // Log status transition if status changed
  if (data.status && data.status !== prevStatus) {
    logStatusChange(id, 'personal', prevStatus, data.status)
  }

  return getTask(id)
}

export function deleteTask(id: string): void {
  getDb().prepare('DELETE FROM tasks WHERE id = ?').run(id)
}

export function addDependency(taskId: string, dependsOnId: string): void {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  db.prepare(
    'INSERT OR IGNORE INTO task_dependencies (id, task_id, depends_on_id, created_at) VALUES (?, ?, ?, ?)'
  ).run(id, taskId, dependsOnId, now)
}

export function removeDependency(taskId: string, dependsOnId: string): void {
  getDb()
    .prepare('DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?')
    .run(taskId, dependsOnId)
}

export function getDependencies(taskId: string): Task[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT t.*, p.name as project_name, p.color as project_color
       FROM task_dependencies td
       JOIN tasks t ON t.id = td.depends_on_id
       LEFT JOIN projects p ON p.id = t.project_id
       WHERE td.task_id = ?`
    )
    .all(taskId) as Record<string, unknown>[]

  return rows.map(mapRow)
}

export function getBlockedBy(taskId: string): Task[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT t.*, p.name as project_name, p.color as project_color
       FROM task_dependencies td
       JOIN tasks t ON t.id = td.task_id
       LEFT JOIN projects p ON p.id = t.project_id
       WHERE td.depends_on_id = ?`
    )
    .all(taskId) as Record<string, unknown>[]

  return rows.map(mapRow)
}

export function exportAllTasks(): Task[] {
  return listTasks()
}

function mapRow(row: Record<string, unknown>): Task {
  const task: Task = {
    id: row.id as string,
    project_id: (row.project_id as string) ?? null,
    title: row.title as string,
    description: (row.description as string) ?? '',
    status: row.status as TaskStatus,
    priority: row.priority as Priority,
    due_date: (row.due_date as number) ?? null,
    due_time: (row.due_time as string) ?? null,
    completed_at: (row.completed_at as number) ?? null,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
    synced_at: (row.synced_at as number) ?? null,
    drive_file_id: (row.drive_file_id as string) ?? null
  }

  if (row.project_name) {
    task.project = {
      id: row.project_id as string,
      name: row.project_name as string,
      color: row.project_color as string,
      created_at: 0,
      updated_at: 0
    }
  }

  return task
}

