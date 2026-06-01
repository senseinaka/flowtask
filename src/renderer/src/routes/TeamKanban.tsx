import { useMemo, useRef, useState, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Trash2, Check, X, Calendar, UserCircle2, Search } from 'lucide-react'
import type { DelegatedTask, DelegatedStatus, Priority } from '@shared/types'
import { DELEGATED_STATUS_LABELS, PRIORITY_COLORS, PRIORITY_LABELS } from '@shared/types'
import { useDelegatedTasks, useUpdateDelegatedTask, useDeleteDelegatedTask } from '../hooks/useDelegated'
import { useContacts } from '../hooks/useContacts'
import { useUIStore } from '../store/ui.store'
import DelegatedTaskDetail from '../components/tasks/DelegatedTaskDetail'
import { cn, formatDate, isOverdue } from '../components/ui/utils'

const COLUMNS: DelegatedStatus[] = ['pending', 'in_progress', 'done', 'cancelled']

const COLUMN_STYLES: Record<DelegatedStatus, string> = {
  pending:    'border-yellow-600',
  in_progress:'border-blue-600',
  done:       'border-emerald-600',
  cancelled:  'border-slate-600'
}

const COLUMN_HEADER_STYLES: Record<DelegatedStatus, string> = {
  pending:    'text-yellow-300',
  in_progress:'text-blue-300',
  done:       'text-emerald-300',
  cancelled:  'text-slate-400'
}

// ── Priority badge (igual al TaskCard) ───────────────────────────────────────

function PriorityBadge({ priority }: { priority: Priority }) {
  const color = PRIORITY_COLORS[priority]
  const label = PRIORITY_LABELS[priority]
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

// ── Status badge ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<DelegatedStatus, { bg: string; text: string }> = {
  pending:    { bg: 'bg-yellow-900/30', text: 'text-yellow-400' },
  in_progress:{ bg: 'bg-blue-900/30',   text: 'text-blue-400' },
  done:       { bg: 'bg-emerald-900/30', text: 'text-emerald-400' },
  cancelled:  { bg: 'bg-slate-700',      text: 'text-slate-400' }
}

// ── Delegated task card ───────────────────────────────────────────────────────

function DelegatedCard({
  task,
  selected,
  onDelete,
  onClick,
  onDoubleClick
}: {
  task: DelegatedTask
  selected: boolean
  onDelete: (id: string) => void
  onClick: (id: string) => void
  onDoubleClick: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const overdue = task.due_date
    ? isOverdue(task.due_date) && task.status !== 'done' && task.status !== 'cancelled'
    : false
  const priorityColor = PRIORITY_COLORS[task.priority]

  return (
    <div
      onClick={() => onClick(task.id)}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(task.id) }}
      className={cn(
        'bg-slate-800 border rounded-lg p-3 group transition-colors cursor-pointer',
        selected ? 'border-violet-500 bg-violet-900/10' : 'border-slate-700 hover:border-slate-600'
      )}
      style={{ borderLeftColor: priorityColor, borderLeftWidth: '3px' }}
    >
      {/* Título */}
      <p className={cn(
        'text-xs font-medium leading-snug mb-2',
        task.status === 'done' || task.status === 'cancelled'
          ? 'line-through text-slate-500'
          : 'text-slate-200'
      )}>
        {task.title}
      </p>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <PriorityBadge priority={task.priority} />
        <span className={cn(
          'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
          STATUS_BADGE[task.status].bg, STATUS_BADGE[task.status].text
        )}>
          {DELEGATED_STATUS_LABELS[task.status]}
        </span>
      </div>

      {/* Footer: contacto + fecha + delete */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {task.contact?.name && (
            <div className="flex items-center gap-1 min-w-0">
              <UserCircle2 size={10} className="text-slate-500 shrink-0" />
              <span className="text-[10px] text-slate-500 truncate">{task.contact.name}</span>
            </div>
          )}
          {task.due_date && (
            <div className={cn('flex items-center gap-1 shrink-0', overdue ? 'text-red-400' : 'text-slate-500')}>
              <Calendar size={10} className="shrink-0" />
              <span className="text-[10px]">{formatDate(task.due_date)}</span>
            </div>
          )}
        </div>

        {/* Delete controls */}
        <div className="flex items-center gap-0.5 shrink-0">
          {confirmDelete ? (
            <>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onDelete(task.id) }}
                className="p-1 rounded bg-red-600 hover:bg-red-500 text-white transition-colors"
              >
                <Check size={11} />
              </button>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(false) }}
                className="p-1 rounded bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X size={11} />
              </button>
            </>
          ) : (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
              className="p-1 rounded text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sortable wrapper ──────────────────────────────────────────────────────────

function SortableCard({
  task,
  selected,
  suppressNextClick,
  onDelete,
  onClick,
  onDoubleClick
}: {
  task: DelegatedTask
  selected: boolean
  suppressNextClick: React.RefObject<Set<string>>
  onDelete: (id: string) => void
  onClick: (id: string) => void
  onDoubleClick: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }}
      {...attributes}
      {...listeners}
      onClickCapture={(e) => {
        if (suppressNextClick.current?.has(task.id)) {
          e.stopPropagation()
          suppressNextClick.current?.delete(task.id)
        }
      }}
    >
      <DelegatedCard task={task} selected={selected} onDelete={onDelete} onClick={onClick} onDoubleClick={onDoubleClick} />
    </div>
  )
}

// ── Droppable column area ─────────────────────────────────────────────────────

function ColumnArea({
  colStatus, colTasks, suppressNextClick, selectedId, onDelete, onClick, onDoubleClick
}: {
  colStatus: DelegatedStatus
  colTasks: DelegatedTask[]
  suppressNextClick: React.RefObject<Set<string>>
  selectedId: string | null
  onDelete: (id: string) => void
  onClick: (id: string) => void
  onDoubleClick: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: colStatus })

  return (
    <div ref={setNodeRef} className={cn('flex-1 overflow-y-auto p-2 space-y-2 transition-colors', isOver && 'bg-slate-700/20')}>
      <SortableContext items={colTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {colTasks.map((task) => (
          <SortableCard
            key={task.id}
            task={task}
            selected={selectedId === task.id}
            suppressNextClick={suppressNextClick}
            onDelete={onDelete}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
          />
        ))}
      </SortableContext>

      {colTasks.length === 0 && (
        <div className={cn(
          'h-20 border-2 border-dashed rounded-lg flex items-center justify-center transition-colors',
          isOver ? 'border-violet-500 bg-violet-900/10' : 'border-slate-700'
        )}>
          <span className="text-xs text-slate-600">Arrastrá aquí</span>
        </div>
      )}
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

const MIN_WIDTH = 280
const MAX_WIDTH = 620

export default function TeamKanban() {
  const { data: tasks = [] }    = useDelegatedTasks()
  const { data: contacts = [] } = useContacts()
  const updateTask  = useUpdateDelegatedTask()
  const deleteTask  = useDeleteDelegatedTask()
  const {
    selectedDelegatedTaskId, setSelectedDelegatedTask,
    delegatedDetailPanelWidth, setDelegatedDetailPanelWidth,
    openExpandedDelegatedTask
  } = useUIStore()

  const [activeTask,       setActiveTask]       = useState<DelegatedTask | null>(null)
  const [search,           setSearch]           = useState('')
  const [filterContactId,  setFilterContactId]  = useState('')
  const [filterPriority,   setFilterPriority]   = useState('')
  const [filterStatus,     setFilterStatus]     = useState('')
  const suppressNextClick = useRef<Set<string>>(new Set())

  // Drag-to-resize del panel de detalle
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const hasFilters = !!(search || filterContactId || filterPriority || filterStatus)

  // Tareas filtradas
  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filterContactId && t.contact_id !== filterContactId) return false
      if (filterPriority  && t.priority !== Number(filterPriority)) return false
      if (filterStatus    && t.status !== filterStatus) return false
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [tasks, search, filterContactId, filterPriority, filterStatus])

  const columns = useMemo(() => {
    const map: Record<DelegatedStatus, DelegatedTask[]> = { pending: [], in_progress: [], done: [], cancelled: [] }
    for (const t of filtered) map[t.status].push(t)
    return map
  }, [filtered])

  const handleDragStart = (event: DragStartEvent) =>
    setActiveTask(tasks.find((t) => t.id === event.active.id) ?? null)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)
    if (!over) return
    const task = tasks.find((t) => t.id === active.id)
    if (!task) return
    suppressNextClick.current.add(active.id as string)
    setTimeout(() => suppressNextClick.current.delete(active.id as string), 300)
    const newStatus: DelegatedStatus | undefined = COLUMNS.includes(over.id as DelegatedStatus)
      ? (over.id as DelegatedStatus)
      : tasks.find((t) => t.id === over.id)?.status
    if (newStatus && newStatus !== task.status) {
      updateTask.mutate({ id: task.id, data: { status: newStatus } })
    }
  }

  const handleDelete = (id: string) => {
    deleteTask.mutate(id)
    if (selectedDelegatedTaskId === id) setSelectedDelegatedTask(null)
  }

  const handleCardClick = (id: string) =>
    setSelectedDelegatedTask(selectedDelegatedTaskId === id ? null : id)

  const handleCardDoubleClick = (id: string) => {
    setSelectedDelegatedTask(id)
    openExpandedDelegatedTask(id)
  }

  const clearFilters = () => {
    setSearch('')
    setFilterContactId('')
    setFilterPriority('')
    setFilterStatus('')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Barra de filtros ─────────────────────────────────────────────── */}
      <div className="px-4 py-2 border-b border-slate-700 flex items-center gap-3 flex-shrink-0 bg-slate-800 flex-wrap">

        {/* Búsqueda */}
        <div className="relative">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tarea..."
            className="bg-slate-700 border border-slate-600 rounded px-2 pl-6 py-1 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-violet-500 w-40"
          />
        </div>

        {/* Prioridad */}
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-violet-500"
        >
          <option value="">Todas las prioridades</option>
          {([1, 2, 3, 4, 5] as Priority[]).map((p) => (
            <option key={p} value={String(p)}>{PRIORITY_LABELS[p]}</option>
          ))}
        </select>

        {/* Estado */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-violet-500"
        >
          <option value="">Todos los estados</option>
          {COLUMNS.map((s) => (
            <option key={s} value={s}>{DELEGATED_STATUS_LABELS[s]}</option>
          ))}
        </select>

        {/* Contacto */}
        {contacts.length > 0 && (
          <select
            value={filterContactId}
            onChange={(e) => setFilterContactId(e.target.value)}
            className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-violet-500"
          >
            <option value="">Todos los contactos</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}

        {/* Limpiar */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
          >
            <X size={11} /> Limpiar
          </button>
        )}

        <span className="ml-auto text-xs text-slate-600">
          {filtered.length} tarea{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Kanban + panel de detalle ────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex-1 grid grid-cols-4 gap-0 overflow-hidden">
            {COLUMNS.map((colStatus) => {
              const colTasks = columns[colStatus]
              return (
                <div
                  key={colStatus}
                  className={cn('flex flex-col border-t-2 bg-slate-850 overflow-hidden', COLUMN_STYLES[colStatus])}
                >
                  <div className="px-3 py-3 border-b border-slate-700 bg-slate-800 flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <span className={cn('text-xs font-semibold uppercase tracking-wider', COLUMN_HEADER_STYLES[colStatus])}>
                        {DELEGATED_STATUS_LABELS[colStatus]}
                      </span>
                      <span className="text-xs text-slate-500 bg-slate-700 rounded-full px-1.5 py-0.5">
                        {colTasks.length}
                      </span>
                    </div>
                  </div>
                  <ColumnArea
                    colStatus={colStatus}
                    colTasks={colTasks}
                    suppressNextClick={suppressNextClick}
                    selectedId={selectedDelegatedTaskId}
                    onDelete={handleDelete}
                    onClick={handleCardClick}
                    onDoubleClick={handleCardDoubleClick}
                  />
                </div>
              )
            })}
          </div>

          <DragOverlay>
            {activeTask && (
              <div className="rotate-1 opacity-90 shadow-2xl">
                <DelegatedCard task={activeTask} selected={false} onDelete={() => {}} onClick={() => {}} onDoubleClick={() => {}} />
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {/* Drag handle + panel de detalle */}
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
    </div>
  )
}
