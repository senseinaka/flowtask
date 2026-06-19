import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ArrowLeftRight, Plus, Trash2, ChevronRight } from 'lucide-react'
import { useReconPeriods, useCreateReconPeriod, useDeleteReconPeriod } from '../../hooks/useRecon'
import { useAuthSession } from '../../hooks/useCalendar'
import {
  RECON_STATUS_LABELS, RECON_STATUS_COLORS,
  type ReconPeriodStatus
} from '@shared/types'
import { cn } from '../../components/ui/utils'

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

function StatusBadge({ status }: { status: ReconPeriodStatus }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold"
      style={{
        backgroundColor: RECON_STATUS_COLORS[status] + '25',
        color: RECON_STATUS_COLORS[status],
      }}
    >
      {RECON_STATUS_LABELS[status]}
    </span>
  )
}

export default function ReconDashboard() {
  const navigate  = useNavigate()
  const { data: session } = useAuthSession()
  const userId    = session?.userId ?? ''

  const { data: periods = [], isLoading } = useReconPeriods()
  const createPeriod = useCreateReconPeriod()
  const deletePeriod = useDeleteReconPeriod()

  const [showModal, setShowModal]       = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const now = new Date()
  const [newMonth, setNewMonth] = useState(now.getMonth() + 1)
  const [newYear,  setNewYear]  = useState(now.getFullYear())
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    setCreating(true)
    try {
      const period = await createPeriod.mutateAsync({
        data: { period_month: newMonth, period_year: newYear },
        userId,
      })
      setShowModal(false)
      navigate(`/contable/recon/${period.id}`)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (deleteConfirm !== id) { setDeleteConfirm(id); return }
    await deletePeriod.mutateAsync(id)
    setDeleteConfirm(null)
  }

  const duplicado = periods.some(
    p => p.period_month === newMonth && p.period_year === newYear
  )

  return (
    <div className="flex flex-col h-full bg-slate-900">

      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-900/40 flex items-center justify-center">
            <BookOpen size={16} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Conciliador Contable</h1>
            <p className="text-xs text-slate-400">
              Naka Outdoors · {periods.length} período{periods.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={14} />
          Nuevo período
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="text-center text-slate-500 py-16 text-sm">Cargando períodos…</div>
        ) : periods.length === 0 ? (
          <div className="max-w-md mx-auto text-center py-20">
            <div className="w-16 h-16 rounded-full bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
              <ArrowLeftRight size={24} className="text-amber-400" />
            </div>
            <h2 className="text-white font-semibold mb-2">Sin períodos todavía</h2>
            <p className="text-sm text-slate-400 mb-6">
              Cada período mensual agrupa los archivos de Flexxus, ML y cupones para conciliar.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Crear primer período
            </button>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-2">
            {periods.map(period => (
              <div
                key={period.id}
                onClick={() => navigate(`/contable/recon/${period.id}`)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-5 py-4 flex items-center gap-4 cursor-pointer hover:border-amber-700/50 hover:bg-slate-800/80 transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-amber-900/30 flex-shrink-0 flex flex-col items-center justify-center">
                  <span className="text-[9px] font-bold text-amber-500 uppercase leading-none">
                    {MONTH_NAMES[period.period_month - 1].slice(0, 3)}
                  </span>
                  <span className="text-xs font-bold text-amber-300 leading-none mt-0.5">
                    {String(period.period_year).slice(2)}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      {MONTH_NAMES[period.period_month - 1]} {period.period_year}
                    </span>
                    <StatusBadge status={period.status} />
                  </div>
                  {period.notes && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{period.notes}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={(e) => handleDelete(period.id, e)}
                    className={cn(
                      'p-1.5 rounded transition-colors',
                      deleteConfirm === period.id
                        ? 'bg-red-600 text-white'
                        : 'text-slate-600 hover:text-red-400 hover:bg-slate-700'
                    )}
                    title={deleteConfirm === period.id ? 'Confirmar' : 'Eliminar'}
                  >
                    <Trash2 size={13} />
                  </button>
                  <ChevronRight
                    size={16}
                    className="text-slate-600 group-hover:text-amber-500 transition-colors"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal nuevo período */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-80 shadow-2xl">
            <h2 className="text-white font-semibold mb-4 text-sm">Nuevo período</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Mes</label>
                <select
                  value={newMonth}
                  onChange={e => setNewMonth(Number(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={i + 1} value={i + 1}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Año</label>
                <input
                  type="number"
                  value={newYear}
                  onChange={e => setNewYear(Number(e.target.value))}
                  min={2020} max={2099}
                  className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
                />
              </div>
              {duplicado && (
                <p className="text-xs text-red-400">
                  Ya existe un período para {MONTH_NAMES[newMonth - 1]} {newYear}
                </p>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || duplicado}
                className="flex-1 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
              >
                {creating ? 'Creando…' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
