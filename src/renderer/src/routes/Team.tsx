import { useState, useRef, useEffect } from 'react'
import {
  Users, Plus, X, Trash2, MessageCircle, ChevronDown,
  AlertTriangle, Check, Loader2, Mail, Calendar, Filter, Search
} from 'lucide-react'
import type { DelegatedTask, DelegatedStatus, Priority, Contact } from '@shared/types'
import { PRIORITY_LABELS, PRIORITY_COLORS, DELEGATED_STATUS_LABELS } from '@shared/types'
import { useDelegatedTasks, useCreateDelegatedTask, useUpdateDelegatedTask, useDeleteDelegatedTask } from '../hooks/useDelegated'
import { useContacts } from '../hooks/useContacts'
import { useUIStore } from '../store/ui.store'
import DatePicker from '../components/ui/DatePicker'
import DelegatedTaskDetail from '../components/tasks/DelegatedTaskDetail'
import { cn, formatDate, isOverdue } from '../components/ui/utils'
import dayjs from 'dayjs'

const STATUSES: DelegatedStatus[] = ['pending', 'in_progress', 'done', 'cancelled']

const STATUS_COLORS: Record<DelegatedStatus, string> = {
  pending:    'text-yellow-400 bg-yellow-400/10',
  in_progress:'text-blue-400 bg-blue-400/10',
  done:       'text-emerald-400 bg-emerald-400/10',
  cancelled:  'text-slate-500 bg-slate-500/10'
}

interface NewTaskForm {
  contactId: string
  title: string
  description: string
  priority: Priority
  dueDate: string
  notifyWhatsapp: boolean
  notifyEmail: boolean
}

const EMPTY_FORM: NewTaskForm = {
  contactId: '', title: '', description: '', priority: 3, dueDate: '',
  notifyWhatsapp: false, notifyEmail: false
}

const MIN_WIDTH = 280
const MAX_WIDTH = 680

export default function Team() {
  const { data: tasks = [] }    = useDelegatedTasks()
  const { data: contacts = [] } = useContacts()
  const createTask  = useCreateDelegatedTask()
  const updateTask  = useUpdateDelegatedTask()
  const deleteTask  = useDeleteDelegatedTask()
  const {
    selectedDelegatedTaskId, setSelectedDelegatedTask,
    delegatedDetailPanelWidth, setDelegatedDetailPanelWidth
  } = useUIStore()

  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState<NewTaskForm>(EMPTY_FORM)
  const [reminding, setReminding] = useState<string | null>(null)
  const [reminded, setReminded]   = useState<Set<string>>(new Set())
  const [expandedContact, setExpandedContact] = useState<string | null>(null)

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [search,          setSearch]          = useState('')
  const [filterStatuses,  setFilterStatuses]  = useState<DelegatedStatus[]>([])
  const [filterPriorities,setFilterPriorities]= useState<Priority[]>([])
  const [filterContactId, setFilterContactId] = useState<string>('')

  const toggleStatus = (s: DelegatedStatus) =>
    setFilterStatuses((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s])
  const togglePriority = (p: Priority) =>
    setFilterPriorities((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])
  const hasFilters = !!(search || filterStatuses.length || filterPriorities.length || filterContactId)
  const clearFilters = () => { setSearch(''); setFilterStatuses([]); setFilterPriorities([]); setFilterContactId('') }

  // ── Drag-to-resize ───────────────────────────────────────────────────────────
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const delta = startX.current - e.clientX
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW.current + delta))
      setDelegatedDetailPanelWidth(next)
    }
    const onUp = () => {
      if (!isResizing.current) return
      isResizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [setDelegatedDetailPanelWidth])

  const onHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true
    startX.current = e.clientX
    startW.current = delegatedDetailPanelWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  // ── Filter tasks ─────────────────────────────────────────────────────────────
  const filterTask = (t: DelegatedTask): boolean => {
    if (filterStatuses.length && !filterStatuses.includes(t.status)) return false
    if (filterPriorities.length && !filterPriorities.includes(t.priority)) return false
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }

  // ── Group by contact ─────────────────────────────────────────────────────────
  const byContact = contacts.reduce<Record<string, { contact: Contact; tasks: DelegatedTask[] }>>(
    (acc, c) => {
      acc[c.id] = { contact: c, tasks: tasks.filter((t) => t.contact_id === c.id && filterTask(t)) }
      return acc
    }, {}
  )

  const sorted = Object.values(byContact)
    .filter((g) => {
      if (filterContactId && g.contact.id !== filterContactId) return false
      if (hasFilters && g.tasks.length === 0) return false
      return true
    })
    .sort((a, b) => b.tasks.length - a.tasks.length)

  // ── Stats ────────────────────────────────────────────────────────────────────
  const activeTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled')
  const doneTasks   = tasks.filter((t) => t.status === 'done' || t.status === 'cancelled')

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.contactId || !form.title.trim()) return
    const contact = contacts.find((c) => c.id === form.contactId)
    await createTask.mutateAsync({
      contact_id: form.contactId,
      title: form.title.trim(),
      description: form.description.trim(),
      priority: form.priority,
      due_date: form.dueDate ? dayjs(form.dueDate).valueOf() : null
    })
    if (contact) {
      if (form.notifyWhatsapp && contact.phone) {
        const msg = `Hola ${contact.name}, te asigno una nueva tarea:\n\n*${form.title.trim()}*${form.description.trim() ? `\n\n${form.description.trim()}` : ''}${form.dueDate ? `\n\nVencimiento: ${dayjs(form.dueDate).format('DD/MM/YYYY')}` : ''}`
        await window.api.whatsapp.send(contact.phone, msg).catch(() => null)
      }
      if (form.notifyEmail && contact.email) {
        const subject = encodeURIComponent(`Tarea asignada: ${form.title.trim()}`)
        const body = encodeURIComponent(`Hola ${contact.name},\n\nTe asigno la siguiente tarea:\n\n${form.title.trim()}${form.description.trim() ? `\n\n${form.description.trim()}` : ''}${form.dueDate ? `\n\nVencimiento: ${dayjs(form.dueDate).format('DD/MM/YYYY')}` : ''}\n\nSaludos`)
        await window.api.shell.open(`mailto:${contact.email}?subject=${subject}&body=${body}`)
      }
    }
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  const handleRemind = async (task: DelegatedTask) => {
    if (!task.contact?.phone) return
    setReminding(task.id)
    try {
      await window.api.delegated.remind(task.contact.phone, task.title, task.contact.name ?? '')
      setReminded((s) => new Set(s).add(task.id))
      setTimeout(() => setReminded((s) => { const n = new Set(s); n.delete(task.id); return n }), 3000)
    } finally {
      setReminding(null)
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Users size={20} className="text-violet-400" />
          <h1 className="text-lg font-bold">Tareas asignadas</h1>
          <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
            {activeTasks.length} activas · {doneTasks.length} completadas
          </span>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={15} /> Asignar tarea
        </button>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div className="px-4 py-2 bg-slate-850 border-b border-slate-700 flex items-center gap-2 flex-wrap flex-shrink-0">
        <Filter size={13} className="text-slate-500 flex-shrink-0" />

        {/* Search */}
        <div className="relative">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="bg-slate-700 border border-slate-600 rounded px-2 pl-6 py-0.5 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-violet-500 w-28"
          />
        </div>

        <span className="text-xs text-slate-500 mr-0.5">Estado:</span>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => toggleStatus(s)}
            className={cn('px-2 py-0.5 rounded text-xs transition-colors',
              filterStatuses.includes(s) ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-600'
            )}>
            {DELEGATED_STATUS_LABELS[s]}
          </button>
        ))}

        <span className="text-xs text-slate-500 ml-1 mr-0.5">Prioridad:</span>
        {([1,2,3,4,5] as Priority[]).map((p) => (
          <button key={p} onClick={() => togglePriority(p)}
            className={cn('px-2 py-0.5 rounded text-xs transition-colors',
              filterPriorities.includes(p) ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-600'
            )}>
            {PRIORITY_LABELS[p]}
          </button>
        ))}

        {contacts.length > 0 && (
          <>
            <span className="text-xs text-slate-500 ml-1 mr-0.5">Contacto:</span>
            <select
              value={filterContactId}
              onChange={(e) => setFilterContactId(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-xs text-slate-300 focus:outline-none focus:border-violet-500"
            >
              <option value="">Todos</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </>
        )}

        {hasFilters && (
          <button onClick={clearFilters} className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors">
            <X size={12} /> Limpiar
          </button>
        )}
      </div>

      {/* ── Content area (list + panel) ─────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: scrollable task list */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 min-w-0">
          {contacts.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <Users size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No hay contactos en la agenda.</p>
            </div>
          )}

          {sorted.length === 0 && contacts.length > 0 && (
            <div className="text-center py-16 text-slate-500">
              <p className="text-sm">{hasFilters ? 'Sin resultados para los filtros aplicados.' : 'Sin tareas asignadas aún.'}</p>
            </div>
          )}

          {sorted.map(({ contact, tasks: ctasks }) => {
            const active  = ctasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled')
            const done    = ctasks.filter((t) => t.status === 'done' || t.status === 'cancelled')
            const isOpen  = expandedContact === null || expandedContact === contact.id
            const hasOverdue = active.some((t) => isOverdue(t.due_date))

            return (
              <div key={contact.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                {/* Contact header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-700/30 transition-colors"
                  onClick={() => setExpandedContact(isOpen && expandedContact === contact.id ? null : contact.id)}
                >
                  <div className="w-8 h-8 rounded-full bg-violet-600/30 border border-violet-500/30 flex items-center justify-center text-sm font-bold text-violet-300 flex-shrink-0">
                    {contact.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{contact.name}</p>
                    <p className="text-xs text-slate-500">{contact.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasOverdue && <AlertTriangle size={13} className="text-red-400" />}
                    <span className="text-xs text-slate-500">
                      {active.length} pendiente{active.length !== 1 ? 's' : ''}
                      {done.length > 0 && ` · ${done.length} hecha${done.length !== 1 ? 's' : ''}`}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setForm({ ...EMPTY_FORM, contactId: contact.id }); setShowForm(true) }}
                      className="p-1 text-slate-500 hover:text-violet-400 hover:bg-slate-700 rounded transition-colors"
                      title="Asignar tarea a este colaborador"
                    >
                      <Plus size={14} />
                    </button>
                    <ChevronDown size={14} className={cn('text-slate-500 transition-transform', expandedContact === contact.id ? 'rotate-180' : '')} />
                  </div>
                </div>

                {/* Tasks */}
                {isOpen && ctasks.length > 0 && (
                  <div className="border-t border-slate-700 divide-y divide-slate-700/50">
                    {ctasks.map((task) => {
                      const overdue  = isOverdue(task.due_date) && task.status !== 'done' && task.status !== 'cancelled'
                      const selected = selectedDelegatedTaskId === task.id
                      return (
                        <div
                          key={task.id}
                          className={cn(
                            'px-4 py-3 flex items-start gap-3 cursor-pointer transition-colors',
                            task.status === 'done' || task.status === 'cancelled' ? 'opacity-50' : '',
                            selected ? 'bg-violet-900/20' : 'hover:bg-slate-700/20'
                          )}
                          onClick={() => setSelectedDelegatedTask(selected ? null : task.id)}
                        >
                          {/* Status selector */}
                          <select
                            value={task.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateTask.mutate({ id: task.id, data: { status: e.target.value as DelegatedStatus } })}
                            className={cn('text-xs px-2 py-1 rounded-lg border-0 cursor-pointer font-medium focus:outline-none flex-shrink-0', STATUS_COLORS[task.status])}
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>{DELEGATED_STATUS_LABELS[s]}</option>
                            ))}
                          </select>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-sm font-medium', task.status === 'done' && 'line-through text-slate-500')}>
                              {task.title}
                            </p>
                            {task.description && (
                              <p className="text-xs text-slate-500 mt-0.5 truncate">{task.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                                style={{ color: PRIORITY_COLORS[task.priority], backgroundColor: `${PRIORITY_COLORS[task.priority]}18` }}>
                                {PRIORITY_LABELS[task.priority]}
                              </span>
                              {task.due_date && (
                                <span className={cn('flex items-center gap-1 text-[10px]', overdue ? 'text-red-400' : 'text-slate-500')}>
                                  <Calendar size={10} />
                                  {formatDate(task.due_date)}
                                  {overdue && ' · Vencida'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleRemind(task)}
                              disabled={!!reminding || task.status === 'done' || task.status === 'cancelled' || !task.contact?.phone}
                              title="Enviar recordatorio por WhatsApp"
                              className={cn('p-1.5 rounded-lg transition-colors',
                                reminded.has(task.id) ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-500 hover:text-emerald-400 hover:bg-slate-700 disabled:opacity-30'
                              )}
                            >
                              {reminding === task.id ? <Loader2 size={13} className="animate-spin" /> : reminded.has(task.id) ? <Check size={13} /> : <MessageCircle size={13} />}
                            </button>
                            <button
                              onClick={() => { deleteTask.mutate(task.id); if (selected) setSelectedDelegatedTask(null) }}
                              className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {isOpen && ctasks.length === 0 && (
                  <div className="border-t border-slate-700 px-4 py-3 text-xs text-slate-600">
                    Sin tareas{hasFilters ? ' que coincidan con los filtros' : ' asignadas'}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Drag handle + detail panel */}
        {selectedDelegatedTaskId && (
          <>
            <div
              onMouseDown={onHandleMouseDown}
              className="w-1 flex-shrink-0 bg-slate-700 hover:bg-violet-500 active:bg-violet-400 cursor-col-resize transition-colors relative"
            >
              <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
            </div>
            <div style={{ width: delegatedDetailPanelWidth }} className="flex-shrink-0 overflow-hidden h-full">
              <DelegatedTaskDetail />
            </div>
          </>
        )}
      </div>

      {/* ── New task modal ──────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <h2 className="font-semibold">Asignar tarea a persona</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-200 transition-colors"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">A quién</label>
                <select required value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 transition-colors">
                  <option value="">Elegir contacto...</option>
                  {contacts.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Tarea</label>
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="¿Qué debe hacer?"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 transition-colors" />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Notas (opcional)</label>
                <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Contexto adicional..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Prioridad</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) as Priority })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 transition-colors">
                    {([1, 2, 3, 4, 5] as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Vencimiento</label>
                  <DatePicker value={form.dueDate} onChange={(d) => setForm({ ...form, dueDate: d })} placeholder="Sin fecha" />
                </div>
              </div>

              {form.contactId && (() => {
                const contact = contacts.find((c) => c.id === form.contactId)
                return (
                  <div className="space-y-2 border-t border-slate-700 pt-3">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Notificar al asignar</p>
                    <label className={cn('flex items-center gap-3 cursor-pointer', !contact?.phone && 'opacity-40 cursor-not-allowed')}>
                      <input type="checkbox" checked={form.notifyWhatsapp} disabled={!contact?.phone}
                        onChange={(e) => setForm({ ...form, notifyWhatsapp: e.target.checked })}
                        className="w-4 h-4 rounded accent-emerald-500" />
                      <MessageCircle size={14} className="text-emerald-400" />
                      <span className="text-sm text-slate-300">Enviar por WhatsApp{contact?.phone && <span className="text-slate-500 ml-1">({contact.phone})</span>}</span>
                    </label>
                    <label className={cn('flex items-center gap-3 cursor-pointer', !contact?.email && 'opacity-40 cursor-not-allowed')}>
                      <input type="checkbox" checked={form.notifyEmail} disabled={!contact?.email}
                        onChange={(e) => setForm({ ...form, notifyEmail: e.target.checked })}
                        className="w-4 h-4 rounded accent-violet-500" />
                      <Mail size={14} className="text-violet-400" />
                      <span className="text-sm text-slate-300">Enviar por Email{contact?.email && <span className="text-slate-500 ml-1">({contact.email})</span>}</span>
                    </label>
                  </div>
                )
              })()}

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={!form.contactId || !form.title.trim() || createTask.isPending}
                  className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
                  {createTask.isPending ? 'Asignando...' : 'Asignar tarea'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
