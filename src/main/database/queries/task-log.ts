import { randomUUID } from 'crypto'
import { getDb } from '../db'
import type { TaskStatusLogEntry, TaskType } from '@shared/types'

export function logStatusChange(
  taskId: string,
  taskType: TaskType,
  fromStatus: string | null,
  toStatus: string,
  note = ''
): void {
  const db = getDb()
  db.prepare(
    `INSERT INTO task_status_log (id, task_id, task_type, from_status, to_status, changed_at, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), taskId, taskType, fromStatus ?? null, toStatus, Date.now(), note)
}

export function getStatusLog(taskId: string, taskType: TaskType): TaskStatusLogEntry[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM task_status_log
       WHERE task_id = ? AND task_type = ?
       ORDER BY changed_at ASC`
    )
    .all(taskId, taskType) as TaskStatusLogEntry[]
  return rows
}
