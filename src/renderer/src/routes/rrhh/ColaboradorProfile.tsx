import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronLeft, User, Briefcase, TrendingUp, FolderOpen, FileText,
  Hash, Edit2, ExternalLink, Loader2, AlertCircle, FolderPlus, Tag,
  Camera, Upload, FilePlus
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import {
  useHistorialColaborador, useAsignarLegajo, useCrearDriveColaborador,
  useDeleteColaborador, useNominaColaboradores,
  useUploadColaboradorFoto, useUploadColaboradorCv, useFotoDataUrl
} from '../../hooks/useRrhh'
import type { RrhhColaboradorConStats } from '@shared/types'
import ColaboradorFormDrawer from './ColaboradorFormDrawer'

type Tab = 'resumen' | 'personal' | 'laboral' | 'sueldos' | 'drive'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'resumen',  label: 'Resumen',  icon: <User className="w-4 h-4" /> },
  { id: 'personal', label: 'Personal', icon: <User className="w-4 h-4" /> },
  { id: 'laboral',  label: 'Laboral',  icon: <Briefcase className="w-4 h-4" /> },
  { id: 'sueldos',  label: 'Sueldos',  icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'drive',    label: 'Drive',    icon: <FolderOpen className="w-4 h-4" /> },
]

const ESTADO_COLORS: Record<string, string> = {
  activo:     'bg-emerald-500/20 text-emerald-300',
  inactivo:   'bg-slate-500/20 text-slate-400',
  licencia:   'bg-amber-500/20 text-amber-300',
  suspendido: 'bg-red-500/20 text-red-300',
  externo:    'bg-sky-500/20 text-sky-300',
}

const ESTADO_LABELS: Record<string, string> = {
  activo: 'Activo', inactivo: 'Inactivo', licencia: 'Licencia', suspendido: 'Suspendido', externo: 'Externo',
}

function fmtM(n: number | null | undefined) {
  if (n == null) return '—'
  return '$' + Math.round(n).toLocaleString('es-AR')
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-200 mt-0.5">{value ?? <span className="text-slate-600">—</span>}</dd>
    </div>
  )
}

function AvatarFoto({ colaborador }: { colaborador: RrhhColaboradorConStats }) {
  const uploadFoto = useUploadColaboradorFoto()
  const { data: fotoUrl } = useFotoDataUrl(colaborador.id, !!colaborador.foto_drive_file_id)

  async function handleUpload() {
    const localPath = await window.api.rrhh.nomina.colaboradores.selectImageFile()
    if (!localPath) return
    uploadFoto.mutate({ id: colaborador.id, localPath })
  }

  const initials = colaborador.nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()

  const hue = Array.from(colaborador.nombre).reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360

  return (
    <button
      onClick={handleUpload}
      disabled={uploadFoto.isPending}
      title={colaborador.foto_drive_file_id ? 'Reemplazar foto' : 'Subir foto'}
      className="relative flex-shrink-0 w-12 h-12 rounded-full overflow-hidden group focus:outline-none"
    >
      {fotoUrl
        ? <img src={fotoUrl} alt={colaborador.nombre} className="w-full h-full object-cover" />
        : (
          <div
            className="w-full h-full flex items-center justify-center text-white text-base font-semibold"
            style={{ background: `hsl(${hue}, 35%, 28%)` }}
          >
            {initials}
          </div>
        )
      }
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        {uploadFoto.isPending
          ? <Loader2 className="w-4 h-4 text-white animate-spin" />
          : <Camera className="w-4 h-4 text-white" />
        }
      </div>
    </button>
  )
}

export default function ColaboradorProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('resumen')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: colaboradores = [] } = useNominaColaboradores()
  const colaborador = colaboradores.find(c => c.id === id) as RrhhColaboradorConStats | undefined

  const { data: historial = [], isLoading: histLoading } = useHistorialColaborador(id ?? null)
  const asignarLegajo = useAsignarLegajo()
  const crearDrive    = useCrearDriveColaborador()
  const deleteCol     = useDeleteColaborador()

  if (!id) return null

  if (!colaborador) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Cargando...
      </div>
    )
  }

  const estado = colaborador.estado_laboral ?? 'activo'
  const chartData = historial.map(h => ({
    label: h.periodo.label,
    neto: h.sueldo.total_neto,
    vac:  h.sueldo.vacaciones_neto ?? 0,
    total: h.sueldo.total_neto + (h.sueldo.vacaciones_neto ?? 0),
  }))

  function handleDelete() {
    deleteCol.mutate(colaborador!.id, { onSuccess: () => navigate('/rrhh/nomina') })
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-700 flex-shrink-0">
        <button onClick={() => navigate('/rrhh/nomina')} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <AvatarFoto colaborador={colaborador} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-100 truncate">{colaborador.nombre}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[estado] ?? ESTADO_COLORS.activo}`}>
              {ESTADO_LABELS[estado] ?? estado}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
            {colaborador.legajo && <span className="font-mono">Leg. {colaborador.legajo}</span>}
            <span>{colaborador.documento}</span>
            {colaborador.cuil && <span>{colaborador.cuil}</span>}
            {colaborador.puesto || colaborador.tarea_habitual
              ? <span>{colaborador.puesto || colaborador.tarea_habitual}</span>
              : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            Editar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700 flex-shrink-0 px-6">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'border-pink-500 text-pink-300 font-medium'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-6">
        {tab === 'resumen' && (
          <TabResumen
            colaborador={colaborador}
            chartData={chartData}
            histLoading={histLoading}
            totalPeriodos={colaborador.total_periodos}
          />
        )}
        {tab === 'personal' && <TabPersonal c={colaborador} />}
        {tab === 'laboral' && (
          <TabLaboral
            c={colaborador}
            onAsignarLegajo={() => asignarLegajo.mutate(colaborador.id)}
            asignandoLegajo={asignarLegajo.isPending}
            onDeleteClick={() => setConfirmDelete(true)}
          />
        )}
        {tab === 'sueldos' && (
          <TabSueldos historial={historial} loading={histLoading} chartData={chartData} />
        )}
        {tab === 'drive' && (
          <TabDrive
            c={colaborador}
            onCrearCarpeta={() => crearDrive.mutate(colaborador.id)}
            creando={crearDrive.isPending}
          />
        )}
      </div>

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-80 space-y-4">
            <p className="text-sm text-slate-200">
              Marcar a <strong>{colaborador.nombre}</strong> como inactivo. No se borrará su historial de sueldos.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800">Cancelar</button>
              <button
                onClick={handleDelete}
                disabled={deleteCol.isPending}
                className="px-3 py-1.5 text-sm text-white bg-red-600 hover:bg-red-500 rounded-lg disabled:opacity-50"
              >
                {deleteCol.isPending ? 'Procesando...' : 'Confirmar baja'}
              </button>
            </div>
          </div>
        </div>
      )}

      {drawerOpen && (
        <ColaboradorFormDrawer
          colaborador={colaborador}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  )
}

// ── Sub-tabs ──────────────────────────────────────────────────────────────────

function TabResumen({ colaborador, chartData, histLoading, totalPeriodos }: {
  colaborador: RrhhColaboradorConStats
  chartData: { label: string; neto: number; vac: number; total: number }[]
  histLoading: boolean
  totalPeriodos: number
}) {
  return (
    <div className="space-y-6 max-w-3xl">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Último neto</div>
          <div className="text-xl font-bold text-pink-400">{fmtM(colaborador.ultimo_total_neto)}</div>
          {colaborador.ultimo_vacaciones_neto ? (
            <div className="text-xs text-sky-400 mt-0.5">+ {fmtM(colaborador.ultimo_vacaciones_neto)} vac.</div>
          ) : null}
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Períodos liquidados</div>
          <div className="text-xl font-bold text-slate-200">{totalPeriodos}</div>
          {colaborador.ultimo_periodo_label && (
            <div className="text-xs text-slate-500 mt-0.5">Último: {colaborador.ultimo_periodo_label}</div>
          )}
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Ingreso</div>
          <div className="text-base font-semibold text-slate-200">{colaborador.fecha_ingreso ?? '—'}</div>
          {colaborador.legajo && (
            <div className="text-xs text-slate-500 mt-0.5">Legajo {colaborador.legajo}</div>
          )}
        </div>
      </div>

      {/* Mini chart */}
      {histLoading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Cargando historial...</div>
      ) : chartData.length > 1 ? (
        <div className="bg-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-4">Evolución de sueldos</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradNeto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f472b6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f472b6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tickFormatter={v => `$${(v / 1_000_000).toFixed(1)}M`} tick={{ fill: '#64748b', fontSize: 10 }} width={52} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#94a3b8', fontSize: 12 }}
                formatter={(v: number) => [fmtM(v), '']}
              />
              <Area dataKey="neto" stroke="#f472b6" fill="url(#gradNeto)" strokeWidth={2} name="Neto" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  )
}

function TabPersonal({ c }: { c: RrhhColaboradorConStats }) {
  return (
    <div className="max-w-xl">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
        <Field label="Nombre completo"  value={c.nombre} />
        <Field label="Documento (DNI)"  value={c.documento} />
        <Field label="CUIL"             value={c.cuil} />
        <Field label="Fecha nacimiento" value={c.fecha_nacimiento} />
        <Field label="Teléfono"         value={c.telefono} />
        <Field label="Email personal"   value={c.email_personal} />
        <Field label="Dirección"        value={c.direccion} />
        <Field label="Localidad"        value={c.localidad} />
        <Field label="Provincia"        value={c.provincia} />
      </dl>
    </div>
  )
}

function TabLaboral({ c, onAsignarLegajo, asignandoLegajo, onDeleteClick }: {
  c: RrhhColaboradorConStats
  onAsignarLegajo: () => void
  asignandoLegajo: boolean
  onDeleteClick: () => void
}) {
  return (
    <div className="max-w-xl space-y-6">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
        <div>
          <dt className="text-xs text-slate-500">Legajo</dt>
          <dd className="flex items-center gap-2 mt-0.5">
            {c.legajo
              ? <span className="font-mono text-sm text-slate-200">{c.legajo}</span>
              : <span className="text-slate-600 text-sm">Sin asignar</span>
            }
            {!c.legajo && (
              <button
                onClick={onAsignarLegajo}
                disabled={asignandoLegajo}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-pink-600/20 hover:bg-pink-600/30 text-pink-300 text-xs transition-colors disabled:opacity-50"
              >
                <Tag className="w-3 h-3" />
                {asignandoLegajo ? 'Asignando...' : 'Asignar'}
              </button>
            )}
          </dd>
        </div>
        <Field label="F. ingreso"         value={c.fecha_ingreso} />
        <Field label="Tarea habitual"      value={c.tarea_habitual} />
        <Field label="Puesto"             value={c.puesto} />
        <Field label="Sector"             value={c.sector} />
        <Field label="Categoría"          value={c.categoria_laboral} />
        <Field label="Tipo contratación"  value={c.tipo_contratacion} />
        <Field label="Jornada"            value={c.jornada} />
        <Field label="Modalidad"          value={c.modalidad} />
        <Field label="Email laboral"      value={c.email_laboral} />
        <Field label="Banco"              value={c.banco} />
        <Field label="CBU"                value={c.cbu} />
      </dl>
      {c.observaciones && (
        <div>
          <dt className="text-xs text-slate-500 mb-1">Observaciones</dt>
          <dd className="text-sm text-slate-300 bg-slate-800 rounded-lg p-3">{c.observaciones}</dd>
        </div>
      )}
      <div className="pt-4 border-t border-slate-700">
        <button
          onClick={onDeleteClick}
          className="text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          Dar de baja colaborador
        </button>
      </div>
    </div>
  )
}

function TabSueldos({ historial, loading, chartData }: {
  historial: ReturnType<typeof useHistorialColaborador>['data']
  loading: boolean
  chartData: { label: string; neto: number; vac: number; total: number }[]
}) {
  if (loading) return (
    <div className="flex items-center gap-2 text-slate-500 text-sm">
      <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
    </div>
  )
  if (!historial || historial.length === 0) return (
    <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-500">
      <FileText className="w-7 h-7" />
      <p className="text-sm">Sin historial de sueldos.</p>
    </div>
  )

  return (
    <div className="space-y-6 max-w-3xl">
      {chartData.length > 1 && (
        <div className="bg-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-4">Evolución histórica</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradN" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f472b6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f472b6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradV" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tickFormatter={v => `$${(v / 1_000_000).toFixed(1)}M`} tick={{ fill: '#64748b', fontSize: 10 }} width={52} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v: number) => [fmtM(v), '']}
              />
              <Area dataKey="neto" stroke="#f472b6" fill="url(#gradN)" strokeWidth={2} name="Sueldo" dot={false} />
              <Area dataKey="vac"  stroke="#38bdf8" fill="url(#gradV)" strokeWidth={1.5} name="Vacaciones" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-400 border-b border-slate-700">
            <th className="pb-2 font-medium">Período</th>
            <th className="pb-2 font-medium text-right">Sueldo</th>
            <th className="pb-2 font-medium text-right">Vacaciones</th>
            <th className="pb-2 font-medium text-right">Total</th>
            <th className="pb-2 font-medium text-right">Variación</th>
          </tr>
        </thead>
        <tbody>
          {[...historial].reverse().map((h, i) => {
            const total = h.sueldo.total_neto + (h.sueldo.vacaciones_neto ?? 0)
            return (
              <tr key={i} className="border-b border-slate-800">
                <td className="py-2 text-slate-200">{h.periodo.label}</td>
                <td className="py-2 text-right font-mono text-slate-300">{fmtM(h.sueldo.total_neto)}</td>
                <td className="py-2 text-right font-mono text-sky-400">{h.sueldo.vacaciones_neto ? fmtM(h.sueldo.vacaciones_neto) : '—'}</td>
                <td className="py-2 text-right font-mono text-slate-200">{fmtM(total)}</td>
                <td className="py-2 text-right">
                  {h.delta_pct != null ? (
                    <span className={h.delta_pct >= 0 ? 'text-emerald-400 text-xs' : 'text-red-400 text-xs'}>
                      {h.delta_pct >= 0 ? '+' : ''}{h.delta_pct}%
                    </span>
                  ) : <span className="text-slate-600 text-xs">—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TabDrive({ c, onCrearCarpeta, creando }: {
  c: RrhhColaboradorConStats
  onCrearCarpeta: () => void
  creando: boolean
}) {
  const uploadFoto = useUploadColaboradorFoto()
  const uploadCv   = useUploadColaboradorCv()

  async function handleUploadFoto() {
    const localPath = await window.api.rrhh.nomina.colaboradores.selectImageFile()
    if (!localPath) return
    uploadFoto.mutate({ id: c.id, localPath })
  }

  async function handleUploadCv() {
    const localPath = await window.api.rrhh.nomina.colaboradores.selectCvFile()
    if (!localPath) return
    uploadCv.mutate({ id: c.id, localPath })
  }

  const noFolder = !c.drive_legajo_folder_id

  return (
    <div className="space-y-4 max-w-sm">
      {/* Carpeta de legajo */}
      <div className="bg-slate-800 rounded-xl p-5 space-y-3">
        {c.drive_legajo_folder_id ? (
          <>
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <FolderOpen className="w-5 h-5" />
              Carpeta de legajo creada
            </div>
            <p className="text-xs text-slate-400">
              <strong>Summit RRHH / Legajos / {c.legajo} {c.nombre}</strong>
            </p>
            <button
              onClick={() => window.api.rrhh.drive.openFolder(c.drive_legajo_folder_id!)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir en Drive
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
              <FolderOpen className="w-5 h-5" />
              Sin carpeta de legajo
            </div>
            {!c.legajo && (
              <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/10 rounded-lg p-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Asigná un legajo primero desde la tab Laboral para poder crear la carpeta.
              </div>
            )}
            <p className="text-xs text-slate-400">
              Se creará <strong>Summit RRHH / Legajos / {c.legajo ?? '???'} {c.nombre}</strong> con subcarpetas: Documentos personales, Contratos, Recibos.
            </p>
            <button
              onClick={onCrearCarpeta}
              disabled={creando || !c.legajo}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white text-sm transition-colors"
            >
              {creando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
              {creando ? 'Creando...' : 'Crear carpeta en Drive'}
            </button>
          </>
        )}
      </div>

      {/* Foto */}
      <div className="bg-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <Camera className="w-4 h-4 text-pink-400" />
          Foto del colaborador
        </div>
        {noFolder && (
          <p className="text-xs text-slate-500">Creá la carpeta de legajo primero.</p>
        )}
        {!noFolder && c.foto_drive_file_id && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => window.api.rrhh.drive.openFile(c.foto_drive_file_id!)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ver en Drive
            </button>
            <button
              onClick={handleUploadFoto}
              disabled={uploadFoto.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 text-xs transition-colors disabled:opacity-50"
            >
              {uploadFoto.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Reemplazar
            </button>
          </div>
        )}
        {!noFolder && !c.foto_drive_file_id && (
          <button
            onClick={handleUploadFoto}
            disabled={uploadFoto.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors disabled:opacity-50"
          >
            {uploadFoto.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploadFoto.isPending ? 'Subiendo...' : 'Subir foto'}
          </button>
        )}
        {uploadFoto.isError && (
          <p className="text-xs text-red-400">{uploadFoto.error.message}</p>
        )}
      </div>

      {/* CV */}
      <div className="bg-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <FilePlus className="w-4 h-4 text-sky-400" />
          CV / Currículum
        </div>
        {noFolder && (
          <p className="text-xs text-slate-500">Creá la carpeta de legajo primero.</p>
        )}
        {!noFolder && c.cv_drive_file_id && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => window.api.rrhh.drive.openFile(c.cv_drive_file_id!)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ver en Drive
            </button>
            <button
              onClick={handleUploadCv}
              disabled={uploadCv.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 text-xs transition-colors disabled:opacity-50"
            >
              {uploadCv.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Reemplazar
            </button>
          </div>
        )}
        {!noFolder && !c.cv_drive_file_id && (
          <button
            onClick={handleUploadCv}
            disabled={uploadCv.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors disabled:opacity-50"
          >
            {uploadCv.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploadCv.isPending ? 'Subiendo...' : 'Subir CV (PDF)'}
          </button>
        )}
        {uploadCv.isError && (
          <p className="text-xs text-red-400">{uploadCv.error.message}</p>
        )}
      </div>
    </div>
  )
}
