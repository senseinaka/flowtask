import { ipcMain, shell } from 'electron'
import { driveService } from '../services/drive.service'
import { whatsappService } from '../services/whatsapp.service'

export function registerSyncIpc(): void {
  ipcMain.handle('sync:trigger', () => driveService.syncNow())
  ipcMain.handle('sync:getStatus', () => driveService.getStatus())
  ipcMain.handle('sync:isAuthenticated', () => driveService.isAuthenticated())
  ipcMain.handle('sync:startOAuth', () => driveService.startOAuth())

  ipcMain.handle('sync:saveGoogleCredentials', (_e, clientId: string, clientSecret: string) =>
    driveService.saveCredentials(clientId, clientSecret)
  )
  ipcMain.handle('sync:getGoogleCredentials', () => driveService.getCredentials())

  ipcMain.handle('sync:connectWhatsapp', () => whatsappService.connectInstance())
  ipcMain.handle('sync:getWhatsappQR', () => whatsappService.getQR())
  ipcMain.handle('sync:getWhatsappConfig', () => whatsappService.getConfig())
  ipcMain.handle('sync:saveWhatsappConfig', (_e, url: string, key: string) =>
    whatsappService.saveConfig(url, key)
  )

  ipcMain.handle('whatsapp:send', (_e, phone: string, message: string) =>
    whatsappService.sendMessage(phone, message)
  )

  ipcMain.handle('shell:open', (_e, url: string) => shell.openExternal(url))
}
