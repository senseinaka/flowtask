import { ipcMain } from 'electron'
import { getPersonalContact, savePersonalContact } from '../services/settings.service'
import type { PersonalContactInfo } from '@shared/types'

export function registerSettingsIpc(): void {
  // ── Datos personales de contacto ────────────────────────────────────────────
  ipcMain.handle('settings:personal:get', () => getPersonalContact())

  ipcMain.handle('settings:personal:save', (_e, data: Partial<PersonalContactInfo>) => {
    savePersonalContact(data)
    return getPersonalContact()
  })
}
