import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db

  const userDataPath = app.getPath('userData')
  const dbDir = path.join(userDataPath, 'flowtask')
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

  const dbPath = path.join(dbDir, 'flowtask.db')
  _db = new Database(dbPath)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')

  return _db
}

export function getAttachmentsDir(): string {
  const userDataPath = app.getPath('userData')
  const dir = path.join(userDataPath, 'flowtask', 'attachments')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

/** Ruta absoluta del archivo .db en uso (sin abrirlo). Útil para restaurar backups. */
export function getDbPath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'flowtask', 'flowtask.db')
}

/**
 * Cierra la conexión activa a la base de datos y libera el handle del archivo.
 * Necesario antes de reemplazar el .db por una copia restaurada — getDb() vuelve
 * a abrirla (y a crear una nueva conexión) la próxima vez que se llame.
 */
export function closeDb(): void {
  if (_db) {
    try { _db.close() } catch { /* ignore */ }
    _db = null
  }
}
