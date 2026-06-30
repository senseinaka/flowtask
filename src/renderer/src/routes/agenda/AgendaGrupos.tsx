import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Users, Plus, Pencil, Trash2, X, Check, Search } from 'lucide-react'
import type { AgendaGrupo, Contact } from '@shared/types'
import {
  useAgendaGrupos, useCreateGrupo, useUpdateGrupo, useDeleteGrupo,
  useGrupoMembers, useAddGrupoMember, useRemoveGrupoMember, useContacts
} from '../../hooks/useContacts'
import { cn } from '../../components/ui/utils'
import { useConfirm } from '../../store/confirm.store'

// ── Color picker ──────────────────────────────────────────────────────────────

const GRUPO_COLORS = [
  '#6366f1', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f97316', '#64748b'
]

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {GRUPO_COLORS.map(c => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className="w-6 h-6 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
          style={{ background: c }}
        >
          {value === c && <Check size={11} className="text-white" />}
        </button>
      ))}
    </div>
  )
}

// ── New/Edit Grupo Modal ───────────────────────────────────────────────────────

function GrupoModal({
  grupo,
  onClose
}: { grupo?: AgendaGrupo; onClose: () => void }) {
  const createGrupo = useCreateGrupo()
  const updateGrupo = useUpdateGrupo()
  const [nombre,      setNombre]      = useState(grupo?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(grupo?.descripcion ?? '')
  const [color,       setColor]       = useState(grupo?.color ?? '#6366f1')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    if (grupo) {
      await updateGrupo.mutateAsync({ id: grupo.id, data: { nombre: nombre.trim(), descripcion: descripcion.trim(), color } })
    } else {
      await createGrupo.mutateAsync({ nombre: nombre.trim(), descripcion: descripcion.trim(), color })
    }
    onClose()
  }

  const isPending = createGrupo.isPending || updateGrupo.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-sm p-5">
        <h2 className="text-slate-100 font-semibold text-sm mb-4">
          {grupo ? 'Editar grupo' : 'Nuevo grupo'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nombre *</label>
            <input
              ref={inputRef}
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm"
              placeholder="Nombre del grupo"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Descripción</label>
            <input
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm"
              placeholder="Descripción opcional"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-2">Color</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={!nombre.trim() || isPending}
              className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-40">
              {grupo ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Contact Avatar small ──────────────────────────────────────────────────────

function MiniAvatar({ contact }: { contact: Contact }) {
  const initials = contact.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
      style={{ background: contact.avatar_color }}
    >
      {initials}
    </div>
  )
}

// ── Add members dropdown ──────────────────────────────────────────────────────

function AddMemberPanel({ grupoId, members }: { grupoId: string; members: Contact[] }) {
  const { data: todos = [] } = useContacts()
  const addMember = useAddGrupoMember()
  const [search, setSearch] = useState('')

  const memberIds = new Set(members.map(m => m.id))
  const candidates = useMemo(() =>
    todos.filter(c =>
      !memberIds.has(c.id) &&
      (search === '' || c.name.toLowerCase().includes(search.toLowerCase()) || c.company?.toLowerCase().includes(search.toLowerCase()))
    ), [todos, memberIds, search])

  if (!candidates.length && !search) return null

  return (
    <div className="mt-4 pt-4 border-t border-slate-700">
      <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Agregar miembro</p>
      <div className="relative mb-2">
        <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar contacto..."
          className="w-full bg-slate-700/60 border border-slate-600/50 text-slate-300 text-xs rounded-lg pl-7 pr-3 py-1.5"
        />
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {candidates.slice(0, 20).map(c => (
          <button
            key={c.id}
            onClick={() => addMember.mutate({ grupoId, contactId: c.id })}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-slate-700/60 transition-colors"
          >
            <MiniAvatar contact={c} />
            <div className="flex-1 min-w-0">
              <span className="text-sm text-slate-300 truncate block">{c.name}</span>
              {c.company && <span className="text-xs text-slate-500 truncate block">{c.company}</span>}
            </div>
            <Plus size={13} className="text-blue-400 flex-shrink-0" />
          </button>
        ))}
        {candidates.length === 0 && search && (
          <p className="text-xs text-slate-600 px-2">Sin resultados</p>
        )}
      </div>
    </div>
  )
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function GrupoDetail({ grupo, onDeleted, onEdit }: {
  grupo: AgendaGrupo
  onDeleted: () => void
  onEdit: () => void
}) {
  const deleteGrupo   = useDeleteGrupo()
  const removeMember  = useRemoveGrupoMember()
  const { data: members = [], isLoading } = useGrupoMembers(grupo.id)
  const confirm = useConfirm()

  async function handleDelete() {
    if (!await confirm({ message: `¿Eliminar el grupo "${grupo.nombre}"? Los contactos no se eliminarán.`, danger: true })) return
    deleteGrupo.mutate(grupo.id)
    onDeleted()
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6 pb-5 border-b border-slate-700">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: `${grupo.color}33`, border: `2px solid ${grupo.color}` }}
        >
          <Users size={22} style={{ color: grupo.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-slate-100 font-semibold text-lg truncate">{grupo.nombre}</h2>
          {grupo.descripcion && (
            <p className="text-slate-400 text-sm mt-0.5">{grupo.descripcion}</p>
          )}
          <p className="text-slate-500 text-xs mt-1">{grupo.member_count ?? members.length} miembro(s)</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onEdit}
            className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors">
            <Pencil size={14} />
          </button>
          <button onClick={handleDelete}
            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Members */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Miembros</p>
        {isLoading ? (
          <p className="text-xs text-slate-600">Cargando...</p>
        ) : members.length === 0 ? (
          <p className="text-xs text-slate-600">Sin miembros aún</p>
        ) : (
          <div className="space-y-2">
            {members.map(m => {
              const firstPhone = m.phones[0]?.numero
              return (
                <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/40 group transition-colors">
                  <MiniAvatar contact={m} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 font-medium truncate">{m.name}</p>
                    {m.company && <p className="text-xs text-slate-500 truncate">{m.company}</p>}
                    {firstPhone && <p className="text-xs text-slate-600 truncate">{firstPhone}</p>}
                  </div>
                  <button
                    onClick={() => removeMember.mutate({ grupoId: grupo.id, contactId: m.id })}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-all"
                    title="Quitar del grupo"
                  >
                    <X size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <AddMemberPanel grupoId={grupo.id} members={members} />
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AgendaGrupos() {
  const { data: grupos = [], isLoading } = useAgendaGrupos()
  const [selectedId,  setSelectedId]  = useState<string | null>(null)
  const [showModal,   setShowModal]   = useState(false)
  const [editingGrupo, setEditingGrupo] = useState<AgendaGrupo | null>(null)

  const selected = grupos.find(g => g.id === selectedId) ?? null

  return (
    <div className="flex h-full bg-slate-900 overflow-hidden">
      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col border-r border-slate-700" style={{ width: 260 }}>
        {/* Header */}
        <div className="p-3 border-b border-slate-700 flex items-center justify-between">
          <h1 className="text-slate-100 font-semibold text-sm">Grupos</h1>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded-lg font-medium transition-colors"
          >
            <Plus size={12} /> Nuevo
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading && (
            <p className="text-xs text-slate-500 px-2 py-3">Cargando...</p>
          )}
          {!isLoading && grupos.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600 py-8">
              <Users size={32} strokeWidth={1} />
              <p className="text-xs">Sin grupos creados</p>
            </div>
          )}
          {grupos.map(g => (
            <button
              key={g.id}
              onClick={() => setSelectedId(g.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                selectedId === g.id ? 'bg-blue-600/15 border border-blue-500/30' : 'hover:bg-slate-700/40 border border-transparent'
              )}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: `${g.color}33` }}
              >
                <Users size={14} style={{ color: g.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{g.nombre}</p>
                <p className="text-xs text-slate-500">{g.member_count ?? 0} miembro(s)</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Right panel ────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {selected ? (
          <GrupoDetail
            key={selected.id}
            grupo={selected}
            onDeleted={() => setSelectedId(null)}
            onEdit={() => setEditingGrupo(selected)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-600">
            <Users size={48} strokeWidth={1} />
            <div className="text-center">
              <p className="text-sm font-medium">Seleccioná un grupo</p>
              <p className="text-xs mt-1">o creá uno nuevo con el botón Nuevo</p>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showModal && (
        <GrupoModal onClose={() => setShowModal(false)} />
      )}
      {editingGrupo && (
        <GrupoModal grupo={editingGrupo} onClose={() => setEditingGrupo(null)} />
      )}
    </div>
  )
}
