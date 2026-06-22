import { useState } from 'react'
import { type LucideIcon } from 'lucide-react'

interface IconButtonProps {
  icon: LucideIcon
  size?: 'sm' | 'md' | 'lg'
  variant?: 'ghost' | 'solid'
  accent?: string
  active?: boolean
  disabled?: boolean
  title?: string
  badge?: boolean | string | number
  onClick?: () => void
  style?: React.CSSProperties
  className?: string
}

const SIZES = {
  sm: { box: 28, icon: 14, radius: 'var(--radius-lg)' },
  md: { box: 36, icon: 16, radius: 'var(--radius-xl)' },
  lg: { box: 44, icon: 18, radius: 'var(--radius-xl)' },
}

export function IconButton({
  icon: Icon,
  size = 'md',
  variant = 'ghost',
  accent,
  active = false,
  disabled = false,
  title,
  badge,
  onClick,
  style,
  className,
}: IconButtonProps) {
  const [hover, setHover] = useState(false)
  const s = SIZES[size]
  const baseColor = accent || (variant === 'solid' ? 'var(--white)' : 'var(--text-muted)')

  let bg = 'transparent'
  let color = baseColor
  if (variant === 'solid') {
    bg = accent || 'var(--primary)'
    color = 'var(--white)'
  }
  if (active) {
    bg = accent ? `${accent}22` : 'var(--slate-700)'
    color = accent || 'var(--text-body)'
  }
  if (hover && !disabled && variant !== 'solid' && !active) {
    bg = 'var(--slate-700)'
    color = accent || 'var(--text-body)'
  }
  if (hover && !disabled && variant === 'solid') {
    color = 'var(--white)'
  }

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={className}
      style={{
        position: 'relative',
        width: s.box,
        height: s.box,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color,
        background: bg,
        border: 'none',
        borderRadius: s.radius,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'var(--transition-colors)',
        ...style,
      }}
    >
      <Icon size={s.icon} />
      {badge != null && badge !== false && (
        <span
          style={{
            position: 'absolute',
            top: badge === true ? 6 : -2,
            right: badge === true ? 6 : -2,
            minWidth: badge === true ? 6 : 16,
            height: badge === true ? 6 : 16,
            padding: badge === true ? 0 : '0 4px',
            borderRadius: 'var(--radius-full)',
            background: badge === true ? 'var(--success)' : 'var(--ws-empresa)',
            color: 'var(--white)',
            fontSize: 10,
            fontWeight: 'var(--weight-bold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}
        >
          {badge === true ? null : badge}
        </span>
      )}
    </button>
  )
}
