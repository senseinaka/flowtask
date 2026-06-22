import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface Option {
  value: string
  label: string
}

interface SelectProps {
  label?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  options: (string | Option)[]
  placeholder?: string
  accent?: string
  disabled?: boolean
  size?: 'sm' | 'md'
  style?: React.CSSProperties
  className?: string
  [key: string]: any
}

const SIZES = {
  sm: { padding: '5px 26px 5px 8px', font: 'var(--text-xs)', radius: 'var(--radius-md)' },
  md: { padding: '8px 30px 8px 12px', font: 'var(--text-sm)', radius: 'var(--radius-lg)' },
}

export function Select({
  label,
  value,
  onChange,
  options = [],
  placeholder,
  accent = 'var(--focus-border)',
  disabled = false,
  size = 'md',
  style,
  className,
  ...rest
}: SelectProps) {
  const [focus, setFocus] = useState(false)
  const s = SIZES[size]
  const norm: Option[] = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))

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
        <select
          value={value}
          onChange={onChange}
          disabled={disabled}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            width: '100%',
            appearance: 'none',
            WebkitAppearance: 'none',
            padding: s.padding,
            fontFamily: 'var(--font-sans)',
            fontSize: s.font,
            color: value ? 'var(--text-body)' : 'var(--text-faint)',
            background: 'var(--surface-sunken)',
            border: `1px solid ${focus ? accent : 'var(--border)'}`,
            borderRadius: s.radius,
            outline: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            transition: 'var(--transition-colors)',
          }}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {norm.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={size === 'sm' ? 12 : 14}
          style={{
            position: 'absolute',
            right: size === 'sm' ? 8 : 10,
            color: 'var(--text-faint)',
            pointerEvents: 'none',
          }}
        />
      </span>
    </label>
  )
}
