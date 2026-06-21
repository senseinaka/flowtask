import { randomUUID } from 'crypto'
import { getDb } from '../db'
import { getPowerSyncDb } from '../powersync'
import type {
  KnowledgeEntry,
  KnowledgeGlobalSummary,
  KnowledgeContentType,
  KnowledgeDriveStatus,
  KnowledgeListFilters,
  KnowledgeSource
} from '@shared/types'

const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'

// ── Sources (flowtask.db — local catalog) ────────────────────────────────────

export function listKnowledgeSources(): KnowledgeSource[] {
  return getDb()
    .prepare('SELECT * FROM knowledge_sources ORDER BY sort_order ASC')
    .all() as KnowledgeSource[]
}

export function createKnowledgeSource(data: {
  name: string; icon: string; color: string
}): KnowledgeSource {
  const db  = getDb()
  const id  = randomUUID()
  const max = (db.prepare('SELECT MAX(sort_order) as m FROM knowledge_sources').get() as { m: number | null }).m ?? 0
  db.prepare('INSERT INTO knowledge_sources (id, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)')
    .run(id, data.name, data.icon, data.color, max + 10)
  return db.prepare('SELECT * FROM knowledge_sources WHERE id = ?').get(id) as KnowledgeSource
}

export function updateKnowledgeSource(id: string, data: {
  name?: string; icon?: string; color?: string; sort_order?: number
}): void {
  const sets: string[] = []
  const vals: unknown[] = []
  if (data.name       !== undefined) { sets.push('name = ?');       vals.push(data.name) }
  if (data.icon       !== undefined) { sets.push('icon = ?');       vals.push(data.icon) }
  if (data.color      !== undefined) { sets.push('color = ?');      vals.push(data.color) }
  if (data.sort_order !== undefined) { sets.push('sort_order = ?'); vals.push(data.sort_order) }
  if (sets.length === 0) return
  vals.push(id)
  getDb().prepare(`UPDATE knowledge_sources SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
}

export function deleteKnowledgeSource(id: string): void {
  getDb().prepare('DELETE FROM knowledge_sources WHERE id = ?').run(id)
}

// ── Entries (PowerSync) ───────────────────────────────────────────────────────

export async function listKnowledgeEntries(
  filters?: KnowledgeListFilters
): Promise<KnowledgeEntry[]> {
  const conditions: string[] = ['workspace_id = ?', '(parent_id IS NULL OR parent_id = \'\')']
  const vals: unknown[] = [WORKSPACE_ID]

  if (filters?.search) {
    const q = `%${filters.search}%`
    conditions.push('(title LIKE ? OR body LIKE ? OR topic LIKE ? OR source LIKE ? OR tags LIKE ?)')
    vals.push(q, q, q, q, q)
  }
  if (filters?.topic)        { conditions.push('topic = ?');        vals.push(filters.topic) }
  if (filters?.content_type) { conditions.push('content_type = ?'); vals.push(filters.content_type) }
  if (filters?.source)       { conditions.push('source = ?');       vals.push(filters.source) }

  return getPowerSyncDb().getAll<KnowledgeEntry>(`
    SELECT * FROM knowledge_entries
    WHERE ${conditions.join(' AND ')}
    ORDER BY COALESCE(entry_date, created_at) DESC
  `, vals)
}

export async function listKnowledgeSubEntries(parentId: string): Promise<KnowledgeEntry[]> {
  return getPowerSyncDb().getAll<KnowledgeEntry>(`
    SELECT * FROM knowledge_entries
    WHERE parent_id = ?
    ORDER BY COALESCE(entry_date, created_at) ASC
  `, [parentId])
}

export async function getKnowledgeEntry(id: string): Promise<KnowledgeEntry | null> {
  return getPowerSyncDb().getOptional<KnowledgeEntry>(
    'SELECT * FROM knowledge_entries WHERE id = ?', [id]
  )
}

export interface CreateKnowledgeEntryFields {
  title?: string
  content_type: KnowledgeContentType
  body?: string
  topic?: string
  tags?: string[]
  source?: string
  entry_date?: number
  parent_id?: string | null
}

export async function createKnowledgeEntry(
  data: CreateKnowledgeEntryFields,
  userId: string
): Promise<KnowledgeEntry> {
  const db  = getPowerSyncDb()
  const id  = randomUUID()
  const now = Date.now()

  await db.execute(`
    INSERT INTO knowledge_entries (
      id, workspace_id, title, content_type, body, topic, tags, source,
      ai_summary, drive_file_id, drive_folder_id, drive_status,
      file_name, file_size, file_mime_type, local_path,
      created_by, created_at, updated_at, entry_date, parent_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', NULL, NULL, 'none', NULL, NULL, NULL, NULL, ?, ?, ?, ?, ?)
  `, [
    id, WORKSPACE_ID,
    data.title ?? '',
    data.content_type,
    data.body ?? '',
    data.topic ?? '',
    JSON.stringify(data.tags ?? []),
    data.source ?? '',
    userId, now, now,
    data.entry_date ?? null,
    data.parent_id ?? null
  ])

  return (await db.getOptional<KnowledgeEntry>('SELECT * FROM knowledge_entries WHERE id = ?', [id]))!
}

export interface UpdateKnowledgeEntryFields {
  title?: string
  body?: string
  topic?: string
  tags?: string[]
  source?: string
  ai_summary?: string
  entry_date?: number | null
  drive_file_id?: string | null
  drive_folder_id?: string | null
  drive_status?: KnowledgeDriveStatus
  file_name?: string | null
  file_size?: number | null
  file_mime_type?: string | null
  local_path?: string | null
}

export async function updateKnowledgeEntry(
  id: string,
  data: UpdateKnowledgeEntryFields
): Promise<KnowledgeEntry> {
  const db  = getPowerSyncDb()
  const now = Date.now()
  const sets: string[] = []
  const vals: unknown[] = []

  if (data.title          !== undefined) { sets.push('title = ?');          vals.push(data.title) }
  if (data.body           !== undefined) { sets.push('body = ?');           vals.push(data.body) }
  if (data.topic          !== undefined) { sets.push('topic = ?');          vals.push(data.topic) }
  if (data.tags           !== undefined) { sets.push('tags = ?');           vals.push(JSON.stringify(data.tags)) }
  if (data.source         !== undefined) { sets.push('source = ?');         vals.push(data.source) }
  if (data.ai_summary     !== undefined) { sets.push('ai_summary = ?');     vals.push(data.ai_summary) }
  if (data.entry_date     !== undefined) { sets.push('entry_date = ?');     vals.push(data.entry_date) }
  if (data.drive_file_id  !== undefined) { sets.push('drive_file_id = ?');  vals.push(data.drive_file_id) }
  if (data.drive_folder_id !== undefined) { sets.push('drive_folder_id = ?'); vals.push(data.drive_folder_id) }
  if (data.drive_status   !== undefined) { sets.push('drive_status = ?');   vals.push(data.drive_status) }
  if (data.file_name      !== undefined) { sets.push('file_name = ?');      vals.push(data.file_name) }
  if (data.file_size      !== undefined) { sets.push('file_size = ?');      vals.push(data.file_size) }
  if (data.file_mime_type !== undefined) { sets.push('file_mime_type = ?'); vals.push(data.file_mime_type) }
  if (data.local_path     !== undefined) { sets.push('local_path = ?');     vals.push(data.local_path) }

  if (sets.length === 0) return (await getKnowledgeEntry(id))!

  sets.push('updated_at = ?')
  vals.push(now, id)

  await db.execute(`UPDATE knowledge_entries SET ${sets.join(', ')} WHERE id = ?`, vals)
  return (await db.getOptional<KnowledgeEntry>('SELECT * FROM knowledge_entries WHERE id = ?', [id]))!
}

export async function deleteKnowledgeEntry(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM knowledge_entries WHERE id = ?', [id])
}

export async function getKnowledgeTopics(): Promise<string[]> {
  const rows = await getPowerSyncDb().getAll<{ topic: string }>(`
    SELECT DISTINCT topic FROM knowledge_entries
    WHERE workspace_id = ? AND topic != ''
    ORDER BY topic ASC
  `, [WORKSPACE_ID])
  return rows.map(r => r.topic)
}

export async function searchKnowledge(query: string): Promise<KnowledgeEntry[]> {
  const q = `%${query}%`
  return getPowerSyncDb().getAll<KnowledgeEntry>(`
    SELECT * FROM knowledge_entries
    WHERE workspace_id = ?
      AND (parent_id IS NULL OR parent_id = '')
      AND (title LIKE ? OR body LIKE ? OR topic LIKE ? OR ai_summary LIKE ? OR tags LIKE ? OR source LIKE ?)
    ORDER BY COALESCE(entry_date, created_at) DESC
    LIMIT 50
  `, [WORKSPACE_ID, q, q, q, q, q, q])
}

// ── Global Summaries ──────────────────────────────────────────────────────────

export async function listKnowledgeGlobalSummaries(): Promise<KnowledgeGlobalSummary[]> {
  return getPowerSyncDb().getAll<KnowledgeGlobalSummary>(`
    SELECT * FROM knowledge_global_summaries
    WHERE workspace_id = ?
    ORDER BY created_at DESC
  `, [WORKSPACE_ID])
}

export async function getLatestTopicSummary(topic: string): Promise<KnowledgeGlobalSummary | null> {
  return getPowerSyncDb().getOptional<KnowledgeGlobalSummary>(`
    SELECT * FROM knowledge_global_summaries
    WHERE workspace_id = ? AND topic = ?
    ORDER BY created_at DESC
    LIMIT 1
  `, [WORKSPACE_ID, topic])
}

export async function createKnowledgeGlobalSummary(
  topic: string,
  summary: string,
  entryCount: number,
  userId: string
): Promise<KnowledgeGlobalSummary> {
  const db  = getPowerSyncDb()
  const id  = randomUUID()
  const now = Date.now()

  await db.execute(`
    INSERT INTO knowledge_global_summaries (id, workspace_id, topic, summary, entry_count, created_at, generated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [id, WORKSPACE_ID, topic, summary, entryCount, now, userId])

  return (await db.getOptional<KnowledgeGlobalSummary>(
    'SELECT * FROM knowledge_global_summaries WHERE id = ?', [id]
  ))!
}

export async function deleteKnowledgeGlobalSummary(id: string): Promise<void> {
  await getPowerSyncDb().execute('DELETE FROM knowledge_global_summaries WHERE id = ?', [id])
}

// ── Entry Files (flowtask.db — local) ─────────────────────────────────────────

import type { KnowledgeEntryFile } from '@shared/types'

export function listKnowledgeEntryFiles(entryId: string): KnowledgeEntryFile[] {
  return getDb()
    .prepare('SELECT * FROM knowledge_entry_files WHERE entry_id = ? ORDER BY created_at ASC')
    .all(entryId) as KnowledgeEntryFile[]
}

export function createKnowledgeEntryFile(data: {
  entry_id: string
  file_name: string
  file_size: number
  file_mime_type: string
  local_path: string
  drive_file_id?: string | null
  drive_folder_id?: string | null
  drive_status?: string
}): KnowledgeEntryFile {
  const db  = getDb()
  const id  = randomUUID()
  const now = Date.now()
  db.prepare(`
    INSERT INTO knowledge_entry_files
      (id, entry_id, file_name, file_size, file_mime_type, local_path, drive_file_id, drive_folder_id, drive_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.entry_id, data.file_name, data.file_size, data.file_mime_type,
    data.local_path, data.drive_file_id ?? null, data.drive_folder_id ?? null,
    data.drive_status ?? 'none', now
  )
  return db.prepare('SELECT * FROM knowledge_entry_files WHERE id = ?').get(id) as KnowledgeEntryFile
}

export function updateKnowledgeEntryFile(id: string, data: {
  drive_file_id?: string
  drive_folder_id?: string
  drive_status?: string
}): KnowledgeEntryFile {
  const sets: string[] = []
  const vals: unknown[] = []
  if (data.drive_file_id   !== undefined) { sets.push('drive_file_id = ?');   vals.push(data.drive_file_id) }
  if (data.drive_folder_id !== undefined) { sets.push('drive_folder_id = ?'); vals.push(data.drive_folder_id) }
  if (data.drive_status    !== undefined) { sets.push('drive_status = ?');    vals.push(data.drive_status) }
  if (sets.length > 0) {
    vals.push(id)
    getDb().prepare(`UPDATE knowledge_entry_files SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
  }
  return getDb().prepare('SELECT * FROM knowledge_entry_files WHERE id = ?').get(id) as KnowledgeEntryFile
}

export function deleteKnowledgeEntryFile(id: string): void {
  getDb().prepare('DELETE FROM knowledge_entry_files WHERE id = ?').run(id)
}

// ── Thread Docs (flowtask.db — local) ─────────────────────────────────────────

import type { KnowledgeThreadDoc } from '@shared/types'

export function getThreadDoc(entryId: string): KnowledgeThreadDoc | null {
  return (getDb()
    .prepare('SELECT * FROM knowledge_thread_docs WHERE entry_id = ?')
    .get(entryId) as KnowledgeThreadDoc | undefined) ?? null
}

export function upsertThreadDoc(entryId: string, data: {
  synthesis: string
  key_data: string
  next_steps: string
  checks: string
  entry_count: number
}): KnowledgeThreadDoc {
  const db  = getDb()
  const now = Date.now()
  const existing = db.prepare('SELECT id FROM knowledge_thread_docs WHERE entry_id = ?').get(entryId) as { id: string } | undefined

  if (existing) {
    db.prepare(`
      UPDATE knowledge_thread_docs
      SET synthesis = ?, key_data = ?, next_steps = ?, checks = ?, generated_at = ?, entry_count = ?
      WHERE entry_id = ?
    `).run(data.synthesis, data.key_data, data.next_steps, data.checks, now, data.entry_count, entryId)
    return db.prepare('SELECT * FROM knowledge_thread_docs WHERE entry_id = ?').get(entryId) as KnowledgeThreadDoc
  }

  const id = randomUUID()
  db.prepare(`
    INSERT INTO knowledge_thread_docs (id, entry_id, synthesis, key_data, next_steps, checks, generated_at, entry_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, entryId, data.synthesis, data.key_data, data.next_steps, data.checks, now, data.entry_count)
  return db.prepare('SELECT * FROM knowledge_thread_docs WHERE entry_id = ?').get(entryId) as KnowledgeThreadDoc
}
