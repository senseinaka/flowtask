import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, Plus, X, Trash2, Check, ChevronRight, ArrowRight, Tag, Building2 } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
dayjs.locale('es')

import {
  useComexPlannings,
  useCreateComexPlanning,
  useDeleteComexPlanning,
  useComexBrands,
  useComexSuppliers
} from '../../hooks/useComex'
import {
  PLANNING_STATUSES, PLANNING_STATUS_LABELS,
  PLANNING_RISK_LABELS, PLANNING_RISK_COLORS,
  PLANNING_TYPES, PLANNING_TYPE_LABELS
} from '@shared/types'
import type {
  ImportOrderPlanning, PlanningStatus, PlanningType, ComexBrand
} from '@shared/types'
import { cn } from '../../components/ui/utils'

// ── Risk badge ──────────────────────────────────────────────────────────────────

function RiskBadge({ status }: { status: ImportOrderPlanning['risk_status'] }) {
  const color = PLANNING_RISK_COLORS[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ backgroundColor: `${color}22`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {PLANNING_RISK_LABELS[status]}
    </span>
  )
}

// ── Date cell ─────────────────────────────────────────────────────────────────

function DateCell({ ts }: { ts: number | null }) {
  if (!ts) return <span className="text-slate-600">—</span>
  return <span className="text-slate-300">{dayjs(ts).format('DD/MM/YY')}</span>
}

// ── Quick-create modal ───────────────────────────────────────────────────────

function QuickCreateModal({ onClose, brands }: { onClose: () => void; brands: ComexBrand[] }) {
  const navigate = useNavigate()
  const createPlanning = useCreateComexPlanning()
  const { data: suppliers = [] } = useComexSuppliers()

  const [brandId, setBrandId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [planningType, setPlanningType] = useState<PlanningType>('single')
  const [targetDate, setTargetDate] = useState('')
  const [saving, setSaving] = useState(false)
  const selectRef = useRef<HTMLSelectElement>(null)

  useEffect(() => { selectRef.current?.focus() }, [])

  const brand = brands.find((b) => b.id === brandId)

  // Al elegir marca, precargar el proveedor primario por defecto
  useEffect(() => {
    if (brand?.primary_supplier_id && !supplierId) setSupplierId(brand.primary_supplier_id)
  }, [brand]) // eslint-disable-line react-hooks/exhaustive-deps

  const supplier = suppliers.find((s) => s.id === supplierId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!brandId || saving) return
    setSaving(true)
    try {
      const targetTs = targetDate ? dayjs(targetDate).valueOf() : null
      const planning = await createPlanning.mutateAsync({
        brand_id: brandId,
        supplier_id: supplierId || null,
        country: supplier?.country ?? '',
        responsible_user_id: '',
        planning_type: planningType,
        status: 'draft',
        risk_status: 'on_time',
        priority: 'medium',
        target_coverage_start_date: null,
        target_coverage_end_date: null,
        target_commercial_availability_date: targetTs,
        recommended_order_date: null,
        approval_deadline_date: null,
        estimated_reception_date: null,
        demand_annual_estimated: brand?.demand_annual ?? null,
        demand_monthly_estimated: null,
        demand_for_period: null,
        current_stock: brand?.current_stock ?? null,
        safety_stock: brand?.safety_stock ?? null,
        desired_coverage_months: null,
        internal_approval_days: 3,
        supplier_preparation_days: supplier?.preparation_days ?? 0,
        production_days: supplier?.production_days ?? 0,
        inspection_days: 0,
        shipping_days: supplier?.transit_days ?? 0,
        customs_days: supplier?.customs_days ?? 0,
        local_delivery_days: supplier?.local_delivery_days ?? 0,
        safety_days: 5,
        total_lead_time_days: 0,
        ai_recommendation_summary: null,
        ai_risk_explanation: null,
        notes: '',
        linked_import_id: null
      })
      onClose()
      navigate(`/comex/plannings/${planning.id}`)
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
            <CalendarClock size={15} className="text-cyan-400" />
            Nueva programación
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Marca *</label>
            <select
              ref={selectRef}
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">— Seleccionar —</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Proveedor</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">— Sin asignar —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Tipo de programación</label>
            <select
              value={planningType}
              onChange={(e) => setPlanningType(e.target.value as PlanningType)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            >
              {PLANNING_TYPES.map((t) => (
                <option key={t} value={t}>{PLANNING_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Fecha objetivo de disponibilidad comercial</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <p className="text-xs text-slate-500">
            Se precargan los lead times del proveedor seleccionado. Se puede ajustar todo en la ficha completa.
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
              disabled={saving || !brandId}
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

// ── Row ───────────────────────────────────────────────────────────────────────

function PlanningRow({ planning }: { planning: ImportOrderPlanning }) {
  const navigate = useNavigate()
  const deletePlanning = useDeleteComexPlanning()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await deletePlanning.mutateAsync(planning.id)
  }

  return (
    <tr
      onClick={() => navigate(`/comex/plannings/${planning.id}`)}
      className="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors group"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Tag size={13} className="text-cyan-400 shrink-0" />
          <span className="text-sm font-medium text-white truncate">{planning.brand?.name ?? '—'}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Building2 size={12} className="shrink-0" />
          <span className="truncate">{planning.supplier?.name ?? '—'}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-slate-400">{PLANNING_TYPE_LABELS[planning.planning_type]}</td>
      <td className="px-4 py-3 text-xs text-slate-400">{PLANNING_STATUS_LABELS[planning.status]}</td>
      <td className="px-4 py-3"><RiskBadge status={planning.risk_status} /></td>
      <td className="px-4 py-3 text-xs"><DateCell ts={planning.recommended_order_date} /></td>
      <td className="px-4 py-3 text-xs"><DateCell ts={planning.approval_deadline_date} /></td>
      <td className="px-4 py-3 text-xs"><DateCell ts={planning.target_commercial_availability_date} /></td>
      <td className="px-4 py-3 text-xs text-slate-400">
        {planning.demand_for_period != null ? planning.demand_for_period.toLocaleString('es-AR') : '—'}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {confirmDelete ? (
            <>
              <button onClick={handleDelete} className="p-1.5 rounded bg-red-600 hover:bg-red-500 text-white transition-colors">
                <Check size={12} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(false) }}
                className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white transition-colors"
              >
                <X size={12} />
              </button>
            </>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
              className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          )}
          <ChevronRight size={14} className="text-slate-600 group-hover:text-cyan-500 transition-colors" />
        </div>
      </td>
    </tr>
  )
}

// ── Main View ─────────────────────────────────────────────────────────────────

export default function ComexPlannings() {
  const [brandFilter, setBrandFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<PlanningStatus | ''>('')
  const [showCreate, setShowCreate] = useState(false)

  const { data: brands = [] } = useComexBrands()
  const { data: plannings = [], isLoading } = useComexPlannings({
    brandId: brandFilter || undefined,
    status: statusFilter || undefined
  })

  const sorted = useMemo(
    () => [...plannings].sort((a, b) => {
      const order = { late: 0, at_risk: 1, tight: 2, on_time: 3 }
      return order[a.risk_status] - order[b.risk_status]
    }),
    [plannings]
  )

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarClock size={22} className="text-cyan-400" />
          <div>
            <h1 className="text-lg font-bold text-white">Programación de pedidos</h1>
            <p className="text-xs text-slate-400">Planificación de fechas de pedido por marca y cobertura</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Nueva programación
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
        >
          <option value="">Todas las marcas</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as PlanningStatus | '')}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
        >
          <option value="">Todos los estados</option>
          {PLANNING_STATUSES.map((s) => (
            <option key={s} value={s}>{PLANNING_STATUS_LABELS[s]}</option>
          ))}
        </select>
        {(brandFilter || statusFilter) && (
          <button
            onClick={() => { setBrandFilter(''); setStatusFilter('') }}
            className="text-xs text-slate-400 hover:text-white"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Cargando...</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16">
          <CalendarClock size={40} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">
            {brandFilter || statusFilter ? 'Sin resultados' : 'Sin programaciones aún'}
          </p>
          {!brandFilter && !statusFilter && (
            <p className="text-slate-500 text-sm mt-1">
              Hacé clic en{' '}
              <button onClick={() => setShowCreate(true)} className="text-cyan-400 hover:underline">
                Nueva programación
              </button>{' '}
              para crear la primera.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={cn('border-b border-slate-700 text-[10px] uppercase tracking-wider text-slate-500')}>
                <th className="px-4 py-2.5 font-medium">Marca</th>
                <th className="px-4 py-2.5 font-medium">Proveedor</th>
                <th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 font-medium">Riesgo</th>
                <th className="px-4 py-2.5 font-medium">Pedido recomendado</th>
                <th className="px-4 py-2.5 font-medium">Límite aprobación</th>
                <th className="px-4 py-2.5 font-medium">Disp. comercial</th>
                <th className="px-4 py-2.5 font-medium">Demanda período</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <PlanningRow key={p.id} planning={p} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <QuickCreateModal onClose={() => setShowCreate(false)} brands={brands} />
      )}
    </div>
  )
}
