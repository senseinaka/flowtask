import { ipcMain, app, dialog, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import {
  listKnowledgeEntries,
  listKnowledgeSubEntries,
  getKnowledgeEntry,
  createKnowledgeEntry,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  listKnowledgeGlobalSummaries,
  createKnowledgeGlobalSummary,
  deleteKnowledgeGlobalSummary,
  getKnowledgeTopics,
  searchKnowledge,
  getLatestTopicSummary,
  listKnowledgeSources,
  createKnowledgeSource,
  updateKnowledgeSource,
  deleteKnowledgeSource,
  listKnowledgeEntryFiles,
  createKnowledgeEntryFile,
  updateKnowledgeEntryFile,
  deleteKnowledgeEntryFile
} from '../database/queries/knowledge'
import type { CreateKnowledgeEntryFields, UpdateKnowledgeEntryFields } from '../database/queries/knowledge'
import {
  summarizeKnowledgeEntry,
  generateKnowledgeGlobalSummary,
  generateEntryThreadDocument,
  analyzeTopicEntries
} from '../services/knowledge-ai.service'
import { driveService } from '../services/drive.service'
import type { KnowledgeListFilters } from '@shared/types'

function getKnowledgeFilesDir(): string {
  const dir = path.join(app.getPath('userData'), 'flowtask', 'knowledge-files')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain', csv: 'text/csv', png: 'image/png',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', zip: 'application/zip',
    json: 'application/json'
  }
  return map[ext.toLowerCase()] ?? 'application/octet-stream'
}

export function registerKnowledgeIpc(): void {
  // ── Sources (local catalog) ───────────────────────────────────────────────

  ipcMain.handle('knowledge:sources:list', () =>
    listKnowledgeSources()
  )

  ipcMain.handle('knowledge:sources:create', (_e, data: { name: string; icon: string; color: string }) =>
    createKnowledgeSource(data)
  )

  ipcMain.handle('knowledge:sources:update', (_e, id: string, data: { name?: string; icon?: string; color?: string }) =>
    updateKnowledgeSource(id, data)
  )

  ipcMain.handle('knowledge:sources:delete', (_e, id: string) =>
    deleteKnowledgeSource(id)
  )

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
    const bodyText = entry.body.replace(/<[^>]*>/g, '').trim()
    const summary = await summarizeKnowledgeEntry(
      entry.title, bodyText, entry.content_type, entry.file_name ?? undefined
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
      file_name: fileName, file_size: fileSize,
      file_mime_type: mimeType, local_path: localPath, drive_status: 'none'
    })

    if (!driveService.isAuthenticated()) return entry

    try {
      const folderId = await driveService.getOrCreateKnowledgeFolder()
      await updateKnowledgeEntry(id, { drive_status: 'uploading' })
      const driveFileId = await driveService.uploadFileToFolder(localPath, folderId, fileName, mimeType)
      return updateKnowledgeEntry(id, {
        drive_file_id: driveFileId, drive_folder_id: folderId, drive_status: 'synced'
      })
    } catch {
      return updateKnowledgeEntry(id, { drive_status: 'error' })
    }
  })

  ipcMain.handle('knowledge:entries:saveClipboardImage', async (
    _e,
    buffer: ArrayBuffer,
    mimeType: string
  ) => {
    const ext       = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png'
    const localName = `kn_${randomUUID()}.${ext}`
    const localDir  = getKnowledgeFilesDir()
    const localPath = path.join(localDir, localName)
    fs.writeFileSync(localPath, Buffer.from(buffer))
    return { localPath, fileName: localName, mimeType }
  })

  ipcMain.handle('knowledge:entries:listChildren', async (_e, parentId: string) =>
    listKnowledgeSubEntries(parentId)
  )

  ipcMain.handle('knowledge:entries:generateDocument', async (_e, entryId: string) => {
    const main = await getKnowledgeEntry(entryId)
    if (!main) throw new Error('Entrada no encontrada')
    const children = await listKnowledgeSubEntries(entryId)
    return generateEntryThreadDocument(main, children)
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

  ipcMain.handle('knowledge:search', async (_e, query: string) =>
    searchKnowledge(query)
  )

  // ── Topic-level AI analysis ───────────────────────────────────────────────

  ipcMain.handle('knowledge:topic:analyze', async (_e, topic: string, userId: string) => {
    const entries = await listKnowledgeEntries({ topic })
    if (entries.length === 0) throw new Error('No hay entradas para analizar')
    const analysis = await analyzeTopicEntries(entries, topic)
    return createKnowledgeGlobalSummary(topic, analysis, entries.length, userId)
  })

  ipcMain.handle('knowledge:topic:latestSummary', async (_e, topic: string) =>
    getLatestTopicSummary(topic)
  )

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

  // ── Entry Files ───────────────────────────────────────────────────────────

  ipcMain.handle('knowledge:files:list', (_e, entryId: string) =>
    listKnowledgeEntryFiles(entryId)
  )

  ipcMain.handle('knowledge:files:selectFile', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Seleccionar archivo adjunto',
      properties: ['openFile']
    })
    return result.canceled || !result.filePaths.length ? null : result.filePaths[0]
  })

  ipcMain.handle('knowledge:files:upload', async (
    _e,
    entryId: string,
    filePath: string,
    rootEntryId?: string   // parent entry id (for sub-entries) — used for Drive folder path
  ) => {
    const fileName = path.basename(filePath)
    const ext      = path.extname(fileName).replace('.', '')
    const mimeType = mimeFromExt(ext)
    const fileSize = fs.statSync(filePath).size

    const localName = `kn_${randomUUID()}.${ext || 'bin'}`
    const localPath = path.join(getKnowledgeFilesDir(), localName)
    fs.copyFileSync(filePath, localPath)

    const fileRecord = createKnowledgeEntryFile({
      entry_id: entryId, file_name: fileName,
      file_size: fileSize, file_mime_type: mimeType,
      local_path: localPath, drive_status: 'none'
    })

    if (!driveService.isAuthenticated()) return fileRecord

    try {
      const rootId = rootEntryId ?? entryId
      const rootEntry = await getKnowledgeEntry(rootId)
      const folderDate  = rootEntry?.entry_date ?? rootEntry?.created_at ?? Date.now()
      const folderTitle = rootEntry?.title || 'Sin título'
      const folderId = await driveService.getOrCreateKnowledgeEntryFolder(folderDate, folderTitle)
      const driveFileId = await driveService.uploadFileToFolder(localPath, folderId, fileName, mimeType)
      return updateKnowledgeEntryFile(fileRecord.id, {
        drive_file_id: driveFileId, drive_folder_id: folderId, drive_status: 'synced'
      })
    } catch {
      return updateKnowledgeEntryFile(fileRecord.id, { drive_status: 'error' })
    }
  })

  ipcMain.handle('knowledge:files:delete', (_e, id: string) =>
    deleteKnowledgeEntryFile(id)
  )
}
