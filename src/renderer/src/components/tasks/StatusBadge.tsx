import type { TaskStatus } from '@shared/types'
import { STATUS_LABELS } from '@shared/types'
import { cn } from '../ui/utils'

const STATUS_STYLES: Record<TaskStatus, string> = {
  pending: 'bg-slate-700 text-slate-300',
  in_progress: 'bg-blue-900/60 text-blue-300',
  blocked: 'bg-red-900/60 text-red-300',
  done: 'bg-emerald-900/60 text-emerald-300'
}

interface Props {
  status: TaskStatus
  size?: 'sm' | 'md'
}

export default function StatusBadge({ status, size = 'sm' }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded font-medium',
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs',
        STATUS_STYLES[status]
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
