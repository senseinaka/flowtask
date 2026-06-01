import { useState } from 'react'
import { Package, Plus, Search, X, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
dayjs.locale('es')

import {
  useComexImports,
  useCreateComexImport,
  useComexSuppliers
} from '../../hooks/useComex'
import {
  IMPORT_STATUS_LABELS,
  IMPORT_STATUS_COLORS,
  INCOTERMS
} from '@shared/types'
import type { ImportStatus, CreateComexImportInput, ComexImport } from '@shared/types'
import { cn } from '../../components/ui/utils'

const ALL_STATUSES = Object.keys(IMPORT_STATUS_LABELS) as ImportStatus[]

const CURRENCIES = ['USD', 'EUR', 'CNY', 'GBP', 'JPY']

// ── Create Form ───────────────────────────────────────────────────────────────

function CreateImportModal({ onClose }: { onClose: () => void }) {
  const { data: suppliers = [] } = useComexSuppliers()
  const create = useCreateComexImport()

  const [form, setForm] = useState<Partial<CreateComexImportInput>>({
    status: 'planning',
    currency: 'USD',
    incoterm: 'FOB',
    origin_country: '',
    title: '',
    notes: '',
    tracking_number: '',
    customs_agent: ''
  })

  const set = (k: keyof CreateComexImportInput, v: unknown) =>
    setForm((prev) => ({ ...prev, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title?.trim()) return
    await create.mutateAsync({
      title: form.title,
      supplier_id: form.supplier_id ?? null,
      status: form.status ?? 'planning',
      incoterm: form.incoterm ?? '',
      origin_country: form.origin_country ?? '',
      currency: form.currency ?? 'USD',
      estimated_value: form.estimated_value ?? null,
      actual_value: null,
      order_date: form.order_date ?? null,
      payment_date: form.payment_date ?? null,
      ship_date: form.ship_date ?? null,
      arrival_date: form.arrival_date ?? null,
      actual_ship_date: null,
      actual_arrival_date: null,
      tracking_number: form.tracking_number ?? '',
      customs_agent: form.customs_agent ?? '',
      drive_folder_id: null,
      notes: form.notes ?? ''
    })
    onClose()
  }

  const dateToTs = (s: string) => (s ? dayjs(s).valueOf() : null)
  const tsToDate = (n: number | null | undefined) =>
    n ? dayjs(n).format('YYYY-MM-DD') : ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="font-semibold text-white">Nueva importación</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Título */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Título *</label>
            <input
              autoFocus
              value={form.title ?? ''}
              onChange={(e) => set('title', e.target.value)}
              placeholder="ej. Electrónica – Proveedor Shenzhen Q2-2025"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Estado */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Estado</label>
              <select
                value={form.status}
                onChange={(e) => set('status', e.target.value as ImportStatus)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>{IMPORT_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>

            {/* Proveedor */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Proveedor</label>
              <select
                value={form.supplier_id ?? ''}
                onChange={(e) => set('supplier_id', e.target.value || null)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">Sin proveedor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* País origen */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">País origen</label>
              <input
                value={form.origin_country ?? ''}
                onChange={(e) => set('origin_country', e.target.value)}
                placeholder="China"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Incoterm */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Incoterm</label>
              <select
                value={form.incoterm ?? 'FOB'}
                onChange={(e) => set('incoterm', e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                {INCOTERMS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Moneda */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Moneda</label>
              <select
                value={form.currency ?? 'USD'}
                onChange={(e) => set('currency', e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Valor estimado */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Valor estimado</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.estimated_value ?? ''}
              onChange={(e) => set('estimated_value', e.target.value ? Number(e.target.value) : null)}
              placeholder="0.00"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Fecha de pedido</label>
              <input
                type="date"
                value={tsToDate(form.order_date)}
                onChange={(e) => set('order_date', dateToTs(e.target.value))}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Fecha de llegada estimada</label>
              <input
                type="date"
                value={tsToDate(form.arrival_date)}
                onChange={(e) => set('arrival_date', dateToTs(e.target.value))}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notas</label>
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
              placeholder="Información adicional..."
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={create.isPending || !form.title?.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 transition-colors"
            >
              {create.isPending ? 'Creando...' : 'Crear importación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Import Card ───────────────────────────────────────────────────────────────

function ImportCard({ imp }: { imp: ComexImport }) {
  const navigate = useNavigate()
  const color = IMPORT_STATUS_COLORS[imp.status as ImportStatus]
  const label = IMPORT_STATUS_LABELS[imp.status as ImportStatus]

  // Valor a mostrar: actual > estimado
  const displayValue = imp.actual_value ?? imp.estimated_value
  // ETA más reciente
  const eta = imp.eta_4 ?? imp.eta_3 ?? imp.eta_2 ?? imp.arrival_date

  return (
    <button
      onClick={() => navigate(`/comex/imports/${imp.id}`)}
      className="w-full text-left bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: color + '22', color }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
              {label}
            </span>
            {imp.incoterm && (
              <span className="text-[10px] text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">
                {imp.incoterm}
              </span>
            )}
            {imp.inal_required === 1 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-700/50">
                INAL
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-white truncate">{imp.title}</p>
          {imp.supplier && (
            <p className="text-xs text-slate-400 mt-0.5">{imp.supplier.name}</p>
          )}
        </div>
        <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400 flex-shrink-0 mt-1 transition-colors" />
      </div>

      {/* Fila 1: valor · país · llegada */}
      <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
        {displayValue != null && (
          <span className="text-cyan-400 font-medium">
            {imp.currency} {displayValue.toLocaleString('es-AR')}
          </span>
        )}
        {imp.origin_country && <span>{imp.origin_country}</span>}
        {eta && (
          <span>Llegada: {dayjs(eta).format('DD/MM/YY')}</span>
        )}
      </div>

      {/* Fila 2: Desp. · Costo imp % */}
      {(imp._despacho_number || imp.cost_pct != null) && (
        <div className="mt-1 flex items-center gap-3 text-[11px] flex-wrap">
          {imp._despacho_number && (
            <span className="text-slate-500 truncate max-w-[200px]">
              Desp.: {imp._despacho_number}
            </span>
          )}
          {imp.cost_pct != null && (
            <span className={cn(
              'font-semibold',
              imp.cost_pct < 15 ? 'text-emerald-500' :
              imp.cost_pct < 25 ? 'text-amber-500' : 'text-red-500'
            )}>
              Costo imp: {imp.cost_pct.toFixed(1)}%
            </span>
          )}
        </div>
      )}
    </button>
  )
}

// ── Main View ─────────────────────────────────────────────────────────────────

export default function ComexImports() {
  const [statusFilter, setStatusFilter] = useState<ImportStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const { data: imports = [], isLoading } = useComexImports(
    statusFilter === 'all' ? undefined : statusFilter
  )

  const filtered = imports.filter((i) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      i.title.toLowerCase().includes(q) ||
      (i.supplier?.name ?? '').toLowerCase().includes(q) ||
      (i.origin_country ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package size={22} className="text-cyan-400" />
          <div>
            <h1 className="text-lg font-bold text-white">Importaciones</h1>
            <p className="text-xs text-slate-400">Gestión de compras al exterior</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Nueva importación
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar importaciones..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setStatusFilter('all')}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors',
              statusFilter === 'all'
                ? 'bg-slate-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            )}
          >
            Todas
          </button>
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                statusFilter === s
                  ? 'text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              )}
              style={
                statusFilter === s
                  ? { backgroundColor: IMPORT_STATUS_COLORS[s] + 'cc' }
                  : {}
              }
            >
              {IMPORT_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Package size={40} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">
            {search || statusFilter !== 'all' ? 'Sin resultados' : 'Sin importaciones aún'}
          </p>
          {!search && statusFilter === 'all' && (
            <p className="text-slate-500 text-sm mt-1">
              Hacé clic en{' '}
              <button onClick={() => setShowCreate(true)} className="text-cyan-400 hover:underline">
                Nueva importación
              </button>{' '}
              para empezar.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((imp) => (
            <ImportCard key={imp.id} imp={imp} />
          ))}
        </div>
      )}

      {/* Summary footer */}
      {filtered.length > 0 && (
        <p className="text-xs text-slate-600 text-right">
          {filtered.length} importacion{filtered.length !== 1 ? 'es' : ''}
        </p>
      )}

      {showCreate && <CreateImportModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
