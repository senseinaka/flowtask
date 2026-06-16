import { ipcMain } from 'electron'
import { getPowerSyncDb, getPowerSyncStatus, restoreComexLocalCache } from '../database/powersync'

export function registerPowerSyncIpc(): void {
  ipcMain.handle('powersync:getStatus', () => getPowerSyncStatus())
  ipcMain.handle('powersync:restoreComex', async () => {
    const db = getPowerSyncDb()
    await restoreComexLocalCache(db)
    return { ok: true }
  })
}
