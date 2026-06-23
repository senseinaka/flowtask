import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import { useUpsertColaborador, useRrhhListas } from '../../hooks/useRrhh'
import type { RrhhColaborador, UpsertColaboradorInput, RrhhListaTipo } from '@shared/types'

interface Props {
  colaborador: RrhhColaborador | null
  onClose: () => void
}

const DIAS_SEMANA = [
  { key: 'lunes',     label: 'Lun' },
  { key: 'martes',    label: 'Mar' },
  { key: 'miercoles', label: 'Mié' },
  { key: 'jueves',    label: 'Jue' },
  { key: 'viernes',   label: 'Vie' },
  { key: 'sabado',    label: 'Sáb' },
]

function ListaSelect({
  tipo, value, onChange, placeholder
}: {
  tipo: RrhhListaTipo
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const { data: items = [] } = useRrhhListas(tipo)
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-pink-500"
    >
      <option value="">{placeholder ?? '—'}</option>
      {items.map(item => (
        <option key={item.id} value={item.valor}>{item.valor}</option>
      ))}
    </select>
  )
}

function DiasPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const activos = new Set(value ? value.split(',').map(d => d.trim()).filter(Boolean) : [])

  function toggle(dia: string) {
    const next = new Set(activos)
    next.has(dia) ? next.delete(dia) : next.add(dia)
    const ordered = DIAS_SEMANA.map(d => d.key).filter(k => next.has(k))
    onChange(ordered.join(','))
  }

  return (
    <div className="flex gap-1.5 flex-wrap">
      {DIAS_SEMANA.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => toggle(key)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
            activos.has(key)
              ? 'bg-pink-600 border-pink-500 text-white'
              : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-400'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export default function ColaboradorFormDrawer({ colaborador, onClose }: Props) {
  const upsert = useUpsertColaborador()
  const isEdit = !!colaborador

  const [form, setForm] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    if (colaborador) {
      const fields = [
        'nombre','documento','cuil','fecha_nacimiento','telefono',
        'email_personal','direccion','localidad','provincia',
        'legajo','tarea_habitual','sector','puesto','categoria_laboral',
        'fecha_ingreso','estado_laboral','tipo_contratacion','jornada',
        'modalidad','email_laboral','banco','cbu','observaciones',
        'dias_home_office',
      ]
      const f: Record<string, string> = {}
      for (const k of fields) {
        const v = (colaborador as unknown as Record<string, unknown>)[k]
        f[k] = v != null ? String(v) : ''
      }
      setForm(f)
    } else {
      setForm({ estado_laboral: 'activo', tipo_contratacion: 'relacion_dependencia', jornada: 'completa', modalidad: 'presencial' })
    }
  }, [colaborador])

  function set(key: string, val: string) {
    setForm(f => {
      const next = { ...f, [key]: val }
      if (key === 'modalidad' && val !== 'hibrido') next.dias_home_office = ''
      return next
    })
  }

  function handleSave() {
    if (!form.nombre?.trim()) { setError('El nombre es obligatorio'); return }
    if (!form.documento?.trim()) { setError('El documento es obligatorio'); return }
    setError('')
    const data: UpsertColaboradorInput = { ...form as unknown as UpsertColaboradorInput }
    if (isEdit && colaborador) data.id = colaborador.id
    upsert.mutate(data, { onSuccess: onClose })
  }

  const inp = 'w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-pink-500'
  const sel = 'w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-pink-500'
  const lbl = 'block text-xs text-slate-400 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] bg-slate-900 rounded-xl border border-slate-700 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-base font-semibold text-slate-100">
            {isEdit ? 'Editar colaborador' : 'Nuevo colaborador'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* Personal */}
          <section>
            <h3 className="text-xs font-semibold text-pink-400 uppercase tracking-wider mb-3">Personal</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={lbl}>Nombre completo</label>
                <input className={inp} value={form.nombre ?? ''} onChange={e => set('nombre', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Documento (DNI)</label>
                <input className={inp} value={form.documento ?? ''} onChange={e => set('documento', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>CUIL</label>
                <input className={inp} value={form.cuil ?? ''} onChange={e => set('cuil', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Fecha de nacimiento <span className="text-slate-600 font-normal">dd-mm-aaaa</span></label>
                <input className={inp} placeholder="15-06-1990" value={form.fecha_nacimiento ?? ''} onChange={e => set('fecha_nacimiento', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Celular</label>
                <input className={inp} value={form.telefono ?? ''} onChange={e => set('telefono', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Email personal</label>
                <input type="email" className={inp} value={form.email_personal ?? ''} onChange={e => set('email_personal', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Dirección</label>
                <input className={inp} value={form.direccion ?? ''} onChange={e => set('direccion', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Localidad</label>
                <input className={inp} value={form.localidad ?? ''} onChange={e => set('localidad', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Provincia</label>
                <input className={inp} value={form.provincia ?? ''} onChange={e => set('provincia', e.target.value)} />
              </div>
            </div>
          </section>

          {/* Laboral */}
          <section>
            <h3 className="text-xs font-semibold text-pink-400 uppercase tracking-wider mb-3">Laboral</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Legajo</label>
                <input className={inp} value={form.legajo ?? ''} onChange={e => set('legajo', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>F. ingreso <span className="text-slate-600 font-normal">dd-mm-aaaa</span></label>
                <input className={inp} placeholder="01-03-2022" value={form.fecha_ingreso ?? ''} onChange={e => set('fecha_ingreso', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Tarea habitual</label>
                <input className={inp} value={form.tarea_habitual ?? ''} onChange={e => set('tarea_habitual', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Sector</label>
                <ListaSelect tipo="sector" value={form.sector ?? ''} onChange={v => set('sector', v)} />
              </div>
              <div>
                <label className={lbl}>Puesto</label>
                <ListaSelect tipo="puesto" value={form.puesto ?? ''} onChange={v => set('puesto', v)} />
              </div>
              <div>
                <label className={lbl}>Categoría</label>
                <ListaSelect tipo="categoria" value={form.categoria_laboral ?? ''} onChange={v => set('categoria_laboral', v)} />
              </div>
              <div>
                <label className={lbl}>Estado</label>
                <select className={sel} value={form.estado_laboral ?? ''} onChange={e => set('estado_laboral', e.target.value)}>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="licencia">Licencia</option>
                  <option value="suspendido">Suspendido</option>
                  <option value="externo">Externo</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Contratación</label>
                <select className={sel} value={form.tipo_contratacion ?? ''} onChange={e => set('tipo_contratacion', e.target.value)}>
                  <option value="">—</option>
                  <option value="relacion_dependencia">Relación de dependencia</option>
                  <option value="monotributo">Monotributista</option>
                  <option value="eventual">Eventual</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Jornada</label>
                <select className={sel} value={form.jornada ?? ''} onChange={e => set('jornada', e.target.value)}>
                  <option value="">—</option>
                  <option value="completa">Completa</option>
                  <option value="parcial">Parcial</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Modalidad</label>
                <select className={sel} value={form.modalidad ?? ''} onChange={e => set('modalidad', e.target.value)}>
                  <option value="">—</option>
                  <option value="presencial">Presencial</option>
                  <option value="remoto">Remoto</option>
                  <option value="hibrido">Híbrido</option>
                </select>
              </div>
              {form.modalidad === 'hibrido' && (
                <div className="col-span-2">
                  <label className={lbl}>Días de home office</label>
                  <DiasPicker value={form.dias_home_office ?? ''} onChange={v => set('dias_home_office', v)} />
                </div>
              )}
              <div>
                <label className={lbl}>Email laboral</label>
                <input type="email" className={inp} value={form.email_laboral ?? ''} onChange={e => set('email_laboral', e.target.value)} />
              </div>
            </div>
          </section>

          {/* Banco */}
          <section>
            <h3 className="text-xs font-semibold text-pink-400 uppercase tracking-wider mb-3">Bancario</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Banco</label>
                <ListaSelect tipo="banco" value={form.banco ?? ''} onChange={v => set('banco', v)} />
              </div>
              <div>
                <label className={lbl}>CBU</label>
                <input className={inp} value={form.cbu ?? ''} onChange={e => set('cbu', e.target.value)} />
              </div>
            </div>
          </section>

          {/* Notas */}
          <section>
            <h3 className="text-xs font-semibold text-pink-400 uppercase tracking-wider mb-3">Observaciones</h3>
            <textarea
              rows={3}
              value={form.observaciones ?? ''}
              onChange={e => set('observaciones', e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-pink-500 resize-none"
            />
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-700 flex-shrink-0">
          {error ? <p className="text-xs text-red-400">{error}</p> : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={upsert.isPending}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {upsert.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
