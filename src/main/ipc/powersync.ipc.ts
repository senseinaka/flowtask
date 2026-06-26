import { ipcMain } from 'electron'
import { getPowerSyncDb, getPowerSyncStatus, restoreComexLocalCache, reconnectPowerSync } from '../database/powersync'

export function registerPowerSyncIpc(): void {
  ipcMain.handle('powersync:getStatus', () => getPowerSyncStatus())
  ipcMain.handle('powersync:restoreComex', async () => {
    const db = getPowerSyncDb()
    await restoreComexLocalCache(db)
    return { ok: true }
  })
  ipcMain.handle('powersync:reconnect', async () => {
    await reconnectPowerSync()
    return { ok: true }
  })
}
