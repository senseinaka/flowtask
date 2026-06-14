import { useState, useEffect } from 'react'
import { Truck, Plus, X, Trash2, Check, Mail, Phone, MessageCircle, Edit2, UserPlus, User, Upload } from 'lucide-react'
import {
  useComexFreightOperators,
  useCreateComexFreightOperator,
  useUpdateComexFreightOperator,
  useDeleteComexFreightOperator,
  useUploadOperatorLogo,
  useDeleteOperatorLogo,
  useComexOperatorContacts,
  useCreateComexOperatorContact,
  useUpdateComexOperatorContact,
  useDeleteComexOperatorContact
} from '../../hooks/useComex'
import type {
  ComexFreightOperator, ComexFreightOperatorContact,
  CreateComexFreightOperatorInput, FreightCompanyType
} from '@shared/types'
import { FREIGHT_COMPANY_TYPE_LABELS } from '@shared/types'

const TYPE_OPTIONS = Object.entries(FREIGHT_COMPANY_TYPE_LABELS) as [FreightCompanyType, string][]

const EMPTY: CreateComexFreightOperatorInput = {
  name: '', company_type: 'agente', contact_name: '',
  email: '', phone: '', whatsapp: '', services: '', notes: ''
}

// ── Form modal ────────────────────────────────────────────────────────────────

function OperatorFormModal({
  initial, onSave, onClose
}: {
  initial?: Partial<CreateComexFreightOperatorInput>
  onSave: (d: CreateComexFreightOperatorInput) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<CreateComexFreightOperatorInput>({ ...EMPTY, ...initial })
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof CreateComexFreightOperatorInput>(k: K, v: CreateComexFreightOperatorInput[K]) =>
    setForm((p) => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="font-semibold text-white">{initial ? 'Editar operador' : 'Nuevo operador logístico'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Nombre *</label>
              <input autoFocus value={form.name} onChange={(e) => set('name', e.target.value)}
                placeholder="Maersk Argentina, DHL Express..."
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tipo</label>
              <select value={form.company_type} onChange={(e) => set('company_type', e.target.value as FreightCompanyType)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-cyan-500">
                {TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Contacto principal</label>
              <input value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)}
                placeholder="Juan López"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                placeholder="cotizaciones@operador.com"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Teléfono / WhatsApp</label>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)}
                placeholder="+54 11..."
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Servicios ofrecidos</label>
              <input value={form.services} onChange={(e) => set('services', e.target.value)}
                placeholder="LCL, FCL, aéreo, despacho aduanero..."
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Notas</label>
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={5}
                placeholder="Trabajan bien con carga de China. Precios competitivos en LCL..."
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 resize-none" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors">Cancelar</button>
            <button type="submit" disabled={saving || !form.name.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 transition-colors">
              {saving ? 'Guardando...' : initial ? 'Guardar cambios' : 'Crear operador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Contact row ───────────────────────────────────────────────────────────────

function ContactRow({
  contact, operatorId
}: {
  contact: ComexFreightOperatorContact
  operatorId: string
}) {
  const update = useUpdateComexOperatorContact()
  const del = useDeleteComexOperatorContact()
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [form, setForm] = useState({
    name: contact.name, nickname: contact.nickname,
    role: contact.role, phone: contact.phone, email: contact.email
  })
  const [saving, setSaving] = useState(false)

  const setField = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || saving) return
    setSaving(true)
    try {
      await update.mutateAsync({ id: contact.id, operatorId, data: form })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setForm({ name: contact.name, nickname: contact.nickname, role: contact.role, phone: contact.phone, email: contact.email })
    setEditing(false)
  }

  if (editing) {
    return (
      <form
        onSubmit={handleSave}
        className="bg-slate-900/60 rounded-lg p-2.5 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-2 gap-2">
          <input
            autoFocus
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
            placeholder="Nombre completo *"
            className="bg-slate-800 border border-slate-600 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 placeholder-slate-500"
          />
          <input
            value={form.nickname}
            onChange={(e) => setField('nickname', e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
            placeholder="Nick / nombre corto"
            className="bg-slate-800 border border-slate-600 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 placeholder-slate-500"
          />
          <input
            value={form.role}
            onChange={(e) => setField('role', e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
            placeholder="Cargo / función"
            className="bg-slate-800 border border-slate-600 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 placeholder-slate-500"
          />
          <input
            value={form.phone}
            onChange={(e) => setField('phone', e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
            placeholder="WhatsApp"
            className="bg-slate-800 border border-slate-600 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 placeholder-slate-500"
          />
          <div className="col-span-2">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
              placeholder="Email"
              className="w-full bg-slate-800 border border-slate-600 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 placeholder-slate-500"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="px-2.5 py-1 rounded text-xs text-slate-400 hover:bg-slate-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !form.name.trim()}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 transition-colors"
          >
            <Check size={11} />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex items-start gap-2 group">
      <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
        <User size={11} className="text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-white font-medium">{contact.name}</span>
          {contact.nickname && (
            <span className="text-[10px] text-slate-400 italic">"{contact.nickname}"</span>
          )}
          {contact.role && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-900/40 text-cyan-400 font-medium">
              {contact.role}
            </span>
          )}
        </div>
        <div className="mt-0.5 space-y-0.5">
          {contact.phone && (
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <MessageCircle size={10} className="text-emerald-500 flex-shrink-0" />
              <span>{contact.phone}</span>
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <Mail size={10} className="flex-shrink-0" />
              <a
                href={`mailto:${contact.email}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:text-cyan-400 transition-colors truncate"
              >
                {contact.email}
              </a>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {confirm ? (
          <>
            <button
              onClick={() => del.mutate({ id: contact.id, operatorId })}
              className="p-1 rounded bg-red-600 hover:bg-red-500 text-white transition-colors"
            >
              <Check size={11} />
            </button>
            <button
              onClick={() => setConfirm(false)}
              className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
            >
              <X size={11} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setEditing(true)}
              className="p-1 rounded text-slate-600 hover:text-cyan-400 hover:bg-slate-700 transition-colors"
            >
              <Edit2 size={11} />
            </button>
            <button
              onClick={() => setConfirm(true)}
              className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-slate-700 transition-colors"
            >
              <Trash2 size={11} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Contacts section ──────────────────────────────────────────────────────────

const EMPTY_CONTACT = { name: '', nickname: '', role: '', phone: '', email: '' }

function OperatorContactsSection({ operatorId }: { operatorId: string }) {
  const { data: contacts = [] } = useComexOperatorContacts(operatorId)
  const create = useCreateComexOperatorContact()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_CONTACT)
  const [saving, setSaving] = useState(false)

  const setField = (k: keyof typeof EMPTY_CONTACT, v: string) =>
    setForm((p) => ({ ...p, [k]: v }))

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || saving) return
    setSaving(true)
    try {
      await create.mutateAsync({
        operator_id: operatorId,
        name: form.name.trim(),
        nickname: form.nickname.trim(),
        role: form.role.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        sort_order: contacts.length
      })
      setForm(EMPTY_CONTACT)
      setShowAdd(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-700/50">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider">
          Contactos {contacts.length > 0 && `(${contacts.length})`}
        </p>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-slate-500 hover:text-cyan-400 hover:bg-slate-700 transition-colors"
          >
            <UserPlus size={11} />
            Agregar
          </button>
        )}
      </div>

      {contacts.length > 0 && (
        <div className="space-y-2.5">
          {contacts.map((c) => (
            <ContactRow key={c.id} contact={c} operatorId={operatorId} />
          ))}
        </div>
      )}

      {contacts.length === 0 && !showAdd && (
        <p className="text-[11px] text-slate-600 italic">Sin contactos cargados.</p>
      )}

      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="mt-2 bg-slate-900/60 rounded-lg p-2.5 space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-2 gap-2">
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setShowAdd(false); setForm(EMPTY_CONTACT) } }}
              placeholder="Nombre completo *"
              className="bg-slate-800 border border-slate-600 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 placeholder-slate-500"
            />
            <input
              value={form.nickname}
              onChange={(e) => setField('nickname', e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setShowAdd(false); setForm(EMPTY_CONTACT) } }}
              placeholder="Nick / nombre corto"
              className="bg-slate-800 border border-slate-600 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 placeholder-slate-500"
            />
            <input
              value={form.role}
              onChange={(e) => setField('role', e.target.value)}
              placeholder="Cargo / función"
              className="bg-slate-800 border border-slate-600 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 placeholder-slate-500"
            />
            <input
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              placeholder="WhatsApp"
              className="bg-slate-800 border border-slate-600 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 placeholder-slate-500"
            />
            <div className="col-span-2">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="Email"
                className="w-full bg-slate-800 border border-slate-600 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 placeholder-slate-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowAdd(false); setForm(EMPTY_CONTACT) }}
              className="px-2.5 py-1 rounded text-xs text-slate-400 hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 transition-colors"
            >
              <Plus size={11} />
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ── Logo Badge ────────────────────────────────────────────────────────────────

function LogoBadge({
  storedName,
  logoData,
  onUpload,
  onRemove,
  uploading,
  PlaceholderIcon,
  size = 44
}: {
  storedName: string | null
  logoData?: string | null
  onUpload: (e: React.MouseEvent) => void
  onRemove: (e: React.MouseEvent) => void
  uploading: boolean
  PlaceholderIcon: React.ElementType
  size?: number
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    if (!storedName && !logoData) { setDataUrl(null); return }
    window.api.comex.logo.getDataUrl(storedName, logoData).then(setDataUrl)
  }, [storedName, logoData])

  const handleMouseLeave = () => { if (confirmRemove) setConfirmRemove(false) }

  const dim = `${size}px`

  return (
    <div
      className="relative group/logo flex-shrink-0"
      style={{ width: dim, height: dim }}
      onClick={!dataUrl && !uploading ? onUpload : undefined}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={`w-full h-full rounded-lg overflow-hidden flex items-center justify-center
          ${dataUrl
            ? 'border border-slate-600 bg-slate-900/80'
            : 'border border-dashed border-slate-600 bg-slate-700/30 cursor-pointer hover:border-cyan-600 transition-colors'
          }`}
      >
        {uploading ? (
          <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        ) : dataUrl ? (
          <img src={dataUrl} alt="logo" className="w-full h-full object-contain p-1.5" />
        ) : (
          <div className="flex flex-col items-center gap-0.5 opacity-40">
            <PlaceholderIcon size={16} />
            <Upload size={9} />
          </div>
        )}
      </div>

      {/* Overlay con acciones — visible al hover cuando hay logo */}
      {(dataUrl || uploading) && (
        <div className="absolute inset-0 rounded-lg bg-black/65 opacity-0 group-hover/logo:opacity-100 transition-opacity flex items-center justify-center gap-1">
          {confirmRemove ? (
            <div className="flex flex-col items-center gap-1 px-1" onClick={(e) => e.stopPropagation()}>
              <span className="text-[9px] text-white font-medium leading-tight text-center">¿Eliminar?</span>
              <div className="flex gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(e) }}
                  className="px-1.5 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[9px] font-medium transition-colors"
                >
                  Sí
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmRemove(false) }}
                  className="px-1.5 py-0.5 rounded bg-slate-600 hover:bg-slate-500 text-white text-[9px] font-medium transition-colors"
                >
                  No
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={onUpload}
                className="p-1 rounded bg-slate-700/80 hover:bg-cyan-700 text-white transition-colors"
                title="Cambiar logo"
              >
                <Upload size={11} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmRemove(true) }}
                className="p-1 rounded bg-slate-700/80 hover:bg-red-600 text-white transition-colors"
                title="Quitar logo"
              >
                <X size={11} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Type badge ────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: FreightCompanyType }) {
  const colors: Record<FreightCompanyType, string> = {
    agente:  'bg-blue-400/10 text-blue-400',
    naviera: 'bg-violet-400/10 text-violet-400',
    courier: 'bg-amber-400/10 text-amber-400',
    aereo:   'bg-sky-400/10 text-sky-400',
    otro:    'bg-slate-400/10 text-slate-400'
  }
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${colors[type]}`}>
      {FREIGHT_COMPANY_TYPE_LABELS[type]}
    </span>
  )
}

// ── Operator Card ─────────────────────────────────────────────────────────────

function OperatorCard({ op }: { op: ComexFreightOperator }) {
  const update = useUpdateComexFreightOperator()
  const del = useDeleteComexFreightOperator()
  const uploadLogo = useUploadOperatorLogo()
  const deleteLogo = useDeleteOperatorLogo()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleSave = async (data: CreateComexFreightOperatorInput) => {
    await update.mutateAsync({ id: op.id, data })
    setEditing(false)
  }

  const handleUploadLogo = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const filePath = await window.api.comex.logo.selectFile()
    if (!filePath) return
    uploadLogo.mutate({ id: op.id, filePath })
  }

  const handleDeleteLogo = (e: React.MouseEvent) => {
    e.stopPropagation()
    deleteLogo.mutate(op.id)
  }

  return (
    <>
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <LogoBadge
            storedName={op.logo_stored_name}
            logoData={op.logo_data}
            onUpload={handleUploadLogo}
            onRemove={handleDeleteLogo}
            uploading={uploadLogo.isPending}
            PlaceholderIcon={Truck}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{op.name}</p>
            <div className="mt-1">
              <TypeBadge type={op.company_type} />
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setEditing(true)} className="p-1.5 rounded text-slate-500 hover:text-cyan-400 hover:bg-slate-700 transition-colors">
              <Edit2 size={13} />
            </button>
            {confirmDelete ? (
              <>
                <button onClick={() => del.mutate(op.id)} className="p-1.5 rounded bg-red-600 hover:bg-red-500 text-white"><Check size={13} /></button>
                <button onClick={() => setConfirmDelete(false)} className="p-1.5 rounded bg-slate-700 text-slate-400"><X size={13} /></button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Datos principales del operador */}
        <div className="mt-2 space-y-1">
          {op.contact_name && <p className="text-xs text-slate-400">{op.contact_name}</p>}
          {op.email && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Mail size={11} />
              <a href={`mailto:${op.email}`} className="hover:text-cyan-400 transition-colors truncate">{op.email}</a>
            </div>
          )}
          {op.phone && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Phone size={11} />
              <span>{op.phone}</span>
            </div>
          )}
          {op.whatsapp && op.whatsapp !== op.phone && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <MessageCircle size={11} />
              <span>{op.whatsapp}</span>
            </div>
          )}
        </div>

        {op.services && (
          <div className="mt-3 pt-3 border-t border-slate-700/50">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Servicios</p>
            <p className="text-xs text-slate-400">{op.services}</p>
          </div>
        )}
        {op.notes && <p className="text-xs text-slate-500 mt-2 line-clamp-2">{op.notes}</p>}

        {/* Sección de contactos múltiples */}
        <OperatorContactsSection operatorId={op.id} />
      </div>

      {editing && (
        <OperatorFormModal initial={op} onSave={handleSave} onClose={() => setEditing(false)} />
      )}
    </>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function ComexOperators() {
  const { data: operators = [], isLoading } = useComexFreightOperators()
  const create = useCreateComexFreightOperator()
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = operators.filter((o) => {
    if (!search) return true
    const q = search.toLowerCase()
    return o.name.toLowerCase().includes(q) || o.contact_name.toLowerCase().includes(q) || o.services.toLowerCase().includes(q)
  })

  const handleCreate = async (data: CreateComexFreightOperatorInput) => {
    await create.mutateAsync(data)
    setShowCreate(false)
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck size={22} className="text-cyan-400" />
          <div>
            <h1 className="text-lg font-bold text-white">Operadores logísticos</h1>
            <p className="text-xs text-slate-400">Agentes de carga, navieras y couriers</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors">
          <Plus size={16} /> Nuevo operador
        </button>
      </div>

      <div className="relative max-w-sm">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar operadores..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500" />
        <Truck size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
            <X size={12} />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Truck size={40} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">{search ? 'Sin resultados' : 'Sin operadores aún'}</p>
          {!search && (
            <p className="text-slate-500 text-sm mt-1">
              Hacé clic en{' '}
              <button onClick={() => setShowCreate(true)} className="text-cyan-400 hover:underline">Nuevo operador</button>
              {' '}para agregar el primero.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((op) => <OperatorCard key={op.id} op={op} />)}
        </div>
      )}

      {showCreate && <OperatorFormModal onSave={handleCreate} onClose={() => setShowCreate(false)} />}
    </div>
  )
}
