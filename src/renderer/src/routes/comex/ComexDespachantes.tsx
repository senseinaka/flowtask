import { useState } from 'react'
import { Briefcase, Plus, X, Trash2, Check, Mail, MessageCircle, Edit2, UserPlus, ChevronDown, ChevronUp, Globe, MapPin, Upload, Building2, Landmark } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import {
  useComexDespachantes, useCreateComexDespachante, useUpdateComexDespachante, useDeleteComexDespachante,
  useCreateComexDespachanteContact, useUpdateComexDespachanteContact, useDeleteComexDespachanteContact,
  useCreateComexDespachanteBank, useUpdateComexDespachanteBank, useDeleteComexDespachanteBank,
  useUploadDespachantelogo, useDeleteDespachantelogo,
} from '../../hooks/useComex'
import type {
  ComexDespachante, ComexDespachanteContact, CreateComexDespachanteInput, CreateComexDespachanteContactInput,
  ComexDespachanteBankAccount, CreateComexDespachanteBankAccountInput
} from '@shared/types'
import { cn } from '../../components/ui/utils'

// ── Avatar con logo ───────────────────────────────────────────────────────────

function Avatar({ name, logo, logoData, size = 48 }: { name: string; logo?: string | null; logoData?: string | null; size?: number }) {
  const { data: dataUrl } = useQuery({
    queryKey: ['logo-url', logo, logoData], queryFn: () => (logo || logoData) ? window.api.comex.logo.getDataUrl(logo ?? null, logoData) : null,
    enabled: !!(logo || logoData), staleTime: Infinity, gcTime: Infinity,
  })
  const initials = name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const COLORS   = ['#0ea5e9','#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6']
  const color    = COLORS[name.charCodeAt(0) % COLORS.length]
  if (dataUrl) return (
    <div className="flex-shrink-0 rounded-xl overflow-hidden border border-slate-600/50 bg-slate-900/50"
      style={{ width: size, height: size }}>
      <img src={dataUrl} alt={name} className="w-full h-full object-contain p-1" />
    </div>
  )
  return (
    <div className="flex-shrink-0 rounded-xl flex items-center justify-center font-bold"
      style={{ width: size, height: size, backgroundColor: color + '33', border: `1.5px solid ${color}55`, color, fontSize: size * 0.32 }}>
      {initials}
    </div>
  )
}

// ── Form Modal ────────────────────────────────────────────────────────────────

const EMPTY: CreateComexDespachanteInput & { website: string; direccion: string; phone_empresa: string } = {
  name:'', matricula:'', empresa:'', cuit:'', email:'', phone:'', whatsapp:'', website:'', direccion:'', phone_empresa:'', notas:''
}

type ContactDraft = { name: string; role: string; email: string; phone: string }
const EMPTY_CONTACT: ContactDraft = { name: '', role: '', email: '', phone: '' }

function DespachanteFormModal({ initial, onSave, onClose }: {
  initial?: Partial<typeof EMPTY>
  onSave: (d: typeof EMPTY) => Promise<ComexDespachante | null | void>
  onClose: () => void
}) {
  const isNew = !initial?.name
  const [form, setForm] = useState({ ...EMPTY, ...initial })
  const [contacts, setContacts] = useState<ContactDraft[]>([])
  const [saving, setSaving] = useState(false)
  const createContact = useCreateComexDespachanteContact()
  const set = <K extends keyof typeof form>(k: K, v: string) => setForm(p => ({ ...p, [k]: v }))
  const cls = 'w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500'
  const clsSm = 'w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500'

  const addContactRow    = () => setContacts(p => [...p, { ...EMPTY_CONTACT }])
  const removeContactRow = (i: number) => setContacts(p => p.filter((_, idx) => idx !== i))
  const setContactField  = (i: number, k: keyof ContactDraft, v: string) =>
    setContacts(p => p.map((c, idx) => idx === i ? { ...c, [k]: v } : c))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    const saved = await onSave(form)
    if (isNew && saved?.id) {
      const validContacts = contacts.filter(c => c.name.trim())
      for (const [i, c] of validContacts.entries()) {
        await createContact.mutateAsync({ ...c, despachante_id: saved.id, sort_order: i })
      }
    }
    setSaving(false); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="font-semibold text-white">{initial?.name ? 'Editar despachante' : 'Nuevo despachante'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nombre completo *</label>
            <input autoFocus value={form.name} onChange={e => set('name', e.target.value)} placeholder="Dario Valero" className={cls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Empresa / Estudio</label>
              <input value={form.empresa} onChange={e => set('empresa', e.target.value)} placeholder="Valero Despachantes SA" className={cls} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">CUIT</label>
              <input value={form.cuit} onChange={e => set('cuit', e.target.value)} placeholder="20-28471234-5" className={cls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Dirección</label>
              <input value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Av. Corrientes 1234, CABA" className={cls} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Sitio web</label>
              <input value={form.website} onChange={e => set('website', e.target.value)} placeholder="www.despacho.com.ar" className={cls} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="despachos@mail.com" className={cls} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tel. empresa</label>
              <input value={form.phone_empresa} onChange={e => set('phone_empresa', e.target.value)} placeholder="+54 11 4567-8901" className={cls} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">WhatsApp personal</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+54 11 1234-5678" className={cls} />
            </div>
          </div>
          {isNew && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs text-slate-400">Contactos</label>
                <button type="button" onClick={addContactRow}
                  className="flex items-center gap-1 text-[11px] text-cyan-500 hover:text-cyan-400">
                  <Plus size={11}/> Agregar contacto
                </button>
              </div>
              <div className="space-y-2">
                {contacts.map((c, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center">
                    <input value={c.name} onChange={e => setContactField(i, 'name', e.target.value)}
                      placeholder="Nombre" className={clsSm} />
                    <input value={c.role} onChange={e => setContactField(i, 'role', e.target.value)}
                      placeholder="Cargo" className={clsSm} />
                    <input value={c.email} onChange={e => setContactField(i, 'email', e.target.value)}
                      placeholder="Mail" className={clsSm} />
                    <input value={c.phone} onChange={e => setContactField(i, 'phone', e.target.value)}
                      placeholder="WhatsApp" className={clsSm} />
                    <button type="button" onClick={() => removeContactRow(i)}
                      className="p-1 text-slate-500 hover:text-red-400"><X size={13}/></button>
                  </div>
                ))}
                {contacts.length === 0 && (
                  <p className="text-[11px] text-slate-600">Sin contactos todavía. Con 2 o 3 suele alcanzar.</p>
                )}
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notas</label>
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={5}
              placeholder="Especializado en canal rojo..." className={cn(cls, 'resize-none')} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors">Cancelar</button>
            <button type="submit" disabled={saving || !form.name.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 transition-colors">
              {saving ? 'Guardando...' : initial?.name ? 'Guardar cambios' : 'Crear despachante'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Contact row ───────────────────────────────────────────────────────────────

function DespachanteContactRow({ contact }: { contact: ComexDespachanteContact }) {
  const update = useUpdateComexDespachanteContact()
  const del    = useDeleteComexDespachanteContact()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: contact.name, role: contact.role, email: contact.email, phone: contact.phone })
  const setF = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))

  if (editing) return (
    <form onSubmit={async e => { e.preventDefault(); await update.mutateAsync({ id: contact.id, data: form }); setEditing(false) }}
      className="bg-slate-900/60 rounded-lg p-2.5 space-y-2" onClick={e => e.stopPropagation()}>
      <div className="grid grid-cols-2 gap-2">
        <input autoFocus value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Nombre"
          className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500" />
        <input value={form.role} onChange={e => setF('role', e.target.value)} placeholder="Rol"
          className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500" />
        <input value={form.email} onChange={e => setF('email', e.target.value)} placeholder="Email"
          className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500" />
        <input value={form.phone} onChange={e => setF('phone', e.target.value)} placeholder="Teléfono"
          className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500" />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => setEditing(false)} className="px-2 py-1 text-xs text-slate-400 hover:text-white">Cancelar</button>
        <button type="submit" className="px-2 py-1 text-xs bg-cyan-700 hover:bg-cyan-600 text-white rounded">Guardar</button>
      </div>
    </form>
  )

  return (
    <div className="flex items-center gap-2 group" onClick={e => e.stopPropagation()}>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-slate-300">{contact.name}</span>
        {contact.role && <span className="text-[10px] text-slate-600 ml-1.5">{contact.role}</span>}
        <div className="flex items-center gap-2 mt-0.5">
          {contact.email && <button onClick={() => navigator.clipboard.writeText(contact.email)} className="text-[10px] text-slate-500 hover:text-cyan-400 flex items-center gap-0.5"><Mail size={9}/>{contact.email}</button>}
          {contact.phone && <button onClick={() => window.api.shell.open(`https://wa.me/${contact.phone.replace(/\D/g,'')}`)} className="text-[10px] text-slate-500 hover:text-emerald-400 flex items-center gap-0.5"><MessageCircle size={9}/>{contact.phone}</button>}
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setEditing(true)} className="p-1 rounded text-slate-600 hover:text-white hover:bg-slate-700"><Edit2 size={11}/></button>
        <button onClick={() => del.mutate(contact.id)} className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-slate-700"><Trash2 size={11}/></button>
      </div>
    </div>
  )
}

// ── Bank row ───────────────────────────────────────────────────────────────────

function DespachanteBankRow({ bank }: { bank: ComexDespachanteBankAccount }) {
  const update = useUpdateComexDespachanteBank()
  const del    = useDeleteComexDespachanteBank()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ bank_name: bank.bank_name, cbu: bank.cbu, alias: bank.alias, beneficiary_name: bank.beneficiary_name })
  const setF = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))

  if (editing) return (
    <form onSubmit={async e => { e.preventDefault(); await update.mutateAsync({ id: bank.id, data: form }); setEditing(false) }}
      className="bg-slate-900/60 rounded-lg p-2.5 space-y-2" onClick={e => e.stopPropagation()}>
      <div className="grid grid-cols-2 gap-2">
        <input autoFocus value={form.bank_name} onChange={e => setF('bank_name', e.target.value)} placeholder="Banco"
          className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500" />
        <input value={form.beneficiary_name} onChange={e => setF('beneficiary_name', e.target.value)} placeholder="Titular"
          className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500" />
        <input value={form.cbu} onChange={e => setF('cbu', e.target.value)} placeholder="CBU"
          className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-500" />
        <input value={form.alias} onChange={e => setF('alias', e.target.value)} placeholder="Alias"
          className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-500" />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => setEditing(false)} className="px-2 py-1 text-xs text-slate-400 hover:text-white">Cancelar</button>
        <button type="submit" className="px-2 py-1 text-xs bg-cyan-700 hover:bg-cyan-600 text-white rounded">Guardar</button>
      </div>
    </form>
  )

  return (
    <div className="flex items-center gap-2 group" onClick={e => e.stopPropagation()}>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-slate-300">{bank.bank_name || 'Banco sin nombre'}</span>
        {bank.beneficiary_name && <span className="text-[10px] text-slate-600 ml-1.5">{bank.beneficiary_name}</span>}
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {bank.cbu && (
            <button onClick={() => navigator.clipboard.writeText(bank.cbu)} className="text-[10px] text-slate-500 hover:text-cyan-400 font-mono">
              CBU {bank.cbu}
            </button>
          )}
          {bank.alias && (
            <button onClick={() => navigator.clipboard.writeText(bank.alias)} className="text-[10px] text-slate-500 hover:text-cyan-400 font-mono">
              Alias {bank.alias}
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setEditing(true)} className="p-1 rounded text-slate-600 hover:text-white hover:bg-slate-700"><Edit2 size={11}/></button>
        <button onClick={() => del.mutate(bank.id)} className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-slate-700"><Trash2 size={11}/></button>
      </div>
    </div>
  )
}

// ── Despachante Card ──────────────────────────────────────────────────────────

function DespachanteCard({ d }: { d: ComexDespachante }) {
  const update     = useUpdateComexDespachante()
  const del        = useDeleteComexDespachante()
  const addContact = useCreateComexDespachanteContact()
  const addBank    = useCreateComexDespachanteBank()
  const uploadLogo = useUploadDespachantelogo()
  const delLogo    = useDeleteDespachantelogo()
  const [editing,   setEditing]   = useState(false)
  const [confirmDel,setConfirmDel]= useState(false)
  const [expanded,  setExpanded]  = useState(() => (d.contacts?.length ?? 0) > 0)
  const [bankExpanded, setBankExpanded] = useState(() => (d.bank_accounts?.length ?? 0) > 0)
  const [addingC,   setAddingC]   = useState(false)
  const [addingB,   setAddingB]   = useState(false)
  const [newC,      setNewC]      = useState<Omit<CreateComexDespachanteContactInput,'despachante_id'>>({ name:'', role:'', email:'', phone:'', sort_order:0 })
  const [newB,      setNewB]      = useState<Omit<CreateComexDespachanteBankAccountInput,'despachante_id'>>({ bank_name:'', cbu:'', alias:'', beneficiary_name:'', notes:'' })
  const [copied,    setCopied]    = useState<string | null>(null)

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key); setTimeout(() => setCopied(null), 1500)
  }

  return (
    <>
      {editing && (
        <DespachanteFormModal
          initial={d as Partial<typeof d & { website: string; direccion: string; phone_empresa: string }>}
          onSave={async input => update.mutateAsync({ id: d.id, data: input as Partial<ComexDespachante> })}
          onClose={() => setEditing(false)}
        />
      )}

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden hover:border-slate-600 transition-colors">
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Avatar/Logo */}
            <div className="flex-shrink-0 relative group/logo">
              <Avatar name={d.name} logo={d.logo_stored_name} logoData={d.logo_data} size={48} />
              <button onClick={async () => {
                  const fp = await window.api.comex.logo.selectFile?.() ?? null
                  if (!fp) return
                  await uploadLogo.mutateAsync({ id: d.id, filePath: fp })
                }}
                className="absolute inset-0 rounded-xl bg-black/60 opacity-0 group-hover/logo:opacity-100 transition-opacity flex items-center justify-center"
                title="Subir logo">
                <Upload size={14} className="text-white" />
              </button>
              {d.logo_stored_name && (
                <button onClick={() => delLogo.mutate(d.id)}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white opacity-0 group-hover/logo:opacity-100 transition-opacity flex items-center justify-center">
                  <X size={8} />
                </button>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{d.name}</p>
                  {d.empresa   && <p className="text-[11px] text-slate-400 truncate">{d.empresa}</p>}
                  {d.matricula && <p className="text-[10px] text-cyan-600 font-mono">Mat. {d.matricula}</p>}
                  {d.cuit      && <p className="text-[10px] text-slate-600">CUIT: {d.cuit}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700"><Edit2 size={13}/></button>
                  {confirmDel ? (
                    <>
                      <button onClick={() => del.mutate(d.id)} className="p-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white"><Check size={13}/></button>
                      <button onClick={() => setConfirmDel(false)} className="p-1.5 rounded-lg bg-slate-700 text-slate-400"><X size={13}/></button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmDel(true)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700"><Trash2 size={13}/></button>
                  )}
                </div>
              </div>

              {/* Info empresa */}
              <div className="flex flex-col gap-0.5 mt-2">
                {d.direccion && (
                  <p className="text-[10px] text-slate-500 flex items-center gap-1"><MapPin size={9}/>{d.direccion}</p>
                )}
                {d.website && (
                  <button onClick={() => window.api.shell.open(d.website.startsWith('http') ? d.website : `https://${d.website}`)}
                    className="text-[10px] text-cyan-600 hover:text-cyan-400 flex items-center gap-1 text-left">
                    <Globe size={9}/>{d.website}
                  </button>
                )}
              </div>

              {/* Contactos rápidos */}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {d.phone_empresa && (
                  <button onClick={() => handleCopy(d.phone_empresa, 'empresa')}
                    className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300">
                    {copied === 'empresa' ? <Check size={10} className="text-emerald-400"/> : <Building2 size={10}/>}
                    {copied === 'empresa' ? '¡Copiado!' : d.phone_empresa}
                  </button>
                )}
                {d.email && (
                  <button onClick={() => handleCopy(d.email, 'email')}
                    className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-cyan-400">
                    {copied === 'email' ? <Check size={10} className="text-emerald-400"/> : <Mail size={10}/>}
                    {copied === 'email' ? '¡Copiado!' : d.email}
                  </button>
                )}
                {(d.whatsapp || d.phone) && (
                  <button onClick={() => window.api.shell.open(`https://wa.me/${(d.whatsapp||d.phone).replace(/\D/g,'')}`)}
                    className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-emerald-400">
                    <MessageCircle size={10}/>{d.whatsapp || d.phone}
                  </button>
                )}
              </div>

              {d.notas && <p className="text-[10px] text-slate-600 mt-1.5 italic">{d.notas}</p>}
            </div>
          </div>
        </div>

        {/* Contactos de la empresa */}
        <div className="border-t border-slate-700/50">
          <button onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2 text-[10px] text-slate-500 hover:text-slate-300 hover:bg-slate-700/30 transition-colors">
            <span className="flex items-center gap-1.5">
              <UserPlus size={11}/>
              {(d.contacts?.length ?? 0) > 0 ? `${d.contacts!.length} contacto${d.contacts!.length !== 1 ? 's' : ''}` : 'Sin contactos'}
            </span>
            {expanded ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
          </button>

          {expanded && (
            <div className="px-4 pb-3 space-y-2">
              {(d.contacts ?? []).map(c => <DespachanteContactRow key={c.id} contact={c} />)}
              {addingC ? (
                <form onSubmit={async e => { e.preventDefault(); await addContact.mutateAsync({ ...newC, despachante_id: d.id }); setNewC({ name:'', role:'', email:'', phone:'', sort_order:0 }); setAddingC(false) }}
                  className="bg-slate-900/60 rounded-lg p-2.5 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input autoFocus value={newC.name} onChange={e => setNewC(p=>({...p,name:e.target.value}))} placeholder="Nombre *"
                      className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500" />
                    <input value={newC.role} onChange={e => setNewC(p=>({...p,role:e.target.value}))} placeholder="Rol"
                      className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500" />
                    <input value={newC.email} onChange={e => setNewC(p=>({...p,email:e.target.value}))} placeholder="Email"
                      className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500" />
                    <input value={newC.phone} onChange={e => setNewC(p=>({...p,phone:e.target.value}))} placeholder="Teléfono"
                      className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setAddingC(false)} className="px-2 py-1 text-xs text-slate-400 hover:text-white">Cancelar</button>
                    <button type="submit" disabled={!newC.name.trim()} className="px-2 py-1 text-xs bg-cyan-700 hover:bg-cyan-600 text-white rounded disabled:opacity-50">Agregar</button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setAddingC(true)} className="flex items-center gap-1.5 text-[10px] text-cyan-600 hover:text-cyan-400">
                  <Plus size={11}/> Agregar contacto
                </button>
              )}
            </div>
          )}
        </div>

        {/* Datos bancarios */}
        <div className="border-t border-slate-700/50">
          <button onClick={() => setBankExpanded(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2 text-[10px] text-slate-500 hover:text-slate-300 hover:bg-slate-700/30 transition-colors">
            <span className="flex items-center gap-1.5">
              <Landmark size={11}/>
              {(d.bank_accounts?.length ?? 0) > 0 ? `${d.bank_accounts!.length} cuenta${d.bank_accounts!.length !== 1 ? 's' : ''} bancaria${d.bank_accounts!.length !== 1 ? 's' : ''}` : 'Sin datos bancarios'}
            </span>
            {bankExpanded ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
          </button>

          {bankExpanded && (
            <div className="px-4 pb-3 space-y-2">
              {(d.bank_accounts ?? []).map(b => <DespachanteBankRow key={b.id} bank={b} />)}
              {addingB ? (
                <form onSubmit={async e => { e.preventDefault(); await addBank.mutateAsync({ ...newB, despachante_id: d.id }); setNewB({ bank_name:'', cbu:'', alias:'', beneficiary_name:'', notes:'' }); setAddingB(false) }}
                  className="bg-slate-900/60 rounded-lg p-2.5 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input autoFocus value={newB.bank_name} onChange={e => setNewB(p=>({...p,bank_name:e.target.value}))} placeholder="Banco *"
                      className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500" />
                    <input value={newB.beneficiary_name} onChange={e => setNewB(p=>({...p,beneficiary_name:e.target.value}))} placeholder="Titular"
                      className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500" />
                    <input value={newB.cbu} onChange={e => setNewB(p=>({...p,cbu:e.target.value}))} placeholder="CBU"
                      className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-500" />
                    <input value={newB.alias} onChange={e => setNewB(p=>({...p,alias:e.target.value}))} placeholder="Alias"
                      className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-500" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setAddingB(false)} className="px-2 py-1 text-xs text-slate-400 hover:text-white">Cancelar</button>
                    <button type="submit" disabled={!newB.bank_name.trim()} className="px-2 py-1 text-xs bg-cyan-700 hover:bg-cyan-600 text-white rounded disabled:opacity-50">Agregar</button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setAddingB(true)} className="flex items-center gap-1.5 text-[10px] text-cyan-600 hover:text-cyan-400">
                  <Plus size={11}/> Agregar cuenta bancaria
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ComexDespachantes() {
  const { data: despachantes = [], isLoading } = useComexDespachantes()
  const create = useCreateComexDespachante()
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = despachantes.filter(d => {
    if (!search) return true
    const q = search.toLowerCase()
    return d.name.toLowerCase().includes(q) || d.empresa.toLowerCase().includes(q) || d.matricula.toLowerCase().includes(q)
  })

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Briefcase size={22} className="text-cyan-400" />
          <div>
            <h1 className="text-lg font-bold text-white">Despachantes</h1>
            <p className="text-xs text-slate-400">Agentes de aduanas y despachantes de importación</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors">
          <Plus size={16}/> Nuevo despachante
        </button>
      </div>

      <div className="relative max-w-sm">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar despachante..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500" />
        {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><X size={12}/></button>}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Briefcase size={40} className="text-slate-700 mx-auto mb-3"/>
          <p className="text-slate-400 font-medium">{search ? 'Sin resultados' : 'Sin despachantes cargados'}</p>
          {!search && (
            <button onClick={() => setShowCreate(true)} className="mt-2 text-sm text-cyan-400 hover:underline">Agregar el primer despachante →</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(d => <DespachanteCard key={d.id} d={d} />)}
        </div>
      )}

      {showCreate && (
        <DespachanteFormModal
          onSave={async input => create.mutateAsync(input as CreateComexDespachanteInput)}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}
