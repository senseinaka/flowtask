import { useMemo, useRef, useEffect } from 'react'
import { Filter, X, Search, Plus } from 'lucide-react'
import { useTasks } from '../hooks/useTasks'
import { useUIStore } from '../store/ui.store'
import TaskCard from '../components/tasks/TaskCard'
import TaskDetail from '../components/tasks/TaskDetail'
import { cn } from '../components/ui/utils'
import type { TaskStatus, Priority } from '@shared/types'
import { STATUS_LABELS, PRIORITY_LABELS } from '@shared/types'

const STATUSES: TaskStatus[] = ['pending', 'in_progress', 'blocked', 'done']
const PRIORITIES: Priority[] = [1, 2, 3, 4, 5]

const MIN_WIDTH = 280
const MAX_WIDTH = 720

export default function TaskList() {
  const {
    filters, toggleStatusFilter, togglePriorityFilter, clearFilters,
    selectedTaskId, detailPanelWidth, setDetailPanelWidth,
    searchQuery, setSearch, openCreateForm
  } = useUIStore()
  const { data: tasks, isLoading } = useTasks(filters)

  // ── Drag-to-resize logic ──────────────────────────────────────────────────
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const delta = startX.current - e.clientX   // left = bigger panel
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW.current + delta))
      setDetailPanelWidth(next)
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
  }, [setDetailPanelWidth])

  const onHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true
    startX.current = e.clientX
    startW.current = detailPanelWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const hasFilters = !!(
    filters.status?.length ||
    filters.priority?.length ||
    filters.project_id ||
    filters.search
  )

  const groups = useMemo(() => {
    if (!tasks) return []
    const todo = tasks.filter((t) => t.status === 'pending')
    const inProgress = tasks.filter((t) => t.status === 'in_progress')
    const blocked = tasks.filter((t) => t.status === 'blocked')
    const done = tasks.filter((t) => t.status === 'done')
    return [
      { label: 'En progreso', tasks: inProgress, show: inProgress.length > 0 },
      { label: 'Bloqueado', tasks: blocked, show: blocked.length > 0 },
      { label: 'Pendiente', tasks: todo, show: todo.length > 0 },
      { label: 'Hecho', tasks: done, show: done.length > 0 }
    ].filter((g) => g.show)
  }, [tasks])

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Filter bar */}
        <div className="px-4 py-2.5 bg-slate-850 border-b border-slate-700 flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar tareas..."
              value={searchQuery}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded px-2 pl-8 pr-7 py-1 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-44"
            />
            {searchQuery && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <Filter size={13} className="text-slate-500 flex-shrink-0" />
          <span className="text-xs text-slate-500 mr-1">Estado:</span>
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => toggleStatusFilter(s)}
              className={cn(
                'px-2 py-0.5 rounded text-xs transition-colors',
                filters.status?.includes(s)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-600'
              )}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
          <span className="text-xs text-slate-500 ml-2 mr-1">Prioridad:</span>
          {PRIORITIES.map((p) => (
            <button
              key={p}
              onClick={() => togglePriorityFilter(p)}
              className={cn(
                'px-2 py-0.5 rounded text-xs transition-colors',
                filters.priority?.includes(p)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-600'
              )}
            >
              {PRIORITY_LABELS[p]}
            </button>
          ))}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X size={12} /> Limpiar
            </button>
          )}

          <button
            onClick={openCreateForm}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Plus size={14} />
            Nueva tarea
          </button>
        </div>

        {/* Task list body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {isLoading && (
            <div className="text-center text-slate-500 text-sm pt-12">Cargando...</div>
          )}

          {!isLoading && (!tasks || tasks.length === 0) && (
            <div className="text-center py-16">
              <p className="text-slate-500 text-sm">No hay tareas aún.</p>
              <p className="text-slate-600 text-xs mt-1">
                {hasFilters ? 'Probá limpiar los filtros.' : 'Usá "Nueva tarea" para crear una.'}
              </p>
            </div>
          )}

          {groups.map((group) => (
            <div key={group.label}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {group.label}
                </span>
                <span className="text-xs text-slate-600 bg-slate-700 rounded-full px-1.5">
                  {group.tasks.length}
                </span>
              </div>
              <div className="space-y-2">
                {group.tasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Drag handle + detail panel */}
      {selectedTaskId && (
        <>
          {/* Drag handle — thin vertical bar between list and panel */}
          <div
            onMouseDown={onHandleMouseDown}
            className="w-1 flex-shrink-0 bg-slate-700 hover:bg-indigo-500 active:bg-indigo-400 cursor-col-resize transition-colors relative group"
            title="Arrastrar para redimensionar"
          >
            {/* Wider invisible hit-area so it's easy to grab */}
            <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
          </div>
          {/* Detail panel with dynamic width */}
          <div style={{ width: detailPanelWidth }} className="flex-shrink-0 overflow-hidden h-full">
            <TaskDetail />
          </div>
        </>
      )}
    </div>
  )
}
