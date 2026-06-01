import { randomUUID } from 'crypto'
import { getDb } from '../db'
import type { Project } from '@shared/types'

export function listProjects(): Project[] {
  return getDb().prepare('SELECT * FROM projects ORDER BY name ASC').all() as Project[]
}

export function getProject(id: string): Project | null {
  return (getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project) ?? null
}

export function createProject(name: string, color = '#6366f1'): Project {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  db.prepare('INSERT INTO projects (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
    id,
    name,
    color,
    now,
    now
  )
  return getProject(id)!
}

export function updateProject(id: string, data: Partial<Pick<Project, 'name' | 'color'>>): Project | null {
  const db = getDb()
  const updates: string[] = []
  const params: unknown[] = []

  if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name) }
  if (data.color !== undefined) { updates.push('color = ?'); params.push(data.color) }
  if (!updates.length) return getProject(id)

  updates.push('updated_at = ?')
  params.push(Date.now(), id)
  db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...params)
  return getProject(id)
}

export function deleteProject(id: string): void {
  getDb().prepare('DELETE FROM projects WHERE id = ?').run(id)
}

export function exportAllProjects(): Project[] {
  return listProjects()
}

