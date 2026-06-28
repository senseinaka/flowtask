import { useState, useMemo } from 'react'
import { X, Loader2, Plus, Trash2, ShieldCheck } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '../../components/ui/utils'
import {
  useCashboxPermissions,
  useGrantCashboxPermission,
  useRevokeCashboxPermission,
} from '../../hooks/useCajas'
import type { CashboxWithBalance, CashboxPermission } from '@shared/types'
import type { UserProfile } from '@shared/types'

const PERM_KEYS = ['view', 'income', 'expense', 'transfer', 'count'] as const
type PermKey = typeof PERM_KEYS[number]

const PERM_LABELS: Record<PermKey, string> = {
  view:     'Ver',
  income:   'Ingresar',
  expense:  'Egresar',
  transfer: 'Transferir',
  count:    'Contar',
}

const PERM_COLORS: Record<PermKey, string> = {
  view:     'bg-slate-700/60 text-slate-300 border-slate-600',
  income:   'bg-emerald-900/40 text-emerald-300 border-emerald-700',
  expense:  'bg-red-900/30 text-red-300 border-red-800',
  transfer: 'bg-sky-900/30 text-sky-300 border-sky-800',
  count:    'bg-amber-900/30 text-amber-300 border-amber-800',
}

function useUserProfiles() {
  return useQuery<UserProfile[]>({
    queryKey: ['permissions', 'profiles'],
    queryFn:  () => window.api.permissions.profiles.list(),
  })
}

export default function PermisosModal({
  box,
  onClose,
}: {
  box: CashboxWithBalance
  onClose: () => void
}) {
  const { data: perms = [],    isLoading }   = useCashboxPermissions(box.id)
  const { data: profiles = [] }              = useUserProfiles()
  const grant  = useGrantCashboxPermission()
  const revoke = useRevokeCashboxPermission()

  const [formOpen,  setFormOpen]  = useState(false)
  const [userId,    setUserId]    = useState('')
  const [permKey,   setPermKey]   = useState<PermKey>('view')
  const [formError, setFormError] = useState<string | null>(null)

  const profileMap = useMemo(
    () => Object.fromEntries(profiles.map(p => [p.id, p])),
    [profiles]
  )

  // Group permissions by user_id
  const byUser = useMemo(() => {
    const map: Record<string, CashboxPermission[]> = {}
    for (const p of perms) {
      if (!map[p.user_id]) map[p.user_id] = []
      map[p.user_id].push(p)
    }
    return map
  }, [perms])

  // Users not yet with any permission (for the form selector)
  const usersWithPerms = new Set(Object.keys(byUser))

  async function handleGrant() {
    setFormError(null)
    if (!userId) { setFormError('Seleccioná un usuario.'); return }
    const already = perms.find(p => p.user_id === userId && p.permission_key === permKey)
    if (already) { setFormError('Ese permiso ya existe para ese usuario.'); return }
    await grant.mutateAsync({ cashbox_id: box.id, user_id: userId, permission_key: permKey })
    setFormOpen(false)
    setUserId('')
    setPermKey('view')
  }

  async function handleRevoke(perm: CashboxPermission) {
    await revoke.mutateAsync({ id: perm.id, cashbox_id: box.id })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div>
            <p className="text-sm font-semibold text-slate-100">Permisos</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{box.name} · {box.company?.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={18} className="animate-spin text-slate-500" />
            </div>
          ) : Object.keys(byUser).length === 0 && !formOpen ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500 gap-2">
              <ShieldCheck size={28} className="text-slate-600" />
              <p className="text-sm">Sin permisos asignados</p>
            </div>
          ) : (
            Object.entries(byUser).map(([uid, userPerms]) => {
              const profile = profileMap[uid]
              return (
                <div key={uid} className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 space-y-2">
                  <div>
                    <p className="text-xs font-medium text-slate-200">
                      {profile?.display_name || profile?.email || uid}
                    </p>
                    {profile?.email && profile?.display_name && (
                      <p className="text-[10px] text-slate-500">{profile.email}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {userPerms.map(perm => (
                      <span
                        key={perm.id}
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border',
                          PERM_COLORS[perm.permission_key as PermKey] ?? PERM_COLORS.view
                        )}
                      >
                        {PERM_LABELS[perm.permission_key as PermKey] ?? perm.permission_key}
                        <button
                          onClick={() => handleRevoke(perm)}
                          disabled={revoke.isPending}
                          className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={9} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )
            })
          )}

          {/* Inline form */}
          {formOpen && (
            <div className="bg-slate-800/60 border border-slate-600 rounded-xl p-3 space-y-3">
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                Nuevo permiso
              </p>

              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Usuario</label>
                  <select
                    value={userId}
                    onChange={e => setUserId(e.target.value)}
                    className="w-full appearance-none bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="">Seleccionar…</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.display_name || p.email}
                        {usersWithPerms.has(p.id) ? ' (ya tiene permisos)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Permiso</label>
                  <div className="flex flex-wrap gap-1.5">
                    {PERM_KEYS.map(k => (
                      <button
                        key={k}
                        onClick={() => setPermKey(k)}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                          permKey === k
                            ? PERM_COLORS[k]
                            : 'border-slate-700 text-slate-500 hover:text-slate-300'
                        )}
                      >
                        {PERM_LABELS[k]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {formError && (
                <p className="text-xs text-red-400">{formError}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleGrant}
                  disabled={grant.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg border border-emerald-700 text-emerald-300 bg-emerald-900/30 hover:bg-emerald-900/50 transition-colors disabled:opacity-40"
                >
                  {grant.isPending
                    ? <><Loader2 size={11} className="animate-spin" /> Guardando…</>
                    : 'Confirmar'
                  }
                </button>
                <button
                  onClick={() => { setFormOpen(false); setFormError(null) }}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 border border-slate-700 rounded-lg"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-3 border-t border-slate-800 shrink-0">
          {!formOpen && (
            <button
              onClick={() => setFormOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-600 text-slate-300 hover:border-slate-500 transition-colors"
            >
              <Plus size={13} />
              Agregar permiso
            </button>
          )}
          <button
            onClick={onClose}
            className="ml-auto px-4 py-2 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
