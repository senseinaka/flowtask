import { Calendar, Paperclip, Link2, AlertCircle } from 'lucide-react'
import type { Task } from '@shared/types'
import { PRIORITY_COLORS } from '@shared/types'
import { cn, formatDate, isOverdue } from '../ui/utils'
import PriorityBadge from './PriorityBadge'
import StatusBadge from './StatusBadge'
import { useUIStore } from '../../store/ui.store'

interface Props {
  task: Task
  compact?: boolean
}

export default function TaskCard({ task, compact = false }: Props) {
  const { selectedTaskId, setSelectedTask, openExpandedTask } = useUIStore()
  const isSelected = selectedTaskId === task.id
  const overdue = isOverdue(task.due_date) && task.status !== 'done'
  const priorityColor = PRIORITY_COLORS[task.priority]

  return (
    <div
      onClick={() => setSelectedTask(isSelected ? null : task.id)}
      onDoubleClick={(e) => { e.stopPropagation(); setSelectedTask(task.id); openExpandedTask(task.id) }}
      className={cn(
        'group relative flex flex-col gap-2 p-3 rounded-lg border cursor-pointer transition-all',
        'hover:border-slate-600',
        isSelected
          ? 'bg-slate-700 border-indigo-500'
          : 'bg-slate-800 border-slate-700',
        task.status === 'done' && 'opacity-60'
      )}
      style={{ borderLeftColor: priorityColor, borderLeftWidth: '3px' }}
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        <p className={cn('flex-1 text-sm font-medium leading-snug', task.status === 'done' && 'line-through text-slate-400')}>
          {task.title}
        </p>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={task.priority} />
        <StatusBadge status={task.status} />

        {task.project && (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium"
            style={{
              backgroundColor: `${task.project.color}22`,
              color: task.project.color,
              border: `1px solid ${task.project.color}44`
            }}
          >
            {task.project.name}
          </span>
        )}
      </div>

      {/* Footer row */}
      {!compact && (
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {task.due_date && (
            <span className={cn('flex items-center gap-1', overdue && 'text-red-400')}>
              <Calendar size={11} />
              {formatDate(task.due_date)}
              {overdue && <AlertCircle size={11} />}
            </span>
          )}
          {task.status === 'blocked' && (
            <span className="flex items-center gap-1 text-red-400">
              <Link2 size={11} />
              Bloqueado
            </span>
          )}
          {task.description && (
            <span className="truncate max-w-[120px] text-slate-600">{task.description}</span>
          )}
        </div>
      )}
    </div>
  )
}
