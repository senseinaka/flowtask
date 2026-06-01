import { ipcMain } from 'electron'
import { listReminders, createReminder, deleteReminder } from '../database/queries/reminders'
import { schedulerService } from '../services/scheduler.service'
import type { CreateReminderInput } from '@shared/types'

export function registerReminderIpc(): void {
  ipcMain.handle('reminders:list', (_e, taskId: string) => listReminders(taskId))

  ipcMain.handle('reminders:create', (_e, data: CreateReminderInput) => {
    const reminder = createReminder(data)
    schedulerService.scheduleReminder(reminder)
    return reminder
  })

  ipcMain.handle('reminders:delete', (_e, id: string) => {
    schedulerService.cancelReminder(id)
    deleteReminder(id)
  })
}
