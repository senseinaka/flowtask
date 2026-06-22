interface AvatarProps {
  name?: string
  src?: string
  color?: string
  size?: number
  online?: boolean | null
  style?: React.CSSProperties
  className?: string
}

const PALETTE = ['#818cf8', '#fb923c', '#34d399', '#60a5fa', '#a78bfa', '#22d3ee', '#f472b6', '#facc15']

function initials(name: string = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function pick(name: string = '') {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export function Avatar({
  name = '',
  src,
  color,
  size = 36,
  online,
  style,
  className,
}: AvatarProps) {
  const accent = color || pick(name)
  return (
    <span
      className={className}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        background: src ? 'var(--slate-700)' : `${accent}26`,
        color: accent,
        fontSize: Math.round(size * 0.38),
        fontWeight: 'var(--weight-semibold)',
        overflow: 'hidden',
        border: `1px solid ${accent}40`,
        ...style,
      }}
    >
      {src ? (
        <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        initials(name)
      )}
      {online != null && (
        <span
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: Math.max(8, size * 0.26),
            height: Math.max(8, size * 0.26),
            borderRadius: '50%',
            background: online ? 'var(--success-400)' : 'var(--slate-500)',
            border: '2px solid var(--bg-rail)',
          }}
        />
      )}
    </span>
  )
}
