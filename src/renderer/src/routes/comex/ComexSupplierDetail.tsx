import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Building2, MapPin, CreditCard, Users,
  Plus, Trash2, X, Check, Mail, Phone, MessageCircle,
  Package, Anchor, Clock, Edit2, BarChart3
} from 'lucide-react'
import {
  useComexSupplier, useUpdateComexSupplier,
  useComexSupplierContacts, useCreateComexSupplierContact,
  useUpdateComexSupplierContact, useDeleteComexSupplierContact,
  useComexSupplierBanks, useCreateComexSupplierBank,
  useUpdateComexSupplierBank, useDeleteComexSupplierBank
} from '../../hooks/useComex'
import type {
  ComexSupplier, ComexSupplierContact, ComexSupplierBankAccount,
  ContactRole,
  CreateComexSupplierContactInput, CreateComexSupplierBankAccountInput
} from '@shared/types'
import { CONTACT_ROLE_LABELS, CONTACT_ROLE_COLORS } from '@shared/types'

// ── Inline edit primitives ────────────────────────────────────────────────────

function EText({
  label, value, onSave, placeholder = '—', multiline = false, mono = false
}: {
  label?: string; value: string; onSave: (v: string) => void
  placeholder?: string; multiline?: boolean; mono?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const start = () => { setDraft(value); setEditing(true) }
  const commit = () => { if (draft !== value) onSave(draft); setEditing(false) }
  const cancel = () => setEditing(false)

  const cls = `w-full bg-slate-900 border border-cyan-500 rounded px-2 py-1 text-sm text-white focus:outline-none ${mono ? 'font-mono' : ''}`

  if (editing) {
    if (multiline) return (
      <div className="space-y-1">
        {label && <span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>}
        <textarea
          autoFocus rows={6} value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') cancel() }}
          onBlur={commit}
          className={cls + ' resize-none'}
        />
      </div>
    )
    return (
      <div className="space-y-1">
        {label && <span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>}
        <input
          autoFocus value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
          onBlur={commit}
          className={cls}
        />
      </div>
    )
  }

  return (
    <div className="space-y-1 group cursor-pointer" onClick={start}>
      {label && <span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>}
      <p className={`text-sm min-h-[1.25rem] ${value ? 'text-white' : 'text-slate-600 italic'} ${mono ? 'font-mono' : ''} group-hover:text-cyan-300 transition-colors`}>
        {value || placeholder}
        <Edit2 size={11} className="inline ml-1.5 opacity-0 group-hover:opacity-50" />
      </p>
    </div>
  )
}

function ENum({
  label, value, onSave, placeholder = '—'
}: {
  label?: string; value: number | null; onSave: (v: number | null) => void; placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const start = () => { setDraft(value !== null ? String(value) : ''); setEditing(true) }
  const commit = () => {
    const n = parseFloat(draft)
    onSave(isNaN(n) ? null : n)
    setEditing(false)
  }
  const cancel = () => setEditing(false)

  if (editing) return (
    <div className="space-y-1">
      {label && <span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>}
      <input
        autoFocus type="number" value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
        onBlur={commit}
        className="w-full bg-slate-900 border border-cyan-500 rounded px-2 py-1 text-sm text-white focus:outline-none"
      />
    </div>
  )

  return (
    <div className="space-y-1 group cursor-pointer" onClick={start}>
      {label && <span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>}
      <p className={`text-sm min-h-[1.25rem] ${value !== null ? 'text-white' : 'text-slate-600 italic'} group-hover:text-cyan-300 transition-colors`}>
        {value !== null ? value : placeholder}
        <Edit2 size={11} className="inline ml-1.5 opacity-0 group-hover:opacity-50" />
      </p>
    </div>
  )
}

function ESelect({
  label, value, options, onSave
}: {
  label?: string
  value: string
  options: { value: string; label: string }[]
  onSave: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)

  const commit = (v: string) => { if (v !== value) onSave(v); setEditing(false) }

  if (editing) return (
    <div className="space-y-1">
      {label && <span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>}
      <select
        autoFocus
        value={value}
        onChange={(e) => commit(e.target.value)}
        onBlur={() => setEditing(false)}
        className="w-full bg-slate-900 border border-cyan-500 rounded px-2 py-1 text-sm text-white focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )

  const display = options.find((o) => o.value === value)?.label || value

  return (
    <div className="space-y-1 group cursor-pointer" onClick={() => setEditing(true)}>
      {label && <span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>}
      <p className={`text-sm min-h-[1.25rem] ${display ? 'text-white' : 'text-slate-600 italic'} group-hover:text-cyan-300 transition-colors`}>
        {display || '—'}
        <Edit2 size={11} className="inline ml-1.5 opacity-0 group-hover:opacity-50" />
      </p>
    </div>
  )
}

// ── Multi-value chips (pipe-separated) ───────────────────────────────────────

function EChips({
  label, value, placeholder = 'Agregar...', onSave
}: {
  label?: string; value: string; placeholder?: string; onSave: (v: string) => void
}) {
  const chips = value ? value.split('|').map((s) => s.trim()).filter(Boolean) : []
  const [draft, setDraft] = useState('')

  const addChip = () => {
    const trimmed = draft.trim()
    if (!trimmed || chips.includes(trimmed)) { setDraft(''); return }
    onSave([...chips, trimmed].join('|'))
    setDraft('')
  }

  const removeChip = (chip: string) => {
    onSave(chips.filter((c) => c !== chip).join('|'))
  }

  return (
    <div className="space-y-1.5">
      {label && <span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>}
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <span
            key={chip}
            className="inline-flex items-center gap-1 text-xs bg-slate-700 text-cyan-300 border border-slate-600 rounded-full px-2.5 py-0.5"
          >
            {chip}
            <button
              onClick={() => removeChip(chip)}
              className="text-slate-400 hover:text-red-400 transition-colors leading-none"
              aria-label={`Eliminar ${chip}`}
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChip() } }}
          placeholder={placeholder}
          className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
        />
        <button
          onClick={addChip}
          disabled={!draft.trim()}
          className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Agregar puerto"
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ icon: Icon, title, action, children }: {
  icon: React.ElementType
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <Icon size={15} className="text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
}

// ── Role badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: ContactRole }) {
  const color = CONTACT_ROLE_COLORS[role]
  const label = CONTACT_ROLE_LABELS[role]
  return (
    <span
      className="inline-block text-[10px] px-2 py-0.5 rounded-full font-medium"
      style={{ backgroundColor: color + '22', color }}
    >
      {label}
    </span>
  )
}

// ── Contact Card ──────────────────────────────────────────────────────────────

const ROLE_OPTIONS: Array<{ value: ContactRole; label: string }> = [
  { value: 'commercial',  label: 'Comercial' },
  { value: 'quality',     label: 'Calidad / Garantías' },
  { value: 'logistics',   label: 'Logística' },
  { value: 'accounting',  label: 'Contabilidad / Finanzas' },
  { value: 'other',       label: 'Otro' }
]

function ContactCard({
  contact, supplierId
}: {
  contact: ComexSupplierContact
  supplierId: string
}) {
  const updateContact = useUpdateComexSupplierContact()
  const deleteContact = useDeleteComexSupplierContact()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = (data: Partial<ComexSupplierContact>) =>
    updateContact.mutate({ id: contact.id, supplierId, data })

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <EText
            value={contact.name}
            onSave={(v) => save({ name: v })}
            placeholder="Nombre del contacto"
          />
          <div className="mt-1">
            <EText
              value={contact.position}
              onSave={(v) => save({ position: v })}
              placeholder="Cargo"
            />
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <select
            value={contact.role}
            onChange={(e) => save({ role: e.target.value as ContactRole })}
            className="text-[10px] bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          {confirmDelete ? (
            <>
              <button
                onClick={() => deleteContact.mutate({ id: contact.id, supplierId })}
                className="p-1 rounded bg-red-600 hover:bg-red-500 text-white"
              >
                <Check size={11} />
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="p-1 rounded bg-slate-700 text-slate-400"
              >
                <X size={11} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1 rounded text-slate-600 hover:text-red-400"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>

      <RoleBadge role={contact.role} />

      {/* Contact details */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center gap-2">
          <Mail size={12} className="text-slate-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <EText value={contact.email} onSave={(v) => save({ email: v })} placeholder="email@proveedor.com" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Phone size={12} className="text-slate-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <EText value={contact.phone} onSave={(v) => save({ phone: v })} placeholder="+86 ..." />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MessageCircle size={12} className="text-slate-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <EText value={contact.whatsapp} onSave={(v) => save({ whatsapp: v })} placeholder="WhatsApp" />
          </div>
        </div>
      </div>

      {/* Notes */}
      <EText
        label="Notas"
        value={contact.notes}
        onSave={(v) => save({ notes: v })}
        placeholder="—"
        multiline
      />
    </div>
  )
}

function AddContactForm({ supplierId, onDone }: { supplierId: string; onDone: () => void }) {
  const createContact = useCreateComexSupplierContact()
  const [form, setForm] = useState<CreateComexSupplierContactInput>({
    supplier_id: supplierId,
    role: 'commercial',
    name: '',
    position: '',
    email: '',
    phone: '',
    whatsapp: '',
    notes: '',
    sort_order: 0
  })

  const set = <K extends keyof CreateComexSupplierContactInput>(k: K, v: CreateComexSupplierContactInput[K]) =>
    setForm((p) => ({ ...p, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim()) return
    await createContact.mutateAsync(form)
    onDone()
  }

  return (
    <div className="bg-slate-900 border border-cyan-600 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Nombre *</label>
          <input
            autoFocus
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Nombre completo"
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Rol</label>
          <select
            value={form.role}
            onChange={(e) => set('role', e.target.value as ContactRole)}
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Cargo</label>
          <input
            value={form.position}
            onChange={(e) => set('position', e.target.value)}
            placeholder="Sales Manager"
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Email</label>
          <input
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="contact@..."
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Teléfono</label>
          <input
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="+86..."
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">WhatsApp</label>
          <input
            value={form.whatsapp}
            onChange={(e) => set('whatsapp', e.target.value)}
            placeholder="+86..."
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onDone} className="px-3 py-1.5 rounded text-sm text-slate-400 hover:bg-slate-800">
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={!form.name.trim() || createContact.isPending}
          className="px-3 py-1.5 rounded text-sm font-medium bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50"
        >
          Agregar
        </button>
      </div>
    </div>
  )
}

// ── Bank Account Card ─────────────────────────────────────────────────────────

function BankCard({
  bank, supplierId
}: {
  bank: ComexSupplierBankAccount
  supplierId: string
}) {
  const updateBank = useUpdateComexSupplierBank()
  const deleteBank = useDeleteComexSupplierBank()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = (data: Partial<ComexSupplierBankAccount>) =>
    updateBank.mutate({ id: bank.id, supplierId, data })

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <EText
            value={bank.bank_name}
            onSave={(v) => save({ bank_name: v })}
            placeholder="Nombre del banco"
          />
          <div className="mt-0.5">
            <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 font-medium">
              {bank.currency || 'USD'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {confirmDelete ? (
            <>
              <button
                onClick={() => deleteBank.mutate({ id: bank.id, supplierId })}
                className="p-1 rounded bg-red-600 hover:bg-red-500 text-white"
              >
                <Check size={11} />
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="p-1 rounded bg-slate-700 text-slate-400"
              >
                <X size={11} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1 rounded text-slate-600 hover:text-red-400"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <EText label="Beneficiario" value={bank.beneficiary_name} onSave={(v) => save({ beneficiary_name: v })} placeholder="—" />
        <EText label="N° de cuenta" value={bank.account_number} onSave={(v) => save({ account_number: v })} placeholder="—" mono />
        <EText label="SWIFT / BIC"  value={bank.swift_bic}       onSave={(v) => save({ swift_bic: v })}       placeholder="—" mono />
        <EText label="IBAN"         value={bank.iban}            onSave={(v) => save({ iban: v })}            placeholder="—" mono />
        <EText label="Routing (ABA)"value={bank.routing_number}  onSave={(v) => save({ routing_number: v })} placeholder="—" mono />
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Moneda</label>
          <select
            value={bank.currency}
            onChange={(e) => save({ currency: e.target.value })}
            className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-cyan-500"
          >
            {['USD','EUR','CNY','GBP','JPY','BRL','ARS'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <EText label="Dirección del banco" value={bank.bank_address} onSave={(v) => save({ bank_address: v })} placeholder="—" />
      <EText label="Notas" value={bank.notes} onSave={(v) => save({ notes: v })} placeholder="—" multiline />
    </div>
  )
}

function AddBankForm({ supplierId, onDone }: { supplierId: string; onDone: () => void }) {
  const createBank = useCreateComexSupplierBank()
  const [form, setForm] = useState<CreateComexSupplierBankAccountInput>({
    supplier_id: supplierId,
    bank_name: '',
    beneficiary_name: '',
    account_number: '',
    swift_bic: '',
    iban: '',
    routing_number: '',
    currency: 'USD',
    bank_address: '',
    notes: ''
  })

  const set = <K extends keyof CreateComexSupplierBankAccountInput>(k: K, v: CreateComexSupplierBankAccountInput[K]) =>
    setForm((p) => ({ ...p, [k]: v }))

  const handleSave = async () => {
    if (!form.bank_name.trim()) return
    await createBank.mutateAsync(form)
    onDone()
  }

  return (
    <div className="bg-slate-900 border border-cyan-600 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Banco *</label>
          <input
            autoFocus
            value={form.bank_name}
            onChange={(e) => set('bank_name', e.target.value)}
            placeholder="HSBC, Bank of China..."
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Moneda</label>
          <select
            value={form.currency}
            onChange={(e) => set('currency', e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            {['USD','EUR','CNY','GBP','JPY','BRL','ARS'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Beneficiario</label>
        <input
          value={form.beneficiary_name}
          onChange={(e) => set('beneficiary_name', e.target.value)}
          placeholder="Nombre en la cuenta"
          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onDone} className="px-3 py-1.5 rounded text-sm text-slate-400 hover:bg-slate-800">
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={!form.bank_name.trim() || createBank.isPending}
          className="px-3 py-1.5 rounded text-sm font-medium bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50"
        >
          Agregar
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ComexSupplierDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const updateSupplier = useUpdateComexSupplier()

  const { data: supplier, isLoading } = useComexSupplier(id ?? null)
  const { data: contacts = [] } = useComexSupplierContacts(id ?? null)
  const { data: banks = [] } = useComexSupplierBanks(id ?? null)

  const [showAddContact, setShowAddContact] = useState(false)
  const [showAddBank, setShowAddBank] = useState(false)

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center text-slate-500">Cargando...</div>
  )
  if (!supplier) return (
    <div className="flex-1 flex items-center justify-center text-slate-500">Proveedor no encontrado</div>
  )

  const save = (data: Partial<ComexSupplier>) =>
    updateSupplier.mutate({ id: supplier.id, data })

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/comex/suppliers')}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <Building2 size={20} className="text-cyan-400" />
        <div className="flex-1 min-w-0">
          {/* Editable title */}
          <EditableTitle value={supplier.name} onSave={(v) => save({ name: v })} />
          {(supplier.city || supplier.country) && (
            <p className="text-xs text-slate-400 mt-0.5">
              {[supplier.city, supplier.country].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* ── General / Identification ─────────────────────────────────────────── */}
      <Section icon={Building2} title="Identificación y comercial">
        <FieldGrid>
          <EText label="País"              value={supplier.country}            onSave={(v) => save({ country: v })}            placeholder="China" />
          <EText label="Ciudad"            value={supplier.city}               onSave={(v) => save({ city: v })}               placeholder="Shenzhen" />
          <EText label="Código postal"     value={supplier.zip_code}           onSave={(v) => save({ zip_code: v })}           placeholder="518000" />
          <EText label="Tax ID / VAT"      value={supplier.tax_id}             onSave={(v) => save({ tax_id: v })}             placeholder="CN123456789" mono />
          <EText label="N° REX"            value={supplier.rex_number}         onSave={(v) => save({ rex_number: v })}         placeholder="CN/REX/..." mono />
          <EText label="Marca"             value={supplier.brand}              onSave={(v) => save({ brand: v })}              placeholder="Ej: Naturehike" />
          <EText label="Sitio web"         value={supplier.website}            onSave={(v) => save({ website: v })}            placeholder="https://..." />
          <EText label="WeChat"            value={supplier.wechat}             onSave={(v) => save({ wechat: v })}             placeholder="wechat_id" />
          <EText label="Cond. de pago"     value={supplier.payment_terms}      onSave={(v) => save({ payment_terms: v })}      placeholder="30% adelanto, 70% BL" />
          <ESelect
            label="Incoterm pautado"
            value={supplier.incoterms_preferred}
            options={[
              { value: '',    label: '—' },
              { value: 'FOB', label: 'FOB' },
              { value: 'EXW', label: 'EXW' }
            ]}
            onSave={(v) => save({ incoterms_preferred: v })}
          />
        </FieldGrid>
        <div className="mt-4">
          <EChips
            label="Puertos de embarque"
            value={supplier.port_of_origin}
            placeholder="Shenzhen (CNSZX)"
            onSave={(v) => save({ port_of_origin: v })}
          />
        </div>
        <div className="mt-4">
          <EText label="Categorías de producto" value={supplier.product_categories} onSave={(v) => save({ product_categories: v })} placeholder="Electrónica, herramientas, ..." />
        </div>
        <div className="mt-4">
          <EText label="Notas generales" value={supplier.notes} onSave={(v) => save({ notes: v })} placeholder="—" multiline />
        </div>
      </Section>

      {/* ── Dirección fiscal ─────────────────────────────────────────────────── */}
      <Section icon={MapPin} title="Dirección fiscal">
        <FieldGrid>
          <EText label="Dirección"    value={supplier.address}        onSave={(v) => save({ address: v })}        placeholder="123 Factory Rd" />
          <EText label="Ciudad"       value={supplier.city}           onSave={(v) => save({ city: v })}           placeholder="Shenzhen" />
          <EText label="País"         value={supplier.country}        onSave={(v) => save({ country: v })}        placeholder="China" />
          <EText label="Código postal"value={supplier.zip_code}       onSave={(v) => save({ zip_code: v })}       placeholder="518000" />
        </FieldGrid>
      </Section>

      {/* ── Dirección de pickup ──────────────────────────────────────────────── */}
      <Section icon={Package} title="Dirección de pickup / retiro de mercadería">
        <EText
          value={supplier.pickup_address}
          onSave={(v) => save({ pickup_address: v })}
          placeholder="Ingresá la dirección exacta de retiro de la mercadería..."
          multiline
        />
      </Section>

      {/* ── Logística operativa ──────────────────────────────────────────────── */}
      <Section icon={Anchor} title="Logística operativa">
        <FieldGrid>
          <ENum label="Lead time total (días)" value={supplier.lead_time_days} onSave={(v) => save({ lead_time_days: v })} placeholder="—" />
          <ENum label="MOQ (cantidad mínima)" value={supplier.moq} onSave={(v) => save({ moq: v })} placeholder="—" />
        </FieldGrid>
      </Section>

      {/* ── Programación Pedidos: desglose de lead time ──────────────────────── */}
      <Section icon={Clock} title="Desglose de lead time (Programación Pedidos)">
        <FieldGrid>
          <ENum label="Producción (días)"        value={supplier.production_days}    onSave={(v) => save({ production_days: v })}    placeholder="—" />
          <ENum label="Preparación (días)"       value={supplier.preparation_days}   onSave={(v) => save({ preparation_days: v })}   placeholder="—" />
          <ENum label="Tránsito (días)"          value={supplier.transit_days}       onSave={(v) => save({ transit_days: v })}       placeholder="—" />
          <ENum label="Aduana (días)"            value={supplier.customs_days}       onSave={(v) => save({ customs_days: v })}       placeholder="—" />
          <ENum label="Entrega local (días)"     value={supplier.local_delivery_days} onSave={(v) => save({ local_delivery_days: v })} placeholder="—" />
        </FieldGrid>
        <div className="mt-4">
          <EText
            label="Notas de confiabilidad"
            value={supplier.reliability_notes}
            onSave={(v) => save({ reliability_notes: v })}
            placeholder="Historial de cumplimiento, demoras frecuentes, etc."
            multiline
          />
        </div>
      </Section>

      {/* ── Marca & Demanda ──────────────────────────────────────────────────── */}
      <Section icon={BarChart3} title="Marca & Demanda">
        <FieldGrid>
          <EText label="Categoría"                value={supplier.category ?? ''}               onSave={(v) => save({ category: v })}               placeholder="Ej: montañismo, trail running" />
          <ENum  label="Demanda anual (unidades)"  value={supplier.demand_annual ?? null}         onSave={(v) => save({ demand_annual: v })}          placeholder="—" />
          <ENum  label="Stock actual"              value={supplier.current_stock ?? null}         onSave={(v) => save({ current_stock: v })}          placeholder="—" />
          <ENum  label="Stock de seguridad"        value={supplier.safety_stock ?? null}          onSave={(v) => save({ safety_stock: v })}           placeholder="—" />
          <ENum  label="Frecuencia de compra (días)" value={supplier.purchase_frequency_days ?? null} onSave={(v) => save({ purchase_frequency_days: v !== null ? Math.round(v) : null })} placeholder="—" />
        </FieldGrid>
        <div className="mt-4">
          <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-2">Demanda mensual estimada (unidades)</span>
          <MonthlyDemandGrid value={supplier.demand_monthly_json ?? '{}'} onSave={(v) => save({ demand_monthly_json: v })} />
        </div>
      </Section>

      {/* ── Contactos ────────────────────────────────────────────────────────── */}
      <Section
        icon={Users}
        title="Contactos"
        action={
          <button
            onClick={() => setShowAddContact(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
          >
            <Plus size={12} />
            Agregar
          </button>
        }
      >
        <div className="space-y-3">
          {showAddContact && (
            <AddContactForm supplierId={supplier.id} onDone={() => setShowAddContact(false)} />
          )}
          {contacts.length === 0 && !showAddContact ? (
            <p className="text-sm text-slate-500 italic">Sin contactos aún. Hacé clic en "Agregar" para añadir el primero.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {contacts.map((c) => (
                <ContactCard key={c.id} contact={c} supplierId={supplier.id} />
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* ── Cuentas bancarias ────────────────────────────────────────────────── */}
      <Section
        icon={CreditCard}
        title="Cuentas bancarias"
        action={
          <button
            onClick={() => setShowAddBank(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
          >
            <Plus size={12} />
            Agregar
          </button>
        }
      >
        <div className="space-y-3">
          {showAddBank && (
            <AddBankForm supplierId={supplier.id} onDone={() => setShowAddBank(false)} />
          )}
          {banks.length === 0 && !showAddBank ? (
            <p className="text-sm text-slate-500 italic">Sin cuentas bancarias aún.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {banks.map((b) => (
                <BankCard key={b.id} bank={b} supplierId={supplier.id} />
              ))}
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}

// ── Monthly demand grid ────────────────────────────────────────────────────────

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function MonthlyDemandGrid({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  let parsed: Record<string, number> = {}
  try { parsed = JSON.parse(value) || {} } catch { parsed = {} }

  const setMonth = (month: number, raw: string) => {
    const next = { ...parsed }
    const n = parseFloat(raw)
    if (raw === '' || isNaN(n)) {
      delete next[String(month)]
    } else {
      next[String(month)] = n
    }
    onSave(JSON.stringify(next))
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {MONTH_LABELS.map((label, i) => {
        const month = i + 1
        const v = parsed[String(month)]
        return (
          <div key={month} className="space-y-1">
            <span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
            <input
              type="number"
              defaultValue={v !== undefined ? String(v) : ''}
              onBlur={(e) => setMonth(month, e.target.value)}
              placeholder="—"
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>
        )
      })}
    </div>
  )
}

// ── Editable title (large) ────────────────────────────────────────────────────

function EditableTitle({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const start = () => { setDraft(value); setEditing(true) }
  const commit = () => { if (draft.trim() && draft !== value) onSave(draft.trim()); setEditing(false) }
  const cancel = () => setEditing(false)

  if (editing) return (
    <input
      autoFocus value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
      onBlur={commit}
      className="text-lg font-bold text-white bg-slate-900 border border-cyan-500 rounded px-2 py-0.5 w-full focus:outline-none"
    />
  )

  return (
    <h1
      onClick={start}
      className="text-lg font-bold text-white cursor-pointer hover:text-cyan-300 transition-colors group flex items-center gap-2"
    >
      {value}
      <Edit2 size={13} className="opacity-0 group-hover:opacity-50 shrink-0" />
    </h1>
  )
}
