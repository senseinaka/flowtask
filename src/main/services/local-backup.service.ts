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
import { getDb, getAttachmentsDir, getDbPath, closeDb } from '../database/db'
import type { LocalBackupStatus, LocalBackupEntry, RestoreResult } from '@shared/types'

const store = new ConfigStore('local-backup-config')

/** Cuántas copias completas conservar antes de borrar las más viejas. */
const KEEP_LAST = 10

/** Cada cuántas horas correr el backup automático si el usuario no eligió otra cosa. */
const DEFAULT_INTERVAL_HOURS = 24

/** Intervalos permitidos desde la UI (en horas). 0 = solo manual (sin programación automática). */
export const BACKUP_INTERVAL_OPTIONS = [0, 6, 12, 24] as const

/**
 * Carpeta-espejo de adjuntos, COMPARTIDA por todas las copias (vive en la raíz
 * del directorio de backups, no dentro de cada subcarpeta con fecha). En cada
 * corrida sólo se copian los archivos nuevos que todavía no están ahí — nunca
 * se borra nada de esta carpeta, así que funciona como un archivo histórico
 * que sólo crece. Esto evita duplicar ~90 MB de adjuntos en cada una de las
 * `KEEP_LAST` copias (un desperdicio, dado que una factura ya subida no cambia).
 */
const ATTACHMENTS_MIRROR_DIR = 'attachments'

/** Prefijo de las carpetas de seguridad creadas automáticamente antes de restaurar. */
const PRE_RESTORE_PREFIX = '_antes-de-restaurar_'

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
  private pushFn: ((channel: string, data: unknown) => void) | null = null

  // ── Configuración del destino ───────────────────────────────────────────

  /** Carpeta donde se guardan los backups. Si no se configuró ninguna, usa Documentos/FlowTask Backups. */
  getBackupDir(): string {
    return (store.get<string>('backupDir', '') as string) || defaultBackupDir()
  }

  setBackupDir(dir: string): void {
    store.set('backupDir', dir)
  }

  // ── Configuración de la frecuencia ──────────────────────────────────────

  /** Cada cuántas horas correr el backup automático. 0 significa "solo manual". */
  getIntervalHours(): number {
    return store.get<number>('intervalHours', DEFAULT_INTERVAL_HOURS) as number
  }

  /**
   * Cambia la frecuencia del backup automático y reprograma el temporizador en
   * caliente (sin reiniciar la app) si el servicio ya estaba corriendo.
   */
  setIntervalHours(hours: number): void {
    store.set('intervalHours', hours)
    if (this.pushFn) {
      this.stop()
      this.start(this.pushFn)
    }
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

      // 2. Adjuntos (facturas, PDFs, logos, etc.) — en vez de duplicar ~90 MB en
      //    cada una de las KEEP_LAST copias, se sincronizan de forma incremental
      //    contra una carpeta-espejo COMPARTIDA en la raíz: sólo se copian los
      //    archivos nuevos que todavía no están ahí (un adjunto ya subido no
      //    cambia, así que comparar nombre+tamaño alcanza). Nunca se borra nada
      //    del espejo — funciona como un archivo histórico que sólo crece, así
      //    que un adjunto borrado más tarde sigue recuperable. Best-effort: si
      //    algo falla acá no debe arruinar el backup de la base de datos.
      let attachmentsCopied = 0
      try {
        const attachmentsDir = getAttachmentsDir()
        const mirrorDir = path.join(rootDir, ATTACHMENTS_MIRROR_DIR)
        if (fs.existsSync(attachmentsDir)) {
          attachmentsCopied = this.syncAttachmentsMirror(attachmentsDir, mirrorDir)
        }
      } catch (err) {
        console.warn('[BackupLocal] No se pudieron sincronizar los adjuntos:', (err as Error).message)
      }

      // 3. Manifest con metadata para identificar la copia al restaurar.
      //    NOTA: los adjuntos NO viven dentro de esta carpeta — están en el
      //    espejo compartido `<rootDir>/attachments/` (ver `attachmentsMirror`).
      const dbStats = fs.statSync(dbDest)
      const totalSizeMB = dirSizeMB(destDir)
      const manifest = {
        timestamp:        displayTs,
        appVersion:       app.getVersion(),
        dbSizeMB:         (dbStats.size / 1_048_576).toFixed(2),
        totalSizeMB,
        attachmentsMirror: ATTACHMENTS_MIRROR_DIR,
        attachmentsCopiadosEnEstaCorrida: attachmentsCopied
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

  /**
   * Copia a `mirrorDir` sólo los archivos de `sourceDir` que todavía no están
   * ahí (comparando nombre + tamaño — un adjunto subido no se vuelve a editar,
   * así que esto alcanza para detectar "es nuevo"). Devuelve cuántos se
   * copiaron en esta corrida. Nunca borra nada del espejo: si un adjunto se
   * elimina del sistema en vivo, sigue existiendo acá para poder recuperarlo.
   */
  private syncAttachmentsMirror(sourceDir: string, mirrorDir: string): number {
    fs.mkdirSync(mirrorDir, { recursive: true })
    let copied = 0
    const entries = fs.readdirSync(sourceDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile()) continue
      const src = path.join(sourceDir, entry.name)
      const dst = path.join(mirrorDir, entry.name)
      try {
        const srcSize = fs.statSync(src).size
        const alreadyThere = fs.existsSync(dst) && fs.statSync(dst).size === srcSize
        if (!alreadyThere) {
          fs.copyFileSync(src, dst)
          copied++
        }
      } catch (err) {
        console.warn(`[BackupLocal] No se pudo copiar el adjunto "${entry.name}":`, (err as Error).message)
      }
    }
    return copied
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
  // La cadencia es configurable desde Configuración (`getIntervalHours`/
  // `setIntervalHours`, por defecto 1 vez al día). A diferencia del backup a
  // Drive, este NO depende de ninguna autenticación: siempre corre, salvo que
  // el usuario elija explícitamente "solo manual" (0 horas).

  start(push: (channel: string, data: unknown) => void): void {
    this.pushFn = push
    const hours = this.getIntervalHours()

    if (hours > 0) {
      const INTERVAL_MS = hours * 60 * 60 * 1000
      this.intervalId = setInterval(() => {
        this.runBackup().then(status => push('backup:local:complete', status))
      }, INTERVAL_MS)
    }

    // Primer backup local a los 2 minutos de arrancar (deja que la app termine
    // de cargar y de correr sus migraciones antes de tocar el archivo de la DB)
    // — corre siempre, incluso en modo "solo manual", para asegurar que al
    // menos exista una copia reciente sin que el usuario tenga que acordarse.
    setTimeout(() => {
      this.runBackup().then(status => push('backup:local:complete', status))
    }, 2 * 60 * 1000)
  }

  stop(): void {
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null }
  }

  // ── Restaurar una copia anterior ─────────────────────────────────────────

  /** Lista las copias disponibles (carpetas con fecha), más recientes primero, leyendo su manifest.json. */
  async listBackups(): Promise<LocalBackupEntry[]> {
    const rootDir = this.getBackupDir()
    let names: string[] = []
    try {
      names = fs.readdirSync(rootDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && /^\d{4}-\d{2}-\d{2}/.test(e.name))
        .map(e => e.name)
        .sort()
        .reverse()
    } catch {
      return []
    }

    return names.map((name) => {
      const full = path.join(rootDir, name)
      let timestamp = name
      let dbSizeMB: string | undefined
      let totalSizeMB: string | undefined
      try {
        const manifest = JSON.parse(fs.readFileSync(path.join(full, 'manifest.json'), 'utf-8'))
        timestamp   = manifest.timestamp   ?? timestamp
        dbSizeMB    = manifest.dbSizeMB
        totalSizeMB = manifest.totalSizeMB
      } catch { /* manifest faltante o corrupto — igual mostramos la carpeta */ }
      return { folder: name, path: full, timestamp, dbSizeMB, totalSizeMB }
    })
  }

  /**
   * Restaura una copia anterior reemplazando la base de datos en uso.
   *
   * Pasos (en este orden, para que un fallo a mitad de camino nunca deje el
   * sistema peor de lo que estaba):
   *   1. Validar que la copia elegida existe y tiene un flowtask.db válido.
   *   2. Crear una copia de seguridad del estado ACTUAL antes de tocar nada
   *      (carpeta `_antes-de-restaurar_<fecha>` — así esto siempre se puede
   *      deshacer, incluso si el usuario se arrepiente después).
   *   3. Cerrar la conexión a la base para soltar el archivo.
   *   4. Reemplazar flowtask.db por el de la copia (y limpiar -wal/-shm viejos
   *      para que SQLite no intente "continuar" un journal que no corresponde).
   *   5. Traer del espejo de adjuntos cualquier archivo que la copia restaurada
   *      pueda referenciar y ya no exista en vivo (sólo agrega, nunca borra).
   *   6. Reiniciar la app — getDb() abre la base restaurada de cero al volver.
   */
  async restoreBackup(folderName: string): Promise<RestoreResult> {
    if (this.isRunning) {
      return { success: false, error: 'Hay un backup en curso — esperá a que termine antes de restaurar' }
    }

    const rootDir = this.getBackupDir()
    const srcDir  = path.join(rootDir, folderName)
    const srcDb   = path.join(srcDir, 'flowtask.db')

    if (!fs.existsSync(srcDb)) {
      return { success: false, error: `No se encontró flowtask.db dentro de "${folderName}"` }
    }

    const liveDbPath = getDbPath()
    const safetyTs   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)
    const safetyDir  = path.join(rootDir, `${PRE_RESTORE_PREFIX}${safetyTs}`)

    try {
      // 2. Copia de seguridad del estado actual — por si hace falta deshacer esto.
      fs.mkdirSync(safetyDir, { recursive: true })
      const db = getDb()
      await db.backup(path.join(safetyDir, 'flowtask.db'))
      fs.writeFileSync(
        path.join(safetyDir, 'manifest.json'),
        JSON.stringify({
          timestamp: new Date().toISOString(),
          motivo: `Copia automática del estado previo a restaurar "${folderName}"`,
          appVersion: app.getVersion()
        }, null, 2),
        'utf-8'
      )

      // 3. Cerrar la conexión activa para poder reemplazar el archivo.
      closeDb()

      // 4. Reemplazar la base de datos en uso por la de la copia elegida.
      fs.copyFileSync(srcDb, liveDbPath)
      for (const ext of ['-wal', '-shm']) {
        try { fs.rmSync(liveDbPath + ext, { force: true }) } catch { /* no existía, está bien */ }
      }

      // 5. Recuperar del espejo cualquier adjunto que la copia restaurada
      //    necesite y que ya no esté en la carpeta de adjuntos en vivo
      //    (best-effort — un adjunto faltante no debe impedir la restauración).
      try {
        const mirrorDir = path.join(rootDir, ATTACHMENTS_MIRROR_DIR)
        const attachmentsDir = getAttachmentsDir()
        if (fs.existsSync(mirrorDir)) {
          for (const entry of fs.readdirSync(mirrorDir, { withFileTypes: true })) {
            if (!entry.isFile()) continue
            const dst = path.join(attachmentsDir, entry.name)
            if (!fs.existsSync(dst)) {
              fs.copyFileSync(path.join(mirrorDir, entry.name), dst)
            }
          }
        }
      } catch (err) {
        console.warn('[BackupLocal] No se pudieron recuperar todos los adjuntos:', (err as Error).message)
      }

      console.log(`[BackupLocal] ✓ Restaurado "${folderName}" — reiniciando la app para aplicar los cambios`)

      // 6. Reiniciar — la próxima vez que algo llame a getDb() se abre la
      //    base restaurada de cero, sin arrastrar ningún estado en memoria.
      setTimeout(() => {
        app.relaunch()
        app.exit(0)
      }, 300)

      return { success: true, willRestart: true }

    } catch (err) {
      const error = err instanceof Error ? err.message : 'Error desconocido al restaurar'
      console.error('[BackupLocal] Error al restaurar:', error)
      return { success: false, error }
    }
  }
}

export const localBackupService = new LocalBackupService()
