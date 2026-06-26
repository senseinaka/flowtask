import { google } from 'googleapis'
import { app, shell } from 'electron'
import http from 'http'
import os from 'os'
import ConfigStore from './config-store'
import { exportAllTasks } from '../database/queries/tasks'
import { exportAllProjects } from '../database/queries/projects'
import { exportAllAttachments } from '../database/queries/attachments'
import { exportAllReminders } from '../database/queries/reminders'
import { getDb, getAttachmentsDir } from '../database/db'
import type { SyncResult, SyncStatus, BackupStatus, RrhhEmpresa } from '@shared/types'
import path from 'path'
import fs from 'fs'

const store = new ConfigStore('drive-config')

// Sufijo de carpeta Drive por empresa. NAKA mantiene los nombres legacy
// ("Sueldos"/"Legajos") para no orfanar las carpetas ya creadas; EV usa sufijo.
const DRIVE_EMPRESA_SUFFIX: Record<RrhhEmpresa, string> = { naka: '', ev: ' EV' }
const REDIRECT_PORT = 42813
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`
const SCOPES = ['https://www.googleapis.com/auth/drive.file']

class DriveService {
  private isSyncing = false

  saveCredentials(clientId: string, clientSecret: string): void {
    store.set('clientId', clientId.trim())
    store.set('clientSecret', clientSecret.trim())
    // Clear existing tokens when credentials change
    store.delete('tokens')
  }

  getCredentials(): { clientId: string; clientSecret: string } {
    return {
      clientId: (store.get('clientId', '') as string),
      clientSecret: (store.get('clientSecret', '') as string)
    }
  }

  hasCredentials(): boolean {
    const { clientId, clientSecret } = this.getCredentials()
    return !!(clientId && clientSecret)
  }

  private getOAuth2Client() {
    const { clientId, clientSecret } = this.getCredentials()
    return new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI)
  }

  isAuthenticated(): boolean {
    return this.hasCredentials() && !!store.get('tokens')
  }

  /**
   * Verifica si los tokens son realmente válidos haciendo una llamada mínima a la API.
   * Si detecta invalid_grant, limpia los tokens automáticamente.
   */
  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    if (!this.isAuthenticated()) return { ok: false, error: 'Sin tokens almacenados' }
    try {
      const oauth2Client = this.getOAuth2Client()
      oauth2Client.setCredentials(store.get('tokens') as object)
      const drive = google.drive({ version: 'v3', auth: oauth2Client })
      await drive.about.get({ fields: 'user' })
      return { ok: true }
    } catch (err) {
      const gErr = err as { response?: { data?: { error?: string } } }
      const code  = gErr.response?.data?.error ?? (err as Error).message ?? 'Error desconocido'
      if (code === 'invalid_grant') {
        store.delete('tokens')  // Limpiar tokens vencidos automáticamente
        console.warn('[Drive] Tokens vencidos (invalid_grant) — limpiados')
      }
      return { ok: false, error: code }
    }
  }

  /** Desconecta Drive borrando los tokens almacenados */
  disconnect(): void {
    store.delete('tokens')
  }

  async startOAuth(): Promise<void> {
    if (!this.hasCredentials()) {
      throw new Error('Configurá el Client ID y Client Secret de Google antes de conectar.')
    }
    const oauth2Client = this.getOAuth2Client()
    const authUrl = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES })
    shell.openExternal(authUrl)

    return new Promise((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        if (!req.url?.startsWith('/oauth2callback')) return
        const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`)
        const code = url.searchParams.get('code')
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('<h1>FlowTask conectado a Google Drive. Podés cerrar esta pestaña.</h1>')
        server.close()

        if (!code) { reject(new Error('No code')); return }
        try {
          const { tokens } = await oauth2Client.getToken(code)
          store.set('tokens', tokens)
          resolve()
        } catch (err) {
          reject(err)
        }
      })
      server.listen(REDIRECT_PORT)
      setTimeout(() => { server.close(); reject(new Error('OAuth timeout')) }, 120_000)
    })
  }

  getStatus(): SyncStatus {
    return {
      lastSync: (store.get('lastSync') as number) ?? null,
      isAuthenticated: this.isAuthenticated(),
      isSyncing: this.isSyncing
    }
  }

  async syncNow(): Promise<SyncResult> {
    if (!this.isAuthenticated()) {
      return { success: false, timestamp: Date.now(), error: 'No autenticado con Google Drive' }
    }
    if (this.isSyncing) {
      return { success: false, timestamp: Date.now(), error: 'Sync en curso' }
    }

    this.isSyncing = true
    try {
      const oauth2Client = this.getOAuth2Client()
      oauth2Client.setCredentials(store.get('tokens') as object)
      const drive = google.drive({ version: 'v3', auth: oauth2Client })

      const folderId = await this.getOrCreateFolder(drive, 'FlowTask Backups')

      // Export DB as JSON
      const backup = {
        version: 1,
        exported_at: new Date().toISOString(),
        tasks: await exportAllTasks(),
        projects: await exportAllProjects(),
        attachments: exportAllAttachments(),
        reminders: exportAllReminders()
      }

      const today = new Date().toISOString().slice(0, 10)
      const fileName = `summit-backup-${today}.json`
      const content = JSON.stringify(backup, null, 2)

      // Check if file for today already exists
      const existing = await drive.files.list({
        q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id)'
      })
      const existingId = existing.data.files?.[0]?.id

      if (existingId) {
        await drive.files.update({
          fileId: existingId,
          media: { mimeType: 'application/json', body: content }
        })
      } else {
        await drive.files.create({
          requestBody: { name: fileName, parents: [folderId] },
          media: { mimeType: 'application/json', body: content }
        })
      }

      // Sync attachments
      const attachmentsDir = getAttachmentsDir()
      const attachFolderId = await this.getOrCreateFolder(drive, 'FlowTask Attachments')
      const attachments = exportAllAttachments()
      let filesUploaded = 1

      for (const att of attachments) {
        if (att.drive_file_id) continue
        const filePath = path.join(attachmentsDir, att.stored_name)
        if (!fs.existsSync(filePath)) continue
        await drive.files.create({
          requestBody: { name: att.original_name, parents: [attachFolderId] },
          media: { mimeType: att.mime_type, body: fs.createReadStream(filePath) }
        })
        filesUploaded++
      }

      // Cleanup old backups (keep last 7)
      const allBackups = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        orderBy: 'createdTime desc',
        fields: 'files(id,name)'
      })
      const toDelete = (allBackups.data.files ?? []).slice(7)
      for (const f of toDelete) {
        if (f.id) await drive.files.delete({ fileId: f.id })
      }

      store.set('lastSync', Date.now())
      return { success: true, timestamp: Date.now(), filesUploaded }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Error desconocido'
      return { success: false, timestamp: Date.now(), error }
    } finally {
      this.isSyncing = false
    }
  }

  /**
   * Creates (or retrieves existing) a per-import subfolder inside "FlowTask Comex".
   * Returns { folderId, url } so the caller can store the ID and open the URL.
   */
  async createImportFolder(importTitle: string): Promise<{ folderId: string; url: string }> {
    if (!this.isAuthenticated()) throw new Error('No autenticado con Google Drive')

    const oauth2Client = this.getOAuth2Client()
    oauth2Client.setCredentials(store.get('tokens') as object)
    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    // Root comex folder
    const comexRootId = await this.getOrCreateFolder(drive, 'FlowTask Comex')

    // Sanitize folder name (Drive doesn't like slashes etc.)
    const safe = importTitle.replace(/[/\\:*?"<>|]/g, '-').slice(0, 100)

    // Check if a folder with this name already exists inside FlowTask Comex
    const safeSanitized = safe.replace(/'/g, "\\'")
    const existing = await drive.files.list({
      q: `name='${safeSanitized}' and mimeType='application/vnd.google-apps.folder' and '${comexRootId}' in parents and trashed=false`,
      fields: 'files(id)'
    })
    let folderId: string
    if (existing.data.files?.length) {
      folderId = existing.data.files[0].id!
    } else {
      const created = await drive.files.create({
        requestBody: {
          name: safe,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [comexRootId]
        },
        fields: 'id'
      })
      folderId = created.data.id!
    }

    return {
      folderId,
      url: `https://drive.google.com/drive/folders/${folderId}`
    }
  }

  /** Opens an existing Drive folder in the browser. */
  openFolder(folderId: string): void {
    shell.openExternal(`https://drive.google.com/drive/folders/${folderId}`)
  }

  /** Creates or retrieves a subfolder by name inside a given parent folder. Returns the folder ID. */
  async createSubfolder(name: string, parentFolderId: string): Promise<string> {
    if (!this.isAuthenticated()) throw new Error('No autenticado con Google Drive')
    const oauth2Client = this.getOAuth2Client()
    oauth2Client.setCredentials(store.get('tokens') as object)
    const drive = google.drive({ version: 'v3', auth: oauth2Client })
    return this.getOrCreateFolder(drive, name, parentFolderId)
  }

  /**
   * Uploads a local file to a given Drive folder and returns the file ID.
   */
  async uploadFileToFolder(
    localPath: string,
    folderId: string,
    fileName: string,
    mimeType: string
  ): Promise<string> {
    if (!this.isAuthenticated()) throw new Error('No autenticado con Google Drive')
    const oauth2Client = this.getOAuth2Client()
    oauth2Client.setCredentials(store.get('tokens') as object)
    const drive = google.drive({ version: 'v3', auth: oauth2Client })
    const res = await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media: { mimeType, body: fs.createReadStream(localPath) },
      fields: 'id'
    })
    return res.data.id!
  }

  async getOrCreateKnowledgeFolder(): Promise<string> {
    const cached = store.get('knowledgeFolderId', '') as string
    if (cached) return cached
    if (!this.isAuthenticated()) throw new Error('No autenticado con Google Drive')
    const oauth2Client = this.getOAuth2Client()
    oauth2Client.setCredentials(store.get('tokens') as object)
    const drive = google.drive({ version: 'v3', auth: oauth2Client })
    const folderId = await this.getOrCreateFolder(drive, 'Summit Knowledge')
    store.set('knowledgeFolderId', folderId)
    return folderId
  }

  /**
   * Returns the innermost Drive folder for an entry:
   * Summit Knowledge / "Junio 2026" / "Entry Title"
   */
  async getOrCreateKnowledgeEntryFolder(entryDate: number, entryTitle: string): Promise<string> {
    if (!this.isAuthenticated()) throw new Error('No autenticado con Google Drive')
    const oauth2Client = this.getOAuth2Client()
    oauth2Client.setCredentials(store.get('tokens') as object)
    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    const rootId = await this.getOrCreateKnowledgeFolder()

    const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    const d = new Date(entryDate)
    const monthYear = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
    const monthId = await this.getOrCreateFolder(drive, monthYear, rootId)

    const safeName = (entryTitle || 'Sin título').slice(0, 80).replace(/[/\\:*?"<>|]/g, '-').trim() || 'Entrada'
    return this.getOrCreateFolder(drive, safeName, monthId)
  }

  async getOrCreateQuoteFolder(quoteTitle: string): Promise<string> {
    if (!this.isAuthenticated()) throw new Error('No autenticado con Google Drive')
    const oauth2Client = this.getOAuth2Client()
    oauth2Client.setCredentials(store.get('tokens') as object)
    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    const cached = store.get('quoteFolderId', '') as string
    let rootId = cached
    if (!rootId) {
      rootId = await this.getOrCreateFolder(drive, 'Summit Presupuestos')
      store.set('quoteFolderId', rootId)
    }

    const safeName = (quoteTitle || 'Sin título').slice(0, 80).replace(/[/\\:*?"<>|]/g, '-').trim() || 'Presupuesto'
    return this.getOrCreateFolder(drive, safeName, rootId)
  }

  /**
   * Summit RRHH / Sueldos{ EV} / MM-YYYY
   * e.g. empresa='naka', mes=5, anio=2026 → "Summit RRHH/Sueldos/05-2026"
   *      empresa='ev'                     → "Summit RRHH/Sueldos EV/05-2026"
   */
  async getOrCreateRrhhSueldosMesFolder(empresa: RrhhEmpresa, mes: number, anio: number): Promise<string> {
    if (!this.isAuthenticated()) throw new Error('No autenticado con Google Drive')
    const oauth2Client = this.getOAuth2Client()
    oauth2Client.setCredentials(store.get('tokens') as object)
    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    const rrhhRoot = await this.getRrhhRootFolder(drive)
    const sueldosId = await this.getOrCreateFolder(drive, `Sueldos${DRIVE_EMPRESA_SUFFIX[empresa]}`, rrhhRoot)
    const folderName = `${String(mes).padStart(2, '0')}-${anio}`
    return this.getOrCreateFolder(drive, folderName, sueldosId)
  }

  private async getRrhhRootFolder(drive: ReturnType<typeof google.drive>): Promise<string> {
    const cached = store.get('rrhhRootFolderId', '') as string
    if (cached) return cached
    const id = await this.getOrCreateFolder(drive, 'Summit RRHH')
    store.set('rrhhRootFolderId', id)
    return id
  }

  async getOrCreateLegajosFolder(empresa: RrhhEmpresa): Promise<string> {
    if (!this.isAuthenticated()) throw new Error('No autenticado con Google Drive')
    const oauth2Client = this.getOAuth2Client()
    oauth2Client.setCredentials(store.get('tokens') as object)
    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    // Cache key legacy para NAKA; sufijo por empresa para el resto
    const cacheKey = empresa === 'naka' ? 'rrhhLegajosFolderId' : `rrhhLegajosFolderId_${empresa}`
    const cached = store.get(cacheKey, '') as string
    if (cached) return cached

    const rrhhRoot = await this.getRrhhRootFolder(drive)
    const id = await this.getOrCreateFolder(drive, `Legajos${DRIVE_EMPRESA_SUFFIX[empresa]}`, rrhhRoot)
    store.set(cacheKey, id)
    return id
  }

  /**
   * Summit RRHH / Legajos{ EV} / "0001 Juan Pérez" (legajo + nombre)
   * Crea subfolders default si es nuevo: Documentos, Contratos, Recibos.
   */
  async getOrCreateColaboradorLegajoFolder(empresa: RrhhEmpresa, legajo: string, nombre: string): Promise<string> {
    if (!this.isAuthenticated()) throw new Error('No autenticado con Google Drive')
    const oauth2Client = this.getOAuth2Client()
    oauth2Client.setCredentials(store.get('tokens') as object)
    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    const legajosRoot = await this.getOrCreateLegajosFolder(empresa)
    const safeName = `${legajo} ${nombre}`.replace(/[/:*?"<>|]/g, '-').slice(0, 100).trim()
    const folderId = await this.getOrCreateFolder(drive, safeName, legajosRoot)

    // Crear subcarpetas default (silencioso — no falla si ya existen)
    await Promise.all([
      this.getOrCreateFolder(drive, 'Documentos personales', folderId).catch(() => null),
      this.getOrCreateFolder(drive, 'Contratos', folderId).catch(() => null),
      this.getOrCreateFolder(drive, 'Recibos', folderId).catch(() => null),
    ])

    return folderId
  }

  // ── Backup completo de la base de datos ──────────────────────────────────

  getLastBackupStatus(): BackupStatus | null {
    return store.get<BackupStatus | null>('lastFullBackup', null)
  }

  /**
   * Crea un backup completo de la base de datos SQLite en Drive.
   * Usa la API nativa de backup de SQLite (safe con WAL mode).
   * Guarda en: Summit Backups / YYYY-MM-DD_HH-mm / flowtask.db + manifest.json
   * Mantiene los últimos 7 backups.
   */
  async fullBackup(): Promise<BackupStatus> {
    if (!this.isAuthenticated()) throw new Error('No autenticado con Google Drive')

    const timestamp   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)  // "2026-05-31_09-00"
    const displayTs   = new Date().toISOString()
    const tmpDir      = os.tmpdir()
    const tmpDbPath   = path.join(tmpDir, `summit-backup-${timestamp}.db`)

    try {
      // 1. Backup seguro de la DB usando la API nativa de better-sqlite3
      const db = getDb()
      await db.backup(tmpDbPath)

      // 2. Conectar a Drive
      const oauth2Client = this.getOAuth2Client()
      oauth2Client.setCredentials(store.get('tokens') as object)
      const drive = google.drive({ version: 'v3', auth: oauth2Client })

      // 3. Carpeta raíz de backups
      const rootId = await this.getOrCreateFolder(drive, 'FlowTask Backups')

      // 4. Subcarpeta con timestamp
      const created = await drive.files.create({
        requestBody: {
          name:     timestamp,
          mimeType: 'application/vnd.google-apps.folder',
          parents:  [rootId]
        },
        fields: 'id'
      })
      const subFolderId = created.data.id!

      // 5. Subir la base de datos
      const stats = fs.statSync(tmpDbPath)
      await drive.files.create({
        requestBody: { name: 'flowtask.db', parents: [subFolderId] },
        media: {
          mimeType: 'application/octet-stream',
          body:     fs.createReadStream(tmpDbPath)
        }
      })

      // 6. Subir manifest
      const manifest = {
        timestamp:      displayTs,
        appVersion:     app.getVersion(),
        dbSizeBytes:    stats.size,
        dbSizeMB:       (stats.size / 1_048_576).toFixed(2),
        attachmentsDir: getAttachmentsDir()
      }
      await drive.files.create({
        requestBody: { name: 'manifest.json', parents: [subFolderId] },
        media: {
          mimeType: 'application/json',
          body:     JSON.stringify(manifest, null, 2)
        }
      })

      // 7. Limpiar backups viejos — mantener últimos 7
      const allFolders = await drive.files.list({
        q:      `'${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        orderBy:'createdTime desc',
        fields: 'files(id,name)'
      })
      const toDelete = (allFolders.data.files ?? []).slice(7)
      for (const f of toDelete) {
        if (f.id) await drive.files.delete({ fileId: f.id }).catch(() => {})
      }

      // 8. Guardar estado
      const status: BackupStatus = { timestamp: displayTs, success: true, driveFolder: timestamp }
      store.set('lastFullBackup', status)
      console.log(`[Backup] ✓ Base de datos respaldada en Drive: ${timestamp}`)
      return status

    } finally {
      // Eliminar archivo temporal
      try { if (fs.existsSync(tmpDbPath)) fs.unlinkSync(tmpDbPath) } catch {}
    }
  }

  /** Renombra un archivo/carpeta en Drive (best-effort). */
  async renameFile(fileId: string, newName: string): Promise<void> {
    if (!this.isAuthenticated()) return
    try {
      const oauth2Client = this.getOAuth2Client()
      oauth2Client.setCredentials(store.get('tokens') as object)
      const drive = google.drive({ version: 'v3', auth: oauth2Client })
      await drive.files.update({ fileId, requestBody: { name: newName } })
    } catch (err) {
      console.error('[Drive] Error al renombrar carpeta:', (err as Error).message)
    }
  }

  /** Deletes a file from Drive (best-effort, swallows errors). */
  async deleteFile(fileId: string): Promise<void> {
    if (!this.isAuthenticated()) return
    try {
      const oauth2Client = this.getOAuth2Client()
      oauth2Client.setCredentials(store.get('tokens') as object)
      const drive = google.drive({ version: 'v3', auth: oauth2Client })
      await drive.files.delete({ fileId })
    } catch { /* ignore */ }
  }

  private async getOrCreateFolder(drive: ReturnType<typeof google.drive>, name: string, parentId?: string): Promise<string> {
    const safeName = name.replace(/'/g, "\\'")
    const parentClause = parentId ? ` and '${parentId}' in parents` : ''
    const res = await drive.files.list({
      q: `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentClause}`,
      fields: 'files(id)'
    })
    if (res.data.files?.length) return res.data.files[0].id!

    const folder = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId ? { parents: [parentId] } : {})
      },
      fields: 'id'
    })
    return folder.data.id!
  }
}

export const driveService = new DriveService()
