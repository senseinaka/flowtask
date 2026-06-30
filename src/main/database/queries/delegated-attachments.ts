import { randomUUID } from 'crypto'
import path from 'path'
import fs from 'fs'
import { getDb, resolveAttachmentPath } from '../db'
import type { Attachment } from '@shared/types'

export function listDelegatedAttachments(taskId: string): Attachment[] {
  return getDb()
    .prepare('SELECT * FROM delegated_attachments WHERE task_id = ? ORDER BY created_at ASC')
    .all(taskId) as Attachment[]
}

export function addDelegatedAttachment(taskId: string, sourcePath: string): Attachment {
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  const originalName = path.basename(sourcePath)
  const ext = path.extname(originalName)
  const storedName = `d_${id}${ext}`
  const destPath = resolveAttachmentPath(storedName)

  fs.copyFileSync(sourcePath, destPath)

  const stats = fs.statSync(destPath)
  const mimeType = getMimeType(ext)

  db.prepare(
    `INSERT INTO delegated_attachments (id, task_id, original_name, stored_name, mime_type, size_bytes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, taskId, originalName, storedName, mimeType, stats.size, now)

  return db.prepare('SELECT * FROM delegated_attachments WHERE id = ?').get(id) as Attachment
}

export function getDelegatedAttachment(id: string): Attachment | null {
  return (getDb().prepare('SELECT * FROM delegated_attachments WHERE id = ?').get(id) as Attachment) ?? null
}

export function deleteDelegatedAttachment(id: string): void {
  const db = getDb()
  const row = getDelegatedAttachment(id)
  if (!row) return
  const filePath = resolveAttachmentPath(row.stored_name)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  db.prepare('DELETE FROM delegated_attachments WHERE id = ?').run(id)
}

export function getDelegatedAttachmentPath(id: string): string | null {
  const row = getDelegatedAttachment(id)
  if (!row) return null
  return resolveAttachmentPath(row.stored_name)
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.zip': 'application/zip',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg'
  }
  return map[ext.toLowerCase()] ?? 'application/octet-stream'
}
