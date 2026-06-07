// ═══════════════════════════════════════════════════════════════════════════
// Backup local — red de seguridad independiente de Google Drive
// ═══════════════════════════════════════════════════════════════════════════
//
// El backup a Drive (`drive.service.fullBackup`) sólo corre si la cuenta está
// autenticada — y en la práctica eso puede no estar conectado por meses sin
// que nadie lo note (pasó: se perdieron datos de "Vencimientos" sin ninguna
// copia de la que recuperarlos). Este servicio copia la base de datos completa
// + adjuntos a una carpeta del disco local en cada corrida, sin depender de
// ninguna cuenta ni conexión a internet.
//
// Si el usuario apunta la carpeta a algo sincronizado (OneDrive, Google Drive
// File Stream, Dropbox), el respaldo además queda replicado en la nube sin
// ningún trabajo extra de nuestro lado — por eso el destino es configurable.
//
// Usa la misma API nativa de backup de SQLite que el backup a Drive
// (`db.backup()`), que es segura de tomar mientras la app sigue escribiendo
// (journal_mode = WAL).

import { app, dialog, shell, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import ConfigStore from './config-store'
import { getDb, getAttachmentsDir } from '../database/db'
import type { LocalBackupStatus } from '@shared/types'

const store = new ConfigStore('local-backup-config')

/** Cuántas copias completas conservar antes de borrar las más viejas. */
const KEEP_LAST = 10

function defaultBackupDir(): string {
  return path.join(app.getPath('documents'), 'FlowTask Backups')
}

/** Tamaño total de una carpeta (recursivo), en MB con 2 decimales. Best-effort. */
function dirSizeMB(dir: string): string {
  let total = 0
  const walk = (d: string): void => {
    let entries: fs.Dirent[] = []
    try { entries = fs.readdirSync(d, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) walk(full)
      else { try { total += fs.statSync(full).size } catch { /* ignore */ } }
    }
  }
  walk(dir)
  return (total / 1_048_576).toFixed(2)
}

class LocalBackupService {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private isRunning  = false

  // ── Configuración del destino ───────────────────────────────────────────

  /** Carpeta donde se guardan los backups. Si no se configuró ninguna, usa Documentos/FlowTask Backups. */
  getBackupDir(): string {
    return (store.get<string>('backupDir', '') as string) || defaultBackupDir()
  }

  setBackupDir(dir: string): void {
    store.set('backupDir', dir)
  }

  /** Abre un selector de carpetas nativo para elegir dónde guardar los backups. */
  async chooseBackupDir(win: BrowserWindow): Promise<string | null> {
    const result = await dialog.showOpenDialog(win, {
      title: 'Elegí dónde guardar los backups locales de FlowTask',
      defaultPath: this.getBackupDir(),
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return null
    this.setBackupDir(result.filePaths[0])
    return result.filePaths[0]
  }

  /** Abre la carpeta de backups en el explorador de archivos. */
  openBackupDir(): void {
    const dir = this.getBackupDir()
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      shell.openPath(dir)
    } catch { /* ignore */ }
  }

  // ── Estado ───────────────────────────────────────────────────────────────

  getLastBackupStatus(): LocalBackupStatus | null {
    return store.get<LocalBackupStatus | null>('lastBackup', null)
  }

  isBackupRunning(): boolean {
    return this.isRunning
  }

  // ── Backup ───────────────────────────────────────────────────────────────

  /**
   * Crea una copia completa: base de datos (vía API nativa de backup de
   * SQLite, segura con WAL) + carpeta de adjuntos + manifest.json, dentro de
   * una subcarpeta con fecha y hora. Mantiene las últimas `KEEP_LAST` copias.
   */
  async runBackup(): Promise<LocalBackupStatus> {
    if (this.isRunning) {
      return { timestamp: new Date().toISOString(), success: false, error: 'Ya hay un backup local en curso' }
    }
    this.isRunning = true

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)  // "2026-06-07_10-30"
    const displayTs = new Date().toISOString()
    const rootDir   = this.getBackupDir()
    const destDir   = path.join(rootDir, timestamp)

    try {
      fs.mkdirSync(destDir, { recursive: true })

      // 1. Copia consistente de la base de datos (segura aunque haya escrituras
      //    concurrentes gracias al journal WAL — es la misma API que usa el
      //    backup a Drive).
      const db = getDb()
      const dbDest = path.join(destDir, 'flowtask.db')
      await db.backup(dbDest)

      // 2. Adjuntos completos (facturas, PDFs, logos, etc.) — best-effort: si
      //    algo falla acá no debe arruinar el backup de la base de datos, que
      //    es lo más importante.
      try {
        const attachmentsDir = getAttachmentsDir()
        if (fs.existsSync(attachmentsDir)) {
          fs.cpSync(attachmentsDir, path.join(destDir, 'attachments'), { recursive: true })
        }
      } catch (err) {
        console.warn('[BackupLocal] No se pudieron copiar los adjuntos:', (err as Error).message)
      }

      // 3. Manifest con metadata para identificar la copia al restaurar
      const dbStats = fs.statSync(dbDest)
      const totalSizeMB = dirSizeMB(destDir)
      const manifest = {
        timestamp:   displayTs,
        appVersion:  app.getVersion(),
        dbSizeMB:    (dbStats.size / 1_048_576).toFixed(2),
        totalSizeMB
      }
      fs.writeFileSync(path.join(destDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8')

      // 4. Rotación — borrar las copias más viejas, conservar las últimas KEEP_LAST
      this.cleanupOldBackups(rootDir)

      const status: LocalBackupStatus = {
        timestamp: displayTs, success: true, folder: destDir, sizeMB: totalSizeMB
      }
      store.set('lastBackup', status)
      console.log(`[BackupLocal] ✓ Copia local creada en ${destDir} (${totalSizeMB} MB)`)
      return status

    } catch (err) {
      const error = err instanceof Error ? err.message : 'Error desconocido'
      const status: LocalBackupStatus = { timestamp: displayTs, success: false, error }
      store.set('lastBackup', status)
      console.error('[BackupLocal] Error al crear la copia local:', error)
      // Limpiar la carpeta a medio escribir para no dejar basura
      try { fs.rmSync(destDir, { recursive: true, force: true }) } catch { /* ignore */ }
      return status
    } finally {
      this.isRunning = false
    }
  }

  /** Conserva sólo las `KEEP_LAST` subcarpetas de backup más recientes (por nombre, que es timestamp ISO). */
  private cleanupOldBackups(rootDir: string): void {
    try {
      const entries = fs.readdirSync(rootDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && /^\d{4}-\d{2}-\d{2}/.test(e.name))
        .map(e => e.name)
        .sort()
        .reverse()
      for (const name of entries.slice(KEEP_LAST)) {
        fs.rmSync(path.join(rootDir, name), { recursive: true, force: true })
      }
    } catch (err) {
      console.warn('[BackupLocal] No se pudo limpiar copias viejas:', (err as Error).message)
    }
  }

  // ── Programación automática ──────────────────────────────────────────────
  //
  // Corre con la misma cadencia que el backup a Drive (cada 6 horas) — pero a
  // diferencia de aquel, NO depende de ninguna autenticación: siempre corre.

  start(push: (channel: string, data: unknown) => void): void {
    const INTERVAL_MS = 6 * 60 * 60 * 1000  // 6 horas

    this.intervalId = setInterval(() => {
      this.runBackup().then(status => push('backup:local:complete', status))
    }, INTERVAL_MS)

    // Primer backup local a los 2 minutos de arrancar (deja que la app termine
    // de cargar y de correr sus migraciones antes de tocar el archivo de la DB).
    setTimeout(() => {
      this.runBackup().then(status => push('backup:local:complete', status))
    }, 2 * 60 * 1000)
  }

  stop(): void {
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null }
  }
}

export const localBackupService = new LocalBackupService()
