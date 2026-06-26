import { app, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import ConfigStore from './config-store'
import { getPowerSyncDb } from '../database/powersync'
import { getDb } from '../database/db'

export interface WallpaperConfig {
  enabled: boolean
  mode: 'rotating' | 'fixed'
  interval_seconds: number
  fixed_image_id: string | null
  active_image_ids: string[]
  screensaver_enabled: boolean
  screensaver_timeout_minutes: number
}

export interface WallpaperImage {
  id: string
  filename: string
  dataUrl: string
}

export interface WallpaperStats {
  tasksDueToday: number
  upcomingAlerts: number
}

const DEFAULT_CONFIG: WallpaperConfig = {
  enabled: true,
  mode: 'rotating',
  interval_seconds: 30,
  fixed_image_id: null,
  active_image_ids: [],
  screensaver_enabled: false,
  screensaver_timeout_minutes: 5,
}

const store = new ConfigStore('wallpaper-config')
const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'

function getUserWallpapersDir(): string {
  const dir = path.join(app.getPath('userData'), 'wallpapers')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function getWallpaperConfig(): WallpaperConfig {
  return {
    enabled:                    store.get<boolean>('enabled', DEFAULT_CONFIG.enabled),
    mode:                       store.get<'rotating' | 'fixed'>('mode', DEFAULT_CONFIG.mode),
    interval_seconds:           store.get<number>('interval_seconds', DEFAULT_CONFIG.interval_seconds),
    fixed_image_id:             store.get<string | null>('fixed_image_id', DEFAULT_CONFIG.fixed_image_id),
    active_image_ids:           store.get<string[]>('active_image_ids', DEFAULT_CONFIG.active_image_ids),
    screensaver_enabled:        store.get<boolean>('screensaver_enabled', DEFAULT_CONFIG.screensaver_enabled),
    screensaver_timeout_minutes:store.get<number>('screensaver_timeout_minutes', DEFAULT_CONFIG.screensaver_timeout_minutes),
  }
}

export function setWallpaperConfig(patch: Partial<WallpaperConfig>): WallpaperConfig {
  if (patch.enabled                     !== undefined) store.set('enabled', patch.enabled)
  if (patch.mode                        !== undefined) store.set('mode', patch.mode)
  if (patch.interval_seconds            !== undefined) store.set('interval_seconds', patch.interval_seconds)
  if (patch.fixed_image_id              !== undefined) store.set('fixed_image_id', patch.fixed_image_id)
  if (patch.active_image_ids            !== undefined) store.set('active_image_ids', patch.active_image_ids)
  if (patch.screensaver_enabled         !== undefined) store.set('screensaver_enabled', patch.screensaver_enabled)
  if (patch.screensaver_timeout_minutes !== undefined) store.set('screensaver_timeout_minutes', patch.screensaver_timeout_minutes)
  return getWallpaperConfig()
}

function fileToDataUrl(filepath: string, ext: string): string {
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
  const data = fs.readFileSync(filepath)
  return `data:${mime};base64,${data.toString('base64')}`
}

export function listUserImages(): WallpaperImage[] {
  const dir = getUserWallpapersDir()
  const EXTS = ['.jpg', '.jpeg', '.png', '.webp']
  try {
    return fs.readdirSync(dir)
      .filter(f => EXTS.includes(path.extname(f).toLowerCase()))
      .map(filename => {
        const ext = path.extname(filename).toLowerCase()
        const id = path.basename(filename, ext)
        const dataUrl = fileToDataUrl(path.join(dir, filename), ext)
        return { id, filename, dataUrl }
      })
  } catch {
    return []
  }
}

export async function addUserImage(): Promise<WallpaperImage | null> {
  const result = await dialog.showOpenDialog({
    title: 'Seleccionar imagen de fondo',
    filters: [{ name: 'Imágenes', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    properties: ['openFile'],
  })
  if (result.canceled || !result.filePaths[0]) return null

  const srcPath = result.filePaths[0]
  const ext = path.extname(srcPath).toLowerCase()
  const id = randomUUID()
  const filename = `${id}${ext}`
  const destPath = path.join(getUserWallpapersDir(), filename)
  fs.copyFileSync(srcPath, destPath)
  return { id, filename, dataUrl: fileToDataUrl(destPath, ext) }
}

export function deleteUserImage(id: string): void {
  const dir = getUserWallpapersDir()
  for (const ext of ['.jpg', '.jpeg', '.png', '.webp']) {
    const fp = path.join(dir, `${id}${ext}`)
    if (fs.existsSync(fp)) { fs.unlinkSync(fp); return }
  }
}

export async function getWallpaperStats(): Promise<WallpaperStats> {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999)
  const weekAhead  = Date.now() + 7 * 24 * 60 * 60 * 1000

  let tasksDueToday = 0
  let upcomingAlerts = 0

  try {
    const psDb = getPowerSyncDb()
    const [row] = await psDb.getAll<{ count: number }>(
      `SELECT COUNT(*) as count FROM tasks
       WHERE workspace_id = ? AND status NOT IN ('done','cancelled')
       AND due_date IS NOT NULL AND due_date >= ? AND due_date <= ?`,
      [WORKSPACE_ID, todayStart.getTime(), todayEnd.getTime()]
    )
    tasksDueToday = row?.count ?? 0
  } catch { /* PowerSync puede no estar conectado todavía */ }

  try {
    const db = getDb()
    const [row] = db.prepare(
      `SELECT COUNT(*) as count FROM expiry_items
       WHERE status = 'active' AND next_expiry_date IS NOT NULL AND next_expiry_date <= ?`
    ).all(weekAhead) as [{ count: number }]
    upcomingAlerts = row?.count ?? 0
  } catch { /* columna puede diferir entre versiones */ }

  return { tasksDueToday, upcomingAlerts }
}
