import { Badge } from './Badge'

export const PRIORITY_LABELS: Record<number, string> = {
  1: 'Crítico',
  2: 'Alto',
  3: 'Medio',
  4: 'Bajo',
  5: 'Algún día',
}
export const PRIORITY_COLORS: Record<number, string> = {
  1: 'var(--priority-critico)',
  2: 'var(--priority-alto)',
  3: 'var(--priority-medio)',
  4: 'var(--priority-bajo)',
  5: 'var(--priority-algunDia)',
}

export function PriorityBadge({ priority = 3, size = 'sm' as 'sm' | 'md' }) {
  return (
    <Badge color={PRIORITY_COLORS[priority] ?? 'var(--priority-algunDia)'} variant="soft" size={size}>
      {PRIORITY_LABELS[priority] ?? '—'}
    </Badge>
  )
}
