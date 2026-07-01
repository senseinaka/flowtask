import { useQuery } from '@tanstack/react-query'
import { MODULES, ADMIN_USER_ID, findModuleByPath, findSubmoduleByPath, type PermissionLevel } from '@shared/modules'
import type { UserPermission, RolePermission } from '@shared/types'

export function levelFromRows(
  rows: Array<{ module_key: string; submodule_key: string | null; level: PermissionLevel }>,
  moduleKey: string,
  submoduleKey?: string
): PermissionLevel | null {
  if (submoduleKey) {
    const sub = rows.find((p) => p.module_key === moduleKey && p.submodule_key === submoduleKey)
    if (sub) return sub.level
  }
  const top = rows.find((p) => p.module_key === moduleKey && p.submodule_key === null)
  return top?.level ?? null
}

/**
 * Permiso efectivo, en orden: Super Admin (siempre 'write', sin consultar nada)
 * > módulo superAdminOnly (siempre 'none' si no sos Super Admin) > override
 * individual > permiso del rol asignado > 'none'. Mantener esta MISMA
 * precedencia en permissions.service.ts (proceso main) — ahí se aplica de
 * verdad a cada IPC, esto solo decide qué mostrar en la UI.
 */
function levelFor(
  isSuperAdmin: boolean,
  permissions: UserPermission[],
  rolePermissions: RolePermission[],
  moduleKey: string,
  submoduleKey?: string
): PermissionLevel {
  if (isSuperAdmin) return 'write'

  const mod = MODULES.find((m) => m.key === moduleKey)
  if (mod?.superAdminOnly) return 'none'

  return levelFromRows(permissions, moduleKey, submoduleKey)
    ?? levelFromRows(rolePermissions, moduleKey, submoduleKey)
    ?? 'none'
}

export function usePermissions() {
  const { data: session } = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: () => window.api.auth.getSession()
  })
  const isSuperAdmin = session?.userId === ADMIN_USER_ID

  const { data: permissions = [], isLoading: loadingPermissions } = useQuery({
    queryKey: ['permissions', 'mine'],
    queryFn: () => window.api.permissions.listMine()
  })

  const { data: myRole, isLoading: loadingRole } = useQuery({
    queryKey: ['permissions', 'myRole'],
    queryFn: () => window.api.permissions.myRole(),
    enabled: !isSuperAdmin // el Super Admin no depende de ningún rol
  })
  const rolePermissions = myRole?.rolePermissions ?? []

  const isLoading = loadingPermissions || (!isSuperAdmin && loadingRole)

  function getLevel(moduleKey: string, submoduleKey?: string): PermissionLevel {
    return levelFor(isSuperAdmin, permissions, rolePermissions, moduleKey, submoduleKey)
  }

  function canRead(moduleKey: string, submoduleKey?: string): boolean {
    return getLevel(moduleKey, submoduleKey) !== 'none'
  }

  function canWrite(moduleKey: string, submoduleKey?: string): boolean {
    return getLevel(moduleKey, submoduleKey) === 'write'
  }

  function canReadPath(pathname: string): boolean {
    const mod = findModuleByPath(pathname)
    if (!mod) return true
    const sub = findSubmoduleByPath(mod, pathname)
    return canRead(mod.key, sub?.key)
  }

  return { permissions, isLoading, isSuperAdmin, getLevel, canRead, canWrite, canReadPath, MODULES }
}
