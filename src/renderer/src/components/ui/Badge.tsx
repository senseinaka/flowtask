import { type LucideIcon } from 'lucide-react'

interface BadgeProps {
  children?: React.ReactNode
  color?: string
  variant?: 'soft' | 'solid'
  size?: 'sm' | 'md'
  icon?: LucideIcon
  dot?: boolean
  style?: React.CSSProperties
  className?: string
}

export function Badge({
  children,
  color = '#64748b',
  variant = 'soft',
  size = 'sm',
  icon: Icon,
  dot = false,
  style,
  className,
}: BadgeProps) {
  const sizes = {
    sm: { padding: '2px 6px', font: 'var(--text-11)', radius: 'var(--radius-sm)', icon: 11, gap: 4 },
    md: { padding: '4px 8px', font: 'var(--text-xs)',  radius: 'var(--radius-md)', icon: 12, gap: 5 },
  }
  const s = sizes[size]
  const isVar = color.startsWith('var(')
  const soft = isVar
    ? { background: `color-mix(in srgb, ${color} 13%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 27%, transparent)` }
    : { background: `${color}22`, color, border: `1px solid ${color}44` }
  const solid = isVar
    ? { background: `color-mix(in srgb, ${color} 22%, var(--slate-900))`, color: `color-mix(in srgb, ${color} 65%, var(--white))`, border: '1px solid transparent' }
    : { background: `${color}33`, color, border: '1px solid transparent' }
  const v = variant === 'solid' ? solid : soft

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: s.gap,
        padding: s.padding,
        fontSize: s.font,
        fontWeight: 'var(--weight-medium)',
        lineHeight: 1,
        borderRadius: s.radius,
        whiteSpace: 'nowrap',
        ...v,
        ...style,
      }}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />}
      {Icon && <Icon size={s.icon} />}
      {children}
    </span>
  )
}
