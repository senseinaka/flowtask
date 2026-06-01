import { ipcMain } from 'electron'
import {
  listDelegatedTasks, createDelegatedTask,
  updateDelegatedTask, deleteDelegatedTask
} from '../database/queries/delegated'
import { whatsappService } from '../services/whatsapp.service'
import type { CreateDelegatedTaskInput, DelegatedTask } from '@shared/types'

export function registerDelegatedIpc(): void {
  ipcMain.handle('delegated:list', () => listDelegatedTasks())

  ipcMain.handle('delegated:create', (_e, input: CreateDelegatedTaskInput) =>
    createDelegatedTask(input)
  )

  ipcMain.handle('delegated:update', (_e, id: string, data: Partial<DelegatedTask>) =>
    updateDelegatedTask(id, data)
  )

  ipcMain.handle('delegated:delete', (_e, id: string) => deleteDelegatedTask(id))

  ipcMain.handle('delegated:remind', async (_e, phone: string, taskTitle: string, contactName: string) => {
    const message = `Hola ${contactName}, este es un recordatorio de seguimiento:\n\nTarea pendiente: *${taskTitle}*\n\n¿Cómo va?`
    return whatsappService.sendMessage(phone, message)
  })
}
