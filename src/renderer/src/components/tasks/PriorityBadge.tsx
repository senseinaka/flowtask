import type { Priority } from '@shared/types'
import { PRIORITY_LABELS, PRIORITY_COLORS } from '@shared/types'
import { cn } from '../ui/utils'

interface Props {
  priority: Priority
  size?: 'sm' | 'md'
}

export default function PriorityBadge({ priority, size = 'sm' }: Props) {
  const color = PRIORITY_COLORS[priority]
  const label = PRIORITY_LABELS[priority]

  return (
    <span
      className={cn(
        'inline-flex items-center rounded font-medium',
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'
      )}
      style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      {label}
    </span>
  )
}
