import { useState, useMemo, useRef, useEffect } from 'react'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import {
  Plus, Clock, CheckCircle2, AlertTriangle, Calendar,
  LayoutList, GitBranch, Settings2, Trash2, Edit3,
  ChevronRight, RotateCcw, X, Bell, BellOff, Save,
  RefreshCw, Shield, Tag, Upload, Sparkles, Loader2,
  Check, AlertCircle, ChevronDown as ChevronDownIcon
} from 'lucide-react'
import {
  useExpiryItems, useExpiryCategories,
  useCreateExpiryItem, useUpdateExpiryItem, useDeleteExpiryItem,
  useRenewExpiryItem, useUnrenewExpiryItem,
  useCreateExpiryCategory, useUpdateExpiryCategory, useDeleteExpiryCategory,
  useExpiryAlerts, useSetExpiryAlerts,
  getExpiryUrgency, getDaysUntil, formatExpiryDate
} from '../../hooks/useExpiry'
import type {
  ExpiryItem, ExpiryCategory, ExpiryAlert,
  ExpiryFrequency, ExpiryUrgency,
  CreateExpiryItemInput, CreateExpiryAlertInput
} from '@shared/types'
import {
  EXPIRY_FREQUENCY_LABELS, EXPIRY_URGENCY_LABELS, EXPIRY_URGENCY_COLORS
} from '@shared/types'
import { cn } from '../../components/ui/utils'

dayjs.locale('es')

// ── Constantes ────────────────────────────────────────────────────────────────

const URGENCY_ORDER: ExpiryUrgency[] = ['overdue','urgent','soon','upcoming','ok','renewed']

const URGENCY_BG: Record<ExpiryUrgency, string> = {
  overdue:  'bg-red-950/60 border-red-800/60',
  urgent:   'bg-orange-950/60 border-orange-800/60',
  soon:     'bg-amber-950/60 border-amber-800/60',
  upcoming: 'bg-blue-950/60 border-blue-800/60',
  ok:       'bg-emerald-950/40 border-emerald-900/40',
  renewed:  'bg-slate-800/40 border-slate-700/40',
}

const URGENCY_BADGE: Record<ExpiryUrgency, string> = {
  overdue:  'bg-red-900/80 text-red-300 border border-red-700/60',
  urgent:   'bg-orange-900/80 text-orange-300 border border-orange-700/60',
  soon:     'bg-amber-900/80 text-amber-300 border border-amber-700/60',
  upcoming: 'bg-blue-900/80 text-blue-300 border border-blue-700/60',
  ok:       'bg-emerald-900/80 text-emerald-300 border border-emerald-700/60',
  renewed:  'bg-slate-700/80 text-slate-400 border border-slate-600/60',
}

const FREQ_OPTIONS: ExpiryFrequency[] = [
  'once','monthly','quarterly','biannual','annual','biennial','triennial','quinquennial','custom'
]

const DEFAULT_ALERT_DAYS = [90, 30, 7, 1]
const EMOJI_OPTIONS = ['📄','🪪','🏢','🌐','🛡️','📋','⚖️','🎫','🔑','📁','🚗','✈️','💊','🎓','🏦','⚡']

// ── Helpers ───────────────────────────────────────────────────────────────────

function UrgencyBadge({ urgency }: { urgency: ExpiryUrgency }) {
  return (
    <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider', URGENCY_BADGE[urgency])}>
      {URGENCY_URGENCY_ICONS[urgency]} {EXPIRY_URGENCY_LABELS[urgency]}
    </span>
  )
}

const URGENCY_URGENCY_ICONS: Record<ExpiryUrgency, string> = {
  overdue: '🔴', urgent: '🟠', soon: '🟡', upcoming: '🔵', ok: '🟢', renewed: '✅'
}

function DaysChip({ days, urgency }: { days: number; urgency: ExpiryUrgency }) {
  const color = EXPIRY_URGENCY_COLORS[urgency]
  const label = days < 0
    ? `Hace ${Math.abs(days)} días`
    : days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `En ${days} días`
  return (
    <span className="text-[10px] font-mono font-semibold" style={{ color }}>
      {label}
    </span>
  )
}

// ── Item Form Modal ───────────────────────────────────────────────────────────

function ExpiryItemForm({
  item, categories, onClose
}: {
  item?: ExpiryItem | null
  categories: ExpiryCategory[]
  onClose: () => void
}) {
  const isEdit = !!item
  const create  = useCreateExpiryItem()
  const update  = useUpdateExpiryItem()
  const setAlerts = useSetExpiryAlerts()
  const { data: existingAlerts = [] } = useExpiryAlerts(item?.id ?? null)

  const [form, setForm] = useState<{
    category_id: string
    title: string
    holder: string
    description: string
    expiry_date: string
    frequency: ExpiryFrequency
    frequency_custom_days: string
    notes: string
  }>({
    category_id:           item?.category_id  ?? (categories[0]?.id ?? ''),
    title:                 item?.title        ?? '',
    holder:                item?.holder       ?? '',
    description:           item?.description  ?? '',
    expiry_date:           item ? dayjs(item.expiry_date).format('YYYY-MM-DD') : '',
    frequency:             item?.frequency    ?? 'annual',
    frequency_custom_days: item?.frequency_custom_days ? String(item.frequency_custom_days) : '',
    notes:                 item?.notes        ?? '',
  })

  const [alerts, setAlertList] = useState<CreateExpiryAlertInput[]>(() =>
    existingAlerts.length > 0
      ? existingAlerts.map(a => ({ days_before: a.days_before, channel: a.channel, whatsapp_number: a.whatsapp_number }))
      : [{ days_before: 30, channel: 'both', whatsapp_number: '' }]
  )

  useEffect(() => {
    if (existingAlerts.length > 0) {
      setAlertList(existingAlerts.map(a => ({
        days_before: a.days_before, channel: a.channel, whatsapp_number: a.whatsapp_number
      })))
    }
  }, [existingAlerts.length])

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const upd = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  const addAlert = () => setAlertList(a => [...a, { days_before: 7, channel: 'both', whatsapp_number: '' }])
  const removeAlert = (i: number) => setAlertList(a => a.filter((_, idx) => idx !== i))
  const updAlert = (i: number, k: keyof CreateExpiryAlertInput, v: unknown) =>
    setAlertList(a => a.map((al, idx) => idx === i ? { ...al, [k]: v } : al))

  const handleSave = async () => {
    if (!form.title.trim()) { setError('El título es obligatorio'); return }
    if (!form.expiry_date)  { setError('La fecha de vencimiento es obligatoria'); return }
    if (!form.category_id)  { setError('Seleccioná una categoría'); return }
    setSaving(true)
    setError(null)
    try {
      const data: CreateExpiryItemInput = {
        category_id:           form.category_id,
        title:                 form.title.trim(),
        holder:                form.holder.trim(),
        description:           form.description.trim(),
        expiry_date:           dayjs(form.expiry_date).valueOf(),
        frequency:             form.frequency,
        frequency_custom_days: form.frequency === 'custom' && form.frequency_custom_days
                                 ? Number(form.frequency_custom_days) : null,
        notes:                 form.notes.trim(),
      }
      let savedItem: ExpiryItem
      if (isEdit) {
        savedItem = await update.mutateAsync({ id: item!.id, data })
      } else {
        savedItem = await create.mutateAsync(data)
      }
      // Guardar alertas
      await setAlerts.mutateAsync({ itemId: savedItem.id, alerts })
      onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors'
  const labelCls = 'block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ width: 'min(640px, 95vw)', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/50 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center">
              {isEdit ? <Edit3 size={15} className="text-indigo-400" /> : <Plus size={15} className="text-indigo-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">{isEdit ? 'Editar vencimiento' : 'Nuevo vencimiento'}</h2>
              <p className="text-[10px] text-slate-500">Completá los datos del documento o ítem a vencer</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Categoría + Título */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Categoría</label>
              <select value={form.category_id} onChange={e => upd('category_id', e.target.value)} className={inputCls}>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Título *</label>
              <input
                autoFocus
                value={form.title}
                onChange={e => upd('title', e.target.value)}
                placeholder="Ej: DNI — Juan Pérez"
                className={inputCls}
              />
            </div>
          </div>

          {/* Titular + Fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Titular / Responsable</label>
              <input
                value={form.holder}
                onChange={e => upd('holder', e.target.value)}
                placeholder="Ej: Juan Pérez"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Fecha de vencimiento *</label>
              <input
                type="date"
                value={form.expiry_date}
                onChange={e => upd('expiry_date', e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Frecuencia */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Frecuencia de renovación</label>
              <select value={form.frequency} onChange={e => upd('frequency', e.target.value as ExpiryFrequency)} className={inputCls}>
                {FREQ_OPTIONS.map(f => (
                  <option key={f} value={f}>{EXPIRY_FREQUENCY_LABELS[f]}</option>
                ))}
              </select>
            </div>
            {form.frequency === 'custom' && (
              <div>
                <label className={labelCls}>Cada cuántos días</label>
                <input
                  type="number"
                  min="1"
                  value={form.frequency_custom_days}
                  onChange={e => upd('frequency_custom_days', e.target.value)}
                  placeholder="Ej: 180"
                  className={inputCls}
                />
              </div>
            )}
          </div>

          {/* Descripción */}
          <div>
            <label className={labelCls}>Descripción / Notas</label>
            <textarea
              value={form.description}
              onChange={e => upd('description', e.target.value)}
              rows={2}
              placeholder="Información adicional sobre este vencimiento..."
              className={inputCls + ' resize-none'}
            />
          </div>

          {/* Alertas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls + ' mb-0'}>
                <Bell size={11} className="inline mr-1" />
                Alertas de vencimiento
              </label>
              <button
                onClick={addAlert}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                <Plus size={11} /> Agregar alerta
              </button>
            </div>

            <div className="space-y-2">
              {alerts.map((alert, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-700/50">
                  <Bell size={12} className="text-amber-400 flex-shrink-0" />
                  <select
                    value={alert.days_before}
                    onChange={e => updAlert(i, 'days_before', Number(e.target.value))}
                    className="bg-transparent text-xs text-slate-300 outline-none cursor-pointer"
                  >
                    {[1,3,7,14,15,30,45,60,90,120,180].map(d => (
                      <option key={d} value={d}>{d} {d === 1 ? 'día' : 'días'} antes</option>
                    ))}
                  </select>
                  <span className="text-slate-600 text-xs">·</span>
                  <select
                    value={alert.channel}
                    onChange={e => updAlert(i, 'channel', e.target.value)}
                    className="bg-transparent text-xs text-slate-300 outline-none cursor-pointer"
                  >
                    <option value="both">WhatsApp + App</option>
                    <option value="whatsapp">Solo WhatsApp</option>
                    <option value="inapp">Solo App</option>
                  </select>
                  {(alert.channel === 'both' || alert.channel === 'whatsapp') && (
                    <>
                      <span className="text-slate-600 text-xs">·</span>
                      <input
                        value={alert.whatsapp_number}
                        onChange={e => updAlert(i, 'whatsapp_number', e.target.value)}
                        placeholder="+549..."
                        className="bg-transparent text-xs text-slate-300 outline-none flex-1 placeholder-slate-600"
                      />
                    </>
                  )}
                  <button onClick={() => removeAlert(i)} className="text-slate-600 hover:text-red-400 transition-colors ml-auto">
                    <X size={12} />
                  </button>
                </div>
              ))}
              {alerts.length === 0 && (
                <p className="text-xs text-slate-600 italic text-center py-2">Sin alertas configuradas</p>
              )}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-800/30 flex-shrink-0">
          <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors shadow-lg shadow-indigo-900/30"
          >
            <Save size={14} />
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear vencimiento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Category Manager Modal ────────────────────────────────────────────────────

function CategoryManager({ onClose }: { onClose: () => void }) {
  const { data: categories = [] } = useExpiryCategories()
  const createCat = useCreateExpiryCategory()
  const updateCat = useUpdateExpiryCategory()
  const deleteCat = useDeleteExpiryCategory()

  const [editing, setEditing] = useState<ExpiryCategory | null>(null)
  const [adding, setAdding]   = useState(false)
  const [form, setForm]       = useState({ name: '', icon: '📄', color: '#6366f1' })

  const startAdd = () => { setForm({ name: '', icon: '📄', color: '#6366f1' }); setAdding(true); setEditing(null) }
  const startEdit = (c: ExpiryCategory) => { setForm({ name: c.name, icon: c.icon, color: c.color }); setEditing(c); setAdding(false) }
  const cancel = () => { setAdding(false); setEditing(null) }

  const save = async () => {
    if (!form.name.trim()) return
    if (editing) {
      await updateCat.mutateAsync({ id: editing.id, data: form })
    } else {
      await createCat.mutateAsync(form)
    }
    cancel()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 'min(480px, 95vw)', maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-800/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Tag size={16} className="text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Administrar categorías</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={16} /></button>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center gap-3 bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 group">
              <span className="text-xl">{cat.icon}</span>
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <span className="flex-1 text-sm text-slate-200">{cat.name}</span>
              {cat.is_default ? (
                <span className="text-[9px] text-slate-500 uppercase tracking-wider">default</span>
              ) : null}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => startEdit(cat)}
                  className="p-1 text-slate-500 hover:text-indigo-400 transition-colors"
                >
                  <Edit3 size={13} />
                </button>
                {!cat.is_default && (
                  <button
                    onClick={() => deleteCat.mutate(cat.id)}
                    className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Form inline */}
          {(adding || editing) && (
            <div className="bg-slate-800 border border-indigo-700/50 rounded-xl px-4 py-3 space-y-3 mt-2">
              <p className="text-xs font-semibold text-indigo-300">
                {editing ? 'Editar categoría' : 'Nueva categoría'}
              </p>
              {/* Emoji picker */}
              <div>
                <p className="text-[10px] text-slate-500 mb-1.5">Ícono</p>
                <div className="flex flex-wrap gap-1.5">
                  {EMOJI_OPTIONS.map(e => (
                    <button
                      key={e}
                      onClick={() => setForm(f => ({ ...f, icon: e }))}
                      className={cn(
                        'w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all',
                        form.icon === e
                          ? 'bg-indigo-600/30 border-2 border-indigo-500 scale-110'
                          : 'bg-slate-700 hover:bg-slate-600 border border-transparent'
                      )}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <p className="text-[10px] text-slate-500 mb-1">Nombre</p>
                  <input
                    autoFocus
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Nombre de la categoría"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
                  />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 mb-1">Color</p>
                  <input
                    type="color"
                    value={form.color}
                    onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                    className="w-full h-[34px] rounded-lg cursor-pointer bg-slate-700 border border-slate-600"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={cancel} className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5">Cancelar</button>
                <button
                  onClick={save}
                  className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  Guardar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 flex-shrink-0">
          <button
            onClick={startAdd}
            className="w-full flex items-center justify-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 border border-dashed border-indigo-800/60 hover:border-indigo-600/60 rounded-xl py-2 transition-colors"
          >
            <Plus size={14} /> Nueva categoría
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Renew Modal ───────────────────────────────────────────────────────────────

function RenewModal({ item, onClose }: { item: ExpiryItem; onClose: () => void }) {
  const renew = useRenewExpiryItem()
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [saving, setSaving] = useState(false)

  const handleRenew = async () => {
    setSaving(true)
    await renew.mutateAsync({ id: item.id, renewedDate: dayjs(date).valueOf() })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-5"
        style={{ width: 'min(400px, 95vw)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-600/30 flex items-center justify-center">
            <CheckCircle2 size={20} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Marcar como renovado</h3>
            <p className="text-xs text-slate-400 mt-0.5">{item.title}</p>
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
            Fecha de renovación
          </label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {item.frequency !== 'once' && (
          <div className="bg-emerald-950/40 border border-emerald-900/40 rounded-lg px-3 py-2">
            <p className="text-xs text-emerald-300">
              ✅ Se generará automáticamente el próximo vencimiento según la frecuencia <strong>{EXPIRY_FREQUENCY_LABELS[item.frequency]}</strong>.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg py-2 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleRenew}
            disabled={saving}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2 transition-colors"
          >
            {saving ? 'Guardando...' : 'Confirmar renovación'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Item Card ─────────────────────────────────────────────────────────────────

function ExpiryCard({
  item, onEdit, onRenew, onDelete, onUnrenew
}: {
  item: ExpiryItem
  onEdit:    () => void
  onRenew:   () => void
  onDelete:  () => void
  onUnrenew: () => void
}) {
  const urgency = getExpiryUrgency(item)
  const days    = getDaysUntil(item.expiry_date)
  const color   = EXPIRY_URGENCY_COLORS[urgency]
  const cat     = item.category

  return (
    <div className={cn(
      'relative rounded-xl border p-4 transition-all duration-200 hover:border-slate-600',
      URGENCY_BG[urgency]
    )}>
      {/* Barra lateral de color */}
      <div
        className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full"
        style={{ backgroundColor: color }}
      />

      <div className="pl-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {cat && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                style={{ color: cat.color, backgroundColor: cat.color + '20' }}
              >
                {cat.icon} {cat.name}
              </span>
            )}
            <UrgencyBadge urgency={urgency} />
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {item.is_renewed ? (
              <button
                onClick={onUnrenew}
                title="Deshacer renovación"
                className="p-1.5 text-slate-500 hover:text-amber-400 rounded-lg transition-colors"
              >
                <RotateCcw size={13} />
              </button>
            ) : (
              <button
                onClick={onRenew}
                title="Marcar como renovado"
                className="p-1.5 text-slate-500 hover:text-emerald-400 rounded-lg transition-colors"
              >
                <CheckCircle2 size={13} />
              </button>
            )}
            <button
              onClick={onEdit}
              className="p-1.5 text-slate-500 hover:text-indigo-400 rounded-lg transition-colors"
            >
              <Edit3 size={13} />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Título + titular */}
        <p className="text-sm font-semibold text-slate-100 mt-2 leading-tight">{item.title}</p>
        {item.holder && (
          <p className="text-[11px] text-slate-500 mt-0.5">{item.holder}</p>
        )}

        {/* Fecha + días */}
        <div className="flex items-center gap-3 mt-2.5">
          <div className="flex items-center gap-1.5">
            <Calendar size={11} className="text-slate-500" />
            <span className="text-[11px] text-slate-400 font-mono">{formatExpiryDate(item.expiry_date)}</span>
          </div>
          {!item.is_renewed && <DaysChip days={days} urgency={urgency} />}
          {item.is_renewed && item.renewed_date && (
            <span className="text-[10px] text-emerald-500">
              Renovado {formatExpiryDate(item.renewed_date)}
            </span>
          )}
        </div>

        {/* Frecuencia */}
        <div className="flex items-center gap-1 mt-1.5">
          <RefreshCw size={9} className="text-slate-600" />
          <span className="text-[9px] text-slate-600">{EXPIRY_FREQUENCY_LABELS[item.frequency]}</span>
        </div>

        {item.description && (
          <p className="text-[10px] text-slate-500 mt-2 leading-relaxed line-clamp-2">{item.description}</p>
        )}
      </div>
    </div>
  )
}

// ── Timeline View ─────────────────────────────────────────────────────────────

function ExpiryTimeline({
  items, onEdit, onRenew, onDelete, onUnrenew
}: {
  items: ExpiryItem[]
  onEdit:    (item: ExpiryItem) => void
  onRenew:   (item: ExpiryItem) => void
  onDelete:  (item: ExpiryItem) => void
  onUnrenew: (item: ExpiryItem) => void
}) {
  const DAYS = 365
  const today = dayjs().startOf('day')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Pixels por día
  const PX_PER_DAY = 60

  const totalWidth = DAYS * PX_PER_DAY

  // Meses en el rango
  const months = useMemo(() => {
    const result: { label: string; x: number; days: number }[] = []
    let d = today.startOf('month')
    const end = today.add(DAYS, 'day')
    while (d.isBefore(end)) {
      const offsetDays = d.diff(today, 'day')
      const daysInMonth = d.daysInMonth()
      result.push({
        label: d.format('MMM YYYY'),
        x:     Math.max(0, offsetDays) * PX_PER_DAY,
        days:  daysInMonth
      })
      d = d.add(1, 'month')
    }
    return result
  }, [today, PX_PER_DAY])

  // Scroll al inicio (hoy)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0
  }, [])

  // Items activos ordenados por fecha
  const activeItems = useMemo(() =>
    items.filter(i => {
      if (i.is_renewed) return false
      const d = dayjs(i.expiry_date).diff(today, 'day')
      return d > -30 && d < DAYS
    }).sort((a, b) => a.expiry_date - b.expiry_date)
  , [items, today])

  // Stack de items por posición (evitar superposición vertical)
  const placements = useMemo(() => {
    const rows: number[] = []
    return activeItems.map(item => {
      const offsetDays = dayjs(item.expiry_date).diff(today, 'day')
      const x = offsetDays * PX_PER_DAY
      // Asignar a la primera fila libre
      let row = 0
      while (rows[row] !== undefined && rows[row] > x - 120) row++
      rows[row] = x + 120
      return { item, x, row }
    })
  }, [activeItems, today, PX_PER_DAY])

  const maxRow = placements.reduce((m, p) => Math.max(m, p.row), 0)
  const ITEM_H = 56
  const HEADER_H = 60
  const svgHeight = HEADER_H + (maxRow + 1) * ITEM_H + 40

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center gap-2">
        <GitBranch size={14} className="text-indigo-400" />
        <span className="text-xs font-semibold text-slate-300">Línea de tiempo — próximos 365 días</span>
      </div>

      <div ref={scrollRef} className="overflow-x-auto">
        <div style={{ width: totalWidth + 80, minHeight: svgHeight + 20 }} className="relative">

          {/* Meses — header */}
          <div className="flex absolute top-0 left-0" style={{ width: totalWidth + 80 }}>
            {months.map((m, i) => (
              <div
                key={i}
                className="flex-shrink-0 border-r border-slate-700/40 px-2 py-2"
                style={{ width: m.days * PX_PER_DAY }}
              >
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                  {m.label}
                </span>
              </div>
            ))}
          </div>

          {/* Línea base */}
          <div
            className="absolute bg-slate-700/60 rounded-full"
            style={{ top: HEADER_H + 10, left: 40, width: totalWidth, height: 2 }}
          />

          {/* Hoy marker */}
          <div
            className="absolute flex flex-col items-center"
            style={{ top: HEADER_H, left: 40 }}
          >
            <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50" />
            <div className="w-px bg-cyan-500/40" style={{ height: svgHeight - HEADER_H - 20 }} />
            <span className="text-[8px] text-cyan-400 font-semibold -rotate-90 mt-1">HOY</span>
          </div>

          {/* Semáforos de fondo */}
          {[7, 30, 90].map((daysThreshold, ti) => {
            const colors = ['#ef444420','#f9731620','#f59e0b20']
            return (
              <div
                key={ti}
                className="absolute rounded"
                style={{
                  top: HEADER_H,
                  left: 40,
                  width: daysThreshold * PX_PER_DAY,
                  height: svgHeight - HEADER_H - 20,
                  backgroundColor: colors[ti],
                  opacity: 0.4
                }}
              />
            )
          })}

          {/* Items */}
          {placements.map(({ item, x, row }) => {
            const urgency = getExpiryUrgency(item)
            const color   = EXPIRY_URGENCY_COLORS[urgency]
            const topY    = HEADER_H + 20 + row * ITEM_H
            const posX    = Math.max(0, x)

            return (
              <div
                key={item.id}
                className="absolute group cursor-pointer"
                style={{ left: 40 + posX, top: topY }}
              >
                {/* Línea vertical al eje */}
                <div
                  className="absolute w-px"
                  style={{
                    left: '50%',
                    bottom: '100%',
                    height: topY - HEADER_H - 10,
                    backgroundColor: color + '60'
                  }}
                />
                {/* Punto en el eje */}
                <div
                  className="absolute w-2.5 h-2.5 rounded-full border-2"
                  style={{
                    left: 'calc(50% - 5px)',
                    bottom: `calc(100% + ${topY - HEADER_H - 14}px)`,
                    borderColor: color,
                    backgroundColor: color + '33'
                  }}
                />

                {/* Pastilla */}
                <div
                  onClick={() => onEdit(item)}
                  className="relative flex flex-col rounded-lg px-2.5 py-1.5 border shadow-lg transition-all duration-150 hover:scale-105 hover:shadow-xl hover:z-10"
                  style={{
                    backgroundColor: '#0f172a',
                    borderColor: color + '80',
                    boxShadow: `0 2px 12px ${color}20`,
                    minWidth: 110,
                    maxWidth: 200
                  }}
                >
                  <span className="text-[9px] font-bold truncate" style={{ color }}>
                    {item.category?.icon} {item.title}
                  </span>
                  {item.holder && (
                    <span className="text-[8px] text-slate-500 truncate">{item.holder}</span>
                  )}
                  <span className="text-[8px] font-mono mt-0.5" style={{ color: color + 'cc' }}>
                    {formatExpiryDate(item.expiry_date)}
                  </span>

                  {/* Tooltip acciones */}
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1 shadow-xl z-20">
                    <button onClick={e => { e.stopPropagation(); onRenew(item) }} title="Renovar" className="text-emerald-400 hover:text-emerald-300 p-0.5">
                      <CheckCircle2 size={12} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); onDelete(item) }} title="Eliminar" className="text-red-400 hover:text-red-300 p-0.5">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── List View ─────────────────────────────────────────────────────────────────

function ExpiryList({
  items, categories, onEdit, onRenew, onDelete, onUnrenew
}: {
  items:      ExpiryItem[]
  categories: ExpiryCategory[]
  onEdit:    (item: ExpiryItem) => void
  onRenew:   (item: ExpiryItem) => void
  onDelete:  (item: ExpiryItem) => void
  onUnrenew: (item: ExpiryItem) => void
}) {
  const [filterCat,     setFilterCat]     = useState<string>('all')
  const [filterUrgency, setFilterUrgency] = useState<string>('all')
  const [showRenewed,   setShowRenewed]   = useState(false)

  const filtered = useMemo(() => {
    let list = [...items]
    if (!showRenewed) list = list.filter(i => !i.is_renewed)
    if (filterCat !== 'all') list = list.filter(i => i.category_id === filterCat)
    if (filterUrgency !== 'all') list = list.filter(i => getExpiryUrgency(i) === filterUrgency)
    return list.sort((a, b) => {
      const ua = URGENCY_ORDER.indexOf(getExpiryUrgency(a))
      const ub = URGENCY_ORDER.indexOf(getExpiryUrgency(b))
      if (ua !== ub) return ua - ub
      return a.expiry_date - b.expiry_date
    })
  }, [items, filterCat, filterUrgency, showRenewed])

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
        >
          <option value="all">Todas las categorías</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>

        <select
          value={filterUrgency}
          onChange={e => setFilterUrgency(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
        >
          <option value="all">Todas las urgencias</option>
          {URGENCY_ORDER.filter(u => u !== 'renewed').map(u => (
            <option key={u} value={u}>{URGENCY_URGENCY_ICONS[u]} {EXPIRY_URGENCY_LABELS[u]}</option>
          ))}
        </select>

        <button
          onClick={() => setShowRenewed(v => !v)}
          className={cn(
            'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors',
            showRenewed
              ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-300'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
          )}
        >
          <CheckCircle2 size={11} />
          {showRenewed ? 'Ocultando renovados' : 'Mostrar renovados'}
        </button>

        <span className="ml-auto text-[10px] text-slate-500">{filtered.length} ítems</span>
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Shield size={40} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No hay vencimientos que mostrar</p>
          <p className="text-slate-600 text-xs mt-1">Ajustá los filtros o creá un nuevo vencimiento</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(item => (
            <ExpiryCard
              key={item.id}
              item={item}
              onEdit={() => onEdit(item)}
              onRenew={() => onRenew(item)}
              onDelete={() => onDelete(item)}
              onUnrenew={() => onUnrenew(item)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────

function StatsBar({ items }: { items: ExpiryItem[] }) {
  const active = items.filter(i => !i.is_renewed)
  const counts = useMemo(() => {
    const c: Partial<Record<ExpiryUrgency, number>> = {}
    for (const item of active) {
      const u = getExpiryUrgency(item)
      c[u] = (c[u] ?? 0) + 1
    }
    return c
  }, [active])

  const stats = [
    { key: 'overdue' as ExpiryUrgency,  label: 'Vencidos',  icon: '🔴' },
    { key: 'urgent'  as ExpiryUrgency,  label: 'Urgentes',  icon: '🟠' },
    { key: 'soon'    as ExpiryUrgency,  label: 'Próximos',  icon: '🟡' },
    { key: 'upcoming'as ExpiryUrgency,  label: 'En radar',  icon: '🔵' },
    { key: 'ok'      as ExpiryUrgency,  label: 'Ok',        icon: '🟢' },
  ]

  return (
    <div className="grid grid-cols-5 gap-3">
      {stats.map(s => {
        const count = counts[s.key] ?? 0
        const color = EXPIRY_URGENCY_COLORS[s.key]
        return (
          <div
            key={s.key}
            className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-center"
            style={{ borderColor: count > 0 ? color + '40' : undefined }}
          >
            <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">{s.icon} {s.label}</p>
            <p
              className="text-2xl font-bold"
              style={{ color: count > 0 ? color : '#475569' }}
            >
              {count}
            </p>
          </div>
        )
      })}
    </div>
  )
}

// ── Importación masiva con IA ─────────────────────────────────────────────────

interface ParsedRow {
  title:         string
  expiry_date:   string
  holder:        string
  description:   string
  frequency:     string
  category_hint: string
  selected:      boolean
  // resuelto al confirmar
  category_id?:  string
}

function ImportBulkModal({
  categories,
  onClose,
  onImported
}: {
  categories:  ExpiryCategory[]
  onClose:     () => void
  onImported:  (count: number) => void
}) {
  const createItem = useCreateExpiryItem()

  const [step,    setStep]    = useState<'paste' | 'preview' | 'done'>('paste')
  const [text,    setText]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [rows,    setRows]    = useState<ParsedRow[]>([])
  const [saving,  setSaving]  = useState(false)

  // Mapeo automático de category_hint → category_id
  const resolveCategoryId = (hint: string): string => {
    const h = hint.toLowerCase()
    const match = categories.find(c =>
      c.name.toLowerCase().includes(h) || h.includes(c.name.toLowerCase())
    )
    return match?.id ?? categories[0]?.id ?? ''
  }

  const handleParse = async () => {
    if (!text.trim()) return
    setLoading(true)
    setError(null)
    try {
      const parsed = await window.api.ai.parseExpiryItems(text)
      setRows(parsed.map(r => ({
        ...r,
        selected:    true,
        category_id: resolveCategoryId(r.category_hint)
      })))
      setStep('preview')
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    const toImport = rows.filter(r => r.selected)
    if (!toImport.length) return
    setSaving(true)
    let ok = 0
    for (const r of toImport) {
      try {
        await createItem.mutateAsync({
          category_id:           r.category_id ?? categories[0]?.id ?? '',
          title:                 r.title,
          holder:                r.holder,
          description:           r.description,
          expiry_date:           dayjs(r.expiry_date).valueOf(),
          frequency:             (r.frequency as ExpiryFrequency) ?? 'annual',
          frequency_custom_days: null,
          notes:                 '',
        })
        ok++
      } catch { /* skip individual failures */ }
    }
    setSaving(false)
    onImported(ok)
    onClose()
  }

  const toggleRow  = (i: number) => setRows(rs => rs.map((r,idx) => idx===i ? {...r, selected: !r.selected} : r))
  const toggleAll  = () => { const allSel = rows.every(r => r.selected); setRows(rs => rs.map(r => ({...r, selected: !allSel}))) }
  const updRow = (i: number, k: keyof ParsedRow, v: string) => setRows(rs => rs.map((r,idx) => idx===i ? {...r, [k]: v} : r))

  const inputCls = 'bg-slate-700/60 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 w-full'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 'min(900px, 96vw)', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-600/30 flex items-center justify-center">
              <Sparkles size={18} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Importación masiva con IA</h2>
              <p className="text-[10px] text-slate-500">
                {step === 'paste'   && 'Pegá texto en cualquier formato — tabla, lista, HTML, lo que sea'}
                {step === 'preview' && `${rows.length} ítems detectados — revisá y ajustá antes de importar`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
        </div>

        {/* ── STEP 1: Pegar texto ── */}
        {step === 'paste' && (
          <div className="flex flex-col flex-1 overflow-hidden p-6 gap-4">
            <textarea
              autoFocus
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={`Pegá aquí cualquier texto con vencimientos. Ejemplos:\n\n• Tabla de dominios con columnas Dominio / Alta / Vencimiento\n• Lista de tarjetas con fechas\n• Texto libre: "El DNI de Juan vence el 15/03/2027"\n• HTML copiado de una web\n\nLa IA va a extraer automáticamente todos los ítems.`}
              className="flex-1 bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-500 resize-none font-mono"
              style={{ minHeight: 300 }}
            />
            {error && (
              <div className="flex items-center gap-2 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
                <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-300">{error}</p>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-200 px-4 py-2">Cancelar</button>
              <button
                onClick={handleParse}
                disabled={loading || !text.trim()}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-900/30"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {loading ? 'Analizando con IA...' : 'Analizar con IA'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Preview ── */}
        {step === 'preview' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Tabla */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="pb-2 pr-2 text-left">
                      <input
                        type="checkbox"
                        checked={rows.every(r => r.selected)}
                        onChange={toggleAll}
                        className="accent-indigo-500"
                      />
                    </th>
                    <th className="pb-2 pr-3 text-left text-slate-400 font-medium">Título</th>
                    <th className="pb-2 pr-3 text-left text-slate-400 font-medium">Vencimiento</th>
                    <th className="pb-2 pr-3 text-left text-slate-400 font-medium">Titular</th>
                    <th className="pb-2 pr-3 text-left text-slate-400 font-medium">Categoría</th>
                    <th className="pb-2 text-left text-slate-400 font-medium">Frecuencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {rows.map((row, i) => (
                    <tr key={i} className={row.selected ? '' : 'opacity-40'}>
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={() => toggleRow(i)}
                          className="accent-indigo-500"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          value={row.title}
                          onChange={e => updRow(i, 'title', e.target.value)}
                          className={inputCls}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="date"
                          value={row.expiry_date}
                          onChange={e => updRow(i, 'expiry_date', e.target.value)}
                          className={inputCls + ' w-36'}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          value={row.holder}
                          onChange={e => updRow(i, 'holder', e.target.value)}
                          placeholder="—"
                          className={inputCls}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          value={row.category_id ?? ''}
                          onChange={e => updRow(i, 'category_id', e.target.value)}
                          className={inputCls}
                        >
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2">
                        <select
                          value={row.frequency}
                          onChange={e => updRow(i, 'frequency', e.target.value)}
                          className={inputCls + ' w-28'}
                        >
                          {FREQ_OPTIONS.map(f => (
                            <option key={f} value={f}>{EXPIRY_FREQUENCY_LABELS[f]}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-800/30 flex-shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setStep('paste'); setRows([]) }}
                  className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1.5"
                >
                  ← Volver
                </button>
                <span className="text-xs text-slate-500">
                  {rows.filter(r => r.selected).length} de {rows.length} seleccionados
                </span>
              </div>
              <button
                onClick={handleImport}
                disabled={saving || rows.filter(r => r.selected).length === 0}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-indigo-900/30"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                {saving ? 'Importando...' : `Importar ${rows.filter(r => r.selected).length} vencimientos`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

type ViewMode = 'list' | 'timeline'

export default function ExpiryDashboard() {
  const { data: items      = [], isLoading } = useExpiryItems()
  const { data: categories = [] }            = useExpiryCategories()
  const unrenew = useUnrenewExpiryItem()

  const [view,         setView]         = useState<ViewMode>('list')
  const [formItem,     setFormItem]     = useState<ExpiryItem | null | undefined>(undefined) // undefined = cerrado
  const [renewItem,    setRenewItem]    = useState<ExpiryItem | null>(null)
  const [deletingId,   setDeletingId]   = useState<string | null>(null)
  const [showCatMgr,   setShowCatMgr]   = useState(false)
  const [showImport,   setShowImport]   = useState(false)

  const deleteItem = useDeleteExpiryItem()

  const handleDelete = async (item: ExpiryItem) => {
    if (!confirm(`¿Eliminar "${item.title}"?`)) return
    await deleteItem.mutateAsync(item.id)
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-slate-500 flex items-center gap-2">
          <RefreshCw size={16} className="animate-spin" />
          Cargando vencimientos...
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-900">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-800 bg-slate-800/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center">
              <Clock size={18} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Vencimientos</h1>
              <p className="text-[11px] text-slate-500">
                {items.filter(i => !i.is_renewed).length} activos · {items.filter(i => !!i.is_renewed).length} renovados
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle vista */}
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5">
              <button
                onClick={() => setView('list')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
                  view === 'list'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <LayoutList size={13} /> Lista
              </button>
              <button
                onClick={() => setView('timeline')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
                  view === 'timeline'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <GitBranch size={13} /> Timeline
              </button>
            </div>

            {/* Importar con IA */}
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 text-xs text-violet-300 hover:text-violet-200 border border-violet-800/60 hover:border-violet-600 bg-violet-900/20 rounded-lg px-3 py-2 transition-colors"
            >
              <Sparkles size={13} /> Importar con IA
            </button>

            {/* Categorías */}
            <button
              onClick={() => setShowCatMgr(true)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 bg-slate-800 rounded-lg px-3 py-2 transition-colors"
            >
              <Settings2 size={13} /> Categorías
            </button>

            {/* Nuevo */}
            <button
              onClick={() => setFormItem(null)}
              className="flex items-center gap-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg px-3 py-2 transition-colors shadow-lg shadow-indigo-900/30"
            >
              <Plus size={13} /> Nuevo vencimiento
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Stats */}
        <StatsBar items={items} />

        {/* Vista activa */}
        {view === 'timeline' ? (
          <ExpiryTimeline
            items={items}
            onEdit={item => setFormItem(item)}
            onRenew={item => setRenewItem(item)}
            onDelete={handleDelete}
            onUnrenew={item => unrenew.mutate(item.id)}
          />
        ) : (
          <ExpiryList
            items={items}
            categories={categories}
            onEdit={item => setFormItem(item)}
            onRenew={item => setRenewItem(item)}
            onDelete={handleDelete}
            onUnrenew={item => unrenew.mutate(item.id)}
          />
        )}
      </div>

      {/* Modals */}
      {formItem !== undefined && (
        <ExpiryItemForm
          item={formItem}
          categories={categories}
          onClose={() => setFormItem(undefined)}
        />
      )}
      {renewItem && (
        <RenewModal item={renewItem} onClose={() => setRenewItem(null)} />
      )}
      {showCatMgr && (
        <CategoryManager onClose={() => setShowCatMgr(false)} />
      )}
      {showImport && (
        <ImportBulkModal
          categories={categories}
          onClose={() => setShowImport(false)}
          onImported={(count) => {
            setShowImport(false)
            // pequeño toast visual via alert (se puede mejorar con un toast)
            console.log(`[Expiry] Importados ${count} vencimientos`)
          }}
        />
      )}
    </div>
  )
}
