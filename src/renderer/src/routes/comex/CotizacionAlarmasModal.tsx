import { useState } from 'react'
import { X, Plus, Trash2, Bell, BellOff } from 'lucide-react'
import { parseAmount } from '../../lib/parseAmount'
import {
  useAlarmasCotizacion,
  useAddAlarmaCotizacion,
  useUpdateAlarmaCotizacion,
  useDeleteAlarmaCotizacion
} from '../../hooks/useComex'
import type {
  ComexAlarmaCotizacion,
  ComexMoneda,
  AlarmaTipoCotizacion,
  AlarmaTipoUmbral,
  AlarmaDireccion
} from '@shared/types'

interface Props {
  onClose: () => void
}

const MONEDAS: ComexMoneda[] = ['USD', 'EUR']
const TIPOS_COT: { value: AlarmaTipoCotizacion; label: string }[] = [
  { value: 'divisa',     label: 'Divisa' },
  { value: 'billete',    label: 'Billete' },
  { value: 'cualquiera', label: 'Cualquiera (el mayor)' },
]
const TIPOS_UMBRAL: { value: AlarmaTipoUmbral; label: string }[] = [
  { value: 'porcentaje', label: 'Porcentaje (%)' },
  { value: 'valor',      label: 'Valor ARS ($)' },
]
const DIRECCIONES: { value: AlarmaDireccion; label: string }[] = [
  { value: 'supera',    label: 'Supera' },
  { value: 'cae_bajo',  label: 'Cae bajo' },
]

const EMPTY_FORM = {
  moneda:          'USD'         as ComexMoneda,
  tipo_cotizacion: 'divisa'      as AlarmaTipoCotizacion,
  tipo_umbral:     'porcentaje'  as AlarmaTipoUmbral,
  umbral:          '',
  direccion:       'supera'      as AlarmaDireccion,
  whatsapp_numero: '',
  cooldown_horas:  '24',
}

function fmtFecha(ts: number | null): string {
  if (!ts) return 'nunca'
  return new Date(ts).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function AlarmaRow({ alarma }: { alarma: ComexAlarmaCotizacion }) {
  const toggle = useUpdateAlarmaCotizacion()
  const del    = useDeleteAlarmaCotizacion()

  const tipoCot = TIPOS_COT.find(t => t.value === alarma.tipo_cotizacion)?.label ?? alarma.tipo_cotizacion
  const umbralLabel = alarma.tipo_umbral === 'porcentaje'
    ? `${alarma.umbral}%`
    : `$${alarma.umbral.toLocaleString('es-AR')}`
  const condLabel = `${alarma.direccion === 'supera' ? 'Supera' : 'Cae bajo'} ${umbralLabel} vs Naka`

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
      alarma.activa ? 'border-slate-700/60 bg-slate-800/40' : 'border-slate-800/40 bg-slate-900/40 opacity-60'
    }`}>
      <button
        onClick={() => toggle.mutate({ id: alarma.id, changes: { activa: alarma.activa ? 0 : 1 } })}
        className="mt-0.5 shrink-0"
        title={alarma.activa ? 'Desactivar' : 'Activar'}
      >
        {alarma.activa
          ? <Bell size={15} className="text-amber-400" />
          : <BellOff size={15} className="text-slate-600" />
        }
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
            alarma.moneda === 'USD'
              ? 'bg-blue-950/60 text-blue-400'
              : 'bg-purple-950/60 text-purple-400'
          }`}>{alarma.moneda}</span>
          <span className="text-[11px] text-slate-400">{tipoCot}</span>
        </div>
        <p className="text-xs text-slate-300">{condLabel}</p>
        <div className="flex gap-3 mt-1 text-[10px] text-slate-500">
          <span>WA: {alarma.whatsapp_numero ?? '—'}</span>
          <span>Cooldown: {alarma.cooldown_horas}h</span>
          <span>Última alerta: {fmtFecha(alarma.ultima_alerta_at)}</span>
        </div>
      </div>

      <button
        onClick={() => del.mutate(alarma.id)}
        className="shrink-0 mt-0.5 p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-950/30 transition-colors"
        title="Eliminar"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

export default function CotizacionAlarmasModal({ onClose }: Props) {
  const { data: alarmas = [] } = useAlarmasCotizacion()
  const add = useAddAlarmaCotizacion()
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof typeof EMPTY_FORM>(k: K, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleAdd() {
    // En modo "valor" el umbral es un monto ARS → parseo robusto (formato argentino).
    // En "porcentaje" el "." es decimal legítimo (3.5%), no separador de miles:
    // ahí parseAmount("1.500") daría 1500, así que se mantiene el parseo decimal simple.
    const umbral = form.tipo_umbral === 'valor'
      ? parseAmount(form.umbral)
      : parseFloat(form.umbral.replace(',', '.'))
    if (isNaN(umbral) || umbral <= 0) { setError('El umbral debe ser un número positivo'); return }
    setError(null)
    setAdding(true)
    try {
      await add.mutateAsync({
        moneda:          form.moneda,
        tipo_cotizacion: form.tipo_cotizacion,
        tipo_umbral:     form.tipo_umbral,
        umbral,
        direccion:       form.direccion,
        activa:          1,
        whatsapp_numero: form.whatsapp_numero.trim() || null,
        cooldown_horas:  parseInt(form.cooldown_horas) || 24,
      })
      setForm({ ...EMPTY_FORM })
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Alarmas de tipo de cambio</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Lista de alarmas existentes */}
          {alarmas.length > 0 ? (
            <div className="space-y-2">
              {alarmas.map(a => <AlarmaRow key={a.id} alarma={a} />)}
            </div>
          ) : (
            <p className="text-center text-slate-600 text-sm py-4">Sin alarmas configuradas</p>
          )}

          {/* Formulario nueva alarma */}
          <div className="border border-slate-700/40 rounded-xl p-4 bg-slate-800/30 space-y-3">
            <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
              <Plus size={12} /> Nueva alarma
            </p>

            <div className="grid grid-cols-2 gap-2">
              {/* Moneda */}
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">Moneda</label>
                <select
                  value={form.moneda}
                  onChange={e => set('moneda', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-amber-500/60"
                >
                  {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {/* Tipo cotización */}
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">Tipo cotización</label>
                <select
                  value={form.tipo_cotizacion}
                  onChange={e => set('tipo_cotizacion', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-amber-500/60"
                >
                  {TIPOS_COT.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {/* Dirección */}
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">Condición</label>
                <select
                  value={form.direccion}
                  onChange={e => set('direccion', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-amber-500/60"
                >
                  {DIRECCIONES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>

              {/* Tipo umbral */}
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">Umbral en</label>
                <select
                  value={form.tipo_umbral}
                  onChange={e => set('tipo_umbral', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-amber-500/60"
                >
                  {TIPOS_UMBRAL.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            {/* Umbral valor */}
            <div>
              <label className="text-[10px] text-slate-500 mb-1 block">
                Umbral {form.tipo_umbral === 'porcentaje' ? '(%)' : '(ARS)'}
              </label>
              <input
                type="number"
                min="0"
                step={form.tipo_umbral === 'porcentaje' ? '0.5' : '1'}
                value={form.umbral}
                onChange={e => set('umbral', e.target.value)}
                placeholder={form.tipo_umbral === 'porcentaje' ? 'Ej: 3' : 'Ej: 1350'}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-amber-500/60"
              />
              <p className="text-[10px] text-slate-600 mt-1">
                {form.tipo_umbral === 'porcentaje'
                  ? `Dispara cuando BCRA ${form.tipo_cotizacion} ${form.direccion === 'supera' ? 'supere' : 'caiga por debajo de'} la cotización Naka en este % `
                  : `Dispara cuando BCRA ${form.tipo_cotizacion} ${form.direccion === 'supera' ? 'supere' : 'caiga por debajo de'} este valor ARS`
                }
              </p>
            </div>

            {/* WhatsApp */}
            <div>
              <label className="text-[10px] text-slate-500 mb-1 block">Número WhatsApp (con código de país)</label>
              <input
                type="text"
                value={form.whatsapp_numero}
                onChange={e => set('whatsapp_numero', e.target.value)}
                placeholder="Ej: 5491112345678"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-amber-500/60"
              />
            </div>

            {/* Cooldown */}
            <div>
              <label className="text-[10px] text-slate-500 mb-1 block">Cooldown (horas entre alertas)</label>
              <input
                type="number"
                min="1"
                value={form.cooldown_horas}
                onChange={e => set('cooldown_horas', e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-amber-500/60"
              />
            </div>

            {error && (
              <p className="text-[11px] text-red-400 bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              onClick={handleAdd}
              disabled={adding || !form.umbral}
              className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold rounded-lg transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              <Plus size={13} />
              {adding ? 'Guardando...' : 'Agregar alarma'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
