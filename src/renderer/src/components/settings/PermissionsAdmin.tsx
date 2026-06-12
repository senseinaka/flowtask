import { useState } from 'react'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MODULES, ADMIN_USER_ID, type PermissionLevel } from '@shared/modules'

const LEVEL_LABELS: Record<PermissionLevel, string> = {
  none: 'Sin acceso',
  read: 'Lectura',
  write: 'Lectura y edición'
}

export default function PermissionsAdmin() {
  const { data: session } = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: () => window.api.auth.getSession()
  })

  if (session?.userId !== ADMIN_USER_ID) return null

  return <PermissionsAdminTable />
}

function PermissionsAdminTable() {
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState('')

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['permissions', 'all'],
    queryFn: () => window.api.permissions.listAll()
  })

  const setLevel = useMutation({
    mutationFn: window.api.permissions.setLevel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions', 'all'] })
      queryClient.invalidateQueries({ queryKey: ['permissions', 'mine'] })
    }
  })

  const knownUserIds = Array.from(new Set(permissions.map((p) => p.user_id)))

  function levelFor(moduleKey: string): PermissionLevel {
    if (!userId) return 'none'
    const row = permissions.find(
      (p) => p.user_id === userId && p.module_key === moduleKey && p.submodule_key === null
    )
    return row?.level ?? 'none'
  }

  function handleChange(moduleKey: string, level: PermissionLevel) {
    if (!userId.trim()) return
    setLevel.mutate({ user_id: userId.trim(), module_key: moduleKey, submodule_key: null, level })
  }

  return (
    <section className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-emerald-400" />
        <h2 className="font-semibold">Administración de permisos</h2>
      </div>

      <p className="text-xs text-slate-500">
        Definí el acceso de cada usuario por módulo. Los cambios aplican de inmediato
        en su sesión.
      </p>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-400">User ID (Supabase Auth)</label>
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="UUID del usuario..."
          list="permissions-known-users"
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        <datalist id="permissions-known-users">
          {knownUserIds.map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={18} className="animate-spin text-slate-500" />
        </div>
      ) : (
        <div className="space-y-1.5">
          {MODULES.map((mod) => (
            <div key={mod.key} className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-900/60 rounded-lg">
              <span className="text-sm text-slate-300">{mod.label}</span>
              <select
                value={levelFor(mod.key)}
                disabled={!userId.trim() || setLevel.isPending}
                onChange={(e) => handleChange(mod.key, e.target.value as PermissionLevel)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 disabled:opacity-50 focus:outline-none focus:border-indigo-500 transition-colors"
              >
                {(['none', 'read', 'write'] as PermissionLevel[]).map((level) => (
                  <option key={level} value={level}>{LEVEL_LABELS[level]}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {!userId.trim() && (
        <p className="text-xs text-slate-500">
          Ingresá el User ID del usuario (lo encontrás en Supabase → Authentication → Users) para editar sus permisos.
        </p>
      )}
    </section>
  )
}
