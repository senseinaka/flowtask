import { useState, useEffect } from 'react'
import {
  Send, Clock, History, FileText, Plus, Trash2, RefreshCw,
  ChevronDown, ChevronUp, Users, X, Check, AlertCircle, Loader2, Edit2
} from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import { useContacts } from '../hooks/useContacts'
import {
  useTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate,
  useScheduledMessages, useCreateMessage, useUpdateMessage, useDeleteMessage, useRetryMessage
} from '../hooks/useMessages'
import type {
  MessageTemplate, ScheduledMessage, MessageRecurrence, Contact
} from '@shared/types'
import { RECURRENCE_LABELS } from '@shared/types'
import { cn } from '../components/ui/utils'

dayjs.locale('es')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSendAt(ts: number) {
  const d = dayjs(ts)
  const now = dayjs()
  if (d.isSame(now, 'day')) return `Hoy ${d.format('HH:mm')}`
  if (d.isSame(now.add(1, 'day'), 'day')) return `Mañana ${d.format('HH:mm')}`
  return d.format('DD/MM/YYYY HH:mm')
}

function statusBadge(msg: ScheduledMessage) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:  { label: 'Pendiente', cls: 'bg-slate-700 text-slate-300' },
    sent:     { label: 'Enviado',   cls: 'bg-emerald-900/60 text-emerald-400' },
    failed:   { label: 'Fallido',   cls: 'bg-red-900/60 text-red-400' },
    partial:  { label: 'Parcial',   cls: 'bg-amber-900/60 text-amber-400' }
  }
  const { label, cls } = map[msg.status] ?? map.pending
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', cls)}>
      {label}
    </span>
  )
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'scheduled' | 'history' | 'templates'

// ─── Contact checkbox list ────────────────────────────────────────────────────

function ContactSelector({
  contacts,
  selected,
  onChange
}: {
  contacts: Contact[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  )

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id))
    else onChange([...selected, id])
  }

  return (
    <div className="border border-slate-600 rounded-lg overflow-hidden">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar contacto..."
        className="w-full bg-slate-700 border-b border-slate-600 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none"
      />
      <div className="max-h-44 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-center text-slate-500 text-sm py-4">Sin resultados</p>
        )}
        {filtered.map((c) => (
          <label
            key={c.id}
            className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-700/50 transition-colors"
          >
            <div
              className={cn(
                'w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors',
                selected.includes(c.id)
                  ? 'bg-indigo-500 border-indigo-500'
                  : 'border-slate-500'
              )}
              onClick={() => toggle(c.id)}
            >
              {selected.includes(c.id) && <Check size={10} className="text-white" />}
            </div>
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: c.avatar_color }}
            >
              {c.name[0].toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-sm text-slate-200 truncate">{c.name}</p>
              <p className="text-xs text-slate-500">{c.phone}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

// ─── Message Form (create + edit) ────────────────────────────────────────────

function MessageForm({
  contacts,
  templates,
  initial,
  onClose
}: {
  contacts: Contact[]
  templates: MessageTemplate[]
  initial?: ScheduledMessage   // present → edit mode
  onClose: () => void
}) {
  const isEdit = !!initial
  const createMsg = useCreateMessage()
  const updateMsg = useUpdateMessage()

  const [selectedContacts, setSelectedContacts] = useState<string[]>(
    initial?.contact_ids ?? []
  )
  const [message, setMessage] = useState(initial?.message ?? '')
  const [templateId, setTemplateId] = useState<string>(initial?.template_id ?? '')
  const [dateStr, setDateStr] = useState(
    initial ? dayjs(initial.send_at).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
  )
  const [timeStr, setTimeStr] = useState(
    initial
      ? dayjs(initial.send_at).format('HH:mm')
      : dayjs().add(10, 'minute').format('HH:mm')
  )
  const [recurrence, setRecurrence] = useState<MessageRecurrence>(
    initial?.recurrence ?? 'none'
  )
  const [error, setError] = useState('')

  const applyTemplate = (id: string) => {
    setTemplateId(id)
    const tpl = templates.find((t) => t.id === id)
    if (tpl) setMessage(tpl.body)
  }

  const selectedContactObjects = contacts.filter((c) => selectedContacts.includes(c.id))
  const previewMessage = (name: string) => message.replace(/\{\{nombre\}\}/gi, name)

  const handleSubmit = async () => {
    setError('')
    if (selectedContacts.length === 0) return setError('Seleccioná al menos un contacto.')
    if (!message.trim()) return setError('Escribí un mensaje.')
    if (!dateStr) return setError('Elegí una fecha.')
    const send_at = dayjs(`${dateStr} ${timeStr}`).valueOf()
    if (send_at <= Date.now()) return setError('La fecha y hora deben ser en el futuro.')

    try {
      if (isEdit) {
        await updateMsg.mutateAsync({
          id: initial!.id,
          data: {
            contact_ids: selectedContacts,
            message: message.trim(),
            send_at,
            recurrence
          }
        })
      } else {
        await createMsg.mutateAsync({
          contact_ids: selectedContacts,
          template_id: templateId || null,
          message: message.trim(),
          send_at,
          recurrence
        })
      }
      onClose()
    } catch {
      setError('No se pudo guardar el mensaje.')
    }
  }

  const isPending = createMsg.isPending || updateMsg.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            {isEdit
              ? <><Edit2 size={18} className="text-indigo-400" /> Editar mensaje programado</>
              : <><Send size={18} className="text-indigo-400" /> Nuevo mensaje programado</>}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Template selector — only in create mode */}
          {!isEdit && templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Plantilla (opcional)
              </label>
              <select
                value={templateId}
                onChange={(e) => applyTemplate(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
              >
                <option value="">— Sin plantilla —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Contacts */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              <Users size={14} className="inline mr-1" />
              Destinatarios
            </label>
            <ContactSelector
              contacts={contacts}
              selected={selectedContacts}
              onChange={setSelectedContacts}
            />
            {selectedContactObjects.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedContactObjects.map((c) => (
                  <span
                    key={c.id}
                    className="flex items-center gap-1 bg-indigo-900/50 border border-indigo-700 text-indigo-300 rounded-full px-2 py-0.5 text-xs"
                  >
                    {c.name}
                    <button onClick={() => setSelectedContacts(selectedContacts.filter((x) => x !== c.id))}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Mensaje
              <span className="text-slate-500 font-normal ml-1 text-xs">
                — usá <code className="bg-slate-700 px-1 rounded">{'{{nombre}}'}</code> para personalizar
              </span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Hola {{nombre}}, te escribo para..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 resize-none"
            />
            {message && selectedContactObjects.length > 0 && (
              <div className="mt-2 p-3 bg-slate-900/60 rounded-lg border border-slate-700">
                <p className="text-xs text-slate-500 mb-1">Vista previa para {selectedContactObjects[0].name}:</p>
                <p className="text-sm text-slate-300 whitespace-pre-wrap">
                  {previewMessage(selectedContactObjects[0].name)}
                </p>
              </div>
            )}
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Fecha</label>
              <input
                type="date"
                value={dateStr}
                min={dayjs().format('YYYY-MM-DD')}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Hora</label>
              <input
                type="time"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Recurrence */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Repetición</label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(RECURRENCE_LABELS) as [MessageRecurrence, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setRecurrence(key)}
                  className={cn(
                    'py-2 rounded-lg text-sm font-medium border transition-colors',
                    recurrence === key
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2 text-sm">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isEdit ? (
              <Check size={14} />
            ) : (
              <Send size={14} />
            )}
            {isEdit ? 'Guardar cambios' : 'Programar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Scheduled Tab ────────────────────────────────────────────────────────────

function ScheduledTab({
  contacts,
  templates
}: {
  contacts: Contact[]
  templates: MessageTemplate[]
}) {
  const { data: messages = [], isLoading } = useScheduledMessages('pending')
  const deleteMsg = useDeleteMessage()
  const [formMsg, setFormMsg] = useState<ScheduledMessage | null | 'new'>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-slate-500" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-slate-400">
          {messages.length === 0
            ? 'No hay mensajes programados'
            : `${messages.length} mensaje${messages.length !== 1 ? 's' : ''} pendiente${messages.length !== 1 ? 's' : ''}`}
        </p>
        <button
          onClick={() => setFormMsg('new')}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={15} />
          Nuevo mensaje
        </button>
      </div>

      <div className="space-y-3">
        {messages.map((msg) => {
          const expanded = expandedId === msg.id
          const recipientNames = (msg.contacts ?? []).map((c) => c.name).join(', ')
          return (
            <div
              key={msg.id}
              className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden"
            >
              <div className="px-4 py-3 flex items-start gap-3">
                {/* Time badge */}
                <div className="flex-shrink-0 bg-indigo-900/40 border border-indigo-800/50 rounded-lg px-2.5 py-1.5 text-center min-w-[72px]">
                  <p className="text-xs text-indigo-300 font-semibold">
                    {dayjs(msg.send_at).format('DD MMM')}
                  </p>
                  <p className="text-sm text-white font-bold">
                    {dayjs(msg.send_at).format('HH:mm')}
                  </p>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-200 truncate">
                      {recipientNames || 'Sin destinatarios'}
                    </p>
                    {msg.recurrence !== 'none' && (
                      <span className="text-xs bg-slate-700 text-slate-400 rounded-full px-2 py-0.5">
                        {RECURRENCE_LABELS[msg.recurrence]}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{msg.message}</p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setExpandedId(expanded ? null : msg.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700"
                    title="Ver detalle"
                  >
                    {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <button
                    onClick={() => setFormMsg(msg)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-slate-700"
                    title="Editar"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => deleteMsg.mutate(msg.id)}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-slate-700"
                    title="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="px-4 pb-4 pt-1 border-t border-slate-700/50">
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{msg.message}</p>
                  {(msg.contacts ?? []).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(msg.contacts ?? []).map((c) => (
                        <span
                          key={c.id}
                          className="text-xs bg-slate-700 text-slate-300 rounded-full px-2 py-0.5"
                        >
                          {c.name} · {c.phone}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {formMsg && (
        <MessageForm
          contacts={contacts}
          templates={templates}
          initial={formMsg === 'new' ? undefined : formMsg}
          onClose={() => setFormMsg(null)}
        />
      )}
    </div>
  )
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab() {
  const { data: messages = [], isLoading } = useScheduledMessages(['sent', 'failed', 'partial'])
  const retryMsg = useRetryMessage()
  const deleteMsg = useDeleteMessage()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-slate-500" />
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <History size={32} className="mb-3 opacity-40" />
        <p className="text-sm">Aún no hay mensajes enviados</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {messages.map((msg) => {
        const expanded = expandedId === msg.id
        const recipientNames = (msg.contacts ?? []).map((c) => c.name).join(', ')
        return (
          <div
            key={msg.id}
            className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden"
          >
            <div className="px-4 py-3 flex items-start gap-3">
              {/* Status icon */}
              <div className="flex-shrink-0 mt-0.5">
                {msg.status === 'sent' && (
                  <div className="w-8 h-8 rounded-full bg-emerald-900/40 flex items-center justify-center">
                    <Check size={14} className="text-emerald-400" />
                  </div>
                )}
                {msg.status === 'failed' && (
                  <div className="w-8 h-8 rounded-full bg-red-900/40 flex items-center justify-center">
                    <AlertCircle size={14} className="text-red-400" />
                  </div>
                )}
                {msg.status === 'partial' && (
                  <div className="w-8 h-8 rounded-full bg-amber-900/40 flex items-center justify-center">
                    <AlertCircle size={14} className="text-amber-400" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {statusBadge(msg)}
                  <p className="text-sm text-slate-300 truncate">{recipientNames || '—'}</p>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {msg.sent_at ? dayjs(msg.sent_at).format('DD/MM/YYYY HH:mm') : formatSendAt(msg.send_at)}
                </p>
                {msg.error && (
                  <p className="text-xs text-red-400 mt-0.5">{msg.error}</p>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setExpandedId(expanded ? null : msg.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700"
                >
                  {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {(msg.status === 'failed' || msg.status === 'partial') && (
                  <button
                    onClick={() => retryMsg.mutate(msg.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-slate-700"
                    title="Reintentar"
                  >
                    <RefreshCw size={14} />
                  </button>
                )}
                <button
                  onClick={() => deleteMsg.mutate(msg.id)}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-slate-700"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {expanded && (
              <div className="px-4 pb-4 pt-1 border-t border-slate-700/50">
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{msg.message}</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Templates Tab ────────────────────────────────────────────────────────────

function TemplateForm({
  initial,
  onSave,
  onCancel
}: {
  initial?: MessageTemplate
  onSave: (name: string, body: string) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handleSave = async () => {
    setErr('')
    if (!name.trim()) return setErr('El nombre es requerido.')
    if (!body.trim()) return setErr('El cuerpo del mensaje es requerido.')
    setSaving(true)
    try {
      await onSave(name.trim(), body.trim())
    } catch {
      setErr('No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-slate-800 border border-slate-600 rounded-xl p-4 space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre de la plantilla"
        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder={`Hola {{nombre}}, te escribo para recordarte...`}
        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 resize-none"
      />
      <p className="text-xs text-slate-500">
        Usá <code className="bg-slate-700 px-1 rounded">{'{{nombre}}'}</code> para insertar el nombre del destinatario automáticamente.
      </p>
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Guardar
        </button>
      </div>
    </div>
  )
}

function TemplatesTab() {
  const { data: templates = [], isLoading } = useTemplates()
  const createTpl = useCreateTemplate()
  const updateTpl = useUpdateTemplate()
  const deleteTpl = useDeleteTemplate()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-slate-500" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-slate-400">
          {templates.length === 0
            ? 'Aún no hay plantillas'
            : `${templates.length} plantilla${templates.length !== 1 ? 's' : ''}`}
        </p>
        <button
          onClick={() => { setCreating(true); setEditingId(null) }}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={15} />
          Nueva plantilla
        </button>
      </div>

      <div className="space-y-3">
        {creating && (
          <TemplateForm
            onSave={async (name, body) => {
              await createTpl.mutateAsync({ name, body })
              setCreating(false)
            }}
            onCancel={() => setCreating(false)}
          />
        )}

        {templates.map((tpl) => (
          <div key={tpl.id}>
            {editingId === tpl.id ? (
              <TemplateForm
                initial={tpl}
                onSave={async (name, body) => {
                  await updateTpl.mutateAsync({ id: tpl.id, name, body })
                  setEditingId(null)
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <FileText size={14} className="text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200">{tpl.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{tpl.body}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => { setEditingId(tpl.id); setCreating(false) }}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => deleteTpl.mutate(tpl.id)}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-slate-700"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main route ───────────────────────────────────────────────────────────────

export default function Messages() {
  const [tab, setTab] = useState<Tab>('scheduled')
  const { data: contacts = [] } = useContacts()
  const { data: templates = [] } = useTemplates()

  // Refresh on message:sent push event
  useEffect(() => {
    window.api.on('message:sent', () => {
      // TanStack Query will auto-refetch on next interval; invalidate immediately
      window.dispatchEvent(new CustomEvent('flowtask:message-sent'))
    })
    return () => window.api.off('message:sent')
  }, [])

  const tabs: { key: Tab; label: string; icon: typeof Send }[] = [
    { key: 'scheduled', label: 'Programados', icon: Clock },
    { key: 'history',   label: 'Historial',   icon: History },
    { key: 'templates', label: 'Plantillas',   icon: FileText }
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 pt-8 pb-0 border-b border-slate-700/50 flex-shrink-0">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-indigo-900/50 flex items-center justify-center">
            <Send size={18} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Mensajes automáticos</h1>
            <p className="text-xs text-slate-500">Programá envíos de WhatsApp a uno o varios contactos</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                tab === key
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {tab === 'scheduled' && (
          <ScheduledTab contacts={contacts} templates={templates} />
        )}
        {tab === 'history' && <HistoryTab />}
        {tab === 'templates' && <TemplatesTab />}
      </div>
    </div>
  )
}
