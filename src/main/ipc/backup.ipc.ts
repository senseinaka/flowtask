import { ipcMain, BrowserWindow } from 'electron'
import { driveService } from '../services/drive.service'
import { localBackupService } from '../services/local-backup.service'

export function registerBackupIpc(): void {
  // ── Backup en Google Drive (requiere cuenta conectada) ──────────────────────

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

  // ── Backup local (red de seguridad, no depende de ninguna cuenta) ───────────
  //
  // Corre siempre — conectado o no a Drive — y copia DB + adjuntos a una
  // carpeta del disco (configurable). Pensado para que nunca vuelva a pasar
  // lo de "se borraron los vencimientos y no había nada de dónde recuperarlos".

  ipcMain.handle('backup:local:runNow', async () => {
    return localBackupService.runBackup()
  })

  ipcMain.handle('backup:local:getStatus', () => {
    return localBackupService.getLastBackupStatus()
  })

  ipcMain.handle('backup:local:getDir', () => {
    return localBackupService.getBackupDir()
  })

  ipcMain.handle('backup:local:chooseDir', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return null
    return localBackupService.chooseBackupDir(win)
  })

  ipcMain.handle('backup:local:openDir', () => {
    localBackupService.openBackupDir()
  })

  /** Frecuencia del backup automático, en horas (0 = solo manual). */
  ipcMain.handle('backup:local:getInterval', () => {
    return localBackupService.getIntervalHours()
  })

  ipcMain.handle('backup:local:setInterval', (_e, hours: number) => {
    localBackupService.setIntervalHours(hours)
  })

  // ── Restaurar una copia anterior ─────────────────────────────────────────

  /** Lista las copias disponibles para restaurar (carpeta, fecha, tamaño). */
  ipcMain.handle('backup:local:list', async () => {
    return localBackupService.listBackups()
  })

  /**
   * Restaura la copia elegida. Antes de tocar nada, guarda un respaldo del
   * estado actual (por si hay que deshacerlo) y, si todo sale bien, reinicia
   * la app para que la base restaurada se cargue desde cero.
   */
  ipcMain.handle('backup:local:restore', async (_e, folder: string) => {
    return localBackupService.restoreBackup(folder)
  })
}
