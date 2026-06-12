import { useQuery } from '@tanstack/react-query'
import { MODULES, findModuleByPath, findSubmoduleByPath, type PermissionLevel } from '@shared/modules'
import type { UserPermission } from '@shared/types'

function levelFor(
  permissions: UserPermission[],
  moduleKey: string,
  submoduleKey?: string
): PermissionLevel {
  if (submoduleKey) {
    const sub = permissions.find((p) => p.module_key === moduleKey && p.submodule_key === submoduleKey)
    if (sub) return sub.level
  }
  const top = permissions.find((p) => p.module_key === moduleKey && p.submodule_key === null)
  return top?.level ?? 'none'
}

export function usePermissions() {
  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['permissions', 'mine'],
    queryFn: () => window.api.permissions.listMine()
  })

  function getLevel(moduleKey: string, submoduleKey?: string): PermissionLevel {
    return levelFor(permissions, moduleKey, submoduleKey)
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

  return { permissions, isLoading, getLevel, canRead, canWrite, canReadPath, MODULES }
}
