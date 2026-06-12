import { ipcMain } from 'electron'
import { getPowerSyncStatus } from '../database/powersync'

export function registerPowerSyncIpc(): void {
  ipcMain.handle('powersync:getStatus', () => getPowerSyncStatus())
}
