import { ipcMain } from 'electron'
import * as googleCalendar from '../services/google-calendar.service'
import { getUnifiedEvents } from '../database/queries/calendar'

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
}
