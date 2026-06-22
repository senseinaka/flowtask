import { useState } from 'react'

interface CardProps {
  children: React.ReactNode
  accent?: string
  hover?: boolean
  selected?: boolean
  padding?: string
  onClick?: () => void
  style?: React.CSSProperties
  className?: string
}

export function Card({
  children,
  accent,
  hover = false,
  selected = false,
  padding = 'var(--space-4)',
  onClick,
  style,
  className,
}: CardProps) {
  const [h, setH] = useState(false)
  const interactive = hover || !!onClick

  return (
    <div
      onClick={onClick}
      className={className}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        position: 'relative',
        background: selected ? 'var(--surface-raised)' : 'var(--surface-card)',
        border: `1px solid ${selected ? 'var(--focus-border)' : (interactive && h ? 'var(--border-strong)' : 'var(--border)')}`,
        borderLeft: accent ? `var(--border-width-accent) solid ${accent}` : undefined,
        borderRadius: 'var(--radius-xl)',
        padding,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'var(--transition-colors)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
