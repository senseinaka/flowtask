import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import { useUpsertColaborador } from '../../hooks/useRrhh'
import type { RrhhColaborador, UpsertColaboradorInput } from '@shared/types'

interface Props {
  colaborador: RrhhColaborador | null
  onClose: () => void
}

type Campo = {
  key: keyof UpsertColaboradorInput
  label: string
  type?: 'text' | 'email' | 'select'
  options?: { value: string; label: string }[]
  section?: string
}

const CAMPOS: Campo[] = [
  // Personal
  { key: 'nombre',           label: 'Nombre completo',   section: 'Personal' },
  { key: 'documento',        label: 'Documento (DNI)',   section: 'Personal' },
  { key: 'cuil',             label: 'CUIL',              section: 'Personal' },
  { key: 'fecha_nacimiento', label: 'F. nacimiento',     section: 'Personal' },
  { key: 'telefono',         label: 'Teléfono',          section: 'Personal' },
  { key: 'email_personal',   label: 'Email personal',    section: 'Personal', type: 'email' },
  { key: 'direccion',        label: 'Dirección',         section: 'Personal' },
  { key: 'localidad',        label: 'Localidad',         section: 'Personal' },
  { key: 'provincia',        label: 'Provincia',         section: 'Personal' },
  // Laboral
  { key: 'legajo',           label: 'Legajo',            section: 'Laboral' },
  { key: 'tarea_habitual',   label: 'Tarea habitual',    section: 'Laboral' },
  { key: 'sector',           label: 'Sector',            section: 'Laboral' },
  { key: 'puesto',           label: 'Puesto',            section: 'Laboral' },
  { key: 'categoria_laboral',label: 'Categoría',         section: 'Laboral' },
  { key: 'fecha_ingreso',    label: 'F. ingreso',        section: 'Laboral' },
  {
    key: 'estado_laboral', label: 'Estado', section: 'Laboral', type: 'select',
    options: [
      { value: 'activo',     label: 'Activo' },
      { value: 'inactivo',   label: 'Inactivo' },
      { value: 'licencia',   label: 'Licencia' },
      { value: 'suspendido', label: 'Suspendido' },
      { value: 'externo',    label: 'Externo' },
    ]
  },
  {
    key: 'tipo_contratacion', label: 'Contratación', section: 'Laboral', type: 'select',
    options: [
      { value: 'relacion_dependencia', label: 'Relación de dependencia' },
      { value: 'monotributo',          label: 'Monotributista' },
      { value: 'eventual',             label: 'Eventual' },
      { value: 'otro',                 label: 'Otro' },
    ]
  },
  {
    key: 'jornada', label: 'Jornada', section: 'Laboral', type: 'select',
    options: [
      { value: 'completa', label: 'Completa' },
      { value: 'parcial',  label: 'Parcial' },
    ]
  },
  {
    key: 'modalidad', label: 'Modalidad', section: 'Laboral', type: 'select',
    options: [
      { value: 'presencial', label: 'Presencial' },
      { value: 'remoto',     label: 'Remoto' },
      { value: 'hibrido',    label: 'Híbrido' },
    ]
  },
  { key: 'email_laboral',    label: 'Email laboral',  section: 'Laboral', type: 'email' },
  // Bancario
  { key: 'banco',  label: 'Banco',  section: 'Banco' },
  { key: 'cbu',    label: 'CBU',    section: 'Banco' },
  // Extra
  { key: 'observaciones', label: 'Observaciones', section: 'Notas' },
]

export default function ColaboradorFormDrawer({ colaborador, onClose }: Props) {
  const upsert = useUpsertColaborador()
  const isEdit = !!colaborador

  const [form, setForm] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    if (colaborador) {
      const f: Record<string, string> = {}
      for (const campo of CAMPOS) {
        const v = (colaborador as unknown as Record<string, unknown>)[campo.key]
        f[campo.key] = v != null ? String(v) : ''
      }
      setForm(f)
    } else {
      setForm({ estado_laboral: 'activo', tipo_contratacion: 'relacion_dependencia', jornada: 'completa', modalidad: 'presencial' })
    }
  }, [colaborador])

  function handleSave() {
    if (!form.nombre?.trim()) { setError('El nombre es obligatorio'); return }
    if (!form.documento?.trim()) { setError('El documento es obligatorio'); return }
    setError('')

    const data: UpsertColaboradorInput = { ...form as unknown as UpsertColaboradorInput }
    if (isEdit && colaborador) data.id = colaborador.id

    upsert.mutate(data, { onSuccess: onClose })
  }

  const sections = [...new Set(CAMPOS.map(c => c.section!))]

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex flex-col w-[480px] bg-slate-900 border-l border-slate-700 overflow-hidden">
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
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {sections.map(section => (
            <div key={section}>
              <h3 className="text-xs font-semibold text-pink-400 uppercase tracking-wider mb-3">{section}</h3>
              <div className="grid grid-cols-2 gap-3">
                {CAMPOS.filter(c => c.section === section).map(campo => (
                  <div key={campo.key} className={campo.key === 'observaciones' ? 'col-span-2' : ''}>
                    <label className="block text-xs text-slate-400 mb-1">{campo.label}</label>
                    {campo.type === 'select' ? (
                      <select
                        value={form[campo.key] ?? ''}
                        onChange={e => setForm(f => ({ ...f, [campo.key]: e.target.value }))}
                        className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-pink-500"
                      >
                        <option value="">—</option>
                        {campo.options?.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : campo.key === 'observaciones' ? (
                      <textarea
                        rows={3}
                        value={form[campo.key] ?? ''}
                        onChange={e => setForm(f => ({ ...f, [campo.key]: e.target.value }))}
                        className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-pink-500 resize-none"
                      />
                    ) : (
                      <input
                        type={campo.type ?? 'text'}
                        value={form[campo.key] ?? ''}
                        onChange={e => setForm(f => ({ ...f, [campo.key]: e.target.value }))}
                        className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-pink-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-700 flex-shrink-0">
          {error && <p className="text-xs text-red-400">{error}</p>}
          {!error && <div />}
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
