import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Plus, Download, RefreshCw, Users, UserCheck, UserX, Sparkles,
  ChevronRight, Briefcase, Hash
} from 'lucide-react'
import {
  useNominaColaboradores, useExportNominaXls, useDeleteColaborador, useGenerarDesdeUltimo
} from '../../hooks/useRrhh'
import type { RrhhColaboradorConStats, EstadoLaboral } from '@shared/types'
import ColaboradorFormDrawer from './ColaboradorFormDrawer'
import GenerarNominaModal from './GenerarNominaModal'

const ESTADO_COLORS: Record<string, string> = {
  activo:     'bg-emerald-500/20 text-emerald-300',
  inactivo:   'bg-slate-500/20 text-slate-400',
  licencia:   'bg-amber-500/20 text-amber-300',
  suspendido: 'bg-red-500/20 text-red-300',
  externo:    'bg-sky-500/20 text-sky-300',
}

const ESTADO_LABELS: Record<string, string> = {
  activo:     'Activo',
  inactivo:   'Inactivo',
  licencia:   'Licencia',
  suspendido: 'Suspendido',
  externo:    'Externo',
}

function fmtM(n: number | null | undefined) {
  if (n == null) return '—'
  return '$' + Math.round(n).toLocaleString('es-AR')
}

function EstadoBadge({ estado }: { estado: string | null }) {
  const e = estado ?? 'activo'
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[e] ?? ESTADO_COLORS.activo}`}>
      {ESTADO_LABELS[e] ?? e}
    </span>
  )
}

type FiltroEstado = 'todos' | EstadoLaboral

export default function NominaDashboard() {
  const navigate = useNavigate()
  const { data: colaboradores = [], isLoading } = useNominaColaboradores()
  const exportXls = useExportNominaXls()
  const deleteCol = useDeleteColaborador()
  const generarMutation = useGenerarDesdeUltimo()

  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editando, setEditando] = useState<RrhhColaboradorConStats | null>(null)
  const [generarOpen, setGenerarOpen] = useState(false)

  const filtered = useMemo(() => {
    let list = colaboradores
    if (filtroEstado !== 'todos') list = list.filter(c => (c.estado_laboral ?? 'activo') === filtroEstado)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.nombre.toLowerCase().includes(q) ||
        c.documento.includes(q) ||
        (c.legajo ?? '').includes(q) ||
        (c.sector ?? '').toLowerCase().includes(q) ||
        (c.puesto ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [colaboradores, search, filtroEstado])

  const kpis = useMemo(() => {
    const activos    = colaboradores.filter(c => (c.estado_laboral ?? 'activo') === 'activo').length
    const inactivos  = colaboradores.filter(c => c.estado_laboral === 'inactivo').length
    const sinLegajo  = colaboradores.filter(c => !c.legajo && (c.estado_laboral ?? 'activo') === 'activo').length
    const totalNeto  = colaboradores.filter(c => (c.estado_laboral ?? 'activo') === 'activo')
      .reduce((s, c) => s + (c.ultimo_total_neto ?? 0), 0)
    return { activos, inactivos, sinLegajo, totalNeto }
  }, [colaboradores])

  function handleExport() {
    const rows = filtered.map(c => ({
      'Legajo':         c.legajo ?? '',
      'Nombre':         c.nombre,
      'Documento':      c.documento,
      'CUIL':           c.cuil,
      'Tarea':          c.tarea_habitual,
      'Sector':         c.sector ?? '',
      'Puesto':         c.puesto ?? '',
      'Estado':         ESTADO_LABELS[c.estado_laboral ?? 'activo'] ?? '',
      'F. Ingreso':     c.fecha_ingreso ?? '',
      'Último neto':    c.ultimo_total_neto ?? '',
      'Períodos':       c.total_periodos,
      'Email personal': c.email_personal ?? '',
      'Email laboral':  c.email_laboral ?? '',
      'Teléfono':       c.telefono ?? '',
      'CBU':            c.cbu ?? '',
      'Banco':          c.banco ?? '',
    }))
    exportXls.mutate(rows)
  }

  function handleGenerar() {
    setGenerarOpen(true)
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Nómina de colaboradores</h1>
          <p className="text-xs text-slate-400 mt-0.5">{colaboradores.length} colaboradores registrados</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerar}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-600/20 hover:bg-pink-600/30 text-pink-300 text-sm font-medium transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Generar desde última liquidación
          </button>
          <button
            onClick={handleExport}
            disabled={exportXls.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
          <button
            onClick={() => { setEditando(null); setDrawerOpen(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo
          </button>
        </div>
      </div>

      {/* KPI bar */}
      <div className="flex gap-4 px-6 py-3 border-b border-slate-700 flex-shrink-0">
        <KpiCard icon={<Users className="w-4 h-4" />} label="Activos"      value={kpis.activos}    color="text-emerald-400" />
        <KpiCard icon={<UserX  className="w-4 h-4" />} label="Inactivos"   value={kpis.inactivos}  color="text-slate-400" />
        <KpiCard icon={<Hash   className="w-4 h-4" />} label="Sin legajo"  value={kpis.sinLegajo}  color={kpis.sinLegajo > 0 ? 'text-amber-400' : 'text-slate-400'} />
        <div className="border-l border-slate-700 mx-1" />
        <KpiCard icon={<UserCheck className="w-4 h-4" />} label="Último neto total" value={fmtM(kpis.totalNeto)} color="text-pink-400" wide />
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-700 flex-shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, documento, legajo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-pink-500"
          />
        </div>
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
          {(['todos', 'activo', 'inactivo', 'licencia'] as FiltroEstado[]).map(e => (
            <button
              key={e}
              onClick={() => setFiltroEstado(e)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filtroEstado === e
                  ? 'bg-pink-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {e === 'todos' ? 'Todos' : ESTADO_LABELS[e]}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-slate-500">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Cargando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-500">
            <Users className="w-8 h-8" />
            <p className="text-sm">
              {colaboradores.length === 0
                ? 'No hay colaboradores registrados. Generá la nómina desde la última liquidación.'
                : 'Sin resultados para el filtro actual.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
                <th className="px-4 py-2 font-medium w-16">Leg.</th>
                <th className="px-4 py-2 font-medium">Nombre</th>
                <th className="px-4 py-2 font-medium">Documento</th>
                <th className="px-4 py-2 font-medium">Tarea / Puesto</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2 font-medium text-right">Último neto</th>
                <th className="px-4 py-2 font-medium text-center">Períodos</th>
                <th className="px-4 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/rrhh/nomina/${c.id}`)}
                  className="border-b border-slate-800 hover:bg-slate-800/60 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2.5">
                    {c.legajo
                      ? <span className="font-mono text-xs text-slate-300">{c.legajo}</span>
                      : <span className="text-slate-600 text-xs">—</span>
                    }
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-100">{c.nombre}</div>
                    {c.sector && <div className="text-xs text-slate-500">{c.sector}</div>}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{c.documento}</td>
                  <td className="px-4 py-2.5">
                    <div className="text-slate-300">{c.puesto || c.tarea_habitual || '—'}</div>
                    {c.puesto && c.tarea_habitual && c.puesto !== c.tarea_habitual && (
                      <div className="text-xs text-slate-500">{c.tarea_habitual}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <EstadoBadge estado={c.estado_laboral} />
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-200">
                    {fmtM(c.ultimo_total_neto)}
                    {c.ultimo_vacaciones_neto ? (
                      <div className="text-xs text-sky-400">+ {fmtM(c.ultimo_vacaciones_neto)} vac.</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="text-slate-400 font-mono text-xs">{c.total_periodos}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Form Drawer */}
      {drawerOpen && (
        <ColaboradorFormDrawer
          colaborador={editando}
          onClose={() => setDrawerOpen(false)}
        />
      )}

      {/* Generar modal */}
      {generarOpen && (
        <GenerarNominaModal onClose={() => setGenerarOpen(false)} />
      )}
    </div>
  )
}

function KpiCard({ icon, label, value, color, wide }: {
  icon: React.ReactNode
  label: string
  value: string | number
  color?: string
  wide?: boolean
}) {
  return (
    <div className={`flex items-center gap-2 ${wide ? 'min-w-[160px]' : ''}`}>
      <span className={`${color ?? 'text-slate-400'}`}>{icon}</span>
      <div>
        <div className={`font-semibold text-sm ${color ?? 'text-slate-200'}`}>{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  )
}
