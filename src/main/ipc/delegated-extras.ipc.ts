import { ipcMain, shell, BrowserWindow, dialog } from 'electron'
import {
  listDelegatedReminders,
  createDelegatedReminder,
  deleteDelegatedReminder
} from '../database/queries/delegated-reminders'
import {
  listDelegatedAttachments,
  addDelegatedAttachment,
  deleteDelegatedAttachment,
  getDelegatedAttachmentPath
} from '../database/queries/delegated-attachments'
import { schedulerService } from '../services/scheduler.service'
import type { CreateReminderInput } from '@shared/types'

export function registerDelegatedExtrasIpc(): void {
  // ── Reminders ──────────────────────────────────────────────────────────────
  ipcMain.handle('delegated-reminders:list', (_e, taskId: string) =>
    listDelegatedReminders(taskId)
  )

  ipcMain.handle('delegated-reminders:create', (_e, data: CreateReminderInput) => {
    const reminder = createDelegatedReminder(data)
    schedulerService.scheduleDelegatedReminder(reminder)
    return reminder
  })

  ipcMain.handle('delegated-reminders:delete', (_e, id: string) => {
    schedulerService.cancelDelegatedReminder(id)
    deleteDelegatedReminder(id)
  })

  // ── Attachments ────────────────────────────────────────────────────────────
  ipcMain.handle('delegated-attachments:list', (_e, taskId: string) =>
    listDelegatedAttachments(taskId)
  )

  ipcMain.handle('delegated-attachments:add', (_e, taskId: string, filePath: string) =>
    addDelegatedAttachment(taskId, filePath)
  )

  ipcMain.handle('delegated-attachments:delete', (_e, id: string) =>
    deleteDelegatedAttachment(id)
  )

  ipcMain.handle('delegated-attachments:open', (_e, id: string) => {
    const filePath = getDelegatedAttachmentPath(id)
    if (filePath) shell.openPath(filePath)
  })

  // selectFile is shared with attachments:selectFile — no duplicate needed
  ipcMain.handle('delegated-attachments:selectFile', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [
        { name: 'Todos los archivos', extensions: ['*'] },
        { name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
        { name: 'Documentos', extensions: ['pdf', 'doc', 'docx', 'txt', 'md', 'xlsx', 'xls'] }
      ]
    })
    return result.canceled ? null : result.filePaths[0]
  })
}
