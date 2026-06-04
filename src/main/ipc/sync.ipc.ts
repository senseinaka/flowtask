import { ipcMain, shell } from 'electron'
import { randomUUID } from 'crypto'
import { driveService } from '../services/drive.service'
import { whatsappService } from '../services/whatsapp.service'
import { getDb } from '../database/db'

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

  /** Verifica si la conexión Drive es realmente válida (puede detectar invalid_grant) */
  ipcMain.handle('sync:testDriveConnection', () => driveService.testConnection())

  /** Desconecta Drive borrando los tokens para poder reconectar */
  ipcMain.handle('sync:disconnectDrive', () => driveService.disconnect())

  ipcMain.handle('shell:open', (_e, url: string) => shell.openExternal(url))

  // ── Grupos de WhatsApp ─────────────────────────────────────────────────────

  /** Busca los grupos reales de WhatsApp vía Evolution API */
  ipcMain.handle('whatsapp:fetchGroups', () => whatsappService.fetchGroups())

  /** Lista los grupos favoritos guardados en DB */
  ipcMain.handle('whatsapp:groups:list', () =>
    getDb().prepare('SELECT * FROM whatsapp_groups ORDER BY name ASC').all()
  )

  /** Guarda un grupo como favorito */
  ipcMain.handle('whatsapp:groups:save', (_e, jid: string, name: string, description = '') => {
    const db  = getDb()
    const now = Date.now()
    const existing = db.prepare('SELECT id FROM whatsapp_groups WHERE jid = ?').get(jid) as { id: string } | undefined
    if (existing) {
      db.prepare('UPDATE whatsapp_groups SET name=?, description=?, updated_at=? WHERE id=?')
        .run(name, description, now, existing.id)
      return db.prepare('SELECT * FROM whatsapp_groups WHERE id=?').get(existing.id)
    }
    const id = randomUUID()
    db.prepare('INSERT INTO whatsapp_groups (id,name,jid,description,created_at,updated_at) VALUES (?,?,?,?,?,?)')
      .run(id, name, jid, description, now, now)
    return db.prepare('SELECT * FROM whatsapp_groups WHERE id=?').get(id)
  })

  /** Elimina un grupo favorito */
  ipcMain.handle('whatsapp:groups:delete', (_e, id: string) =>
    getDb().prepare('DELETE FROM whatsapp_groups WHERE id=?').run(id)
  )

  // ── Templates de mensajes WhatsApp ─────────────────────────────────────────

  /** Obtiene un template por key */
  ipcMain.handle('whatsapp:template:get', (_e, key: string) =>
    getDb().prepare('SELECT * FROM whatsapp_templates WHERE key=?').get(key)
  )

  /** Guarda/actualiza un template */
  ipcMain.handle('whatsapp:template:save', (_e, key: string, body: string) => {
    const db = getDb()
    const now = Date.now()
    const existing = db.prepare('SELECT id FROM whatsapp_templates WHERE key=?').get(key) as { id: string } | undefined
    if (existing) {
      db.prepare('UPDATE whatsapp_templates SET body=?, updated_at=? WHERE key=?').run(body, now, key)
    } else {
      db.prepare('INSERT INTO whatsapp_templates (id,key,name,body,updated_at) VALUES (?,?,?,?,?)')
        .run(randomUUID(), key, key, body, now)
    }
  })

  /** Envía un mensaje a un número o grupo JID */
  ipcMain.handle('whatsapp:sendToGroup', (_e, jid: string, message: string) =>
    whatsappService.sendMessage(jid, message)
  )
}
