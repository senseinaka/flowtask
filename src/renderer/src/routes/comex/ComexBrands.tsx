import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tag, Plus, X, Trash2, Check, ChevronRight, Building2, Package, ArrowRight } from 'lucide-react'
import {
  useComexBrands,
  useCreateComexBrand,
  useDeleteComexBrand,
  useComexSuppliers
} from '../../hooks/useComex'
import type { ComexBrand } from '@shared/types'

// ── Quick-create modal: only asks for name, then navigates to full detail ─────

function QuickCreateModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const createBrand = useCreateComexBrand()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const brand = await createBrand.mutateAsync({
        name: name.trim(),
        category: '',
        primary_supplier_id: null,
        demand_annual: null,
        demand_monthly_json: '{}',
        current_stock: null,
        safety_stock: null,
        purchase_frequency_days: null,
        notes: ''
      })
      onClose()
      navigate(`/comex/brands/${brand.id}`)
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
            <Tag size={15} className="text-cyan-400" />
            Nueva marca
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
              placeholder="Naturehike"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          <p className="text-xs text-slate-500">
            Se abrirá la ficha completa para completar el resto de los datos.
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

// ── Brand Card ────────────────────────────────────────────────────────────────

function BrandCard({ brand }: { brand: ComexBrand }) {
  const navigate = useNavigate()
  const deleteBrand = useDeleteComexBrand()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteBrand.mutateAsync(brand.id)
  }

  return (
    <div
      onClick={() => navigate(`/comex/brands/${brand.id}`)}
      className="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-cyan-600 hover:bg-slate-750 transition-colors cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-11 h-11 rounded-lg flex items-center justify-center bg-slate-700/30 border border-slate-600 flex-shrink-0">
          <Tag size={18} className="text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate group-hover:text-cyan-300 transition-colors">
            {brand.name}
          </p>
          {brand.category && (
            <p className="text-xs text-slate-400 mt-0.5">{brand.category}</p>
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

      {/* Proveedor primario */}
      {brand.primary_supplier && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <Building2 size={11} />
          <span className="truncate">{brand.primary_supplier.name}</span>
        </div>
      )}

      {/* Stock / demanda */}
      {(brand.current_stock !== null || brand.demand_annual !== null) && (
        <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center gap-4 text-xs text-slate-400">
          {brand.current_stock !== null && (
            <div className="flex items-center gap-1.5">
              <Package size={11} />
              <span>Stock: {brand.current_stock}</span>
            </div>
          )}
          {brand.demand_annual !== null && (
            <span>Demanda anual: {brand.demand_annual}</span>
          )}
        </div>
      )}

      {/* Notes */}
      {brand.notes && (
        <div className="mt-2">
          <p className="text-xs text-slate-500 line-clamp-2">{brand.notes}</p>
        </div>
      )}
    </div>
  )
}

// ── Main View ─────────────────────────────────────────────────────────────────

export default function ComexBrands() {
  const { data: brands = [], isLoading } = useComexBrands()
  useComexSuppliers() // precarga proveedores para mostrar nombre del proveedor primario
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = brands.filter((b) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      b.name.toLowerCase().includes(q) ||
      b.category.toLowerCase().includes(q) ||
      (b.primary_supplier?.name.toLowerCase().includes(q) ?? false)
    )
  })

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Tag size={22} className="text-cyan-400" />
          <div>
            <h1 className="text-lg font-bold text-white">Marcas</h1>
            <p className="text-xs text-slate-400">Marcas gestionadas para programación de pedidos</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Nueva marca
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar marcas..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
        <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
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
          <Tag size={40} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">
            {search ? 'Sin resultados' : 'Sin marcas aún'}
          </p>
          {!search && (
            <p className="text-slate-500 text-sm mt-1">
              Hacé clic en{' '}
              <button onClick={() => setShowCreate(true)} className="text-cyan-400 hover:underline">
                Nueva marca
              </button>{' '}
              para agregar la primera.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((b) => (
            <BrandCard key={b.id} brand={b} />
          ))}
        </div>
      )}

      {showCreate && (
        <QuickCreateModal onClose={() => setShowCreate(false)} />
      )}
    </div>
  )
}
