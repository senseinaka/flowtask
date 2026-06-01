import { ipcMain } from 'electron'
import {
  listTemplates, createTemplate, updateTemplate, deleteTemplate,
  listScheduledMessages, createScheduledMessage, updateScheduledMessage,
  deleteScheduledMessage, retryFailedMessage
} from '../database/queries/messages'
import { schedulerService } from '../services/scheduler.service'
import type { CreateScheduledMessageInput, MessageStatus } from '@shared/types'

export function registerMessagesIpc(): void {
  // ─── Templates ──────────────────────────────────────────────────────────────

  ipcMain.handle('messages:listTemplates', () => {
    return listTemplates()
  })

  ipcMain.handle('messages:createTemplate', (_e, name: string, body: string) => {
    return createTemplate(name, body)
  })

  ipcMain.handle('messages:updateTemplate', (_e, id: string, name: string, body: string) => {
    return updateTemplate(id, name, body)
  })

  ipcMain.handle('messages:deleteTemplate', (_e, id: string) => {
    deleteTemplate(id)
  })

  // ─── Scheduled messages ──────────────────────────────────────────────────────

  ipcMain.handle('messages:list', (_e, status?: MessageStatus | MessageStatus[]) => {
    return listScheduledMessages(status)
  })

  ipcMain.handle('messages:create', (_e, input: CreateScheduledMessageInput) => {
    const msg = createScheduledMessage(input)
    // Register immediately in the scheduler without waiting for the next poll
    schedulerService.scheduleMessage(msg)
    return msg
  })

  ipcMain.handle('messages:update', (_e, id: string, data: { message?: string; send_at?: number; recurrence?: string; contact_ids?: string[] }) => {
    // Cancel any existing timer and re-register with new values
    schedulerService.cancelMessage(id)
    updateScheduledMessage(id, data as Parameters<typeof updateScheduledMessage>[1])
    // Re-fetch updated message and reschedule
    const updated = listScheduledMessages('pending').find((m) => m.id === id)
    if (updated) schedulerService.scheduleMessage(updated)
  })

  ipcMain.handle('messages:delete', (_e, id: string) => {
    schedulerService.cancelMessage(id)
    deleteScheduledMessage(id)
  })

  ipcMain.handle('messages:retry', (_e, id: string) => {
    retryFailedMessage(id)
    const updated = listScheduledMessages('pending').find((m) => m.id === id)
    if (updated) schedulerService.scheduleMessage(updated)
  })
}
