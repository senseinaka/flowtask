import { useState } from 'react'
import { type LucideIcon } from 'lucide-react'

interface ButtonProps {
  children?: React.ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  icon?: LucideIcon
  iconRight?: LucideIcon
  disabled?: boolean
  fullWidth?: boolean
  type?: 'button' | 'submit' | 'reset'
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  style?: React.CSSProperties
  className?: string
}

const SIZES = {
  sm: { padding: '5px 10px', font: 'var(--text-xs)', gap: '4px', icon: 13, radius: 'var(--radius-md)' },
  md: { padding: '7px 14px', font: 'var(--text-xs)', gap: '6px', icon: 14, radius: 'var(--radius-lg)' },
  lg: { padding: '10px 18px', font: 'var(--text-sm)', gap: '8px', icon: 16, radius: 'var(--radius-lg)' },
}
const VARIANTS = {
  primary:   { bg: 'var(--primary)',   hover: 'var(--primary-hover)', color: 'var(--white)', border: '1px solid transparent' },
  secondary: { bg: 'var(--slate-700)', hover: 'var(--slate-600)',     color: 'var(--text-body)', border: '1px solid var(--border-strong)' },
  ghost:     { bg: 'transparent',      hover: 'var(--slate-700)',     color: 'var(--text-muted)', border: '1px solid transparent' },
  danger:    { bg: 'var(--danger)',     hover: '#dc2626',              color: 'var(--white)', border: '1px solid transparent' },
  success:   { bg: 'var(--success)',    hover: '#059669',              color: 'var(--white)', border: '1px solid transparent' },
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  disabled = false,
  fullWidth = false,
  type = 'button',
  onClick,
  style,
  className,
}: ButtonProps) {
  const [hover, setHover] = useState(false)
  const s = SIZES[size]
  const v = VARIANTS[variant]

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={className}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        padding: s.padding,
        width: fullWidth ? '100%' : undefined,
        fontFamily: 'var(--font-sans)',
        fontSize: s.font,
        fontWeight: 'var(--weight-medium)',
        lineHeight: 1,
        color: v.color,
        background: disabled ? v.bg : (hover ? v.hover : v.bg),
        border: v.border,
        borderRadius: s.radius,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'var(--transition-colors)',
        ...style,
      }}
    >
      {Icon && <Icon size={s.icon} />}
      {children && <span>{children}</span>}
      {IconRight && <IconRight size={s.icon} />}
    </button>
  )
}
