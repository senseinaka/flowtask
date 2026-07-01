import { randomUUID } from 'crypto'
import { getDb } from '../db'
import { getPowerSyncDb } from '../powersync'
import type { UserPermission, UserProfile } from '@shared/types'
import type { PermissionLevel } from '@shared/modules'

const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'

/**
 * user_profiles vive en flowtask.db (fuente que consultan listUserProfiles/etc.,
 * de forma síncrona) Y en Supabase vía PowerSync (necesario para que
 * resolve_username_email — la función RPC de login por usuario, ver
 * supabase_username_login.sql — encuentre el username en un equipo que nunca
 * sincronizó nada). Sin este segundo write, un username asignado acá quedaba
 * solo local y el login por usuario nunca iba a funcionar en la práctica.
 * Falla en silencio si no hay conexión — el dato local ya quedó guardado, y el
 * próximo upsert (el auto-login siguiente, o una edición desde el admin) reintenta.
 */
async function syncUserProfileToSupabase(profile: {
  id: string
  email: string
  display_name: string
  username?: string | null
}, now: number): Promise<void> {
  try {
    const psDb = getPowerSyncDb()
    const existing = await psDb.getOptional<{ username: string | null }>(
      'SELECT username FROM user_profiles WHERE id = ?', [profile.id]
    )
    const username = profile.username !== undefined ? profile.username : (existing?.username ?? null)
    if (existing) {
      await psDb.execute(
        'UPDATE user_profiles SET email = ?, display_name = ?, username = ?, last_seen_at = ? WHERE id = ?',
        [profile.email, profile.display_name, username, now, profile.id]
      )
    } else {
      await psDb.execute(
        'INSERT INTO user_profiles (id, workspace_id, email, display_name, username, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)',
        [profile.id, WORKSPACE_ID, profile.email, profile.display_name, username, now]
      )
    }
  } catch {
    // Sin sesión/conexión todavía — el perfil ya quedó en flowtask.db.
  }
}

export function listUserPermissions(userId: string): UserPermission[] {
  return getDb()
    .prepare('SELECT * FROM user_permissions WHERE user_id = ?')
    .all(userId) as UserPermission[]
}

export function listAllPermissions(): UserPermission[] {
  return getDb()
    .prepare('SELECT * FROM user_permissions ORDER BY user_id, module_key, submodule_key')
    .all() as UserPermission[]
}

export function listUserProfiles(): UserProfile[] {
  return getDb()
    .prepare('SELECT * FROM user_profiles WHERE workspace_id = ? ORDER BY display_name, email')
    .all(WORKSPACE_ID) as UserProfile[]
}

/** Llamado en cada login. NO toca `username` si no se lo pasan (COALESCE preserva
 *  el que haya puesto el admin) — evita que el auto-upsert de sesión lo borre. */
export async function upsertUserProfile(profile: {
  id: string
  email: string
  display_name: string
  username?: string | null
}): Promise<void> {
  const now = Date.now()
  getDb().prepare(`
    INSERT INTO user_profiles (id, workspace_id, email, display_name, username, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      display_name = excluded.display_name,
      username = COALESCE(excluded.username, user_profiles.username),
      last_seen_at = excluded.last_seen_at
  `).run(profile.id, WORKSPACE_ID, profile.email, profile.display_name, profile.username ?? null, now)

  await syncUserProfileToSupabase(
    { id: profile.id, email: profile.email, display_name: profile.display_name, username: profile.username ?? undefined },
    now
  )
}

/** Admin: crea un perfil nuevo (last_seen_at = 0) o edita nombre/email/usuario sin tocar last_seen_at. */
export async function adminSaveUserProfile(profile: {
  id: string
  email: string
  display_name: string
  username?: string | null
}): Promise<void> {
  const username = profile.username?.trim() || null
  getDb().prepare(`
    INSERT INTO user_profiles (id, workspace_id, email, display_name, username, last_seen_at)
    VALUES (?, ?, ?, ?, ?, 0)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      display_name = excluded.display_name,
      username = excluded.username
  `).run(profile.id, WORKSPACE_ID, profile.email, profile.display_name, username)

  await syncUserProfileToSupabase(
    { id: profile.id, email: profile.email, display_name: profile.display_name, username },
    0
  )
}

export function deleteUserProfile(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM user_profiles WHERE id = ?').run(id)
  db.prepare('DELETE FROM user_permissions WHERE user_id = ?').run(id)
}

/** Crea o actualiza el permiso de un usuario sobre un módulo/submódulo. */
export function upsertPermission(input: {
  user_id: string
  module_key: string
  submodule_key?: string | null
  level: PermissionLevel
}): UserPermission {
  const db = getDb()
  const submoduleKey = input.submodule_key ?? null
  const now = Date.now()

  const existing = db
    .prepare(
      'SELECT * FROM user_permissions WHERE user_id = ? AND module_key = ? AND submodule_key IS ?'
    )
    .get(input.user_id, input.module_key, submoduleKey) as UserPermission | undefined

  if (existing) {
    db.prepare('UPDATE user_permissions SET level = ?, updated_at = ? WHERE id = ?')
      .run(input.level, now, existing.id)
    return { ...existing, level: input.level, updated_at: now }
  }

  const row: UserPermission = {
    id: randomUUID(),
    user_id: input.user_id,
    module_key: input.module_key,
    submodule_key: submoduleKey,
    level: input.level,
    created_at: now,
    updated_at: now,
    workspace_id: WORKSPACE_ID
  }

  db.prepare(`
    INSERT INTO user_permissions (id, user_id, module_key, submodule_key, level, created_at, updated_at, workspace_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(row.id, row.user_id, row.module_key, row.submodule_key, row.level, row.created_at, row.updated_at, row.workspace_id)

  return row
}
