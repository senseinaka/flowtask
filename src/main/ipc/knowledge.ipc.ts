import { ipcMain, app, dialog, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import {
  listKnowledgeEntries,
  getKnowledgeEntry,
  createKnowledgeEntry,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  listKnowledgeGlobalSummaries,
  createKnowledgeGlobalSummary,
  deleteKnowledgeGlobalSummary,
  getKnowledgeTopics
} from '../database/queries/knowledge'
import type { CreateKnowledgeEntryFields, UpdateKnowledgeEntryFields } from '../database/queries/knowledge'
import { summarizeKnowledgeEntry, generateKnowledgeGlobalSummary } from '../services/knowledge-ai.service'
import { driveService } from '../services/drive.service'
import type { KnowledgeListFilters } from '@shared/types'

function getKnowledgeFilesDir(): string {
  const dir = path.join(app.getPath('userData'), 'flowtask', 'knowledge-files')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    pdf:  'application/pdf',
    doc:  'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls:  'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt:  'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt:  'text/plain',
    csv:  'text/csv',
    png:  'image/png',
    jpg:  'image/jpeg',
    jpeg: 'image/jpeg',
    gif:  'image/gif',
    webp: 'image/webp',
    svg:  'image/svg+xml',
    zip:  'application/zip',
    json: 'application/json'
  }
  return map[ext.toLowerCase()] ?? 'application/octet-stream'
}

export function registerKnowledgeIpc(): void {
  // ── Entries ───────────────────────────────────────────────────────────────

  ipcMain.handle('knowledge:entries:list', async (_e, filters?: KnowledgeListFilters) =>
    listKnowledgeEntries(filters)
  )

  ipcMain.handle('knowledge:entries:get', async (_e, id: string) =>
    getKnowledgeEntry(id)
  )

  ipcMain.handle('knowledge:entries:create', async (_e, data: CreateKnowledgeEntryFields, userId: string) =>
    createKnowledgeEntry(data, userId)
  )

  ipcMain.handle('knowledge:entries:update', async (_e, id: string, data: UpdateKnowledgeEntryFields) =>
    updateKnowledgeEntry(id, data)
  )

  ipcMain.handle('knowledge:entries:delete', async (_e, id: string) =>
    deleteKnowledgeEntry(id)
  )

  ipcMain.handle('knowledge:entries:summarize', async (_e, id: string) => {
    const entry = await getKnowledgeEntry(id)
    if (!entry) throw new Error('Entrada no encontrada')
    const summary = await summarizeKnowledgeEntry(
      entry.title, entry.body, entry.content_type, entry.file_name ?? undefined
    )
    return updateKnowledgeEntry(id, { ai_summary: summary })
  })

  ipcMain.handle('knowledge:entries:uploadFile', async (_e, id: string, filePath: string) => {
    const fileName = path.basename(filePath)
    const ext      = path.extname(fileName).replace('.', '')
    const mimeType = mimeFromExt(ext)
    const stats    = fs.statSync(filePath)
    const fileSize = stats.size

    const localName = `kn_${randomUUID()}.${ext || 'bin'}`
    const localDir  = getKnowledgeFilesDir()
    const localPath = path.join(localDir, localName)
    fs.copyFileSync(filePath, localPath)

    const entry = await updateKnowledgeEntry(id, {
      file_name:      fileName,
      file_size:      fileSize,
      file_mime_type: mimeType,
      local_path:     localPath,
      drive_status:   'none'
    })

    if (!driveService.isAuthenticated()) return entry

    try {
      const folderId = await driveService.getOrCreateKnowledgeFolder()
      await updateKnowledgeEntry(id, { drive_status: 'uploading' })
      const driveFileId = await driveService.uploadFileToFolder(localPath, folderId, fileName, mimeType)
      return updateKnowledgeEntry(id, {
        drive_file_id:   driveFileId,
        drive_folder_id: folderId,
        drive_status:    'synced'
      })
    } catch {
      return updateKnowledgeEntry(id, { drive_status: 'error' })
    }
  })

  ipcMain.handle('knowledge:entries:topics', async () =>
    getKnowledgeTopics()
  )

  ipcMain.handle('knowledge:entries:selectFile', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Seleccionar archivo para Knowledge',
      properties: ['openFile']
    })
    return result.canceled || !result.filePaths.length ? null : result.filePaths[0]
  })

  // ── Summaries ─────────────────────────────────────────────────────────────

  ipcMain.handle('knowledge:summaries:list', async () =>
    listKnowledgeGlobalSummaries()
  )

  ipcMain.handle('knowledge:summaries:generate', async (_e, topic: string | null, userId: string) => {
    const effectiveTopic = topic ?? '__all__'
    const entries = await listKnowledgeEntries(
      effectiveTopic !== '__all__' ? { topic: effectiveTopic } : undefined
    )
    if (entries.length === 0) throw new Error('No hay entradas para resumir')
    const summary = await generateKnowledgeGlobalSummary(entries, effectiveTopic)
    return createKnowledgeGlobalSummary(effectiveTopic, summary, entries.length, userId)
  })

  ipcMain.handle('knowledge:summaries:delete', async (_e, id: string) =>
    deleteKnowledgeGlobalSummary(id)
  )
}
