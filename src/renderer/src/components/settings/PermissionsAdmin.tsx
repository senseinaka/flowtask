import { useState } from 'react'
import {
  ShieldCheck, Loader2, User, Clock, Pencil, Check, X, Crown,
  Plus, Trash2, Copy, CheckCheck, ChevronRight, ChevronDown
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MODULES, ADMIN_USER_ID, type PermissionLevel } from '@shared/modules'
import type { UserProfile, UserPermission, Role } from '@shared/types'
import { cn } from '../ui/utils'
import { toast } from '../../store/toast.store'
import { levelFromRows } from '../../hooks/usePermissions'
import {
  useRoles, useCreateRole, useRenameRole, useDeleteRole,
  useRolePermissions, useSetRolePermission
} from '../../hooks/useRoles'

// ── Constantes ────────────────────────────────────────────────────────────────

const LEVEL_LABELS: Record<PermissionLevel, string> = {
  none:  'Sin acceso',
  read:  'Lectura',
  write: 'Lectura y edición'
}

const PRESET_NONE:  PermissionLevel = 'none'
const PRESET_READ:  PermissionLevel = 'read'
const PRESET_WRITE: PermissionLevel = 'write'

const GRANTABLE_MODULES = MODULES.filter((m) => !m.superAdminOnly)

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function relativeTime(ts: number): string {
  if (!ts) return 'Nunca conectado'
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60_000)
  if (m < 2)  return 'ahora mismo'
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h}h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'ayer'
  if (d < 30)  return `hace ${d} días`
  return `hace ${Math.floor(d / 30)} meses`
}

function isRecentlyActive(ts: number): boolean {
  return ts > 0 && Date.now() - ts < 7 * 24 * 60 * 60 * 1000
}

function isValidUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim())
}

// ── Componente raíz ───────────────────────────────────────────────────────────

export default function PermissionsAdmin() {
  const { data: session } = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: () => window.api.auth.getSession()
  })
  if (session?.userId !== ADMIN_USER_ID) return null
  return <PermissionsAdminInner />
}

function PermissionsAdminInner() {
  const [tab, setTab] = useState<'usuarios' | 'roles'>('usuarios')

  return (
    <section className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-400" />
          <h2 className="font-semibold text-sm">Usuarios y permisos</h2>
        </div>
        <div className="flex items-center gap-1 bg-slate-900/60 rounded-lg p-1">
          <button
            onClick={() => setTab('usuarios')}
            className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors', tab === 'usuarios' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200')}
          >
            Usuarios
          </button>
          <button
            onClick={() => setTab('roles')}
            className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors', tab === 'roles' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200')}
          >
            Roles
          </button>
        </div>
      </div>

      {tab === 'usuarios' ? <UsersPanel /> : <RolesPanel />}
    </section>
  )
}

// ── Árbol de permisos (compartido entre usuario y rol) ────────────────────────

interface ResolvedLevel {
  level: PermissionLevel
  source: 'individual' | 'role' | null
}

function PermissionTree({
  resolve, onChange, disabled
}: {
  resolve: (moduleKey: string, submoduleKey?: string) => ResolvedLevel
  onChange: (moduleKey: string, submoduleKey: string | null, level: PermissionLevel) => void
  disabled?: boolean
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-0.5">
      {GRANTABLE_MODULES.map((mod) => {
        const hasSubmodules = !!mod.submodules?.length
        const isExpanded = expanded.has(mod.key)
        const resolved = resolve(mod.key)

        return (
          <div key={mod.key}>
            <div
              className={cn(
                'flex items-center justify-between gap-3 px-3 py-2 bg-slate-900/50 rounded-lg',
                hasSubmodules && 'cursor-pointer'
              )}
              onClick={hasSubmodules ? () => toggle(mod.key) : undefined}
            >
              <span className="flex items-center gap-1.5 text-sm text-slate-300">
                {hasSubmodules && (
                  isExpanded ? <ChevronDown size={13} className="text-slate-500" /> : <ChevronRight size={13} className="text-slate-500" />
                )}
                {mod.label}
              </span>
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <SourceBadge source={resolved.source} />
                <LevelSelect
                  value={resolved.level}
                  disabled={disabled}
                  onChange={(level) => onChange(mod.key, null, level)}
                />
              </div>
            </div>

            {hasSubmodules && isExpanded && (
              <div className="pl-6 space-y-0.5 mt-0.5 mb-1">
                {mod.submodules!.map((sub) => {
                  const subResolved = resolve(mod.key, sub.key)
                  return (
                    <div key={sub.key} className="flex items-center justify-between gap-3 px-3 py-1.5">
                      <span className="text-xs text-slate-400">{sub.label}</span>
                      <div className="flex items-center gap-1.5">
                        <SourceBadge source={subResolved.source} />
                        <LevelSelect
                          value={subResolved.level}
                          disabled={disabled}
                          small
                          onChange={(level) => onChange(mod.key, sub.key, level)}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function LevelSelect({
  value, onChange, disabled, small
}: {
  value: PermissionLevel
  onChange: (level: PermissionLevel) => void
  disabled?: boolean
  small?: boolean
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as PermissionLevel)}
      className={cn(
        'bg-slate-800 border border-slate-700 rounded-md text-slate-300 disabled:opacity-50 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer',
        small ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'
      )}
    >
      {(['none', 'read', 'write'] as PermissionLevel[]).map((lv) => (
        <option key={lv} value={lv}>{LEVEL_LABELS[lv]}</option>
      ))}
    </select>
  )
}

function SourceBadge({ source }: { source: 'individual' | 'role' | null }) {
  if (!source) return null
  return (
    <span className={cn(
      'text-[9px] px-1.5 py-0.5 rounded-full border',
      source === 'individual'
        ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500'
        : 'bg-slate-700/50 text-slate-400 border-slate-600'
    )}>
      {source === 'individual' ? 'override' : 'heredado'}
    </span>
  )
}

// ── Pestaña Usuarios ────────────────────────────────────────────────────────

function UsersPanel() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)

  const { data: permissions = [], isLoading: loadingPerms } = useQuery({
    queryKey: ['permissions', 'all'],
    queryFn: () => window.api.permissions.listAll()
  })

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['permissions', 'profiles'],
    queryFn: () => window.api.permissions.profiles.list(),
    staleTime: 30_000
  })

  const { data: roles = [] } = useRoles()
  const roleMap = new Map(roles.map((r) => [r.id, r]))

  const isLoading = loadingPerms || loadingProfiles

  const profileMap = new Map(profiles.map((p) => [p.id, p]))
  const unknownIds = Array.from(new Set(permissions.map((p) => p.user_id))).filter(
    (id) => !profileMap.has(id) && id !== ADMIN_USER_ID
  )

  const selected = selectedId ? profileMap.get(selectedId) : undefined
  const isSelectedSuperAdmin = selectedId === ADMIN_USER_ID

  return (
    <>
      <div className="flex items-center justify-end px-5 pt-3">
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <Plus size={13} />
          Nuevo usuario
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-slate-500" />
        </div>
      ) : (
        <div className="flex min-h-[420px]">

          {/* ── Columna izquierda: lista ── */}
          <div className="w-64 shrink-0 border-r border-slate-700 flex flex-col">
            <div className="px-3 pt-3 pb-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider px-1">
                Usuarios ({profiles.length + unknownIds.length + (profileMap.has(ADMIN_USER_ID) ? 0 : 1)})
              </p>
            </div>

            <div className="flex-1 overflow-y-auto py-1 px-2 space-y-0.5">
              {/* Super Admin siempre primero */}
              <SuperAdminRow
                profile={profileMap.get(ADMIN_USER_ID)}
                selected={selectedId === ADMIN_USER_ID}
                onClick={() => setSelectedId(ADMIN_USER_ID)}
              />

              {profiles.filter((p) => p.id !== ADMIN_USER_ID).map((p) => (
                <UserRow
                  key={p.id}
                  label={p.display_name || p.email.split('@')[0]}
                  sublabel={p.email}
                  roleName={p.role_id ? roleMap.get(p.role_id)?.name : undefined}
                  active={isRecentlyActive(p.last_seen_at)}
                  hasProfile
                  selected={selectedId === p.id}
                  onClick={() => setSelectedId(p.id)}
                />
              ))}

              {unknownIds.map((id) => (
                <UserRow
                  key={id}
                  label="Sin nombre"
                  sublabel={id.slice(0, 18) + '…'}
                  active={false}
                  hasProfile={false}
                  selected={selectedId === id}
                  onClick={() => setSelectedId(id)}
                />
              ))}
            </div>
          </div>

          {/* ── Columna derecha: detalle ── */}
          <div className="flex-1 min-w-0 flex flex-col">
            {!selectedId ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-600">
                <ChevronRight size={28} />
                <p className="text-sm">Seleccioná un usuario</p>
              </div>
            ) : isSelectedSuperAdmin ? (
              <SuperAdminDetail profile={profileMap.get(ADMIN_USER_ID)} />
            ) : selected ? (
              <UserDetail
                key={selected.id}
                profile={selected}
                allPermissions={permissions}
                roles={roles}
                onDeleted={() => setSelectedId(null)}
              />
            ) : (
              <div className="px-5 py-4">
                <CreateProfileInline
                  key={selectedId}
                  userId={selectedId}
                  onCreated={() => qc.invalidateQueries({ queryKey: ['permissions', 'profiles'] })}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {showNewModal && (
        <NewUserModal
          roles={roles}
          onClose={() => setShowNewModal(false)}
          onCreated={(id) => {
            qc.invalidateQueries({ queryKey: ['permissions', 'profiles'] })
            setShowNewModal(false)
            setSelectedId(id)
          }}
        />
      )}
    </>
  )
}

// ── Fila de usuario en la lista ───────────────────────────────────────────────

function UserRow({
  label, sublabel, roleName, active, hasProfile, selected, onClick
}: {
  label: string
  sublabel: string
  roleName?: string
  active: boolean
  hasProfile: boolean
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-colors',
        selected
          ? 'bg-indigo-600/30 ring-1 ring-indigo-500/40'
          : 'hover:bg-slate-700/50'
      )}
    >
      <div className={cn(
        'size-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
        hasProfile ? 'bg-indigo-900 text-indigo-300' : 'bg-slate-700 text-slate-500'
      )}>
        {hasProfile ? initials(label) : <User size={14} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-200 truncate leading-tight">{label}</p>
        <p className="text-xs text-slate-500 truncate">{roleName ?? sublabel}</p>
      </div>
      {active && <span className="size-2 rounded-full bg-emerald-400 shrink-0" />}
    </button>
  )
}

function SuperAdminRow({ profile, selected, onClick }: { profile?: UserProfile; selected: boolean; onClick: () => void }) {
  const label = profile?.display_name || profile?.email?.split('@')[0] || 'Super Admin'
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-colors mb-1',
        selected ? 'bg-amber-500/20 ring-1 ring-amber-500/50' : 'bg-amber-500/10 hover:bg-amber-500/15'
      )}
    >
      <div className="size-8 rounded-full flex items-center justify-center bg-amber-500/20 text-amber-400 shrink-0">
        <Crown size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-100 truncate leading-tight font-medium">{label}</p>
        <p className="text-xs text-amber-400 truncate">Super Admin</p>
      </div>
    </button>
  )
}

// ── Detalle Super Admin ────────────────────────────────────────────────────

function SuperAdminDetail({ profile }: { profile?: UserProfile }) {
  return (
    <div className="p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
          <Crown size={18} />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-100">{profile?.display_name || 'Super Admin'}</p>
          <p className="text-xs text-slate-400">{profile?.email}</p>
        </div>
      </div>
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-2">
        <p className="text-sm text-amber-200 font-medium">Acceso total automático</p>
        <p className="text-xs text-slate-300 leading-relaxed">
          El Super Admin siempre tiene escritura en todos los módulos, incluidos los que se agreguen
          en el futuro — no hace falta asignarle nada acá, ni se le puede quitar. Por eso esta pantalla
          no tiene una matriz editable para este usuario.
        </p>
      </div>
    </div>
  )
}

// ── Detalle de usuario (no-admin) ─────────────────────────────────────────────

function UserDetail({
  profile, allPermissions, roles, onDeleted
}: {
  profile: UserProfile
  allPermissions: UserPermission[]
  roles: Role[]
  onDeleted: () => void
}) {
  const qc = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [copied, setCopied] = useState(false)

  const userPermissions = allPermissions.filter((p) => p.user_id === profile.id)
  const { data: rolePermissions = [] } = useRolePermissions(profile.role_id)

  const setLevel = useMutation({
    mutationFn: window.api.permissions.setLevel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permissions', 'all'] })
      qc.invalidateQueries({ queryKey: ['permissions', 'mine'] })
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo guardar el permiso')
  })

  const setRole = useMutation({
    mutationFn: (role_id: string | null) => window.api.permissions.profiles.save({
      id: profile.id, display_name: profile.display_name, email: profile.email, username: profile.username, role_id
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permissions', 'profiles'] })
      qc.invalidateQueries({ queryKey: ['permissions', 'myRole'] })
      toast.success('Rol actualizado')
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo asignar el rol')
  })

  const deleteUser = useMutation({
    mutationFn: (id: string) => window.api.permissions.profiles.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permissions', 'profiles'] })
      qc.invalidateQueries({ queryKey: ['permissions', 'all'] })
      setConfirmDelete(false)
      toast.success('Usuario eliminado')
      onDeleted()
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo eliminar el usuario')
  })

  function resolve(moduleKey: string, submoduleKey?: string): ResolvedLevel {
    const ind = levelFromRows(userPermissions, moduleKey, submoduleKey)
    if (ind !== null) return { level: ind, source: 'individual' }
    const rl = levelFromRows(rolePermissions, moduleKey, submoduleKey)
    if (rl !== null) return { level: rl, source: 'role' }
    return { level: 'none', source: null }
  }

  async function applyPreset(level: PermissionLevel) {
    for (const mod of GRANTABLE_MODULES) {
      await window.api.permissions.setLevel({ user_id: profile.id, module_key: mod.key, submodule_key: null, level })
    }
    qc.invalidateQueries({ queryKey: ['permissions', 'all'] })
    qc.invalidateQueries({ queryKey: ['permissions', 'mine'] })
  }

  function copyUUID() {
    navigator.clipboard.writeText(profile.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-slate-700 space-y-3">
        <UserHeader profile={profile} onCopyUUID={copyUUID} copied={copied} />

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Rol asignado</span>
          <select
            value={profile.role_id ?? ''}
            disabled={setRole.isPending}
            onChange={(e) => setRole.mutate(e.target.value || null)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          >
            <option value="">Sin rol</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          {profile.role_id && (
            <span className="text-[10px] text-slate-600">La matriz de abajo parte de este rol — un cambio puntual lo pisa.</span>
          )}
        </div>
      </div>

      <div className="px-5 pt-3 pb-2 flex items-center gap-2">
        <span className="text-xs text-slate-500 mr-1">Acceso rápido (override individual):</span>
        {([
          { label: 'Sin acceso', level: PRESET_NONE, cls: 'border-slate-600 text-slate-400 hover:border-slate-500' },
          { label: 'Solo lectura', level: PRESET_READ, cls: 'border-sky-700 text-sky-400 hover:border-sky-500' },
          { label: 'Todo acceso', level: PRESET_WRITE, cls: 'border-emerald-700 text-emerald-400 hover:border-emerald-500' }
        ] as const).map(({ label, level, cls }) => (
          <button
            key={level}
            onClick={() => applyPreset(level)}
            className={cn('px-2.5 py-1 rounded-md text-xs border transition-colors', cls)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-3">
        <PermissionTree
          resolve={resolve}
          disabled={setLevel.isPending}
          onChange={(moduleKey, submoduleKey, level) =>
            setLevel.mutate({ user_id: profile.id, module_key: moduleKey, submodule_key: submoduleKey, level })
          }
        />
      </div>

      <div className="px-5 py-3 border-t border-slate-700">
        {confirmDelete ? (
          <div className="flex items-center gap-3">
            <p className="text-xs text-red-400 flex-1">¿Eliminar usuario y todos sus permisos?</p>
            <button
              onClick={() => deleteUser.mutate(profile.id)}
              disabled={deleteUser.isPending}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {deleteUser.isPending ? 'Eliminando…' : 'Confirmar'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 text-slate-400 hover:text-slate-200 text-xs transition-colors"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} />
            Eliminar usuario
          </button>
        )}
      </div>
    </div>
  )
}

// ── Cabecera del usuario seleccionado ─────────────────────────────────────────

function UserHeader({
  profile, onCopyUUID, copied
}: {
  profile: UserProfile
  onCopyUUID: () => void
  copied: boolean
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile.display_name)
  const [email, setEmail] = useState(profile.email)
  const [username, setUsername] = useState(profile.username ?? '')

  const save = useMutation({
    mutationFn: () => window.api.permissions.profiles.save({
      id: profile.id, display_name: name.trim(), email: email.trim(), username: username.trim() || null, role_id: profile.role_id
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permissions', 'profiles'] })
      setEditing(false)
      toast.success('Perfil actualizado')
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo guardar el perfil')
  })

  if (editing) {
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre completo"
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@empresa.com"
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Nombre de usuario (opcional)</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Para loguearse sin escribir el email"
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Check size={12} /> Guardar
          </button>
          <button
            onClick={() => { setEditing(false); setName(profile.display_name); setEmail(profile.email); setUsername(profile.username ?? '') }}
            className="px-3 py-1.5 text-slate-400 hover:text-slate-200 text-xs transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  const displayName = profile.display_name || profile.email.split('@')[0]

  return (
    <div className="flex items-start gap-3">
      <div className="size-10 rounded-full bg-indigo-900 text-indigo-300 flex items-center justify-center text-sm font-bold shrink-0">
        {initials(displayName)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-slate-100 truncate">{displayName}</p>
          <button onClick={() => setEditing(true)} className="text-slate-600 hover:text-slate-400 transition-colors shrink-0">
            <Pencil size={11} />
          </button>
        </div>
        <p className="text-xs text-slate-400 truncate">{profile.email}</p>
        {profile.username && (
          <p className="text-xs text-indigo-400 truncate">@{profile.username}</p>
        )}
        <div className="flex items-center gap-3 mt-1">
          <button
            onClick={onCopyUUID}
            className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
          >
            {copied ? <CheckCheck size={11} className="text-emerald-400" /> : <Copy size={11} />}
            <span className="truncate max-w-[160px]">{profile.id}</span>
          </button>
          <span className="flex items-center gap-1 text-xs text-slate-600">
            <Clock size={10} />
            {relativeTime(profile.last_seen_at)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Crear perfil inline (usuario sin perfil) ─────────────────────────────────

function CreateProfileInline({ userId, onCreated }: { userId: string; onCreated: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')

  const save = useMutation({
    mutationFn: () => window.api.permissions.profiles.save({
      id: userId,
      display_name: name.trim(),
      email: email.trim(),
      username: username.trim() || null
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permissions', 'profiles'] })
      onCreated()
      toast.success('Perfil creado')
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo crear el perfil')
  })

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-mono text-slate-600 break-all leading-relaxed">{userId}</p>
        <p className="text-xs text-amber-400 mt-1">
          Este usuario no tiene perfil. Asignale un nombre para identificarlo.
        </p>
      </div>
      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1">
          <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre completo"
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && save.mutate()}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
            autoFocus
          />
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Opcional"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Usuario</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Opcional"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <button
          onClick={() => save.mutate()}
          disabled={!name.trim() || save.isPending}
          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 shrink-0"
        >
          {save.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Guardar
        </button>
      </div>
    </div>
  )
}

// ── Modal nuevo usuario ───────────────────────────────────────────────────────

function NewUserModal({ roles, onClose, onCreated }: { roles: Role[]; onClose: () => void; onCreated: (id: string) => void }) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [uuid, setUuid] = useState('')
  const [roleId, setRoleId] = useState('')
  const [preset, setPreset] = useState<PermissionLevel>('none')
  const [error, setError] = useState('')

  const create = useMutation({
    mutationFn: async () => {
      const id = uuid.trim()
      if (!isValidUUID(id)) throw new Error('UUID inválido — verificá el formato en Supabase')
      if (!displayName.trim()) throw new Error('El nombre es obligatorio')
      await window.api.permissions.profiles.save({
        id, display_name: displayName.trim(), email: email.trim(), username: username.trim() || null, role_id: roleId || null
      })
      if (preset !== 'none') {
        for (const mod of GRANTABLE_MODULES) {
          await window.api.permissions.setLevel({ user_id: id, module_key: mod.key, submodule_key: null, level: preset })
        }
      }
      return id
    },
    onSuccess: (id) => { toast.success('Usuario creado'); onCreated(id) },
    onError: (e: Error) => setError(e.message)
  })

  async function pasteUUID() {
    try {
      const text = await navigator.clipboard.readText()
      setUuid(text.trim())
    } catch { /* ignore */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-[420px] shadow-2xl">

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Plus size={15} className="text-indigo-400" />
            <h3 className="font-semibold text-sm">Nuevo usuario</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Nombre completo</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ej: María García"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              type="email"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Nombre de usuario (opcional)</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ej: mgarcia — para loguearse sin escribir el email"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Rol (opcional)</label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="">Sin rol</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">UUID de Supabase Auth</label>
            <div className="flex gap-2">
              <input
                value={uuid}
                onChange={(e) => { setUuid(e.target.value); setError('') }}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className={cn(
                  'flex-1 bg-slate-900 border rounded-lg px-3 py-2 text-sm font-mono placeholder-slate-600 focus:outline-none transition-colors',
                  error && !isValidUUID(uuid.trim())
                    ? 'border-red-600 text-red-300 focus:border-red-500'
                    : 'border-slate-700 text-slate-200 focus:border-indigo-500'
                )}
              />
              <button
                onClick={pasteUUID}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition-colors"
              >
                Pegar
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Supabase → Authentication → Users → copiar el User UID
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Permisos individuales iniciales</label>
            <div className="flex gap-2">
              {([
                { level: 'none'  as PermissionLevel, label: 'Sin acceso' },
                { level: 'read'  as PermissionLevel, label: 'Solo lectura' },
                { level: 'write' as PermissionLevel, label: 'Todo acceso' }
              ]).map(({ level, label }) => (
                <button
                  key={level}
                  onClick={() => setPreset(level)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    preset === level
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-600">Si le asignaste un rol, esto queda como override — dejalo en "Sin acceso" para que use solo lo que da el rol.</p>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending || !displayName.trim() || !uuid.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Crear usuario
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Pestaña Roles ─────────────────────────────────────────────────────────────

function RolesPanel() {
  const { data: roles = [], isLoading } = useRoles()
  const createRole = useCreateRole()
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [newRoleName, setNewRoleName] = useState('')
  const [addingRole, setAddingRole] = useState(false)

  const selected = roles.find((r) => r.id === selectedRoleId)

  async function handleCreateRole() {
    if (!newRoleName.trim()) return
    const role = await createRole.mutateAsync(newRoleName.trim())
    setNewRoleName('')
    setAddingRole(false)
    setSelectedRoleId(role.id)
    toast.success('Rol creado')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-slate-500" />
      </div>
    )
  }

  return (
    <div className="flex min-h-[420px]">
      <div className="w-64 shrink-0 border-r border-slate-700 flex flex-col">
        <div className="px-3 pt-3 pb-1 flex items-center justify-between">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider px-1">
            Roles ({roles.length})
          </p>
        </div>

        <div className="flex-1 overflow-y-auto py-1 px-2 space-y-0.5">
          {roles.length === 0 && !addingRole && (
            <p className="text-xs text-slate-600 px-2 py-3 text-center leading-relaxed">
              Ningún rol todavía.<br />Creá el primero abajo.
            </p>
          )}
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRoleId(r.id)}
              className={cn(
                'w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors',
                selectedRoleId === r.id ? 'bg-indigo-600/30 ring-1 ring-indigo-500/40 text-slate-100' : 'text-slate-300 hover:bg-slate-700/50'
              )}
            >
              {r.name}
            </button>
          ))}

          {addingRole ? (
            <div className="flex items-center gap-1.5 px-1 py-1">
              <input
                autoFocus
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateRole(); if (e.key === 'Escape') setAddingRole(false) }}
                placeholder="Nombre del rol"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
              <button onClick={handleCreateRole} className="p-1.5 rounded-lg text-emerald-400 hover:bg-slate-700"><Check size={14} /></button>
              <button onClick={() => setAddingRole(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700"><X size={14} /></button>
            </div>
          ) : (
            <button
              onClick={() => setAddingRole(true)}
              className="w-full flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-indigo-400 hover:text-indigo-300 hover:bg-slate-700/40 transition-colors"
            >
              <Plus size={13} /> Nuevo rol
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {!selected ? (
          <div className="flex-1 h-full flex flex-col items-center justify-center gap-2 text-slate-600">
            <ChevronRight size={28} />
            <p className="text-sm">Seleccioná un rol</p>
          </div>
        ) : (
          <RoleDetail key={selected.id} role={selected} onDeleted={() => setSelectedRoleId(null)} />
        )}
      </div>
    </div>
  )
}

function RoleDetail({ role, onDeleted }: { role: Role; onDeleted: () => void }) {
  const qc = useQueryClient()
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(role.name)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: rolePermissions = [] } = useRolePermissions(role.id)
  const renameRole = useRenameRole()
  const deleteRole = useDeleteRole()
  const setRolePermission = useSetRolePermission()

  function resolve(moduleKey: string, submoduleKey?: string): ResolvedLevel {
    const level = levelFromRows(rolePermissions, moduleKey, submoduleKey) ?? 'none'
    return { level, source: null }
  }

  async function handleRename() {
    if (!name.trim() || name.trim() === role.name) { setEditingName(false); return }
    await renameRole.mutateAsync({ id: role.id, name: name.trim() })
    setEditingName(false)
    toast.success('Rol actualizado')
  }

  async function handleDelete() {
    await deleteRole.mutateAsync(role.id)
    toast.success('Rol eliminado — los usuarios que lo tenían quedaron sin rol')
    onDeleted()
  }

  async function applyPreset(level: PermissionLevel) {
    for (const mod of GRANTABLE_MODULES) {
      await setRolePermission.mutateAsync({ role_id: role.id, module_key: mod.key, submodule_key: null, level })
    }
    qc.invalidateQueries({ queryKey: ['role-permissions', role.id] })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-100 focus:outline-none focus:border-indigo-500"
            />
            <button onClick={handleRename} className="p-1.5 rounded-lg text-emerald-400 hover:bg-slate-700"><Check size={14} /></button>
            <button onClick={() => { setEditingName(false); setName(role.name) }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700"><X size={14} /></button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-slate-100">{role.name}</p>
            <button onClick={() => setEditingName(true)} className="text-slate-600 hover:text-slate-400 transition-colors">
              <Pencil size={11} />
            </button>
          </div>
        )}

        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-400">¿Eliminar rol?</span>
            <button onClick={handleDelete} className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded-lg">Confirmar</button>
            <button onClick={() => setConfirmDelete(false)} className="px-2.5 py-1 text-slate-400 hover:text-slate-200 text-xs">Cancelar</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1 text-xs text-slate-600 hover:text-red-400 transition-colors">
            <Trash2 size={13} /> Eliminar rol
          </button>
        )}
      </div>

      <div className="px-5 pt-3 pb-2 flex items-center gap-2">
        <span className="text-xs text-slate-500 mr-1">Acceso rápido:</span>
        {([
          { label: 'Sin acceso', level: PRESET_NONE, cls: 'border-slate-600 text-slate-400 hover:border-slate-500' },
          { label: 'Solo lectura', level: PRESET_READ, cls: 'border-sky-700 text-sky-400 hover:border-sky-500' },
          { label: 'Todo acceso', level: PRESET_WRITE, cls: 'border-emerald-700 text-emerald-400 hover:border-emerald-500' }
        ] as const).map(({ label, level, cls }) => (
          <button
            key={level}
            onClick={() => applyPreset(level)}
            className={cn('px-2.5 py-1 rounded-md text-xs border transition-colors', cls)}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-600 px-5 pb-2">
        Un cambio acá afecta a todos los usuarios con este rol asignado, salvo que tengan un override individual propio.
      </p>

      <div className="flex-1 overflow-y-auto px-5 pb-3">
        <PermissionTree
          resolve={resolve}
          disabled={setRolePermission.isPending}
          onChange={(moduleKey, submoduleKey, level) =>
            setRolePermission.mutate({ role_id: role.id, module_key: moduleKey, submodule_key: submoduleKey, level })
          }
        />
      </div>
    </div>
  )
}
