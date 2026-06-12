import { ipcMain, type BrowserWindow } from 'electron'
import { login, logout, getSession } from '../services/auth.service'
import { connectPowerSync, disconnectPowerSync } from '../database/powersync'
import type { AuthLoginResult, AuthSession } from '@shared/types'

export function registerAuthIpc(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('auth:login', async (_e, email: string, password: string): Promise<AuthLoginResult> => {
    const result = await login(email, password)
    if (result.ok) {
      connectPowerSync()
        .then(() => getMainWindow()?.webContents.send('auth:sessionChanged', result.session))
        .catch((err) => console.error('[PowerSync] Error al conectar tras login:', err))
    }
    return result
  })

  ipcMain.handle('auth:logout', async (): Promise<void> => {
    await disconnectPowerSync()
    logout()
    getMainWindow()?.webContents.send('auth:sessionChanged', null)
  })

  ipcMain.handle('auth:getSession', async (): Promise<AuthSession | null> => {
    return getSession()
  })
}
