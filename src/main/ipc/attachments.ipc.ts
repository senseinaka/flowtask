import { ipcMain, shell, dialog, BrowserWindow } from 'electron'
import {
  listAttachments,
  addAttachment,
  deleteAttachment,
  getAttachmentPath
} from '../database/queries/attachments'

export function registerAttachmentIpc(): void {
  ipcMain.handle('attachments:list', (_e, taskId: string) => listAttachments(taskId))

  ipcMain.handle('attachments:add', (_e, taskId: string, filePath: string) =>
    addAttachment(taskId, filePath)
  )

  ipcMain.handle('attachments:delete', (_e, id: string) => deleteAttachment(id))

  ipcMain.handle('attachments:open', (_e, id: string) => {
    const filePath = getAttachmentPath(id)
    if (filePath) shell.openPath(filePath)
  })

  ipcMain.handle('attachments:selectFile', async (e) => {
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
