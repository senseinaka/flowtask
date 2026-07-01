import { ipcMain } from 'electron'
import {
  listUserPermissions,
  listAllPermissions,
  upsertPermission,
  listUserProfiles,
  upsertUserProfile,
  adminSaveUserProfile,
  deleteUserProfile
} from '../database/queries/permissions'
import {
  listRoles, createRole, renameRole, deleteRole,
  listRolePermissions, upsertRolePermission, getMyRole, type MyRoleResult
} from '../database/queries/roles'
import { getSession } from '../services/auth.service'
import { invalidatePermissionsCache } from '../services/permissions.service'
import { ADMIN_USER_ID, type PermissionLevel } from '@shared/modules'
import type { UserPermission, UserProfile, Role, RolePermission } from '@shared/types'

async function requireAdmin(): Promise<void> {
  const session = await getSession()
  if (!session || session.userId !== ADMIN_USER_ID) {
    throw new Error('Sin permiso de administración')
  }
}

export function registerPermissionsIpc(): void {
  ipcMain.handle('permissions:listMine', async (): Promise<UserPermission[]> => {
    const session = await getSession()
    if (!session) return []
    return listUserPermissions(session.userId)
  })

  ipcMain.handle('permissions:listAll', async (): Promise<UserPermission[]> => {
    await requireAdmin()
    return listAllPermissions()
  })

  ipcMain.handle('permissions:profiles:list', async (): Promise<UserProfile[]> => {
    await requireAdmin()
    return listUserProfiles()
  })

  ipcMain.handle('permissions:profiles:upsert', async (
    _event,
    input: { id: string; email: string; display_name: string; username?: string | null; role_id?: string | null }
  ): Promise<void> => {
    await requireAdmin()
    await upsertUserProfile(input)
    invalidatePermissionsCache()
  })

  ipcMain.handle('permissions:profiles:save', async (
    _event,
    input: { id: string; email: string; display_name: string; username?: string | null; role_id?: string | null }
  ): Promise<void> => {
    await requireAdmin()
    await adminSaveUserProfile(input)
    invalidatePermissionsCache()
  })

  ipcMain.handle('permissions:profiles:delete', async (
    _event,
    id: string
  ): Promise<void> => {
    await requireAdmin()
    deleteUserProfile(id)
  })

  ipcMain.handle('permissions:setLevel', async (
    _event,
    input: { user_id: string; module_key: string; submodule_key?: string | null; level: PermissionLevel }
  ): Promise<UserPermission> => {
    await requireAdmin()
    const row = upsertPermission(input)
    invalidatePermissionsCache()
    return row
  })

  // ── Roles (admin) ────────────────────────────────────────────────────────

  ipcMain.handle('permissions:roles:list', async (): Promise<Role[]> => {
    await requireAdmin()
    return listRoles()
  })

  ipcMain.handle('permissions:roles:create', async (_event, name: string): Promise<Role> => {
    await requireAdmin()
    return createRole(name)
  })

  ipcMain.handle('permissions:roles:rename', async (_event, id: string, name: string): Promise<void> => {
    await requireAdmin()
    await renameRole(id, name)
  })

  ipcMain.handle('permissions:roles:delete', async (_event, id: string): Promise<void> => {
    await requireAdmin()
    await deleteRole(id)
    invalidatePermissionsCache()
  })

  ipcMain.handle('permissions:roles:permissions:list', async (_event, roleId: string): Promise<RolePermission[]> => {
    await requireAdmin()
    return listRolePermissions(roleId)
  })

  ipcMain.handle('permissions:roles:permissions:set', async (
    _event,
    input: { role_id: string; module_key: string; submodule_key?: string | null; level: PermissionLevel }
  ): Promise<RolePermission> => {
    await requireAdmin()
    const row = await upsertRolePermission(input)
    invalidatePermissionsCache()
    return row
  })

  // ── Rol propio (self-service, cualquier usuario logueado) ──────────────────

  ipcMain.handle('permissions:myRole', async (): Promise<MyRoleResult> => {
    const session = await getSession()
    if (!session) return { role: null, rolePermissions: [] }
    return getMyRole(session.userId)
  })
}
