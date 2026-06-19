import { ipcMain } from 'electron'
import * as googleCalendar from '../services/google-calendar.service'
import {
  getUnifiedEvents,
  createManualEvent,
  updateManualEvent,
  deleteManualEvent,
  getEventLinks,
  linkEntityToCalendar,
  unlinkEntity,
  refreshLinkedEvent
} from '../database/queries/calendar'
import { schedulerService } from '../services/scheduler.service'
import type { CalendarEventInput, CalendarEventLink, LinkEntityInput } from '@shared/types'

export function registerCalendarIpc(): void {
  ipcMain.handle('calendar:status', async () => googleCalendar.getConnectionStatus())

  ipcMain.handle('calendar:connect', async () => googleCalendar.startOAuth())

  ipcMain.handle('calendar:disconnect', async () => googleCalendar.disconnect())

  ipcMain.handle('calendar:listCalendars', async () => googleCalendar.listCalendars())

  ipcMain.handle('calendar:setEnabledCalendars', async (_e, calendarIds: string[]) => {
    await googleCalendar.setEnabledCalendars(calendarIds)
    return googleCalendar.getConnectionStatus()
  })

  ipcMain.handle('calendar:getEvents', async (_e, startDate: number, endDate: number) =>
    getUnifiedEvents(startDate, endDate)
  )

  ipcMain.handle('calendar:syncNow', async () => {
    const result = await googleCalendar.syncEnabledCalendars()
    return { synced: result?.synced ?? 0 }
  })

  // ── Fase 2: escritura manual de eventos ──────────────────────────────────

  ipcMain.handle('calendar:createEvent', async (_e, calendarId: string, input: CalendarEventInput) =>
    createManualEvent(calendarId, input)
  )

  ipcMain.handle('calendar:updateEvent', async (_e, calendarId: string, googleEventId: string, input: CalendarEventInput) =>
    updateManualEvent(calendarId, googleEventId, input)
  )

  ipcMain.handle('calendar:deleteEvent', async (_e, calendarId: string, googleEventId: string) =>
    deleteManualEvent(calendarId, googleEventId)
  )

  // ── Fase 2: links opt-in con Finanzas/Comex ──────────────────────────────

  ipcMain.handle('calendar:getLinks', async (_e, sourceModule: CalendarEventLink['source_module'], sourceEventIds: string[]) =>
    getEventLinks(sourceModule, sourceEventIds)
  )

  ipcMain.handle('calendar:linkEntity', async (_e, input: LinkEntityInput) =>
    linkEntityToCalendar(input)
  )

  ipcMain.handle('calendar:unlinkEntity', async (_e, linkId: string) =>
    unlinkEntity(linkId)
  )

  ipcMain.handle('calendar:refreshLinkedEvent', async (_e, linkId: string, input: { title: string; dueAtMs: number }) =>
    refreshLinkedEvent(linkId, input)
  )

  ipcMain.handle('calendar:scheduleWaReminder', (_e, id: string, phone: string, message: string, sendAt: number) =>
    schedulerService.scheduleDirectWaReminder(id, phone, message, sendAt)
  )

  ipcMain.handle('calendar:cancelWaReminder', (_e, id: string) =>
    schedulerService.cancelDirectWaReminder(id)
  )
}
