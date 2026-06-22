import { type LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: React.ReactNode
  icon?: LucideIcon
  accent?: string
  valueColor?: string
  caption?: string
  delta?: number | null
  alert?: boolean
  style?: React.CSSProperties
  className?: string
  onClick?: () => void
}

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = 'var(--text-muted)',
  valueColor,
  caption,
  delta,
  alert = false,
  style,
  className,
  onClick,
}: StatCardProps) {
  const deltaColor =
    delta == null ? undefined
    : delta > 0 ? 'var(--success-400)'
    : delta < 0 ? 'var(--danger-400)'
    : 'var(--text-faint)'

  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: alert
          ? 'color-mix(in srgb, var(--danger) 15%, var(--slate-900))'
          : 'var(--surface-card)',
        border: `1px solid ${alert ? 'color-mix(in srgb, var(--danger) 45%, transparent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-4)',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {Icon && <Icon size={13} style={{ color: alert ? 'var(--danger-400)' : accent }} />}
        <span style={{
          fontSize: 'var(--text-11)',
          textTransform: 'uppercase' as const,
          letterSpacing: 'var(--tracking-wider)',
          color: alert ? 'var(--danger-400)' : 'var(--text-muted)',
          fontWeight: 'var(--weight-semibold)',
        }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: 'var(--text-3xl)',
        fontWeight: 'var(--weight-bold)',
        lineHeight: 1.05,
        color: valueColor || (alert ? 'var(--danger-400)' : 'var(--text-strong)'),
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap' as const,
      }}>
        {value}
      </div>
      {(caption || delta != null) && (
        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          {delta != null && (
            <span style={{ fontSize: 'var(--text-11)', fontWeight: 'var(--weight-bold)', color: deltaColor }}>
              {delta > 0 ? '▲' : delta < 0 ? '▼' : '–'} {Math.abs(delta)}%
            </span>
          )}
          {caption && (
            <span style={{ fontSize: 'var(--text-11)', color: 'var(--text-faint)' }}>
              {caption}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
