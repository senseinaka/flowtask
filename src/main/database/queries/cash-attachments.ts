import { randomUUID } from 'crypto'
import path from 'path'
import fs from 'fs'
import { getPowerSyncDb } from '../powersync'
import { driveService } from '../../services/drive.service'
import type { CashAttachment, CashAttachmentOwnerType } from '@shared/types'

const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'

/**
 * Comprobantes de Cajas Internas.
 * La metadata vive en PowerSync (tabla `cash_attachments`, sincroniza ↔ Supabase);
 * los bytes del archivo viven en Google Drive (carpeta "Summit Cajas").
 */

export async function listCashAttachments(
  ownerType: CashAttachmentOwnerType,
  ownerId: string
): Promise<CashAttachment[]> {
  return getPowerSyncDb().getAll<CashAttachment>(
    `SELECT * FROM cash_attachments
     WHERE owner_type = ? AND owner_id = ? AND workspace_id = ?
     ORDER BY created_at ASC`,
    [ownerType, ownerId, WORKSPACE_ID]
  )
}

export async function addCashAttachment(input: {
  ownerType: CashAttachmentOwnerType
  ownerId: string
  sourcePath: string
  createdBy: string
}): Promise<CashAttachment> {
  if (!driveService.isAuthenticated()) {
    throw new Error('Conectá Google Drive en Ajustes → Sincronización para adjuntar comprobantes.')
  }

  const originalName = path.basename(input.sourcePath)
  const ext = path.extname(originalName)
  const mimeType = getMimeType(ext)
  const sizeBytes = fs.existsSync(input.sourcePath) ? fs.statSync(input.sourcePath).size : 0

  const folderId = await driveService.getOrCreateCajasFolder()
  const driveFileId = await driveService.uploadFileToFolder(input.sourcePath, folderId, originalName, mimeType)

  const id = randomUUID()
  const now = new Date().toISOString()

  try {
    await getPowerSyncDb().execute(
      `INSERT INTO cash_attachments
        (id, workspace_id, owner_type, owner_id, original_name, mime_type, size_bytes, drive_file_id, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, WORKSPACE_ID, input.ownerType, input.ownerId, originalName, mimeType, sizeBytes, driveFileId, input.createdBy, now]
    )
  } catch (err) {
    // Si la metadata no se pudo guardar, no dejar el archivo huérfano en Drive
    await driveService.deleteFile(driveFileId).catch(() => null)
    throw err
  }

  return {
    id,
    workspace_id: WORKSPACE_ID,
    owner_type: input.ownerType,
    owner_id: input.ownerId,
    original_name: originalName,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    drive_file_id: driveFileId,
    created_by: input.createdBy,
    created_at: now,
  }
}

export async function deleteCashAttachment(id: string): Promise<void> {
  const db = getPowerSyncDb()
  const row = await db.get<{ drive_file_id: string }>(
    'SELECT drive_file_id FROM cash_attachments WHERE id = ?',
    [id]
  ).catch(() => null)

  if (row?.drive_file_id) {
    await driveService.deleteFile(row.drive_file_id).catch(() => null)
  }
  await db.execute('DELETE FROM cash_attachments WHERE id = ?', [id])
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.txt': 'text/plain',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }
  return map[ext.toLowerCase()] ?? 'application/octet-stream'
}
