import { useState } from 'react'
import {
  Users, Plus, X, Trash2, MessageCircle, Save,
  Phone, Mail, FileText, Loader2, Check, ChevronRight
} from 'lucide-react'
import type { Contact, ContactType, CreateContactInput, DelegatedTask, DelegatedStatus, Priority } from '@shared/types'
import {
  CONTACT_TYPE_LABELS, CONTACT_TYPE_COLORS,
  PRIORITY_LABELS, PRIORITY_COLORS, DELEGATED_STATUS_LABELS
} from '@shared/types'
import { useContacts, useCreateContact, useUpdateContact, useDeleteContact } from '../hooks/useContacts'
import { useDelegatedTasks, useCreateDelegatedTask, useUpdateDelegatedTask, useDeleteDelegatedTask } from '../hooks/useDelegated'
import DatePicker from '../components/ui/DatePicker'
import { cn, formatDate, isOverdue } from '../components/ui/utils'
import dayjs from 'dayjs'

const TYPE_TABS: { value: ContactType | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'collaborator', label: 'Colaboradores' },
  { value: 'family', label: 'Familia' },
  { value: 'friend', label: 'Amigos' },
  { value: 'other', label: 'Otros' }
]

const STATUS_COLORS: Record<DelegatedStatus, string> = {
  pending: 'text-yellow-400 bg-yellow-400/10',
  in_progress: 'text-blue-400 bg-blue-400/10',
  done: 'text-emerald-400 bg-emerald-400/10',
  cancelled: 'text-slate-500 bg-slate-500/10'
}

const EMPTY_FORM: CreateContactInput = { name: '', phone: '', email: '', notes: '', type: 'other' }

export default function Contacts() {
  const { data: contacts = [] } = useContacts()
  const { data: allTasks = [] } = useDelegatedTasks()
  const createContact = useCreateContact()
  const updateContact = useUpdateContact()
  const deleteContact = useDeleteContact()
  const createTask = useCreateDelegatedTask()
  const updateTask = useUpdateDelegatedTask()
  const deleteTask = useDeleteDelegatedTask()

  const [tab, setTab] = useState<ContactType | 'all'>('all')
  const [selected, setSelected] = useState<Contact | null>(null)
  const [showNewContact, setShowNewContact] = useState(false)
  const [newForm, setNewForm] = useState<CreateContactInput>(EMPTY_FORM)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Contact>>({})
  const [savingEdit, setSavingEdit] = useState(false)

  // New task form per contact
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 3 as Priority, dueDate: '' })

  // Remind state
  const [reminding, setReminding] = useState<string | null>(null)
  const [reminded, setReminded] = useState<Set<string>>(new Set())

  const filtered = tab === 'all' ? contacts : contacts.filter((c) => c.type === tab)
  const contactTasks = selected ? allTasks.filter((t) => t.contact_id === selected.id) : []
  const activeTasks = contactTasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled')

  const handleSelectContact = (c: Contact) => {
    setSelected(c)
    setEditing(false)
    setEditForm({})
    setShowTaskForm(false)
  }

  const handleStartEdit = () => {
    if (!selected) return
    setEditForm({ name: selected.name, phone: selected.phone, email: selected.email, notes: selected.notes, type: selected.type, avatar_color: selected.avatar_color })
    setEditing(true)
  }

  const handleSaveEdit = async () => {
    if (!selected) return
    setSavingEdit(true)
    try {
      const updated = await window.api.contacts.update(selected.id, editForm)
      if (updated) setSelected(updated)
      updateContact.mutate({ id: selected.id, data: editForm })
      setEditing(false)
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async () => {
    if (!selected || !confirm(`¿Eliminar a ${selected.name}? Se eliminarán también sus tareas asignadas.`)) return
    await window.api.contacts.delete(selected.id)
    deleteContact.mutate(selected.id)
    setSelected(null)
  }

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newForm.name.trim() || !newForm.phone.trim()) return
    const created = await createContact.mutateAsync(newForm)
    setNewForm(EMPTY_FORM)
    setShowNewContact(false)
    setSelected(created)
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || !taskForm.title.trim()) return
    await createTask.mutateAsync({
      contact_id: selected.id,
      title: taskForm.title.trim(),
      description: taskForm.description.trim(),
      priority: taskForm.priority,
      due_date: taskForm.dueDate ? dayjs(taskForm.dueDate).valueOf() : null
    })
    setTaskForm({ title: '', description: '', priority: 3, dueDate: '' })
    setShowTaskForm(false)
  }

  const handleRemind = async (task: DelegatedTask) => {
    if (!selected?.phone) return
    setReminding(task.id)
    try {
      await window.api.delegated.remind(selected.phone, task.title, selected.name)
      setReminded((s) => new Set(s).add(task.id))
      setTimeout(() => setReminded((s) => { const n = new Set(s); n.delete(task.id); return n }), 3000)
    } finally {
      setReminding(null)
    }
  }

  const AVATAR_COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left panel — contact list */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-slate-700 bg-slate-800/50">
        {/* Header */}
        <div className="px-4 py-4 border-b border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users size={17} className="text-indigo-400" />
              <h1 className="font-bold text-base">Contactos</h1>
              <span className="text-xs text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded-full">{contacts.length}</span>
            </div>
            <button
              onClick={() => setShowNewContact(true)}
              className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Type tabs */}
          <div className="flex gap-1 flex-wrap">
            {TYPE_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={cn(
                  'px-2 py-0.5 rounded text-xs font-medium transition-colors',
                  tab === t.value
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto py-2">
          {filtered.length === 0 && (
            <p className="text-center text-xs text-slate-600 mt-8">Sin contactos en esta categoría</p>
          )}
          {filtered.map((c) => {
            const cTasks = allTasks.filter((t) => t.contact_id === c.id && t.status !== 'done' && t.status !== 'cancelled')
            return (
              <button
                key={c.id}
                onClick={() => handleSelectContact(c)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                  selected?.id === c.id ? 'bg-slate-700' : 'hover:bg-slate-700/50'
                )}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: c.avatar_color }}
                >
                  {c.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs truncate" style={{ color: CONTACT_TYPE_COLORS[c.type] }}>
                    {CONTACT_TYPE_LABELS[c.type]}
                  </p>
                </div>
                {cTasks.length > 0 && (
                  <span className="text-xs bg-indigo-600/30 text-indigo-300 px-1.5 py-0.5 rounded-full flex-shrink-0">
                    {cTasks.length}
                  </span>
                )}
                <ChevronRight size={13} className="text-slate-600 flex-shrink-0" />
              </button>
            )
          })}
        </div>
      </div>

      {/* Right panel — contact detail */}
      {selected ? (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
            {/* Profile header */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="flex flex-col items-center gap-2">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: editing ? (editForm.avatar_color ?? selected.avatar_color) : selected.avatar_color }}
                  >
                    {(editing ? editForm.name ?? selected.name : selected.name)[0]?.toUpperCase()}
                  </div>
                  {editing && (
                    <div className="flex gap-1 flex-wrap justify-center w-16">
                      {AVATAR_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setEditForm({ ...editForm, avatar_color: color })}
                          className={cn(
                            'w-4 h-4 rounded-full transition-transform',
                            editForm.avatar_color === color ? 'scale-125 ring-2 ring-white ring-offset-1 ring-offset-slate-800' : ''
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {editing ? (
                    <div className="space-y-2">
                      <input
                        value={editForm.name ?? ''}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:border-indigo-500"
                      />
                      <select
                        value={editForm.type ?? 'other'}
                        onChange={(e) => setEditForm({ ...editForm, type: e.target.value as ContactType })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                      >
                        {(Object.keys(CONTACT_TYPE_LABELS) as ContactType[]).map((t) => (
                          <option key={t} value={t}>{CONTACT_TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <h2 className="text-lg font-bold">{selected.name}</h2>
                      <span
                        className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ color: CONTACT_TYPE_COLORS[selected.type], backgroundColor: `${CONTACT_TYPE_COLORS[selected.type]}18` }}
                      >
                        {CONTACT_TYPE_LABELS[selected.type]}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  {editing ? (
                    <>
                      <button
                        onClick={handleSaveEdit}
                        disabled={savingEdit}
                        className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                      >
                        {savingEdit ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        Guardar
                      </button>
                      <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-slate-400 hover:text-slate-200 text-sm transition-colors">
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={handleStartEdit} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-sm rounded-lg transition-colors">
                        Editar
                      </button>
                      <button onClick={handleDelete} className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Contact fields */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-3">
                  <Phone size={14} className="text-slate-500 flex-shrink-0" />
                  {editing ? (
                    <input
                      value={editForm.phone ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      placeholder="Teléfono"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  ) : (
                    <span className="text-sm text-slate-300">{selected.phone || <span className="text-slate-600">Sin teléfono</span>}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Mail size={14} className="text-slate-500 flex-shrink-0" />
                  {editing ? (
                    <input
                      value={editForm.email ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      placeholder="Email (opcional)"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  ) : (
                    <span className="text-sm text-slate-300">{selected.email || <span className="text-slate-600">Sin email</span>}</span>
                  )}
                </div>
                <div className="flex items-start gap-3">
                  <FileText size={14} className="text-slate-500 flex-shrink-0 mt-1" />
                  {editing ? (
                    <textarea
                      rows={2}
                      value={editForm.notes ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      placeholder="Notas sobre el contacto..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 resize-none"
                    />
                  ) : (
                    <span className="text-sm text-slate-300 whitespace-pre-wrap">
                      {selected.notes || <span className="text-slate-600">Sin notas</span>}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Delegated tasks */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">Tareas asignadas</h3>
                  {activeTasks.length > 0 && (
                    <span className="text-xs bg-indigo-600/30 text-indigo-300 px-1.5 py-0.5 rounded-full">{activeTasks.length} activas</span>
                  )}
                </div>
                <button
                  onClick={() => setShowTaskForm((v) => !v)}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <Plus size={13} /> Asignar tarea
                </button>
              </div>

              {/* New task form */}
              {showTaskForm && (
                <form onSubmit={handleCreateTask} className="px-5 py-4 border-b border-slate-700 space-y-3 bg-slate-900/40">
                  <input
                    required
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    placeholder="¿Qué debe hacer?"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <textarea
                    rows={2}
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                    placeholder="Notas adicionales (opcional)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={taskForm.priority}
                      onChange={(e) => setTaskForm({ ...taskForm, priority: Number(e.target.value) as Priority })}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    >
                      {([1, 2, 3, 4, 5] as Priority[]).map((p) => (
                        <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                      ))}
                    </select>
                    <DatePicker value={taskForm.dueDate} onChange={(d) => setTaskForm({ ...taskForm, dueDate: d })} placeholder="Sin fecha" />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={!taskForm.title.trim() || createTask.isPending} className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm rounded-lg transition-colors">
                      {createTask.isPending ? 'Guardando...' : 'Asignar'}
                    </button>
                    <button type="button" onClick={() => setShowTaskForm(false)} className="px-3 text-slate-400 hover:text-slate-200 text-sm transition-colors">
                      Cancelar
                    </button>
                  </div>
                </form>
              )}

              {/* Task list */}
              {contactTasks.length === 0 ? (
                <p className="px-5 py-4 text-sm text-slate-600">Sin tareas asignadas</p>
              ) : (
                <div className="divide-y divide-slate-700/50">
                  {contactTasks.map((task) => {
                    const overdue = isOverdue(task.due_date) && task.status !== 'done' && task.status !== 'cancelled'
                    return (
                      <div key={task.id} className={cn('flex items-start gap-3 px-5 py-3', (task.status === 'done' || task.status === 'cancelled') && 'opacity-50')}>
                        <select
                          value={task.status}
                          onChange={(e) => updateTask.mutate({ id: task.id, data: { status: e.target.value as DelegatedStatus } })}
                          className={cn('text-xs px-2 py-1 rounded-lg border-0 cursor-pointer font-medium focus:outline-none flex-shrink-0', STATUS_COLORS[task.status])}
                        >
                          {(Object.keys(DELEGATED_STATUS_LABELS) as DelegatedStatus[]).map((s) => (
                            <option key={s} value={s}>{DELEGATED_STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm font-medium', task.status === 'done' && 'line-through text-slate-500')}>{task.title}</p>
                          {task.description && <p className="text-xs text-slate-500 mt-0.5">{task.description}</p>}
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ color: PRIORITY_COLORS[task.priority], backgroundColor: `${PRIORITY_COLORS[task.priority]}18` }}>
                              {PRIORITY_LABELS[task.priority]}
                            </span>
                            {task.due_date && (
                              <span className={cn('text-[10px] flex items-center gap-1', overdue ? 'text-red-400' : 'text-slate-500')}>
                                {formatDate(task.due_date)}{overdue && ' · Vencida'}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleRemind(task)}
                            disabled={!!reminding || task.status === 'done' || task.status === 'cancelled'}
                            className={cn('p-1.5 rounded-lg transition-colors', reminded.has(task.id) ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-500 hover:text-emerald-400 hover:bg-slate-700 disabled:opacity-30')}
                            title="Enviar recordatorio WhatsApp"
                          >
                            {reminding === task.id ? <Loader2 size={13} className="animate-spin" /> : reminded.has(task.id) ? <Check size={13} /> : <MessageCircle size={13} />}
                          </button>
                          <button onClick={() => deleteTask.mutate(task.id)} className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-600">
          <div className="text-center">
            <Users size={48} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">Seleccioná un contacto para ver su perfil</p>
          </div>
        </div>
      )}

      {/* New contact modal */}
      {showNewContact && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <h2 className="font-semibold">Nuevo contacto</h2>
              <button onClick={() => setShowNewContact(false)} className="text-slate-400 hover:text-slate-200 transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateContact} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Nombre *</label>
                  <input required value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} placeholder="Nombre completo" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Tipo</label>
                  <select value={newForm.type} onChange={(e) => setNewForm({ ...newForm, type: e.target.value as ContactType })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                    {(Object.keys(CONTACT_TYPE_LABELS) as ContactType[]).map((t) => (
                      <option key={t} value={t}>{CONTACT_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Teléfono *</label>
                  <input required value={newForm.phone} onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })} placeholder="5491112345678" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Email</label>
                  <input type="email" value={newForm.email} onChange={(e) => setNewForm({ ...newForm, email: e.target.value })} placeholder="email@ejemplo.com" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Notas</label>
                <textarea rows={2} value={newForm.notes} onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })} placeholder="Rol, empresa, contexto..." className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none" />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={!newForm.name.trim() || !newForm.phone.trim() || createContact.isPending} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
                  {createContact.isPending ? 'Guardando...' : 'Crear contacto'}
                </button>
                <button type="button" onClick={() => { setShowNewContact(false); setNewForm(EMPTY_FORM) }} className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
