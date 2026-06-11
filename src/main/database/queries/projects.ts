import { randomUUID } from 'crypto'
import { getPowerSyncDb } from '../powersync'
import type { Project } from '@shared/types'

const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'

export async function listProjects(): Promise<Project[]> {
  const db = getPowerSyncDb()
  return db.getAll<Project>('SELECT * FROM projects ORDER BY name ASC')
}

export async function getProject(id: string): Promise<Project | null> {
  const db = getPowerSyncDb()
  const row = await db.getOptional<Project>('SELECT * FROM projects WHERE id = ?', [id])
  return row ?? null
}

export async function createProject(name: string, color = '#6366f1'): Promise<Project> {
  const db = getPowerSyncDb()
  const id = randomUUID()
  const now = Date.now()
  await db.execute(
    'INSERT INTO projects (id, name, color, created_at, updated_at, workspace_id) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, color, now, now, WORKSPACE_ID]
  )
  return (await getProject(id))!
}

export async function updateProject(
  id: string,
  data: Partial<Pick<Project, 'name' | 'color'>>
): Promise<Project | null> {
  const db = getPowerSyncDb()
  const updates: string[] = []
  const params: unknown[] = []

  if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name) }
  if (data.color !== undefined) { updates.push('color = ?'); params.push(data.color) }
  if (!updates.length) return getProject(id)

  updates.push('updated_at = ?')
  params.push(Date.now(), id)
  await db.execute(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, params)
  return getProject(id)
}

export async function deleteProject(id: string): Promise<void> {
  const db = getPowerSyncDb()
  await db.execute('DELETE FROM projects WHERE id = ?', [id])
}

export async function exportAllProjects(): Promise<Project[]> {
  return listProjects()
}
