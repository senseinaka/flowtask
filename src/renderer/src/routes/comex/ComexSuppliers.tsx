import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Plus, X, Trash2, Check, Globe, Mail, Phone, ChevronRight, ArrowRight, Upload } from 'lucide-react'
import {
  useComexSuppliers,
  useCreateComexSupplier,
  useDeleteComexSupplier,
  useUploadSupplierLogo,
  useDeleteSupplierLogo
} from '../../hooks/useComex'
import type { ComexSupplier } from '@shared/types'

// ── Quick-create modal: only asks for name, then navigates to full detail ─────

function QuickCreateModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const createSupplier = useCreateComexSupplier()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const supplier = await createSupplier.mutateAsync({
        name: name.trim(),
        country: '', city: '', zip_code: '', address: '',
        tax_id: '', rex_number: '', brand: '', website: '',
        wechat: '', product_categories: '', payment_terms: '',
        incoterms_preferred: '', port_of_origin: '', lead_time_days: null,
        pickup_address: '', contact_name: '', contact_email: '',
        contact_phone: '', notes: ''
      })
      onClose()
      navigate(`/comex/suppliers/${supplier.id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="font-semibold text-white text-sm flex items-center gap-2">
            <Building2 size={15} className="text-cyan-400" />
            Nuevo proveedor
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Nombre *</label>
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
              placeholder="Shenzhen Electronics Co."
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          <p className="text-xs text-slate-500">
            Se abrirá el perfil completo para completar el resto de los datos.
          </p>
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 transition-colors"
            >
              {saving ? 'Creando...' : <>Crear y editar <ArrowRight size={14} /></>}
            </button>
          </div>
        </form>
      </div>
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

  // Si se cancela la confirmación al perder hover, reseteamos
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
            /* Confirmación de borrado */
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
            /* Botones normales */
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

// ── Supplier Card ─────────────────────────────────────────────────────────────

function SupplierCard({ supplier }: { supplier: ComexSupplier }) {
  const navigate = useNavigate()
  const deleteSupplier = useDeleteComexSupplier()
  const uploadLogo = useUploadSupplierLogo()
  const deleteLogo = useDeleteSupplierLogo()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteSupplier.mutateAsync(supplier.id)
  }

  const handleUploadLogo = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const filePath = await window.api.comex.logo.selectFile()
    if (!filePath) return
    uploadLogo.mutate({ id: supplier.id, filePath })
  }

  const handleDeleteLogo = (e: React.MouseEvent) => {
    e.stopPropagation()
    deleteLogo.mutate(supplier.id)
  }

  return (
    <div
      onClick={() => navigate(`/comex/suppliers/${supplier.id}`)}
      className="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-cyan-600 hover:bg-slate-750 transition-colors cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-3">
        <LogoBadge
          storedName={supplier.logo_stored_name}
          logoData={supplier.logo_data}
          onUpload={handleUploadLogo}
          onRemove={handleDeleteLogo}
          uploading={uploadLogo.isPending}
          PlaceholderIcon={Building2}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate group-hover:text-cyan-300 transition-colors">
            {supplier.name}
          </p>
          {(supplier.city || supplier.country) && (
            <p className="text-xs text-slate-400 mt-0.5">
              {[supplier.city, supplier.country].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {confirmDelete ? (
            <>
              <button onClick={handleDelete} className="p-1.5 rounded bg-red-600 hover:bg-red-500 text-white transition-colors">
                <Check size={13} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(false) }}
                className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white transition-colors"
              >
                <X size={13} />
              </button>
            </>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
              className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
          <ChevronRight size={14} className="text-slate-600 group-hover:text-cyan-500 transition-colors" />
        </div>
      </div>

      {/* Contact info */}
      <div className="mt-3 space-y-1">
        {supplier.contact_name && (
          <p className="text-xs text-slate-400">{supplier.contact_name}</p>
        )}
        {supplier.contact_email && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Mail size={11} />
            <a
              href={`mailto:${supplier.contact_email}`}
              className="hover:text-cyan-400 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {supplier.contact_email}
            </a>
          </div>
        )}
        {supplier.contact_phone && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Phone size={11} />
            <span>{supplier.contact_phone}</span>
          </div>
        )}
        {supplier.website && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Globe size={11} />
            <button
              onClick={(e) => { e.stopPropagation(); window.api.shell.open(supplier.website) }}
              className="hover:text-cyan-400 transition-colors truncate max-w-[200px]"
            >
              {supplier.website.replace(/^https?:\/\//, '')}
            </button>
          </div>
        )}
      </div>

      {/* Payment terms */}
      {supplier.payment_terms && (
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Condiciones de pago</p>
          <p className="text-xs text-slate-400">{supplier.payment_terms}</p>
        </div>
      )}

      {/* Notes */}
      {supplier.notes && (
        <div className="mt-2">
          <p className="text-xs text-slate-500 line-clamp-2">{supplier.notes}</p>
        </div>
      )}
    </div>
  )
}

// ── Main View ─────────────────────────────────────────────────────────────────

export default function ComexSuppliers() {
  const { data: suppliers = [], isLoading } = useComexSuppliers()
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = suppliers.filter((s) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      s.name.toLowerCase().includes(q) ||
      s.country.toLowerCase().includes(q) ||
      s.contact_name.toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 size={22} className="text-cyan-400" />
          <div>
            <h1 className="text-lg font-bold text-white">Proveedores</h1>
            <p className="text-xs text-slate-400">Directorio de proveedores del exterior</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Nuevo proveedor
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar proveedores..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
        <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
            <X size={12} />
          </button>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Building2 size={40} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">
            {search ? 'Sin resultados' : 'Sin proveedores aún'}
          </p>
          {!search && (
            <p className="text-slate-500 text-sm mt-1">
              Hacé clic en{' '}
              <button onClick={() => setShowCreate(true)} className="text-cyan-400 hover:underline">
                Nuevo proveedor
              </button>{' '}
              para agregar el primero.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <SupplierCard key={s.id} supplier={s} />
          ))}
        </div>
      )}

      {showCreate && (
        <QuickCreateModal onClose={() => setShowCreate(false)} />
      )}
    </div>
  )
}
