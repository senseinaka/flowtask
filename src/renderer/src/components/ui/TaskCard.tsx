import { useState } from 'react'
import { AlertCircle, Link2, Calendar } from 'lucide-react'
import { PRIORITY_COLORS } from './PriorityBadge'
import { PriorityBadge } from './PriorityBadge'
import { StatusBadge } from './StatusBadge'

interface ProjectTag {
  name: string
  color: string
}

interface TaskCardProps {
  title: string
  priority?: number
  status?: string
  project?: ProjectTag
  dueDate?: string
  overdue?: boolean
  description?: string
  selected?: boolean
  compact?: boolean
  onClick?: () => void
  style?: React.CSSProperties
  className?: string
}

export function TaskCard({
  title,
  priority = 3,
  status = 'pending',
  project,
  dueDate,
  overdue = false,
  description,
  selected = false,
  compact = false,
  onClick,
  style,
  className,
}: TaskCardProps) {
  const [h, setH] = useState(false)
  const done = status === 'done'

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 'var(--space-3)',
        borderRadius: 'var(--radius-lg)',
        background: selected ? 'var(--surface-raised)' : 'var(--surface-card)',
        border: `1px solid ${selected ? 'var(--focus-border)' : (h ? 'var(--border-strong)' : 'var(--border)')}`,
        borderLeft: `var(--border-width-accent) solid ${PRIORITY_COLORS[priority] || '#9ca3af'}`,
        cursor: onClick ? 'pointer' : 'default',
        opacity: done ? 0.6 : 1,
        transition: 'var(--transition-colors)',
        ...style,
      }}
    >
      <p
        style={{
          margin: 0,
          flex: 1,
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--weight-medium)',
          lineHeight: 'var(--leading-snug)',
          color: 'var(--text-body)',
          textDecoration: done ? 'line-through' : 'none',
          ...(done ? { color: 'var(--text-muted)' } : null),
        }}
      >
        {title}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        <PriorityBadge priority={priority} />
        <StatusBadge status={status} />
        {project && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 6px',
              fontSize: 'var(--text-11)',
              fontWeight: 'var(--weight-medium)',
              borderRadius: 'var(--radius-sm)',
              background: `${project.color}22`,
              color: project.color,
              border: `1px solid ${project.color}44`,
            }}
          >
            {project.name}
          </span>
        )}
      </div>

      {!compact && (dueDate || status === 'blocked' || description) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 'var(--text-xs)',
            color: 'var(--text-faint)',
          }}
        >
          {dueDate && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: overdue ? 'var(--danger-400)' : 'inherit',
              }}
            >
              <Calendar size={11} /> {dueDate} {overdue && <AlertCircle size={11} />}
            </span>
          )}
          {status === 'blocked' && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: 'var(--danger-400)',
              }}
            >
              <Link2 size={11} /> Bloqueado
            </span>
          )}
          {description && (
            <span
              style={{
                maxWidth: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap' as const,
                color: 'var(--text-ghost)',
              }}
            >
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
