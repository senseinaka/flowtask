export const STATUS_LABELS: Record<string, string> = {
  pending:     'Pendiente',
  in_progress: 'En progreso',
  blocked:     'Bloqueado',
  done:        'Hecho',
}

const STATUS_STYLES: Record<string, { bg: string; fg: string }> = {
  pending:     { bg: 'var(--slate-700)',                                              fg: 'var(--slate-300)' },
  in_progress: { bg: 'color-mix(in srgb, var(--info) 35%, var(--slate-900))',        fg: '#93c5fd' },
  blocked:     { bg: 'color-mix(in srgb, var(--danger) 35%, var(--slate-900))',      fg: '#fca5a5' },
  done:        { bg: 'color-mix(in srgb, var(--success) 35%, var(--slate-900))',     fg: '#6ee7b7' },
}

export function StatusBadge({ status = 'pending', size = 'sm' as 'sm' | 'md' }) {
  const st = STATUS_STYLES[status] ?? STATUS_STYLES.pending
  const pad = size === 'md' ? '4px 8px' : '2px 6px'
  const font = size === 'md' ? 'var(--text-xs)' : 'var(--text-11)'
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: pad,
      fontSize: font,
      fontWeight: 'var(--weight-medium)',
      lineHeight: 1,
      borderRadius: 'var(--radius-sm)',
      background: st.bg,
      color: st.fg,
      whiteSpace: 'nowrap',
    }}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
