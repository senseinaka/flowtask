import { ipcMain } from 'electron'
import { listUserPermissions, listAllPermissions, upsertPermission } from '../database/queries/permissions'
import { getSession } from '../services/auth.service'
import { invalidatePermissionsCache } from '../services/permissions.service'
import { ADMIN_USER_ID, type PermissionLevel } from '@shared/modules'
import type { UserPermission } from '@shared/types'

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

  ipcMain.handle('permissions:setLevel', async (
    _event,
    input: { user_id: string; module_key: string; submodule_key?: string | null; level: PermissionLevel }
  ): Promise<UserPermission> => {
    await requireAdmin()
    const row = upsertPermission(input)
    invalidatePermissionsCache()
    return row
  })
}
