import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, User, Briefcase, TrendingUp, FolderOpen, FileText,
  Edit2, ExternalLink, Loader2, AlertCircle, FolderPlus, Tag,
  Camera, Upload, FilePlus, Check, X, Trash2
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import {
  useHistorialColaborador, useAsignarLegajo, useCrearDriveColaborador,
  useDeleteColaborador, useHardDeleteColaborador, useNominaColaboradores,
  useUploadColaboradorFoto, useUploadColaboradorCv, useFotoDataUrl,
  useUpsertColaborador, useRrhhListas,
} from '../../hooks/useRrhh'
import type { RrhhColaboradorConStats, UpsertColaboradorInput } from '@shared/types'
import { useRrhhEmpresa } from './RrhhEmpresaContext'
import ColaboradorFormDrawer from './ColaboradorFormDrawer'

type Tab = 'resumen' | 'personal' | 'laboral' | 'sueldos' | 'drive'

const TABS: { id: Tab; label: string }[] = [
  { id: 'resumen',  label: 'Resumen'  },
  { id: 'personal', label: 'Personal' },
  { id: 'laboral',  label: 'Laboral'  },
  { id: 'sueldos',  label: 'Sueldos'  },
  { id: 'drive',    label: 'Drive'    },
]

const ESTADO_COLORS: Record<string, string> = {
  activo:     'bg-emerald-500/20 text-emerald-300',
  inactivo:   'bg-slate-500/20 text-slate-400',
  licencia:   'bg-amber-500/20 text-amber-300',
  suspendido: 'bg-red-500/20 text-red-300',
  externo:    'bg-sky-500/20 text-sky-300',
}

const ESTADO_LABELS: Record<string, string> = {
  activo: 'Activo', inactivo: 'Inactivo', licencia: 'Licencia',
  suspendido: 'Suspendido', externo: 'Externo',
}

const DIAS_SEMANA = [
  { key: 'lunes', label: 'Lunes' },
  { key: 'martes', label: 'Martes' },
  { key: 'miercoles', label: 'Miércoles' },
  { key: 'jueves', label: 'Jueves' },
  { key: 'viernes', label: 'Viernes' },
  { key: 'sabado', label: 'Sábado' },
]

function fmtM(n: number | null | undefined) {
  if (n == null) return '—'
  return '$' + Math.round(n).toLocaleString('es-AR')
}

const INP = 'w-full px-2.5 py-1 bg-slate-700 border border-slate-600 rounded-md text-sm text-slate-100 focus:outline-none focus:border-pink-500'
const SEL = 'w-full px-2.5 py-1 bg-slate-700 border border-slate-600 rounded-md text-sm text-slate-100 focus:outline-none focus:border-pink-500'

function EditField({ label, value, onChange, type }: {
  label: string; value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <div>
      <dt className="text-xs text-slate-500 mb-0.5">{label}</dt>
      <input type={type ?? 'text'} value={value} onChange={e => onChange(e.target.value)} className={INP} />
    </div>
  )
}

function ViewField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-200 mt-0.5">{value || <span className="text-slate-600">—</span>}</dd>
    </div>
  )
}

// ── Avatar foto ──────────────────────────────────────────────────────────────

function AvatarFoto({ colaborador }: { colaborador: RrhhColaboradorConStats }) {
  const uploadFoto = useUploadColaboradorFoto()
  const { data: fotoUrl } = useFotoDataUrl(colaborador.id, !!colaborador.foto_drive_file_id)

  async function handleUpload() {
    const localPath = await window.api.rrhh.nomina.colaboradores.selectImageFile()
    if (!localPath) return
    uploadFoto.mutate({ id: colaborador.id, localPath })
  }

  const initials = colaborador.nombre
    .split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const hue = Array.from(colaborador.nombre).reduce((a, c) => a + c.charCodeAt(0), 0) % 360

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
          <div className="w-full h-full flex items-center justify-center text-white text-base font-semibold"
            style={{ background: `hsl(${hue}, 35%, 28%)` }}>
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

// ── Delete dialog ──────────────────────────────────────────────────────────

type DeleteMode = 'baja' | 'eliminar'

function DeleteDialog({ nombre, onClose, onBaja, onEliminar, pending }: {
  nombre: string
  onClose: () => void
  onBaja: () => void
  onEliminar: () => void
  pending: boolean
}) {
  const [mode, setMode] = useState<DeleteMode>('baja')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl p-6 w-96 space-y-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Gestionar colaborador</h3>
            <p className="text-xs text-slate-400 mt-0.5">{nombre}</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            mode === 'baja' ? 'border-amber-500/50 bg-amber-500/5' : 'border-slate-700 hover:border-slate-600'
          }`}>
            <input type="radio" name="mode" checked={mode === 'baja'} onChange={() => setMode('baja')} className="mt-0.5 accent-amber-500" />
            <div>
              <div className="text-sm font-medium text-slate-200">Dar de baja</div>
              <div className="text-xs text-slate-500 mt-0.5">Marca como inactivo. Conserva el historial de sueldos y puede reactivarse.</div>
            </div>
          </label>
          <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            mode === 'eliminar' ? 'border-red-500/50 bg-red-500/5' : 'border-slate-700 hover:border-slate-600'
          }`}>
            <input type="radio" name="mode" checked={mode === 'eliminar'} onChange={() => setMode('eliminar')} className="mt-0.5 accent-red-500" />
            <div>
              <div className="text-sm font-medium text-slate-200">Eliminar permanentemente</div>
              <div className="text-xs text-slate-500 mt-0.5">Borra el colaborador y todo su historial de sueldos. Esta acción no se puede deshacer.</div>
            </div>
          </label>
        </div>

        {mode === 'eliminar' && (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg p-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Se eliminarán todos los sueldos registrados de este colaborador.
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800">
            Cancelar
          </button>
          <button
            onClick={mode === 'baja' ? onBaja : onEliminar}
            disabled={pending}
            className={`px-4 py-1.5 text-sm text-white rounded-lg disabled:opacity-50 transition-colors ${
              mode === 'baja'
                ? 'bg-amber-600 hover:bg-amber-500'
                : 'bg-red-600 hover:bg-red-500'
            }`}
          >
            {pending ? 'Procesando...' : mode === 'baja' ? 'Confirmar baja' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ColaboradorProfile() {
  const { id } = useParams<{ id: string }>()
  const empresa = useRrhhEmpresa()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('resumen')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: colaboradores = [] } = useNominaColaboradores()
  const colaborador = colaboradores.find(c => c.id === id) as RrhhColaboradorConStats | undefined

  const { data: historial = [], isLoading: histLoading } = useHistorialColaborador(id ?? null)
  const asignarLegajo  = useAsignarLegajo()
  const crearDrive     = useCrearDriveColaborador()
  const softDelete     = useDeleteColaborador()
  const hardDelete     = useHardDeleteColaborador()

  if (!id) return null
  if (!colaborador) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Cargando...
      </div>
    )
  }

  const estado    = colaborador.estado_laboral ?? 'activo'
  const chartData = [...historial]
    .sort((a, b) => a.periodo.anio !== b.periodo.anio
      ? a.periodo.anio - b.periodo.anio
      : a.periodo.mes - b.periodo.mes)
    .map(h => ({
      label: h.periodo.label,
      neto:  h.sueldo.total_neto,
      vac:   h.sueldo.vacaciones_neto ?? 0,
      total: h.sueldo.total_neto + (h.sueldo.vacaciones_neto ?? 0),
    }))

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-700 flex-shrink-0">
        <button onClick={() => navigate(`/rrhh/nomina/${empresa}`)}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
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
            {(colaborador.puesto || colaborador.tarea_habitual) &&
              <span>{colaborador.puesto || colaborador.tarea_habitual}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDeleteOpen(true)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Eliminar colaborador">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors">
            <Edit2 className="w-4 h-4" />
            Editar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700 flex-shrink-0 px-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'border-pink-500 text-pink-300 font-medium'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {tab === 'resumen'  && <TabResumen colaborador={colaborador} chartData={chartData} histLoading={histLoading} />}
        {tab === 'personal' && <TabPersonal c={colaborador} />}
        {tab === 'laboral'  && (
          <TabLaboral
            c={colaborador}
            onAsignarLegajo={() => asignarLegajo.mutate(colaborador.id)}
            asignandoLegajo={asignarLegajo.isPending}
            onDeleteClick={() => setDeleteOpen(true)}
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

      {deleteOpen && (
        <DeleteDialog
          nombre={colaborador.nombre}
          onClose={() => setDeleteOpen(false)}
          pending={softDelete.isPending || hardDelete.isPending}
          onBaja={() => softDelete.mutate(colaborador.id, {
            onSuccess: () => { setDeleteOpen(false); navigate(`/rrhh/nomina/${empresa}`) }
          })}
          onEliminar={() => hardDelete.mutate(colaborador.id, {
            onSuccess: () => navigate(`/rrhh/nomina/${empresa}`)
          })}
        />
      )}

      {drawerOpen && (
        <ColaboradorFormDrawer colaborador={colaborador} onClose={() => setDrawerOpen(false)} />
      )}
    </div>
  )
}

// ── Sub-tabs ──────────────────────────────────────────────────────────────────

type ChartRange = '3m' | '6m' | '12m' | 'all'

function TabResumen({ colaborador, chartData, histLoading }: {
  colaborador: RrhhColaboradorConStats
  chartData: { label: string; neto: number; vac: number; total: number }[]
  histLoading: boolean
}) {
  const [range, setRange] = useState<ChartRange>('all')

  const filtered = range === 'all' ? chartData : chartData.slice(-Number(range.replace('m', '')))
  const RANGES: { id: ChartRange; label: string }[] = [
    { id: '3m', label: '3 m' }, { id: '6m', label: '6 m' },
    { id: '12m', label: '12 m' }, { id: 'all', label: 'Todo' },
  ]

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Último neto</div>
          <div className="text-xl font-bold text-pink-400">{fmtM(colaborador.ultimo_total_neto)}</div>
          {colaborador.ultimo_vacaciones_neto
            ? <div className="text-xs text-sky-400 mt-0.5">+ {fmtM(colaborador.ultimo_vacaciones_neto)} vac.</div>
            : null}
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Períodos liquidados</div>
          <div className="text-xl font-bold text-slate-200">{colaborador.total_periodos}</div>
          {colaborador.ultimo_periodo_label &&
            <div className="text-xs text-slate-500 mt-0.5">Último: {colaborador.ultimo_periodo_label}</div>}
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-1">Ingreso</div>
          <div className="text-base font-semibold text-slate-200">{colaborador.fecha_ingreso ?? '—'}</div>
          {colaborador.legajo &&
            <div className="text-xs text-slate-500 mt-0.5">Legajo {colaborador.legajo}</div>}
        </div>
      </div>

      {histLoading
        ? <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Cargando historial...</div>
        : filtered.length > 1 && (
          <div className="bg-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-300">Evolución de sueldos</h3>
              <div className="flex gap-1 bg-slate-700 rounded-lg p-0.5">
                {RANGES.map(r => (
                  <button key={r.id} onClick={() => setRange(r.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      range === r.id ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}>{r.label}</button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={filtered} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradNeto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f472b6" stopOpacity={0.4} />
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
        )
      }
    </div>
  )
}

// ── Tab Personal — inline edit ────────────────────────────────────────────────

function TabPersonal({ c }: { c: RrhhColaboradorConStats }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const upsert = useUpsertColaborador()

  function startEdit() {
    setForm({
      nombre:           c.nombre ?? '',
      documento:        c.documento ?? '',
      cuil:             c.cuil ?? '',
      fecha_nacimiento: c.fecha_nacimiento ?? '',
      telefono:         c.telefono ?? '',
      email_personal:   c.email_personal ?? '',
      direccion:        c.direccion ?? '',
      localidad:        c.localidad ?? '',
      provincia:        c.provincia ?? '',
      contacto_emergencia_1_nombre:  c.contacto_emergencia_1_nombre  ?? '',
      contacto_emergencia_1_celular: c.contacto_emergencia_1_celular ?? '',
      contacto_emergencia_1_vinculo: c.contacto_emergencia_1_vinculo ?? '',
      contacto_emergencia_2_nombre:  c.contacto_emergencia_2_nombre  ?? '',
      contacto_emergencia_2_celular: c.contacto_emergencia_2_celular ?? '',
      contacto_emergencia_2_vinculo: c.contacto_emergencia_2_vinculo ?? '',
    })
    setEditing(true)
  }

  function handleSave() {
    upsert.mutate(
      { ...form as unknown as UpsertColaboradorInput, id: c.id },
      { onSuccess: () => setEditing(false) }
    )
  }

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  if (editing) {
    return (
      <div className="max-w-xl space-y-5">
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Datos personales</h4>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            <div className="col-span-2">
              <EditField label="Nombre completo" value={form.nombre} onChange={set('nombre')} />
            </div>
            <EditField label="Documento (DNI)" value={form.documento} onChange={set('documento')} />
            <EditField label="CUIL" value={form.cuil} onChange={set('cuil')} />
            <div>
              <dt className="text-xs text-slate-500 mb-0.5">Fecha nacimiento <span className="text-slate-600">dd-mm-aaaa</span></dt>
              <input className={INP} placeholder="15-06-1990" value={form.fecha_nacimiento} onChange={e => set('fecha_nacimiento')(e.target.value)} />
            </div>
            <EditField label="Celular" value={form.telefono} onChange={set('telefono')} />
            <EditField label="Email personal" value={form.email_personal} onChange={set('email_personal')} type="email" />
            <EditField label="Dirección" value={form.direccion} onChange={set('direccion')} />
            <EditField label="Localidad" value={form.localidad} onChange={set('localidad')} />
            <EditField label="Provincia" value={form.provincia} onChange={set('provincia')} />
          </dl>
        </div>

        <div className="space-y-3 pt-1 border-t border-slate-800">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider pt-2">Contactos de emergencia</h4>
          {([1, 2] as const).map(n => (
            <div key={n} className="bg-slate-800/50 rounded-lg p-3 space-y-2">
              <div className="text-xs text-slate-500 font-medium">Contacto {n}</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-3 sm:col-span-1">
                  <EditField
                    label="Nombre"
                    value={form[`contacto_emergencia_${n}_nombre`]}
                    onChange={set(`contacto_emergencia_${n}_nombre`)}
                  />
                </div>
                <EditField
                  label="Celular"
                  value={form[`contacto_emergencia_${n}_celular`]}
                  onChange={set(`contacto_emergencia_${n}_celular`)}
                />
                <EditField
                  label="Vínculo"
                  value={form[`contacto_emergencia_${n}_vinculo`]}
                  onChange={set(`contacto_emergencia_${n}_vinculo`)}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={upsert.isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium disabled:opacity-50 transition-colors">
            <Check className="w-4 h-4" />
            {upsert.isPending ? 'Guardando...' : 'Guardar'}
          </button>
          <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  const hasContact1 = c.contacto_emergencia_1_nombre || c.contacto_emergencia_1_celular
  const hasContact2 = c.contacto_emergencia_2_nombre || c.contacto_emergencia_2_celular

  return (
    <div className="max-w-xl space-y-5">
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Datos personales</h4>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          <ViewField label="Nombre completo"  value={c.nombre} />
          <ViewField label="Documento (DNI)"  value={c.documento} />
          <ViewField label="CUIL"             value={c.cuil} />
          <ViewField label="Fecha nacimiento" value={c.fecha_nacimiento} />
          <ViewField label="Celular"          value={c.telefono} />
          <ViewField label="Email personal"   value={c.email_personal} />
          <ViewField label="Dirección"        value={c.direccion} />
          <ViewField label="Localidad"        value={c.localidad} />
          <ViewField label="Provincia"        value={c.provincia} />
        </dl>
      </div>

      {(hasContact1 || hasContact2) && (
        <div className="space-y-2 border-t border-slate-800 pt-4">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contactos de emergencia</h4>
          {[
            { n: 1, nombre: c.contacto_emergencia_1_nombre, celular: c.contacto_emergencia_1_celular, vinculo: c.contacto_emergencia_1_vinculo },
            { n: 2, nombre: c.contacto_emergencia_2_nombre, celular: c.contacto_emergencia_2_celular, vinculo: c.contacto_emergencia_2_vinculo },
          ].filter(ct => ct.nombre || ct.celular).map(ct => (
            <div key={ct.n} className="bg-slate-800/50 rounded-lg p-3 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-200">{ct.nombre || '—'}</div>
                {ct.vinculo && <div className="text-xs text-slate-500 mt-0.5">{ct.vinculo}</div>}
              </div>
              {ct.celular && (
                <div className="text-sm text-slate-300 font-mono flex-shrink-0">{ct.celular}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <button onClick={startEdit}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors">
        <Edit2 className="w-3.5 h-3.5" /> Editar datos personales
      </button>
    </div>
  )
}

// ── Tab Laboral — inline edit ─────────────────────────────────────────────────

const MODALIDAD_LABELS: Record<string, string> = {
  presencial: 'Presencial', remoto: 'Remoto', hibrido: 'Híbrido',
}
const CONTRATACION_LABELS: Record<string, string> = {
  relacion_dependencia: 'Rel. de dependencia', monotributo: 'Monotributista',
  eventual: 'Eventual', otro: 'Otro',
}

function TabLaboral({ c, onAsignarLegajo, asignandoLegajo, onDeleteClick }: {
  c: RrhhColaboradorConStats
  onAsignarLegajo: () => void
  asignandoLegajo: boolean
  onDeleteClick: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const upsert = useUpsertColaborador()
  const { data: sectores = [] }   = useRrhhListas('sector')
  const { data: puestos = [] }    = useRrhhListas('puesto')
  const { data: categorias = [] } = useRrhhListas('categoria')
  const { data: bancos = [] }     = useRrhhListas('banco')

  function startEdit() {
    setForm({
      nombre:            c.nombre ?? '',
      documento:         c.documento ?? '',
      tarea_habitual:    c.tarea_habitual ?? '',
      sector:            c.sector ?? '',
      puesto:            c.puesto ?? '',
      categoria_laboral: c.categoria_laboral ?? '',
      fecha_ingreso:     c.fecha_ingreso ?? '',
      estado_laboral:    c.estado_laboral ?? 'activo',
      tipo_contratacion: c.tipo_contratacion ?? '',
      jornada:           c.jornada ?? '',
      modalidad:         c.modalidad ?? '',
      email_laboral:     c.email_laboral ?? '',
      banco:             c.banco ?? 'Banco Galicia',
      cbu:               c.cbu ?? '',
      dias_home_office:  c.dias_home_office ?? '',
    })
    setEditing(true)
  }

  function handleSave() {
    const next = { ...form as unknown as UpsertColaboradorInput, id: c.id }
    if (form.modalidad !== 'hibrido') next.dias_home_office = null
    upsert.mutate(next, { onSuccess: () => setEditing(false) })
  }

  const diasActivos = new Set(c.dias_home_office ? c.dias_home_office.split(',').map(d => d.trim()) : [])

  if (editing) {
    const diasSet = new Set(form.dias_home_office ? form.dias_home_office.split(',').map(d => d.trim()).filter(Boolean) : [])
    function toggleDia(dia: string) {
      const next = new Set(diasSet)
      next.has(dia) ? next.delete(dia) : next.add(dia)
      const ordered = DIAS_SEMANA.map(d => d.key).filter(k => next.has(k))
      setForm(f => ({ ...f, dias_home_office: ordered.join(',') }))
    }

    return (
      <div className="max-w-xl space-y-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          <EditField label="Tarea habitual" value={form.tarea_habitual} onChange={v => setForm(f => ({ ...f, tarea_habitual: v }))} />
          <div>
            <dt className="text-xs text-slate-500 mb-0.5">Sector</dt>
            <select className={SEL} value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}>
              <option value="">—</option>
              {sectores.map(s => <option key={s.id} value={s.valor}>{s.valor}</option>)}
            </select>
          </div>
          <div>
            <dt className="text-xs text-slate-500 mb-0.5">Puesto</dt>
            <select className={SEL} value={form.puesto} onChange={e => setForm(f => ({ ...f, puesto: e.target.value }))}>
              <option value="">—</option>
              {puestos.map(s => <option key={s.id} value={s.valor}>{s.valor}</option>)}
            </select>
          </div>
          <div>
            <dt className="text-xs text-slate-500 mb-0.5">Categoría</dt>
            <select className={SEL} value={form.categoria_laboral} onChange={e => setForm(f => ({ ...f, categoria_laboral: e.target.value }))}>
              <option value="">—</option>
              {categorias.map(s => <option key={s.id} value={s.valor}>{s.valor}</option>)}
            </select>
          </div>
          <div>
            <dt className="text-xs text-slate-500 mb-0.5">F. ingreso <span className="text-slate-600">dd-mm-aaaa</span></dt>
            <input className={INP} placeholder="01-03-2022" value={form.fecha_ingreso} onChange={e => setForm(f => ({ ...f, fecha_ingreso: e.target.value }))} />
          </div>
          <div>
            <dt className="text-xs text-slate-500 mb-0.5">Estado</dt>
            <select className={SEL} value={form.estado_laboral} onChange={e => setForm(f => ({ ...f, estado_laboral: e.target.value }))}>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
              <option value="licencia">Licencia</option>
              <option value="suspendido">Suspendido</option>
              <option value="externo">Externo</option>
            </select>
          </div>
          <div>
            <dt className="text-xs text-slate-500 mb-0.5">Contratación</dt>
            <select className={SEL} value={form.tipo_contratacion} onChange={e => setForm(f => ({ ...f, tipo_contratacion: e.target.value }))}>
              <option value="">—</option>
              <option value="relacion_dependencia">Rel. de dependencia</option>
              <option value="monotributo">Monotributista</option>
              <option value="eventual">Eventual</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <dt className="text-xs text-slate-500 mb-0.5">Jornada</dt>
            <select className={SEL} value={form.jornada} onChange={e => setForm(f => ({ ...f, jornada: e.target.value }))}>
              <option value="">—</option>
              <option value="completa">Completa</option>
              <option value="parcial">Parcial</option>
            </select>
          </div>
          <div>
            <dt className="text-xs text-slate-500 mb-0.5">Modalidad</dt>
            <select className={SEL} value={form.modalidad} onChange={e => setForm(f => ({ ...f, modalidad: e.target.value, dias_home_office: '' }))}>
              <option value="">—</option>
              <option value="presencial">Presencial</option>
              <option value="remoto">Remoto</option>
              <option value="hibrido">Híbrido</option>
            </select>
          </div>
          {form.modalidad === 'hibrido' && (
            <div className="col-span-2">
              <dt className="text-xs text-slate-500 mb-1.5">Días de home office</dt>
              <div className="flex gap-1.5 flex-wrap">
                {DIAS_SEMANA.map(({ key, label }) => (
                  <button key={key} type="button" onClick={() => toggleDia(key)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                      diasSet.has(key)
                        ? 'bg-pink-600 border-pink-500 text-white'
                        : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-400'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <EditField label="Email laboral" value={form.email_laboral} onChange={v => setForm(f => ({ ...f, email_laboral: v }))} type="email" />
          <div>
            <dt className="text-xs text-slate-500 mb-0.5">Banco</dt>
            <select className={SEL} value={form.banco} onChange={e => setForm(f => ({ ...f, banco: e.target.value }))}>
              <option value="">—</option>
              {bancos.map(b => <option key={b.id} value={b.valor}>{b.valor}</option>)}
            </select>
          </div>
          <EditField label="CBU" value={form.cbu} onChange={v => setForm(f => ({ ...f, cbu: v }))} />
        </dl>
        <div className="flex gap-2 pt-2">
          <button onClick={handleSave} disabled={upsert.isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium disabled:opacity-50">
            <Check className="w-4 h-4" />{upsert.isPending ? 'Guardando...' : 'Guardar'}
          </button>
          <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl space-y-5">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
        <div>
          <dt className="text-xs text-slate-500">Legajo</dt>
          <dd className="flex items-center gap-2 mt-0.5">
            {c.legajo
              ? <span className="font-mono text-sm text-slate-200">{c.legajo}</span>
              : <span className="text-slate-600 text-sm">Sin asignar</span>
            }
            {!c.legajo && (
              <button onClick={onAsignarLegajo} disabled={asignandoLegajo}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-pink-600/20 hover:bg-pink-600/30 text-pink-300 text-xs disabled:opacity-50">
                <Tag className="w-3 h-3" />
                {asignandoLegajo ? 'Asignando...' : 'Asignar'}
              </button>
            )}
          </dd>
        </div>
        <ViewField label="F. ingreso"        value={c.fecha_ingreso} />
        <ViewField label="Tarea habitual"     value={c.tarea_habitual} />
        <ViewField label="Sector"             value={c.sector} />
        <ViewField label="Puesto"             value={c.puesto} />
        <ViewField label="Categoría"          value={c.categoria_laboral} />
        <ViewField label="Contratación"       value={CONTRATACION_LABELS[c.tipo_contratacion ?? ''] ?? c.tipo_contratacion} />
        <ViewField label="Jornada"            value={c.jornada} />
        <div>
          <dt className="text-xs text-slate-500">Modalidad</dt>
          <dd className="text-sm text-slate-200 mt-0.5">
            {MODALIDAD_LABELS[c.modalidad ?? ''] ?? c.modalidad ?? <span className="text-slate-600">—</span>}
            {c.modalidad === 'hibrido' && c.dias_home_office && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {c.dias_home_office.split(',').map(d => d.trim()).filter(Boolean).map(dia => {
                  const info = DIAS_SEMANA.find(x => x.key === dia)
                  return (
                    <span key={dia} className="px-2 py-0.5 rounded-full bg-pink-600/15 text-pink-300 text-xs">
                      {info?.label ?? dia}
                    </span>
                  )
                })}
              </div>
            )}
          </dd>
        </div>
        <ViewField label="Email laboral"      value={c.email_laboral} />
        <ViewField label="Banco"              value={c.banco} />
        <ViewField label="CBU"                value={c.cbu} />
      </dl>
      {c.observaciones && (
        <div>
          <dt className="text-xs text-slate-500 mb-1">Observaciones</dt>
          <dd className="text-sm text-slate-300 bg-slate-800 rounded-lg p-3">{c.observaciones}</dd>
        </div>
      )}
      <button onClick={startEdit}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors">
        <Edit2 className="w-3.5 h-3.5" /> Editar datos laborales
      </button>
    </div>
  )
}

// ── Tab Sueldos ───────────────────────────────────────────────────────────────

function TabSueldos({ historial, loading, chartData }: {
  historial: ReturnType<typeof useHistorialColaborador>['data']
  loading: boolean
  chartData: { label: string; neto: number; vac: number; total: number }[]
}) {
  const [range, setRange] = useState<ChartRange>('all')
  const filtered = range === 'all' ? chartData : chartData.slice(-Number(range.replace('m', '')))
  const RANGES: { id: ChartRange; label: string }[] = [
    { id: '3m', label: '3 m' }, { id: '6m', label: '6 m' },
    { id: '12m', label: '12 m' }, { id: 'all', label: 'Todo' },
  ]

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
    <div className="space-y-5 max-w-3xl">
      {filtered.length > 1 && (
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-300">Evolución histórica</h3>
            <div className="flex gap-1 bg-slate-700 rounded-lg p-0.5">
              {RANGES.map(r => (
                <button key={r.id} onClick={() => setRange(r.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    range === r.id ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}>{r.label}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={filtered} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradN" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f472b6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f472b6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradV" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
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
              <Area dataKey="vac" stroke="#38bdf8" fill="url(#gradV)" strokeWidth={1.5} name="Vacaciones" dot={false} />
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
                  {h.delta_pct != null
                    ? <span className={h.delta_pct >= 0 ? 'text-emerald-400 text-xs' : 'text-red-400 text-xs'}>
                        {h.delta_pct >= 0 ? '+' : ''}{h.delta_pct}%
                      </span>
                    : <span className="text-slate-600 text-xs">—</span>
                  }
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Tab Drive ─────────────────────────────────────────────────────────────────

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
      {/* Carpeta */}
      <div className="bg-slate-800 rounded-xl p-5 space-y-3">
        {c.drive_legajo_folder_id ? (
          <>
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <FolderOpen className="w-4 h-4" /> Carpeta de legajo creada
            </div>
            <p className="text-xs text-slate-400">
              <strong>Summit RRHH / Legajos / {c.legajo} {c.nombre}</strong>
            </p>
            <button onClick={() => window.api.rrhh.drive.openFolder(c.drive_legajo_folder_id!)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm">
              <ExternalLink className="w-4 h-4" /> Abrir en Drive
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
              <FolderOpen className="w-4 h-4" /> Sin carpeta de legajo
            </div>
            {!c.legajo && (
              <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/10 rounded-lg p-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Asigná un legajo primero desde la tab Laboral.
              </div>
            )}
            <p className="text-xs text-slate-400">
              Se creará <strong>Summit RRHH / Legajos / {c.legajo ?? '???'} {c.nombre}</strong>.
            </p>
            <button onClick={onCrearCarpeta} disabled={creando || !c.legajo}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white text-sm">
              {creando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
              {creando ? 'Creando...' : 'Crear carpeta en Drive'}
            </button>
          </>
        )}
      </div>

      {/* Foto */}
      <div className="bg-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <Camera className="w-4 h-4 text-pink-400" /> Foto del colaborador
        </div>
        {noFolder
          ? <p className="text-xs text-slate-500">Creá la carpeta de legajo primero.</p>
          : c.foto_drive_file_id
            ? (
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => window.api.rrhh.drive.openFile(c.foto_drive_file_id!)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs">
                  <ExternalLink className="w-3.5 h-3.5" /> Ver en Drive
                </button>
                <button onClick={handleUploadFoto} disabled={uploadFoto.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 text-xs disabled:opacity-50">
                  {uploadFoto.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  Reemplazar
                </button>
              </div>
            )
            : (
              <button onClick={handleUploadFoto} disabled={uploadFoto.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm disabled:opacity-50">
                {uploadFoto.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploadFoto.isPending ? 'Subiendo...' : 'Subir foto'}
              </button>
            )
        }
        {uploadFoto.isError && <p className="text-xs text-red-400">{uploadFoto.error.message}</p>}
      </div>

      {/* CV */}
      <div className="bg-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <FilePlus className="w-4 h-4 text-sky-400" /> CV / Currículum
        </div>
        {noFolder
          ? <p className="text-xs text-slate-500">Creá la carpeta de legajo primero.</p>
          : c.cv_drive_file_id
            ? (
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => window.api.rrhh.drive.openFile(c.cv_drive_file_id!)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs">
                  <ExternalLink className="w-3.5 h-3.5" /> Ver en Drive
                </button>
                <button onClick={handleUploadCv} disabled={uploadCv.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 text-xs disabled:opacity-50">
                  {uploadCv.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  Reemplazar
                </button>
              </div>
            )
            : (
              <button onClick={handleUploadCv} disabled={uploadCv.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm disabled:opacity-50">
                {uploadCv.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploadCv.isPending ? 'Subiendo...' : 'Subir CV (PDF)'}
              </button>
            )
        }
        {uploadCv.isError && <p className="text-xs text-red-400">{uploadCv.error.message}</p>}
      </div>
    </div>
  )
}
