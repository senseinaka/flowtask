interface SwitchProps {
  checked?: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  accent?: string
  size?: 'sm' | 'md'
  label?: string
  style?: React.CSSProperties
  className?: string
  [key: string]: any
}

const SIZES = {
  sm: { w: 30, h: 17, knob: 13 },
  md: { w: 38, h: 22, knob: 17 },
}

export function Switch({
  checked = false,
  onChange,
  disabled = false,
  accent = 'var(--primary)',
  size = 'md',
  label,
  style,
  className,
  ...rest
}: SwitchProps) {
  const s = SIZES[size]
  const pad = (s.h - s.knob) / 2

  const toggle = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange && onChange(!checked)}
      className={className}
      style={{
        position: 'relative',
        width: s.w,
        height: s.h,
        flexShrink: 0,
        borderRadius: 'var(--radius-full)',
        border: 'none',
        padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? accent : 'var(--slate-600)',
        opacity: disabled ? 0.5 : 1,
        transition: 'background-color var(--dur-base) var(--ease-out)',
        ...style,
      }}
      {...rest}
    >
      <span
        style={{
          position: 'absolute',
          top: pad,
          left: checked ? s.w - s.knob - pad : pad,
          width: s.knob,
          height: s.knob,
          borderRadius: '50%',
          background: 'var(--white)',
          boxShadow: 'var(--shadow-sm)',
          transition: 'left var(--dur-base) var(--ease-out)',
        }}
      />
    </button>
  )

  if (!label) return toggle
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      {toggle}
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>{label}</span>
    </label>
  )
}
