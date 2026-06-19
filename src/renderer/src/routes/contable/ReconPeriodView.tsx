import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Play, CheckCircle2, Loader2, Upload, BarChart3, List
} from 'lucide-react'
import {
  useReconPeriod, useReconResults, useRunRecon, useSetReconPeriodStatus,
} from '../../hooks/useRecon'
import { useAuthSession } from '../../hooks/useCalendar'
import {
  RECON_STATUS_LABELS, RECON_STATUS_COLORS,
  type ReconPeriodStatus, type ReconEstado,
} from '@shared/types'
import { cn } from '../../components/ui/utils'
import ReconTabImportar   from './ReconTabImportar'
import ReconTabResultados from './ReconTabResultados'
import ReconTabKPIs       from './ReconTabKPIs'

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
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

type Tab = 'importar' | 'resultados' | 'kpis'

export default function ReconPeriodView() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const { data: session } = useAuthSession()
  const userId    = session?.userId ?? ''

  const { data: period, isLoading } = useReconPeriod(id!)
  const { data: results = [] }      = useReconResults(id!)

  const runRecon  = useRunRecon()
  const setStatus = useSetReconPeriodStatus()

  const [tab,         setTab]         = useState<Tab>('importar')
  const [running,     setRunning]     = useState(false)
  const [runMsg,      setRunMsg]      = useState('')
  const [drillEstado, setDrillEstado] = useState<ReconEstado | undefined>()

  async function handleRun() {
    if (!id) return
    setRunning(true)
    setRunMsg('')
    try {
      const result = await runRecon.mutateAsync(id)
      if (result.ok) {
        setRunMsg(`${result.inserted} resultados`)
        setTab('resultados')
      } else {
        setRunMsg(`Error: ${result.error}`)
      }
    } finally {
      setRunning(false)
    }
  }

  async function handleClose() {
    if (!id) return
    await setStatus.mutateAsync({ id, status: 'closed', closedBy: userId })
  }

  function handleDrillDown(estado: ReconEstado) {
    setDrillEstado(estado)
    setTab('resultados')
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-full bg-slate-900">
      <Loader2 size={20} className="animate-spin text-slate-500" />
    </div>
  )

  if (!period) return (
    <div className="flex flex-col items-center justify-center h-full bg-slate-900 gap-3">
      <p className="text-slate-400 text-sm">Período no encontrado</p>
      <button onClick={() => navigate('/contable/recon')} className="text-amber-400 text-sm hover:underline">
        Volver
      </button>
    </div>
  )

  const periodLabel = `${MONTH_NAMES[period.period_month - 1]} ${period.period_year}`
  const canClose    = period.status === 'review'

  const TABS: { key: Tab; icon: React.ElementType; label: string }[] = [
    { key: 'importar',   icon: Upload,    label: 'Importar'   },
    { key: 'resultados', icon: List,      label: `Resultados${results.length ? ` (${results.length})` : ''}` },
    { key: 'kpis',       icon: BarChart3, label: 'KPIs'       },
  ]

  return (
    <div className="flex flex-col h-full bg-slate-900">

      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => navigate('/contable/recon')}
          className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <h1 className="text-base font-semibold text-white">{periodLabel}</h1>
          <StatusBadge status={period.status} />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {runMsg && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={12} /> {runMsg}
            </span>
          )}
          <button
            onClick={handleRun}
            disabled={running || period.status === 'closed'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-40"
          >
            {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            Conciliar
          </button>
          {canClose && (
            <button
              onClick={handleClose}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <CheckCircle2 size={12} />
              Cerrar período
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-6 border-b border-slate-700 flex gap-1 flex-shrink-0">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors',
              tab === t.key
                ? 'border-amber-500 text-amber-300'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            )}
          >
            <t.icon size={12} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'resultados' ? (
          <ReconTabResultados
            periodId={id!}
            userId={userId}
            initialEstado={drillEstado}
          />
        ) : (
          <div className="max-w-4xl mx-auto">
            {tab === 'importar' && (
              <ReconTabImportar periodId={id!} userId={userId} />
            )}
            {tab === 'kpis' && (
              <ReconTabKPIs periodId={id!} onDrillDown={handleDrillDown} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
