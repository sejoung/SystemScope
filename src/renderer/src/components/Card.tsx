import type { CSSProperties, ReactNode } from 'react'

interface CardProps {
  title?: string
  children: ReactNode
  style?: CSSProperties
}

export function Card({ title, children, style }: CardProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        padding: '16px 20px',
        ...style
      }}
    >
      {title && (
        <h3
          style={{
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-secondary)',
            marginBottom: '12px'
          }}
        >
          {title}
        </h3>
      )}
      {children}
    </div>
  )
}
