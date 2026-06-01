import { useState } from 'react'
import {
  X, Trash2, Bell, Paperclip, FileText,
  Check, MessageCircle, Loader2, AlertTriangle,
  Maximize2, Edit2
} from 'lucide-react'
import dayjs from 'dayjs'
import type { DelegatedTask, DelegatedStatus, Priority, Reminder, Attachment, Contact } from '@shared/types'
import { PRIORITY_LABELS, PRIORITY_COLORS, DELEGATED_STATUS_LABELS } from '@shared/types'
import { useUIStore } from '../../store/ui.store'
import { useDelegatedTasks, useUpdateDelegatedTask, useDeleteDelegatedTask } from '../../hooks/useDelegated'
import { useDelegatedReminders, useCreateDelegatedReminder, useDeleteDelegatedReminder } from '../../hooks/useDelegatedReminders'
import { useDelegatedAttachments, useAddDelegatedAttachment, useDeleteDelegatedAttachment } from '../../hooks/useDelegatedAttachments'
import { ActivityTimeline } from './ActivityTimeline'
import QuestionPanel from './QuestionPanel'
import DatePicker from '../ui/DatePicker'
import { cn, formatDate, formatDateTime, formatBytes, isOverdue } from '../ui/utils'

const STATUSES: DelegatedStatus[] = ['pending', 'in_progress', 'done', 'cancelled']

const STATUS_ACTIVE: Record<DelegatedStatus, string> = {
  pending:    'bg-yellow-600 text-white',
  in_progress:'bg-blue-600 text-white',
  done:       'bg-emerald-600 text-white',
  cancelled:  'bg-slate-600 text-white'
}

const STATUS_BADGE: Record<DelegatedStatus, string> = {
  pending:    'bg-yellow-900/40 text-yellow-400 border border-yellow-800/50',
  in_progress:'bg-blue-900/40 text-blue-400 border border-blue-800/50',
  done:       'bg-emerald-900/40 text-emerald-400 border border-emerald-800/50',
  cancelled:  'bg-slate-700/60 text-slate-400 border border-slate-600/50'
}

const PRIORITY_BADGE_COLOR: Record<number, string> = {
  1: 'bg-red-900/40 text-red-400 border border-red-800/50',
  2: 'bg-orange-900/40 text-orange-400 border border-orange-800/50',
  3: 'bg-yellow-900/40 text-yellow-400 border border-yellow-800/50',
  4: 'bg-blue-900/40 text-blue-400 border border-blue-800/50',
  5: 'bg-slate-700/60 text-slate-400 border border-slate-600/50'
}

// ── Reminder row ──────────────────────────────────────────────────────────────
function ReminderRow({ r, onDelete }: { r: Reminder; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-slate-700/50 last:border-0">
      <Bell size={11} className={cn('flex-shrink-0', r.sent === 1 ? 'text-emerald-400' : r.sent === 2 ? 'text-red-400' : 'text-indigo-400')} />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-300">{formatDateTime(r.remind_at)}</p>
        <p className="text-[10px] text-slate-500 truncate">{r.message}</p>
      </div>
      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0',
        r.sent === 1 ? 'bg-emerald-900/40 text-emerald-400' :
        r.sent === 2 ? 'bg-red-900/40 text-red-400' :
        'bg-indigo-900/40 text-indigo-400'
      )}>
        {r.sent === 1 ? 'Enviado' : r.sent === 2 ? 'Fallido' : 'Pendiente'}
      </span>
      {r.sent === 0 && (
        <button onClick={onDelete} className="p-1 text-slate-600 hover:text-red-400 transition-colors flex-shrink-0">
          <X size={11} />
        </button>
      )}
    </div>
  )
}

// ── Attachment row ────────────────────────────────────────────────────────────
function AttachmentRow({ a, onDelete }: { a: Attachment; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-slate-700/50 last:border-0 group">
      <FileText size={11} className="text-slate-500 flex-shrink-0" />
      <button
        onClick={() => window.api.delegatedAttachments.open(a.id)}
        className="flex-1 min-w-0 text-left"
      >
        <p className="text-xs text-slate-300 hover:text-indigo-400 truncate transition-colors">{a.original_name}</p>
        <p className="text-[10px] text-slate-600">{formatBytes(a.size_bytes)}</p>
      </button>
      <button onClick={onDelete} className="p-1 text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
        <X size={11} />
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface DelegatedTaskDetailProps {
  modal?: boolean
  onClose?: () => void
}

export default function DelegatedTaskDetail({ modal = false, onClose }: DelegatedTaskDetailProps) {
  const {
    selectedDelegatedTaskId,
    setSelectedDelegatedTask,
    openExpandedDelegatedTask
  } = useUIStore()

  const { data: allTasks = [] } = useDelegatedTasks()
  const task = allTasks.find((t) => t.id === selectedDelegatedTaskId) ?? null

  const updateTask      = useUpdateDelegatedTask()
  const deleteTask      = useDeleteDelegatedTask()
  const { data: reminders    = [] } = useDelegatedReminders(selectedDelegatedTaskId)
  const { data: attachments  = [] } = useDelegatedAttachments(selectedDelegatedTaskId)
  const createReminder  = useCreateDelegatedReminder(selectedDelegatedTaskId ?? '')
  const deleteReminder  = useDeleteDelegatedReminder(selectedDelegatedTaskId ?? '')
  const addAttachment   = useAddDelegatedAttachment(selectedDelegatedTaskId ?? '')
  const deleteAttachment = useDeleteDelegatedAttachment(selectedDelegatedTaskId ?? '')

  const [editTitle, setEditTitle]       = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [editDesc, setEditDesc]         = useState('')
  const [editingDesc, setEditingDesc]   = useState(false)
  const [showReminderForm, setShowReminderForm] = useState(false)
  const [reminderDate, setReminderDate] = useState('')
  const [reminderTime, setReminderTime] = useState('09:00')
  const [reminderPhone, setReminderPhone] = useState('')
  const [reminderMsg, setReminderMsg]   = useState('')
  const [reminding, setReminding]       = useState(false)
  const [reminded, setReminded]         = useState(false)

  const handleClose = onClose ?? (() => setSelectedDelegatedTask(null))

  if (!task) return null

  const overdue = isOverdue(task.due_date) && task.status !== 'done' && task.status !== 'cancelled'
  const contacts: Contact[] = task.contact ? [task.contact] : []

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar "${task.title}"?`)) return
    await deleteTask.mutateAsync(task.id)
    handleClose()
  }

  const handleStatus = (s: DelegatedStatus) =>
    updateTask.mutate({ id: task.id, data: { status: s } })

  const handlePriority = (p: Priority) =>
    updateTask.mutate({ id: task.id, data: { priority: p } })

  const handleDueDate = (d: string) =>
    updateTask.mutate({ id: task.id, data: { due_date: d ? dayjs(d).valueOf() : null } })

  const commitTitle = () => {
    const t = editTitle.trim()
    if (t && t !== task.title) updateTask.mutate({ id: task.id, data: { title: t } })
    setEditingTitle(false)
  }

  const commitDesc = () => {
    if (editDesc !== task.description) updateTask.mutate({ id: task.id, data: { description: editDesc } })
    setEditingDesc(false)
  }

  const handleRemindNow = async () => {
    if (!task.contact?.phone) return
    setReminding(true)
    try {
      await window.api.delegated.remind(task.contact.phone, task.title, task.contact.name ?? '')
      setReminded(true)
      setTimeout(() => setReminded(false), 3000)
    } finally {
      setReminding(false)
    }
  }

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reminderDate || !reminderPhone) return
    const dt = new Date(`${reminderDate}T${reminderTime || '09:00'}`)
    const body = reminderMsg.trim()
      ? `Recordatorio:\n${reminderMsg.trim()}`
      : `Recordatorio de tarea asignada:\n${task.title}`
    await createReminder.mutateAsync({
      task_id: task.id,
      remind_at: dt.getTime(),
      phone_number: reminderPhone.replace(/\D/g, ''),
      message: body
    })
    setShowReminderForm(false)
    setReminderDate('')
    setReminderTime('09:00')
    setReminderPhone('')
    setReminderMsg('')
  }

  return (
    <div className={cn(
      'flex flex-col h-full bg-slate-800 overflow-hidden',
      !modal && 'border-l border-slate-700'
    )}>
      {/* Header */}
      <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center gap-2 z-10 flex-shrink-0">
        <h2 className="flex-1 font-semibold text-sm truncate text-slate-100">{task.title}</h2>

        {/* Priority + Status badges */}
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0', PRIORITY_BADGE_COLOR[task.priority])}>
          {PRIORITY_LABELS[task.priority]}
        </span>
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0', STATUS_BADGE[task.status])}>
          {DELEGATED_STATUS_LABELS[task.status]}
        </span>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => { setEditTitle(task.title); setEditingTitle(true) }}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
            title="Editar título"
          >
            <Edit2 size={13} />
          </button>
          {!modal && (
            <button
              onClick={() => openExpandedDelegatedTask(task.id)}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
              title="Expandir"
            >
              <Maximize2 size={14} />
            </button>
          )}
          <button
            onClick={handleDelete}
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
            title="Eliminar"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
            title="Cerrar"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 p-4">
        <div className={cn('space-y-5', modal && 'max-w-2xl mx-auto')}>

          {/* Contact card */}
          {task.contact && (
            <div className="flex items-center gap-2.5 bg-slate-900/50 rounded-lg p-2.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{
                  backgroundColor: `${task.contact.avatar_color ?? '#6366f1'}30`,
                  border: `1px solid ${task.contact.avatar_color ?? '#6366f1'}50`,
                  color: task.contact.avatar_color ?? '#a5b4fc'
                }}
              >
                {task.contact.name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-200">{task.contact.name}</p>
                {task.contact.phone && <p className="text-xs text-slate-500">{task.contact.phone}</p>}
              </div>
              {task.contact.phone && (
                <button
                  onClick={handleRemindNow}
                  disabled={reminding}
                  title="Enviar recordatorio ahora por WhatsApp"
                  className={cn(
                    'p-2 rounded-lg transition-colors flex-shrink-0',
                    reminded ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-500 hover:text-emerald-400 hover:bg-slate-700'
                  )}
                >
                  {reminding ? <Loader2 size={14} className="animate-spin" /> : reminded ? <Check size={14} /> : <MessageCircle size={14} />}
                </button>
              )}
            </div>
          )}

          {/* Title (editable inline) */}
          <div>
            <p className="text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wide">Título</p>
            {editingTitle ? (
              <input
                autoFocus
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
                className="w-full bg-slate-900 border border-indigo-500 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
              />
            ) : (
              <p
                onClick={() => { setEditTitle(task.title); setEditingTitle(true) }}
                className={cn('text-sm text-slate-200 cursor-text hover:bg-slate-700/50 rounded px-1 py-0.5 -mx-1 transition-colors', task.status === 'done' && 'line-through text-slate-500')}
              >
                {task.title}
              </p>
            )}
          </div>

          {/* Status */}
          <div>
            <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Estado</p>
            <div className="grid grid-cols-2 gap-1">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatus(s)}
                  className={cn(
                    'px-2 py-1.5 rounded-lg text-xs font-medium transition-colors text-left',
                    task.status === s ? STATUS_ACTIVE[s] : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  )}
                >
                  {DELEGATED_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Priority + Due date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wide">Prioridad</p>
              <select
                value={task.priority}
                onChange={(e) => handlePriority(Number(e.target.value) as Priority)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors"
              >
                {([1, 2, 3, 4, 5] as Priority[]).map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wide">Vencimiento</p>
              <DatePicker
                value={task.due_date ? dayjs(task.due_date).format('YYYY-MM-DD') : ''}
                onChange={handleDueDate}
                placeholder="Sin fecha"
              />
            </div>
          </div>

          {/* Overdue warning */}
          {overdue && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/20 rounded-lg px-3 py-2">
              <AlertTriangle size={13} />
              <span>Vencida el {formatDate(task.due_date!)}</span>
            </div>
          )}

          {/* Description (editable) */}
          <div>
            <p className="text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wide">Descripción</p>
            {editingDesc ? (
              <textarea
                autoFocus
                rows={3}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                onBlur={commitDesc}
                onKeyDown={(e) => { if (e.key === 'Escape') setEditingDesc(false) }}
                className="w-full bg-slate-900 border border-indigo-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none resize-none"
              />
            ) : (
              <p
                onClick={() => { setEditDesc(task.description ?? ''); setEditingDesc(true) }}
                className="text-sm text-slate-400 cursor-text hover:bg-slate-700/50 rounded px-1 py-0.5 -mx-1 transition-colors min-h-[2rem] whitespace-pre-wrap"
              >
                {task.description || <span className="text-slate-600 italic">Sin descripción — clic para agregar</span>}
              </p>
            )}
          </div>

          {/* WhatsApp Questions */}
          <div className="border-t border-slate-700 pt-4">
            <QuestionPanel
              taskId={task.id}
              taskTitle={task.title}
              taskType="delegated"
              contacts={contacts}
              defaultPhone={task.contact?.phone}
            />
          </div>

          {/* Attachments */}
          <div className="border-t border-slate-700 pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide flex items-center gap-1">
                <Paperclip size={11} /> Adjuntos
              </p>
              <button
                onClick={() => addAttachment.mutate()}
                disabled={addAttachment.isPending}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                + Agregar
              </button>
            </div>
            {attachments.length > 0 ? (
              <div className="bg-slate-900/50 rounded-lg px-3">
                {attachments.map((a) => (
                  <AttachmentRow key={a.id} a={a} onDelete={() => deleteAttachment.mutate(a.id)} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600">Sin adjuntos</p>
            )}
          </div>

          {/* Reminders */}
          <div className="border-t border-slate-700 pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide flex items-center gap-1">
                <Bell size={11} /> Recordatorios programados
              </p>
              <button
                onClick={() => setShowReminderForm((v) => !v)}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                + Agregar
              </button>
            </div>

            {showReminderForm && (
              <form onSubmit={handleAddReminder} className="bg-slate-900 border border-slate-700 rounded-lg p-3 mb-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Fecha</label>
                    <input type="date" required value={reminderDate} onChange={(e) => setReminderDate(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Hora</label>
                    <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Teléfono</label>
                  <input type="tel" required value={reminderPhone} onChange={(e) => setReminderPhone(e.target.value)}
                    placeholder={task.contact?.phone ?? '+54 11...'}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Mensaje (opcional)</label>
                  <textarea rows={2} value={reminderMsg} onChange={(e) => setReminderMsg(e.target.value)}
                    placeholder="Mensaje personalizado..."
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none" />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setShowReminderForm(false)}
                    className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors">Cancelar</button>
                  <button type="submit"
                    className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
                    Programar
                  </button>
                </div>
              </form>
            )}

            {reminders.length > 0 ? (
              <div className="bg-slate-900/50 rounded-lg px-3">
                {reminders.map((r) => (
                  <ReminderRow key={r.id} r={r} onDelete={() => deleteReminder.mutate(r.id)} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600">Sin recordatorios</p>
            )}
          </div>

          {/* Activity timeline */}
          <div className="pt-2 border-t border-slate-700">
            <ActivityTimeline taskId={task.id} taskType="delegated" />
          </div>

          {/* Timestamps */}
          <div className="text-xs text-slate-600 space-y-0.5 pt-2 border-t border-slate-700">
            <p>Creado: {formatDateTime(task.created_at)}</p>
            <p>Modificado: {formatDateTime(task.updated_at)}</p>
          </div>

        </div>
      </div>
    </div>
  )
}
