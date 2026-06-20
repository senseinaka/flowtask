import { useState } from 'react'
import { ShieldCheck, Loader2, User, Clock, Pencil, Check, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MODULES, ADMIN_USER_ID, type PermissionLevel } from '@shared/modules'
import type { UserProfile } from '@shared/types'
import { cn } from '../ui/utils'

const LEVEL_LABELS: Record<PermissionLevel, string> = {
  none: 'Sin acceso',
  read: 'Lectura',
  write: 'Lectura y edición'
}

function initials(profile: UserProfile): string {
  const name = profile.display_name || profile.email
  return name.slice(0, 2).toUpperCase()
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 2) return 'ahora mismo'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ayer'
  if (days < 30) return `hace ${days} días`
  return `hace ${Math.floor(days / 30)} meses`
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
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null)
  const [editName, setEditName] = useState('')

  const { data: permissions = [], isLoading: loadingPerms } = useQuery({
    queryKey: ['permissions', 'all'],
    queryFn: () => window.api.permissions.listAll()
  })

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['permissions', 'profiles'],
    queryFn: () => window.api.permissions.profiles.list(),
    staleTime: 30_000
  })

  const setLevel = useMutation({
    mutationFn: window.api.permissions.setLevel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions', 'all'] })
      queryClient.invalidateQueries({ queryKey: ['permissions', 'mine'] })
    }
  })

  const saveProfile = useMutation({
    mutationFn: window.api.permissions.profiles.upsert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions', 'profiles'] })
      setEditingProfile(null)
    }
  })

  const isLoading = loadingPerms || loadingProfiles

  // Usuarios sin perfil (tienen permisos pero no se loguearon desde este dispositivo)
  const profileIds = new Set(profiles.map((p) => p.id))
  const unknownIds = Array.from(new Set(permissions.map((p) => p.user_id))).filter(
    (id) => !profileIds.has(id)
  )

  const allUsers: Array<UserProfile | { id: string; display_name: null; email: null; last_seen_at: null }> = [
    ...profiles,
    ...unknownIds.map((id) => ({ id, display_name: null, email: null, last_seen_at: null }))
  ]

  const selectedUser = allUsers.find((u) => u.id === selectedUserId)

  function levelFor(moduleKey: string): PermissionLevel {
    if (!selectedUserId) return 'none'
    const row = permissions.find(
      (p) => p.user_id === selectedUserId && p.module_key === moduleKey && p.submodule_key === null
    )
    return row?.level ?? 'none'
  }

  function handleChange(moduleKey: string, level: PermissionLevel) {
    if (!selectedUserId) return
    setLevel.mutate({ user_id: selectedUserId, module_key: moduleKey, submodule_key: null, level })
  }

  function startEdit(profile: UserProfile) {
    setEditingProfile(profile)
    setEditName(profile.display_name)
  }

  function confirmEdit() {
    if (!editingProfile) return
    saveProfile.mutate({ id: editingProfile.id, email: editingProfile.email, display_name: editName.trim() || editingProfile.email.split('@')[0] })
  }

  const isRecent = (ts: number | null) => ts !== null && Date.now() - ts < 7 * 24 * 60 * 60 * 1000

  return (
    <section className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-emerald-400" />
        <h2 className="font-semibold">Administración de permisos</h2>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={18} className="animate-spin text-slate-500" />
        </div>
      ) : (
        <div className="flex gap-4 min-h-[320px]">
          {/* Panel izquierdo — lista de usuarios */}
          <div className="w-56 shrink-0 flex flex-col gap-1">
            <p className="text-xs font-medium text-slate-500 mb-1 px-1">Usuarios</p>
            {allUsers.length === 0 && (
              <p className="text-xs text-slate-600 px-1">
                Ningún usuario registrado todavía. Los usuarios aparecen aquí al iniciar sesión.
              </p>
            )}
            {allUsers.map((u) => {
              const isKnown = u.display_name !== null
              const active = isRecent(u.last_seen_at)
              return (
                <button
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  className={cn(
                    'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors w-full',
                    selectedUserId === u.id
                      ? 'bg-indigo-600/30 border border-indigo-500/50'
                      : 'hover:bg-slate-700/60 border border-transparent'
                  )}
                >
                  <div className={cn(
                    'size-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                    isKnown ? 'bg-indigo-800 text-indigo-200' : 'bg-slate-700 text-slate-400'
                  )}>
                    {isKnown ? initials(u as UserProfile) : <User size={14} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    {isKnown ? (
                      <>
                        <p className="text-sm text-slate-200 truncate leading-tight">{(u as UserProfile).display_name || (u as UserProfile).email.split('@')[0]}</p>
                        <p className="text-xs text-slate-500 truncate">{(u as UserProfile).email}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-slate-400 font-mono truncate">{u.id.slice(0, 8)}…</p>
                        <p className="text-xs text-slate-600">Sin perfil</p>
                      </>
                    )}
                  </div>
                  {active && (
                    <span className="size-2 rounded-full bg-emerald-400 shrink-0" title="Activo recientemente" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Separador */}
          <div className="w-px bg-slate-700 shrink-0" />

          {/* Panel derecho — permisos del usuario seleccionado */}
          <div className="flex-1 min-w-0">
            {!selectedUser ? (
              <div className="flex items-center justify-center h-full text-slate-600 text-sm">
                Seleccioná un usuario para editar sus permisos
              </div>
            ) : (
              <div className="space-y-3">
                {/* Cabecera del usuario */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {selectedUser.display_name !== null ? (
                      <>
                        {editingProfile?.id === selectedUser.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                              autoFocus
                            />
                            <button onClick={confirmEdit} disabled={saveProfile.isPending} className="text-emerald-400 hover:text-emerald-300">
                              <Check size={14} />
                            </button>
                            <button onClick={() => setEditingProfile(null)} className="text-slate-500 hover:text-slate-300">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-slate-200">
                              {(selectedUser as UserProfile).display_name || (selectedUser as UserProfile).email.split('@')[0]}
                            </p>
                            <button
                              onClick={() => startEdit(selectedUser as UserProfile)}
                              className="text-slate-600 hover:text-slate-400"
                            >
                              <Pencil size={12} />
                            </button>
                          </div>
                        )}
                        <p className="text-xs text-slate-500">{(selectedUser as UserProfile).email}</p>
                        {(selectedUser as UserProfile).last_seen_at && (
                          <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                            <Clock size={10} />
                            {relativeTime((selectedUser as UserProfile).last_seen_at)}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-slate-500 font-mono">{selectedUser.id}</p>
                        <p className="text-xs text-slate-600 mt-0.5">Sin perfil — el usuario no ha iniciado sesión todavía</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Matriz de permisos */}
                <div className="space-y-1">
                  {MODULES.map((mod) => (
                    <div
                      key={mod.key}
                      className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-900/60 rounded-lg"
                    >
                      <span className="text-sm text-slate-300">{mod.label}</span>
                      <select
                        value={levelFor(mod.key)}
                        disabled={setLevel.isPending}
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
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
