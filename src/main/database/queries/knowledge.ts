import { randomUUID } from 'crypto'
import { getPowerSyncDb } from '../powersync'
import type {
  KnowledgeEntry,
  KnowledgeGlobalSummary,
  KnowledgeContentType,
  KnowledgeDriveStatus,
  KnowledgeListFilters
} from '@shared/types'

const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'

// ── Entries ───────────────────────────────────────────────────────────────────

export async function listKnowledgeEntries(
  filters?: KnowledgeListFilters
): Promise<KnowledgeEntry[]> {
  const conditions: string[] = ['workspace_id = ?']
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
    ORDER BY created_at DESC
  `, vals)
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
      created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', NULL, NULL, 'none', NULL, NULL, NULL, NULL, ?, ?, ?)
  `, [
    id, WORKSPACE_ID,
    data.title ?? '',
    data.content_type,
    data.body ?? '',
    data.topic ?? '',
    JSON.stringify(data.tags ?? []),
    data.source ?? '',
    userId, now, now
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

// ── Global Summaries ──────────────────────────────────────────────────────────

export async function listKnowledgeGlobalSummaries(): Promise<KnowledgeGlobalSummary[]> {
  return getPowerSyncDb().getAll<KnowledgeGlobalSummary>(`
    SELECT * FROM knowledge_global_summaries
    WHERE workspace_id = ?
    ORDER BY created_at DESC
  `, [WORKSPACE_ID])
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
