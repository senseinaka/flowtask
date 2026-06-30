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

/**
 * Resuelve de forma segura un `stored_name` de adjunto contra getAttachmentsDir(),
 * neutralizando path traversal. El nombre de archivo suele venir sincronizado desde
 * Supabase vía PowerSync (campos *_stored_name) y por tanto es controlable por
 * cualquier usuario con permiso de escritura → NO confiable. Forzamos path.basename
 * (descarta directorios, `..`, rutas absolutas y unidades como C:\) y verificamos
 * contención dentro del sandbox de adjuntos. Usar SIEMPRE esto antes de fs.* /
 * shell.openPath sobre un *_stored_name, en lugar de path.join(getAttachmentsDir(), x).
 */
export function resolveAttachmentPath(storedName: unknown): string {
  if (!storedName || typeof storedName !== 'string') throw new Error('stored_name inválido')
  const base = getAttachmentsDir()
  const safe = path.basename(storedName)
  if (!safe || safe === '.' || safe === '..') throw new Error('stored_name inválido')
  const full = path.resolve(base, safe)
  const rel = path.relative(base, full)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('ruta fuera del sandbox de adjuntos')
  }
  return full
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
