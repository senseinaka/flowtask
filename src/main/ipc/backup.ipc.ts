import { ipcMain } from 'electron'
import { driveService } from '../services/drive.service'

export function registerBackupIpc(): void {
  /** Lanza un backup inmediato. Requiere Drive autenticado. */
  ipcMain.handle('backup:runNow', async () => {
    return driveService.fullBackup()
  })

  /** Devuelve el estado del último backup (timestamp, success, carpeta). */
  ipcMain.handle('backup:getStatus', () => {
    return driveService.getLastBackupStatus()
  })

  /** Verifica si Drive está disponible para hacer backup. */
  ipcMain.handle('backup:isReady', () => {
    return driveService.isAuthenticated()
  })
}
