import { useState } from 'react'
import { type LucideIcon } from 'lucide-react'

interface InputProps {
  label?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  type?: string
  icon?: LucideIcon
  accent?: string
  disabled?: boolean
  error?: string
  size?: 'sm' | 'md'
  style?: React.CSSProperties
  className?: string
  [key: string]: any
}

const SIZES = {
  sm: { padding: '5px 8px', font: 'var(--text-xs)', icon: 12, radius: 'var(--radius-md)' },
  md: { padding: '8px 12px', font: 'var(--text-sm)', icon: 14, radius: 'var(--radius-lg)' },
}

export function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  icon: Icon,
  accent = 'var(--focus-border)',
  disabled = false,
  error,
  size = 'md',
  style,
  className,
  ...rest
}: InputProps) {
  const [focus, setFocus] = useState(false)
  const s = SIZES[size]
  const pl = Icon ? (size === 'sm' ? 26 : 32) : undefined
  const borderColor = error ? 'var(--danger)' : focus ? accent : 'var(--border)'

  return (
    <label className={className} style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {label && (
        <span style={{
          fontSize: 'var(--text-10)',
          textTransform: 'uppercase' as const,
          letterSpacing: 'var(--tracking-wider)',
          color: 'var(--text-muted)',
          fontWeight: 'var(--weight-semibold)',
        }}>
          {label}
        </span>
      )}
      <span style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {Icon && (
          <Icon
            size={s.icon}
            style={{
              position: 'absolute',
              left: size === 'sm' ? 8 : 11,
              color: 'var(--text-faint)',
              pointerEvents: 'none',
            }}
          />
        )}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            width: '100%',
            padding: s.padding,
            paddingLeft: pl,
            fontFamily: 'var(--font-sans)',
            fontSize: s.font,
            color: 'var(--text-body)',
            background: 'var(--surface-sunken)',
            border: `1px solid ${borderColor}`,
            borderRadius: s.radius,
            outline: 'none',
            boxShadow: focus && !error ? `0 0 0 3px ${accent === 'var(--focus-border)' ? 'var(--primary-ring)' : 'transparent'}` : 'none',
            transition: 'var(--transition-colors)',
            opacity: disabled ? 0.5 : 1,
          }}
          {...rest}
        />
      </span>
      {error && (
        <span style={{ fontSize: 'var(--text-11)', color: 'var(--danger-400)' }}>
          {error}
        </span>
      )}
    </label>
  )
}
