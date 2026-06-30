import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  UserCircle2, Plus, Search, Star, Phone, Mail, Tag,
  Trash2, X, Check, ChevronDown, MessageCircle, Users, Pencil, Hash
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Contact, ContactType, ContactPhone, ContactEmail, AgendaGrupo } from '@shared/types'
import { CONTACT_TYPE_LABELS, CONTACT_TYPE_COLORS } from '@shared/types'
import {
  useContacts, useCreateContact, useUpdateContact, useDeleteContact,
  useAgendaGrupos, useContactGrupos, useAddGrupoMember, useRemoveGrupoMember
} from '../../hooks/useContacts'
import { cn } from '../../components/ui/utils'
import { useUndoableDelete } from '../../hooks/useUndoableDelete'

// ── Avatar ────────────────────────────────────────────────────────────────────

function ContactAvatar({ contact, size = 40 }: { contact: Contact; size?: number }) {
  const initials = contact.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
      style={{ width: size, height: size, background: contact.avatar_color, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  )
}

// ── Phone/Email editor row ────────────────────────────────────────────────────

const ETIQUETAS = ['personal', 'trabajo', 'otro'] as const

function PhoneRow({
  ph, onUpdate, onDelete
}: { ph: ContactPhone; onUpdate: (p: ContactPhone) => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={ph.etiqueta}
        onChange={e => onUpdate({ ...ph, etiqueta: e.target.value as ContactPhone['etiqueta'] })}
        className="bg-slate-700 border border-slate-600 text-slate-300 text-xs rounded px-1.5 py-1 w-24 flex-shrink-0"
      >
        {ETIQUETAS.map(e => <option key={e} value={e}>{e}</option>)}
      </select>
      <input
        type="tel"
        value={ph.numero}
        onChange={e => onUpdate({ ...ph, numero: e.target.value })}
        placeholder="+54 9 11 ..."
        className="flex-1 bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded px-2.5 py-1 min-w-0"
      />
      <button
        onClick={onDelete}
        className="p-1 text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
      >
        <X size={13} />
      </button>
    </div>
  )
}

function EmailRow({
  em, onUpdate, onDelete
}: { em: ContactEmail; onUpdate: (e: ContactEmail) => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={em.etiqueta}
        onChange={e => onUpdate({ ...em, etiqueta: e.target.value as ContactEmail['etiqueta'] })}
        className="bg-slate-700 border border-slate-600 text-slate-300 text-xs rounded px-1.5 py-1 w-24 flex-shrink-0"
      >
        {ETIQUETAS.map(e => <option key={e} value={e}>{e}</option>)}
      </select>
      <input
        type="email"
        value={em.direccion}
        onChange={e => onUpdate({ ...em, direccion: e.target.value })}
        placeholder="correo@ejemplo.com"
        className="flex-1 bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded px-2.5 py-1 min-w-0"
      />
      <button
        onClick={onDelete}
        className="p-1 text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
      >
        <X size={13} />
      </button>
    </div>
  )
}

// ── New Contact Modal ─────────────────────────────────────────────────────────

function NewContactModal({ onClose, onCreate }: { onClose: () => void; onCreate: (id: string) => void }) {
  const createContact = useCreateContact()
  const [name, setName] = useState('')
  const [type, setType] = useState<ContactType>('other')
  const [company, setCompany] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const contact = await createContact.mutateAsync({ name: name.trim(), type, company: company.trim() })
    onCreate(contact.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-sm p-5">
        <h2 className="text-slate-100 font-semibold text-sm mb-4">Nuevo contacto</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nombre *</label>
            <input
              ref={inputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm"
              placeholder="Nombre completo"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Tipo</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as ContactType)}
              className="w-full bg-slate-700 border border-slate-600 text-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              {(Object.keys(CONTACT_TYPE_LABELS) as ContactType[]).map(t => (
                <option key={t} value={t}>{CONTACT_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Empresa</label>
            <input
              value={company}
              onChange={e => setCompany(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm"
              placeholder="Empresa (opcional)"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={!name.trim() || createContact.isPending}
              className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-40">
              Crear
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Grupos picker (dropdown) ───────────────────────────────────────────────────

function GruposPicker({ contactId, grupos, contactGrupos }: {
  contactId: string
  grupos: AgendaGrupo[]
  contactGrupos: AgendaGrupo[]
}) {
  const [open, setOpen] = useState(false)
  const addMember    = useAddGrupoMember()
  const removeMember = useRemoveGrupoMember()
  const memberIds    = new Set(contactGrupos.map(g => g.id))
  const ref          = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function toggle(grupoId: string) {
    if (memberIds.has(grupoId)) {
      removeMember.mutate({ grupoId, contactId })
    } else {
      addMember.mutate({ grupoId, contactId })
    }
  }

  if (!grupos.length) return <span className="text-xs text-slate-500">Sin grupos creados</span>

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
      >
        <Plus size={12} /> Agregar a grupo
        <ChevronDown size={11} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-slate-800 border border-slate-600 rounded-lg shadow-lg py-1 min-w-44">
          {grupos.map(g => (
            <button
              key={g.id}
              onClick={() => toggle(g.id)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700/60 transition-colors"
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: g.color }} />
              <span className="flex-1 text-left truncate">{g.nombre}</span>
              {memberIds.has(g.id) && <Check size={12} className="text-blue-400 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tag input ─────────────────────────────────────────────────────────────────

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('')

  function add() {
    const val = input.trim().toLowerCase()
    if (val && !tags.includes(val)) onChange([...tags, val])
    setInput('')
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map(t => (
        <span key={t} className="inline-flex items-center gap-1 bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full">
          <Hash size={9} />
          {t}
          <button onClick={() => onChange(tags.filter(x => x !== t))} className="ml-0.5 hover:text-red-400 transition-colors">
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }}
        onBlur={add}
        placeholder="+ etiqueta"
        className="bg-transparent text-slate-400 text-xs placeholder-slate-600 outline-none w-20"
      />
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon size={13} className="text-slate-500" />
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
    </div>
  )
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({ contact, onDeleted }: { contact: Contact; onDeleted: () => void }) {
  const update      = useUpdateContact()
  const deleteC     = useDeleteContact()
  const { deleteWithUndo } = useUndoableDelete(
    (id: string) => deleteC.mutateAsync(id),
    { message: 'Contacto eliminado' }
  )
  const { data: grupos = [] }        = useAgendaGrupos()
  const { data: contactGrupos = [] } = useContactGrupos(contact.id)

  // Local editable state
  const [name,    setName]    = useState(contact.name)
  const [company, setCompany] = useState(contact.company)
  const [role,    setRole]    = useState(contact.role)
  const [notes,   setNotes]   = useState(contact.notes)
  const [type,    setType]    = useState(contact.type)
  const [phones,  setPhones]  = useState<ContactPhone[]>(contact.phones)
  const [emails,  setEmails]  = useState<ContactEmail[]>(contact.emails)
  const [tags,    setTags]    = useState<string[]>(contact.tags)
  const [favorito, setFavorito] = useState(contact.favorito === 1)

  // Reset when contact changes
  useEffect(() => {
    setName(contact.name)
    setCompany(contact.company)
    setRole(contact.role)
    setNotes(contact.notes)
    setType(contact.type)
    setPhones(contact.phones)
    setEmails(contact.emails)
    setTags(contact.tags)
    setFavorito(contact.favorito === 1)
  }, [contact.id])

  function save(patch: Partial<Contact>) {
    update.mutate({ id: contact.id, data: patch })
  }

  function handleDelete() {
    onDeleted()
    deleteWithUndo(contact.id)
  }

  const firstPhone = phones[0]?.numero
  const waUrl = firstPhone
    ? `https://wa.me/${firstPhone.replace(/\D/g, '')}`
    : null

  const typeColor = CONTACT_TYPE_COLORS[type] ?? '#64748b'
  const initials  = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="p-6 pb-4 border-b border-slate-700/60">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
            style={{ background: contact.avatar_color }}
          >
            {initials}
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={() => name.trim() && name !== contact.name && save({ name: name.trim() })}
              className="bg-transparent text-slate-100 font-semibold text-lg w-full outline-none border-b border-transparent hover:border-slate-600 focus:border-blue-500 transition-colors truncate"
            />
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <input
                value={company}
                onChange={e => setCompany(e.target.value)}
                onBlur={() => company !== contact.company && save({ company: company.trim() })}
                placeholder="Empresa"
                className="bg-transparent text-slate-400 text-sm outline-none border-b border-transparent hover:border-slate-600 focus:border-blue-500 transition-colors"
              />
              {company && (
                <>
                  <span className="text-slate-600 text-xs">·</span>
                  <input
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    onBlur={() => role !== contact.role && save({ role: role.trim() })}
                    placeholder="Cargo"
                    className="bg-transparent text-slate-400 text-sm outline-none border-b border-transparent hover:border-slate-600 focus:border-blue-500 transition-colors"
                  />
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => { setFavorito(f => !f); save({ favorito: favorito ? 0 : 1 }) }}
              className={cn('p-1.5 rounded-lg transition-colors', favorito ? 'text-yellow-400' : 'text-slate-500 hover:text-slate-300')}
              title={favorito ? 'Quitar favorito' : 'Marcar favorito'}
            >
              <Star size={16} fill={favorito ? 'currentColor' : 'none'} />
            </button>
            {waUrl && (
              <a href={waUrl} target="_blank" rel="noreferrer"
                className="p-1.5 rounded-lg text-green-500 hover:text-green-400 hover:bg-green-400/10 transition-colors"
                title="Abrir WhatsApp"
              >
                <MessageCircle size={16} />
              </a>
            )}
            <button onClick={handleDelete}
              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
              title="Eliminar contacto"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Type selector */}
        <div className="mt-3 flex items-center gap-2">
          <select
            value={type}
            onChange={e => { const t = e.target.value as ContactType; setType(t); save({ type: t }) }}
            className="text-xs px-2 py-0.5 rounded-full border font-medium transition-colors"
            style={{ background: `${typeColor}22`, color: typeColor, borderColor: `${typeColor}55` }}
          >
            {(Object.keys(CONTACT_TYPE_LABELS) as ContactType[]).map(t => (
              <option key={t} value={t}>{CONTACT_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-5 space-y-6">
        {/* Telefonos */}
        <div>
          <SectionLabel icon={Phone} label="Teléfonos" />
          <div className="space-y-2">
            {phones.map((ph, i) => (
              <PhoneRow
                key={i}
                ph={ph}
                onUpdate={p => {
                  const next = phones.map((x, j) => j === i ? p : x)
                  setPhones(next)
                  save({ phones: next })
                }}
                onDelete={() => {
                  const next = phones.filter((_, j) => j !== i)
                  setPhones(next)
                  save({ phones: next })
                }}
              />
            ))}
            <button
              onClick={() => {
                const next = [...phones, { numero: '', etiqueta: 'personal' as const }]
                setPhones(next)
              }}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Plus size={12} /> Agregar teléfono
            </button>
          </div>
        </div>

        {/* Emails */}
        <div>
          <SectionLabel icon={Mail} label="Correos" />
          <div className="space-y-2">
            {emails.map((em, i) => (
              <EmailRow
                key={i}
                em={em}
                onUpdate={e => {
                  const next = emails.map((x, j) => j === i ? e : x)
                  setEmails(next)
                  save({ emails: next })
                }}
                onDelete={() => {
                  const next = emails.filter((_, j) => j !== i)
                  setEmails(next)
                  save({ emails: next })
                }}
              />
            ))}
            <button
              onClick={() => {
                const next = [...emails, { direccion: '', etiqueta: 'personal' as const }]
                setEmails(next)
              }}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Plus size={12} /> Agregar correo
            </button>
          </div>
        </div>

        {/* Grupos */}
        <div>
          <SectionLabel icon={Users} label="Grupos" />
          <div className="flex flex-wrap gap-1.5 mb-2">
            {contactGrupos.map(g => (
              <span
                key={g.id}
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium"
                style={{ background: `${g.color}22`, color: g.color, borderColor: `${g.color}44` }}
              >
                {g.nombre}
              </span>
            ))}
          </div>
          <GruposPicker contactId={contact.id} grupos={grupos} contactGrupos={contactGrupos} />
        </div>

        {/* Etiquetas */}
        <div>
          <SectionLabel icon={Tag} label="Etiquetas" />
          <TagInput
            tags={tags}
            onChange={t => { setTags(t); save({ tags: t }) }}
          />
        </div>

        {/* Notas */}
        <div>
          <SectionLabel icon={Pencil} label="Notas" />
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={() => notes !== contact.notes && save({ notes: notes.trim() })}
            placeholder="Agregar notas..."
            rows={4}
            className="w-full bg-slate-700/40 border border-slate-600/50 text-slate-300 text-sm rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-slate-500 placeholder-slate-600"
          />
        </div>
      </div>
    </div>
  )
}

// ── Left List ─────────────────────────────────────────────────────────────────

const TYPE_FILTERS: Array<{ key: ContactType | 'all' | 'fav'; label: string }> = [
  { key: 'all',          label: 'Todos' },
  { key: 'fav',          label: 'Favoritos' },
  { key: 'client',       label: 'Clientes' },
  { key: 'provider',     label: 'Proveedores' },
  { key: 'collaborator', label: 'Colaboradores' },
  { key: 'family',       label: 'Familiares' },
  { key: 'friend',       label: 'Amigos' },
  { key: 'other',        label: 'Otros' },
]

// ── Main Page ─────────────────────────────────────────────────────────────────

const SPLIT_KEY     = 'agenda-contacts-split'
const SPLIT_DEFAULT = 280
const SPLIT_MIN     = 200
const SPLIT_MAX     = 480

export default function AgendaContactos() {
  const { data: contacts = [], isLoading } = useContacts()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search,     setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState<ContactType | 'all' | 'fav'>('all')
  const [showModal,  setShowModal]  = useState(false)

  const [leftWidth, setLeftWidth] = useState<number>(() => {
    const saved = localStorage.getItem(SPLIT_KEY)
    return saved ? Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, parseInt(saved, 10))) : SPLIT_DEFAULT
  })
  const containerRef  = useRef<HTMLDivElement>(null)
  const isResizing    = useRef(false)

  function startResize(e: React.MouseEvent) {
    e.preventDefault()
    isResizing.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    function onMove(ev: MouseEvent) {
      if (!isResizing.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const next = Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, ev.clientX - rect.left))
      setLeftWidth(next)
      localStorage.setItem(SPLIT_KEY, String(Math.round(next)))
    }
    function onUp() {
      isResizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const filtered = useMemo(() => {
    let list = contacts
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.role?.toLowerCase().includes(q) ||
        c.phones.some(p => p.numero.includes(q)) ||
        c.emails.some(e => e.direccion.toLowerCase().includes(q)) ||
        c.tags.some(t => t.includes(q))
      )
    }
    if (typeFilter === 'fav') {
      list = list.filter(c => c.favorito === 1)
    } else if (typeFilter !== 'all') {
      list = list.filter(c => c.type === typeFilter)
    }
    return list
  }, [contacts, search, typeFilter])

  // Agrupar por primera letra
  const grouped = useMemo(() => {
    const map = new Map<string, Contact[]>()
    for (const c of filtered) {
      const letter = c.name[0]?.toUpperCase() ?? '#'
      if (!map.has(letter)) map.set(letter, [])
      map.get(letter)!.push(c)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const selectedContact = contacts.find(c => c.id === selectedId) ?? null

  return (
    <div ref={containerRef} className="flex h-full bg-slate-900 overflow-hidden">
      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-shrink-0" style={{ width: leftWidth }}>
        {/* Header */}
        <div className="p-3 border-b border-slate-700 space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-slate-100 font-semibold text-sm">Contactos</h1>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded-lg font-medium transition-colors"
            >
              <Plus size={12} /> Nuevo
            </button>
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full bg-slate-700/60 border border-slate-600/50 text-slate-300 text-xs rounded-lg pl-7 pr-3 py-1.5 placeholder-slate-500"
            />
          </div>
        </div>

        {/* Filter strip */}
        <div className="flex flex-wrap gap-1 px-2 py-2 border-b border-slate-700/50">
          {TYPE_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              className={cn(
                'text-xs px-2 py-0.5 rounded-full transition-colors',
                typeFilter === f.key
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                  : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center h-full text-slate-500 text-xs">Cargando...</div>
          )}
          {!isLoading && grouped.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
              <UserCircle2 size={32} />
              <p className="text-xs">Sin contactos</p>
            </div>
          )}
          {grouped.map(([letter, group]) => (
            <div key={letter}>
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600 bg-slate-800/40 sticky top-0">
                {letter}
              </div>
              {group.map(c => {
                const typeColor = CONTACT_TYPE_COLORS[c.type] ?? '#64748b'
                const firstPhone = c.phones[0]?.numero
                const isActive = c.id === selectedId
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors border-b border-slate-700/30',
                      isActive ? 'bg-blue-600/15 border-l-2 border-l-blue-500' : 'hover:bg-slate-700/40'
                    )}
                  >
                    <ContactAvatar contact={c} size={34} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-slate-200 truncate">{c.name}</span>
                        {c.favorito === 1 && <Star size={9} fill="currentColor" className="text-yellow-400 flex-shrink-0" />}
                      </div>
                      {c.company && (
                        <div className="text-xs text-slate-500 truncate">{c.company}</div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {firstPhone && <MessageCircle size={11} className="text-green-500" />}
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full border font-medium"
                        style={{ color: typeColor, borderColor: `${typeColor}44`, background: `${typeColor}22` }}
                      >
                        {CONTACT_TYPE_LABELS[c.type]}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer count */}
        <div className="px-3 py-1.5 border-t border-slate-700 text-[10px] text-slate-600">
          {filtered.length} de {contacts.length} contactos
        </div>
      </div>

      {/* ── Resize handle ──────────────────────────────────────────────────── */}
      <div
        className="w-1 flex-shrink-0 bg-slate-700 hover:bg-blue-500 active:bg-blue-400 cursor-col-resize transition-colors relative group"
        onMouseDown={startResize}
      >
        {/* Wider invisible hit area */}
        <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
      </div>

      {/* ── Right panel ────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {selectedContact ? (
          <DetailPanel
            key={selectedContact.id}
            contact={selectedContact}
            onDeleted={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-600">
            <UserCircle2 size={48} strokeWidth={1} />
            <div className="text-center">
              <p className="text-sm font-medium">Seleccioná un contacto</p>
              <p className="text-xs mt-1">o creá uno nuevo con el botón Nuevo</p>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <NewContactModal
          onClose={() => setShowModal(false)}
          onCreate={id => { setShowModal(false); setSelectedId(id) }}
        />
      )}
    </div>
  )
}
