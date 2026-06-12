import { app, ipcMain } from 'electron'
import { checkForUpdatesManually } from '../services/updater.service'

export function registerAppIpc(): void {
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('app:checkForUpdates', () => checkForUpdatesManually())
}
