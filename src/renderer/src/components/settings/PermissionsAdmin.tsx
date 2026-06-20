import { useState } from 'react'
import {
  ShieldCheck, Loader2, User, Clock, Pencil, Check, X,
  Plus, Trash2, Copy, CheckCheck, ChevronRight
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MODULES, ADMIN_USER_ID, type PermissionLevel } from '@shared/modules'
import type { UserProfile } from '@shared/types'
import { cn } from '../ui/utils'

// ── Constantes ────────────────────────────────────────────────────────────────

const LEVEL_LABELS: Record<PermissionLevel, string> = {
  none:  'Sin acceso',
  read:  'Lectura',
  write: 'Lectura y edición'
}

const LEVEL_COLORS: Record<PermissionLevel, string> = {
  none:  'text-slate-500',
  read:  'text-sky-400',
  write: 'text-emerald-400'
}

const PRESET_NONE:  PermissionLevel = 'none'
const PRESET_READ:  PermissionLevel = 'read'
const PRESET_WRITE: PermissionLevel = 'write'

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

// ── Panel principal ───────────────────────────────────────────────────────────

function PermissionsAdminInner() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [copied, setCopied] = useState(false)

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
      qc.invalidateQueries({ queryKey: ['permissions', 'all'] })
      qc.invalidateQueries({ queryKey: ['permissions', 'mine'] })
    }
  })

  const deleteUser = useMutation({
    mutationFn: (id: string) => window.api.permissions.profiles.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permissions', 'profiles'] })
      qc.invalidateQueries({ queryKey: ['permissions', 'all'] })
      setSelectedId(null)
      setConfirmDelete(false)
    }
  })

  const isLoading = loadingPerms || loadingProfiles

  // Usuarios sin perfil: tienen permisos pero todavía no se registraron
  const profileMap = new Map(profiles.map((p) => [p.id, p]))
  const unknownIds = Array.from(new Set(permissions.map((p) => p.user_id))).filter(
    (id) => !profileMap.has(id)
  )

  const selected = selectedId ? profileMap.get(selectedId) : undefined

  function levelFor(moduleKey: string): PermissionLevel {
    if (!selectedId) return 'none'
    return (
      permissions.find(
        (p) => p.user_id === selectedId && p.module_key === moduleKey && p.submodule_key === null
      )?.level ?? 'none'
    )
  }

  function handleLevelChange(moduleKey: string, level: PermissionLevel) {
    if (!selectedId) return
    setLevel.mutate({ user_id: selectedId, module_key: moduleKey, submodule_key: null, level })
  }

  async function applyPreset(level: PermissionLevel) {
    if (!selectedId) return
    for (const mod of MODULES) {
      await window.api.permissions.setLevel({ user_id: selectedId, module_key: mod.key, submodule_key: null, level })
    }
    qc.invalidateQueries({ queryKey: ['permissions', 'all'] })
    qc.invalidateQueries({ queryKey: ['permissions', 'mine'] })
  }

  function copyUUID() {
    if (!selectedId) return
    navigator.clipboard.writeText(selectedId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-400" />
          <h2 className="font-semibold text-sm">Usuarios y permisos</h2>
        </div>
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
                Usuarios ({profiles.length + unknownIds.length})
              </p>
            </div>

            <div className="flex-1 overflow-y-auto py-1 px-2 space-y-0.5">
              {profiles.length === 0 && unknownIds.length === 0 && (
                <p className="text-xs text-slate-600 px-2 py-3 text-center leading-relaxed">
                  Ningún usuario todavía.<br />Usá "+ Nuevo usuario" para agregar.
                </p>
              )}

              {profiles.map((p) => (
                <UserRow
                  key={p.id}
                  label={p.display_name || p.email.split('@')[0]}
                  sublabel={p.email}
                  active={isRecentlyActive(p.last_seen_at)}
                  hasProfile
                  selected={selectedId === p.id}
                  onClick={() => { setSelectedId(p.id); setConfirmDelete(false) }}
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
                  onClick={() => { setSelectedId(id); setConfirmDelete(false) }}
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
            ) : (
              <div className="flex flex-col h-full">

                {/* Cabecera del usuario seleccionado */}
                <div className="px-5 py-4 border-b border-slate-700">
                  {selected ? (
                    <UserHeader
                      key={selected.id}
                      profile={selected}
                      onCopyUUID={copyUUID}
                      copied={copied}
                      onRefresh={() => qc.invalidateQueries({ queryKey: ['permissions', 'profiles'] })}
                    />
                  ) : (
                    <CreateProfileInline
                      key={selectedId}
                      userId={selectedId}
                      onCreated={() => qc.invalidateQueries({ queryKey: ['permissions', 'profiles'] })}
                    />
                  )}
                </div>

                {/* Presets de permisos */}
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

                {/* Matriz de permisos */}
                <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-1">
                  {MODULES.map((mod) => {
                    const current = levelFor(mod.key)
                    return (
                      <div
                        key={mod.key}
                        className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-900/50 rounded-lg"
                      >
                        <span className="text-sm text-slate-300">{mod.label}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={cn('text-xs', LEVEL_COLORS[current])}>
                            {LEVEL_LABELS[current]}
                          </span>
                          <select
                            value={current}
                            disabled={setLevel.isPending}
                            onChange={(e) => handleLevelChange(mod.key, e.target.value as PermissionLevel)}
                            className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-xs text-slate-300 disabled:opacity-50 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                          >
                            {(['none', 'read', 'write'] as PermissionLevel[]).map((lv) => (
                              <option key={lv} value={lv}>{LEVEL_LABELS[lv]}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Footer — eliminar usuario */}
                <div className="px-5 py-3 border-t border-slate-700">
                  {confirmDelete ? (
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-red-400 flex-1">
                        ¿Eliminar usuario y todos sus permisos?
                      </p>
                      <button
                        onClick={() => deleteUser.mutate(selectedId)}
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
            )}
          </div>
        </div>
      )}

      {/* Modal nuevo usuario */}
      {showNewModal && (
        <NewUserModal
          onClose={() => setShowNewModal(false)}
          onCreated={(id) => {
            qc.invalidateQueries({ queryKey: ['permissions', 'profiles'] })
            setShowNewModal(false)
            setSelectedId(id)
          }}
        />
      )}
    </section>
  )
}

// ── Fila de usuario en la lista ───────────────────────────────────────────────

function UserRow({
  label, sublabel, active, hasProfile, selected, onClick
}: {
  label: string
  sublabel: string
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
        <p className="text-xs text-slate-500 truncate">{sublabel}</p>
      </div>
      {active && <span className="size-2 rounded-full bg-emerald-400 shrink-0" />}
    </button>
  )
}

// ── Cabecera del usuario seleccionado ─────────────────────────────────────────

function UserHeader({
  profile, onCopyUUID, copied, onRefresh
}: {
  profile: UserProfile
  onCopyUUID: () => void
  copied: boolean
  onRefresh: () => void
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile.display_name)
  const [email, setEmail] = useState(profile.email)

  const save = useMutation({
    mutationFn: () => window.api.permissions.profiles.save({
      id: profile.id, display_name: name.trim(), email: email.trim()
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permissions', 'profiles'] })
      setEditing(false)
      onRefresh()
    }
  })

  if (editing) {
    return (
      <div className="space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre completo"
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
          autoFocus
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@empresa.com"
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
        />
        <div className="flex gap-2">
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Check size={12} /> Guardar
          </button>
          <button
            onClick={() => { setEditing(false); setName(profile.display_name); setEmail(profile.email) }}
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

  const save = useMutation({
    mutationFn: () => window.api.permissions.profiles.save({
      id: userId,
      display_name: name.trim(),
      email: email.trim()
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permissions', 'profiles'] })
      onCreated()
    }
  })

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-mono text-slate-600 break-all leading-relaxed">{userId}</p>
        <p className="text-xs text-amber-400 mt-1">
          Este usuario no tiene perfil. Asignale un nombre para identificarlo.
        </p>
      </div>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre completo"
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && save.mutate()}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
          autoFocus
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (opcional)"
          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
        />
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

function NewUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [uuid, setUuid] = useState('')
  const [preset, setPreset] = useState<PermissionLevel>('none')
  const [error, setError] = useState('')

  const create = useMutation({
    mutationFn: async () => {
      const id = uuid.trim()
      if (!isValidUUID(id)) throw new Error('UUID inválido — verificá el formato en Supabase')
      if (!displayName.trim()) throw new Error('El nombre es obligatorio')
      await window.api.permissions.profiles.save({ id, display_name: displayName.trim(), email: email.trim() })
      if (preset !== 'none') {
        for (const mod of MODULES) {
          await window.api.permissions.setLevel({ user_id: id, module_key: mod.key, submodule_key: null, level: preset })
        }
      }
      return id
    },
    onSuccess: (id) => onCreated(id),
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

        {/* Header modal */}
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
          {/* Nombre */}
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

          {/* Email */}
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

          {/* UUID */}
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

          {/* Permisos iniciales */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Permisos iniciales</label>
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
            <p className="text-xs text-slate-600">Podés ajustar módulo por módulo después de crear</p>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        {/* Footer modal */}
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
