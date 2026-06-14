import { app, ipcMain } from 'electron'
import { checkForUpdatesManually, downloadUpdate, installUpdate } from '../services/updater.service'

export function registerAppIpc(): void {
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('app:checkForUpdates', () => checkForUpdatesManually())
  ipcMain.handle('app:downloadUpdate', () => downloadUpdate())
  ipcMain.handle('app:installUpdate', () => installUpdate())
  ipcMain.handle('app:quit', () => app.quit())
}
