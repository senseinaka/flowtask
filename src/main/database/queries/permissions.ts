import { randomUUID } from 'crypto'
import { getDb } from '../db'
import type { UserPermission, UserProfile } from '@shared/types'
import type { PermissionLevel } from '@shared/modules'

const WORKSPACE_ID = 'd61a4071-1557-4f32-be5e-6443fb336bf5'

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

export function upsertUserProfile(profile: {
  id: string
  email: string
  display_name: string
}): void {
  const now = Date.now()
  getDb().prepare(`
    INSERT INTO user_profiles (id, workspace_id, email, display_name, last_seen_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      display_name = excluded.display_name,
      last_seen_at = excluded.last_seen_at
  `).run(profile.id, WORKSPACE_ID, profile.email, profile.display_name, now)
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
