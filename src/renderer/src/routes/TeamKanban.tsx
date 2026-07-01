import { useMemo, useRef, useState } from 'react'
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
import { Search, X, Plus } from 'lucide-react'
import type { TeamTask, TaskStatus, Priority } from '@shared/types'
import { STATUS_LABELS, PRIORITY_LABELS } from '@shared/types'
import { useTeamTasks, useUpdateTeamTask } from '../hooks/useTeamTasks'
import { useProjects } from '../hooks/useProjects'
import { useUIStore } from '../store/ui.store'
import TeamTaskCard from '../components/tasks/TeamTaskCard'
import TeamTaskDetail from '../components/tasks/TeamTaskDetail'
import { cn } from '../components/ui/utils'

const COLUMNS: TaskStatus[] = ['pending', 'in_progress', 'blocked', 'done']

const COLUMN_STYLES: Record<TaskStatus, string> = {
  pending:    'border-slate-600',
  in_progress:'border-blue-600',
  blocked:    'border-red-600',
  done:       'border-emerald-600'
}

const COLUMN_HEADER_STYLES: Record<TaskStatus, string> = {
  pending:    'text-slate-300',
  in_progress:'text-blue-300',
  blocked:    'text-red-300',
  done:       'text-emerald-300'
}

// ─── Sortable card ─────────────────────────────────────────────────────────────

function SortableCard({
  task,
  suppressNextClick
}: {
  task: TeamTask
  suppressNextClick: React.RefObject<Set<string>>
}) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClickCapture={(e) => {
        if (suppressNextClick.current?.has(task.id)) {
          e.stopPropagation()
          suppressNextClick.current?.delete(task.id)
        }
      }}
    >
      <TeamTaskCard task={task} compact />
    </div>
  )
}

// ─── Droppable column card area ────────────────────────────────────────────────

function KanbanCardArea({
  colStatus,
  colTasks,
  suppressNextClick
}: {
  colStatus: TaskStatus
  colTasks: TeamTask[]
  suppressNextClick: React.RefObject<Set<string>>
}) {
  const { setNodeRef, isOver } = useDroppable({ id: colStatus })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-1 overflow-y-auto p-2 space-y-2 transition-colors',
        isOver && 'bg-slate-700/20'
      )}
    >
      <SortableContext
        items={colTasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        {colTasks.map((task) => (
          <SortableCard
            key={task.id}
            task={task}
            suppressNextClick={suppressNextClick}
          />
        ))}
      </SortableContext>

      {colTasks.length === 0 && (
        <div
          className={cn(
            'h-20 border-2 border-dashed rounded-lg flex items-center justify-center transition-colors',
            isOver ? 'border-indigo-500 bg-indigo-900/10' : 'border-slate-700'
          )}
        >
          <span className="text-xs text-slate-600">Arrastrá aquí</span>
        </div>
      )}
    </div>
  )
}

// ─── Main Kanban view ──────────────────────────────────────────────────────────

export default function TeamKanban() {
  const { data: tasks } = useTeamTasks()
  const { data: projects = [] } = useProjects()
  const updateTask = useUpdateTeamTask()
  const { selectedTeamTaskId, openCreateTeamForm } = useUIStore()
  const [activeTask, setActiveTask] = useState<TeamTask | null>(null)

  // Filtros locales
  const [search,          setSearch]          = useState('')
  const [filterPriority,  setFilterPriority]  = useState('')
  const [filterProjectId, setFilterProjectId] = useState('')
  const [filterStatus,    setFilterStatus]    = useState('')

  const suppressNextClick = useRef<Set<string>>(new Set())

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const hasFilters = !!(search || filterPriority || filterProjectId || filterStatus)

  // Tareas filtradas (para construir columnas)
  const filtered = useMemo(() => {
    return (tasks ?? []).filter((t) => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
      if (filterPriority && t.priority !== Number(filterPriority)) return false
      if (filterProjectId && t.project_id !== filterProjectId) return false
      if (filterStatus && t.status !== filterStatus) return false
      return true
    })
  }, [tasks, search, filterPriority, filterProjectId, filterStatus])

  const columns = useMemo(() => {
    const map: Record<TaskStatus, TeamTask[]> = {
      pending: [], in_progress: [], blocked: [], done: []
    }
    for (const t of filtered) map[t.status].push(t)
    return map
  }, [filtered])

  const handleDragStart = (event: DragStartEvent) => {
    // Buscar en tasks completo (no filtered) para que el drag overlay siempre funcione
    const task = tasks?.find((t) => t.id === event.active.id)
    setActiveTask(task ?? null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)
    if (!over) return
    const task = tasks?.find((t) => t.id === active.id)
    if (!task) return
    suppressNextClick.current.add(active.id as string)
    setTimeout(() => suppressNextClick.current.delete(active.id as string), 300)
    const newStatus: TaskStatus | undefined = COLUMNS.includes(over.id as TaskStatus)
      ? (over.id as TaskStatus)
      : tasks?.find((t) => t.id === over.id)?.status
    if (newStatus && newStatus !== task.status) {
      updateTask.mutate({ id: task.id, data: { status: newStatus } })
    }
  }

  const clearFilters = () => {
    setSearch('')
    setFilterPriority('')
    setFilterProjectId('')
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
          {(COLUMNS).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        {/* Proyecto */}
        {projects.length > 0 && (
          <select
            value={filterProjectId}
            onChange={(e) => setFilterProjectId(e.target.value)}
            className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-violet-500"
          >
            <option value="">Todos los proyectos</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
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

        <button
          onClick={openCreateTeamForm}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <Plus size={14} />
          Nueva tarea
        </button>
      </div>

      {/* ── Kanban + panel de detalle ────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 grid grid-cols-4 gap-0 overflow-hidden">
            {COLUMNS.map((colStatus) => {
              const colTasks = columns[colStatus]
              return (
                <div
                  key={colStatus}
                  className={cn(
                    'flex flex-col border-t-2 bg-slate-850 overflow-hidden',
                    COLUMN_STYLES[colStatus]
                  )}
                >
                  {/* Column header */}
                  <div className="px-3 py-3 border-b border-slate-700 bg-slate-800 flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          'text-xs font-semibold uppercase tracking-wider',
                          COLUMN_HEADER_STYLES[colStatus]
                        )}
                      >
                        {STATUS_LABELS[colStatus]}
                      </span>
                      <span className="text-xs text-slate-500 bg-slate-700 rounded-full px-1.5 py-0.5">
                        {colTasks.length}
                      </span>
                    </div>
                  </div>

                  <KanbanCardArea
                    colStatus={colStatus}
                    colTasks={colTasks}
                    suppressNextClick={suppressNextClick}
                  />
                </div>
              )
            })}
          </div>

          <DragOverlay>
            {activeTask && (
              <div className="rotate-1 opacity-90 shadow-2xl">
                <TeamTaskCard task={activeTask} compact />
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {selectedTeamTaskId && <TeamTaskDetail />}
      </div>
    </div>
  )
}
