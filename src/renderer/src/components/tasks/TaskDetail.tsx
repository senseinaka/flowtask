import { useState } from 'react'
import {
  X, Edit2, Trash2, Paperclip, Bell, Link2, ExternalLink,
  Calendar, Clock, AlertTriangle, CheckCircle2, FileText, ChevronDown, User, Maximize2
} from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/es'
dayjs.extend(relativeTime)
dayjs.locale('es')
import type { Task, TaskStatus } from '@shared/types'
import { STATUS_LABELS, PRIORITY_LABELS } from '@shared/types'
import { useUIStore } from '../../store/ui.store'
import { useTask, useUpdateTask, useDeleteTask, useTaskDependencies, useAddDependency, useRemoveDependency } from '../../hooks/useTasks'
import { useAttachments, useAddAttachment, useDeleteAttachment } from '../../hooks/useAttachments'
import { useReminders, useCreateReminder, useDeleteReminder } from '../../hooks/useReminders'
import { useTasks } from '../../hooks/useTasks'
import { useContacts } from '../../hooks/useContacts'
import PriorityBadge from './PriorityBadge'
import StatusBadge from './StatusBadge'
import DatePicker from '../ui/DatePicker'
import QuestionPanel from './QuestionPanel'
import { ActivityTimeline } from './ActivityTimeline'
import { cn, formatDate, formatDateTime, formatBytes, isOverdue } from '../ui/utils'

const MSG_HEADER = 'Este es un recordatorio automático:\n'

const STATUSES: TaskStatus[] = ['pending', 'in_progress', 'blocked', 'done']

interface TaskDetailProps {
  modal?: boolean
  onClose?: () => void
}

export default function TaskDetail({ modal = false, onClose }: TaskDetailProps) {
  const { selectedTaskId, setSelectedTask, openEditForm, openExpandedTask } = useUIStore()
  const handleClose = onClose ?? (() => setSelectedTask(null))
  const { data: task } = useTask(selectedTaskId)
  const { data: deps } = useTaskDependencies(selectedTaskId)
  const { data: attachments } = useAttachments(selectedTaskId)
  const { data: reminders } = useReminders(selectedTaskId)
  const { data: allTasks } = useTasks()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const addAttachment = useAddAttachment(selectedTaskId ?? '')
  const deleteAttachment = useDeleteAttachment(selectedTaskId ?? '')
  const addDependency = useAddDependency()
  const removeDependency = useRemoveDependency()
  const createReminder = useCreateReminder(selectedTaskId ?? '')
  const deleteReminder = useDeleteReminder(selectedTaskId ?? '')

  const { data: contacts } = useContacts()

  const [showDepPicker, setShowDepPicker] = useState(false)
  const [showReminderForm, setShowReminderForm] = useState(false)
  const [reminderDate, setReminderDate] = useState('')
  const [reminderTime, setReminderTime] = useState('09:00')
  const [reminderPhone, setReminderPhone] = useState('')
  const [reminderMsg, setReminderMsg] = useState('')
  const [showContactPicker, setShowContactPicker] = useState(false)

  if (!selectedTaskId || !task) return null

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar "${task.title}"?`)) return
    await deleteTask.mutateAsync(task.id)
  }

  const handleStatusChange = (status: TaskStatus) => {
    updateTask.mutate({ id: task.id, data: { status } })
  }

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reminderDate || !reminderPhone) return
    const dt = new Date(`${reminderDate}T${reminderTime || '09:00'}`)
    const body = reminderMsg.trim()
      ? `${MSG_HEADER}${reminderMsg.trim()}`
      : `${MSG_HEADER}Tarea: ${task.title}\nPrioridad: ${PRIORITY_LABELS[task.priority]}`
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

  const candidateDeps = (allTasks ?? []).filter(
    (t) => t.id !== task.id && !deps?.some((d) => d.id === t.id)
  )

  const overdue = isOverdue(task.due_date) && task.status !== 'done'

  return (
    <div className={cn(
      'flex flex-col h-full bg-slate-800 overflow-y-auto',
      !modal && 'border-l border-slate-700'
    )}>
      {/* Header */}
      <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center gap-2 z-10">
        <h2 className="flex-1 font-semibold text-sm truncate">{task.title}</h2>
        {!modal && (
          <button
            onClick={() => openExpandedTask(task.id)}
            className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-700 rounded-lg transition-colors"
            title="Abrir en pantalla completa"
          >
            <Maximize2 size={14} />
          </button>
        )}
        <button onClick={() => openEditForm(task.id)} className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors">
          <Edit2 size={14} />
        </button>
        <button onClick={handleDelete} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors">
          <Trash2 size={14} />
        </button>
        <button onClick={handleClose} className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="p-4 space-y-5">
        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <PriorityBadge priority={task.priority} size="md" />
          <StatusBadge status={task.status} size="md" />
          {task.project && (
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
              style={{ backgroundColor: `${task.project.color}22`, color: task.project.color, border: `1px solid ${task.project.color}44` }}>
              {task.project.name}
            </span>
          )}
        </div>

        {/* Status changer */}
        <div>
          <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Estado</p>
          <div className="grid grid-cols-2 gap-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className={cn(
                  'px-2 py-1.5 rounded-lg text-xs font-medium transition-colors text-left',
                  task.status === s
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                )}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Due date */}
        {task.due_date && (
          <div className={cn('flex items-center gap-2 text-sm', overdue ? 'text-red-400' : 'text-slate-300')}>
            <Calendar size={14} />
            <span>{formatDate(task.due_date)}</span>
            {task.due_time && <><Clock size={13} /><span>{task.due_time}</span></>}
            {overdue && <AlertTriangle size={14} className="ml-auto" />}
            {task.status === 'done' && task.completed_at && (
              <span className="text-emerald-400 flex items-center gap-1 text-xs ml-1">
                <CheckCircle2 size={12} /> Completado {formatDate(task.completed_at)}
              </span>
            )}
          </div>
        )}

        {/* Description */}
        {task.description && (
          <div>
            <p className="text-xs text-slate-500 mb-1 font-medium uppercase tracking-wide">Descripción</p>
            <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{task.description}</p>
          </div>
        )}

        {/* Dependencies */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide flex items-center gap-1">
              <Link2 size={11} /> Dependencias
            </p>
            <button
              onClick={() => setShowDepPicker(!showDepPicker)}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              + Agregar
            </button>
          </div>

          {showDepPicker && candidateDeps.length > 0 && (
            <div className="mb-2 bg-slate-900 border border-slate-700 rounded-lg max-h-36 overflow-y-auto">
              {candidateDeps.map((t) => (
                <button
                  key={t.id}
                  onClick={async () => {
                    await addDependency.mutateAsync({ taskId: task.id, dependsOnId: t.id })
                    setShowDepPicker(false)
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 transition-colors first:rounded-t-lg last:rounded-b-lg"
                >
                  {t.title}
                </button>
              ))}
            </div>
          )}

          {deps?.length ? (
            <div className="space-y-1">
              {deps.map((dep) => (
                <div key={dep.id} className="flex items-center gap-2 bg-slate-700 rounded-lg px-2 py-1.5">
                  <div
                    className={cn('w-2 h-2 rounded-full flex-shrink-0', dep.status === 'done' ? 'bg-emerald-400' : 'bg-yellow-400')}
                  />
                  <span className={cn('flex-1 text-xs truncate', dep.status === 'done' && 'line-through text-slate-500')}>
                    {dep.title}
                  </span>
                  <button
                    onClick={() => removeDependency.mutate({ taskId: task.id, dependsOnId: dep.id })}
                    className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600">Sin dependencias</p>
          )}
        </div>

        {/* Attachments */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide flex items-center gap-1">
              <Paperclip size={11} /> Archivos adjuntos
            </p>
            <button
              onClick={() => addAttachment.mutate()}
              disabled={addAttachment.isPending}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
            >
              + Adjuntar
            </button>
          </div>
          {attachments?.length ? (
            <div className="space-y-1">
              {attachments.map((att) => (
                <div key={att.id} className="flex items-center gap-2 bg-slate-700 rounded-lg px-2 py-1.5">
                  <FileText size={12} className="text-slate-400 flex-shrink-0" />
                  <span className="flex-1 text-xs text-slate-300 truncate">{att.original_name}</span>
                  <span className="text-xs text-slate-600 flex-shrink-0">{formatBytes(att.size_bytes)}</span>
                  <button
                    onClick={() => window.api.attachments.open(att.id)}
                    className="text-slate-500 hover:text-indigo-400 transition-colors flex-shrink-0"
                  >
                    <ExternalLink size={11} />
                  </button>
                  <button
                    onClick={() => deleteAttachment.mutate(att.id)}
                    className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600">Sin archivos adjuntos</p>
          )}
        </div>

        {/* Reminders */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide flex items-center gap-1">
              <Bell size={11} /> Recordatorios WhatsApp
            </p>
            <button
              onClick={() => setShowReminderForm(!showReminderForm)}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              + Agregar
            </button>
          </div>

          {showReminderForm && (
            <form onSubmit={handleAddReminder} className="mb-3 space-y-2 bg-slate-900 border border-slate-700 rounded-lg p-3">
              {/* Date + Time */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Fecha</label>
                  <DatePicker value={reminderDate} onChange={setReminderDate} placeholder="Elegir fecha" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Hora</label>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Phone — contact picker or manual */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Teléfono</label>
                {contacts && contacts.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowContactPicker((v) => !v)}
                        className="w-full flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-left hover:border-slate-600 transition-colors"
                      >
                        <User size={11} className="text-slate-500" />
                        <span className={reminderPhone ? 'text-slate-200' : 'text-slate-500'}>
                          {contacts.find((c) => c.phone === reminderPhone)?.name ?? (reminderPhone || 'Elegir contacto...')}
                        </span>
                        <ChevronDown size={11} className="ml-auto text-slate-500" />
                      </button>
                      {showContactPicker && (
                        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                          {contacts.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => { setReminderPhone(c.phone); setShowContactPicker(false) }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-700 transition-colors"
                            >
                              <span className="font-medium text-slate-200">{c.name}</span>
                              <span className="text-slate-500 ml-auto">{c.phone}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input
                      type="text"
                      value={reminderPhone}
                      onChange={(e) => setReminderPhone(e.target.value)}
                      placeholder="O ingresá manualmente (ej: 5491112345678)"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    required
                    value={reminderPhone}
                    onChange={(e) => setReminderPhone(e.target.value)}
                    placeholder="5491112345678 (guardá contactos en Configuración)"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                  />
                )}
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Mensaje personalizado</label>
                <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden focus-within:border-indigo-500 transition-colors">
                  <div className="px-2 pt-1.5 pb-0.5 text-[10px] text-indigo-400 border-b border-slate-700 select-none">
                    Este es un recordatorio automático:
                  </div>
                  <textarea
                    rows={2}
                    value={reminderMsg}
                    onChange={(e) => setReminderMsg(e.target.value)}
                    placeholder={`Tarea: ${task.title}\nPrioridad: ${PRIORITY_LABELS[task.priority]}`}
                    className="w-full bg-transparent px-2 py-1.5 text-xs focus:outline-none resize-none text-slate-200 placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!reminderDate || !reminderPhone}
                  className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs rounded-lg font-medium transition-colors"
                >
                  Crear recordatorio
                </button>
                <button
                  type="button"
                  onClick={() => setShowReminderForm(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-slate-200 text-xs transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {reminders?.length ? (
            <div className="space-y-1">
              {reminders.map((r) => (
                <div key={r.id} className="flex items-center gap-2 bg-slate-700 rounded-lg px-2 py-1.5">
                  <Bell size={11} className={cn(
                    'flex-shrink-0',
                    r.sent === 1 ? 'text-emerald-400' : r.sent === 2 ? 'text-red-400' : 'text-yellow-400'
                  )} />
                  <span className="flex-1 text-xs text-slate-300">{formatDateTime(r.remind_at)}</span>
                  <span className="text-xs text-slate-600">
                    {r.sent === 1 ? 'Enviado' : r.sent === 2 ? 'Falló' : 'Pendiente'}
                  </span>
                  <button
                    onClick={() => deleteReminder.mutate(r.id)}
                    className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600">Sin recordatorios</p>
          )}
        </div>

        {/* WhatsApp Questions */}
        <QuestionPanel
          taskId={task.id}
          taskTitle={task.title}
          contacts={contacts ?? []}
        />

        {/* Activity timeline */}
        <div className="pt-2 border-t border-slate-700">
          <ActivityTimeline taskId={task.id} taskType="personal" />
        </div>

        {/* Timestamps */}
        <div className="text-xs text-slate-600 space-y-0.5 pt-2 border-t border-slate-700">
          <p>Creado: {formatDateTime(task.created_at)}</p>
          <p>Modificado: {formatDateTime(task.updated_at)}</p>
          {task.synced_at && <p>Sincronizado: {formatDateTime(task.synced_at)}</p>}
        </div>
      </div>
    </div>
  )
}
