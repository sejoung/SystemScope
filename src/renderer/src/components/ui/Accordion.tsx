import type { ReactNode } from 'react'

interface AccordionProps {
  title: string
  defaultOpen?: boolean
  forceOpen?: boolean
  badge?: string
  badgeColor?: string
  actions?: ReactNode
  children: ReactNode
}

export function Accordion({
  title,
  badge,
  badgeColor,
  actions,
  children
}: AccordionProps) {
  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        gap: '12px',
        flexWrap: 'wrap',
        minHeight: '40px',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto', minWidth: 0, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-secondary)',
            whiteSpace: 'nowrap'
          }}>
            {title}
          </span>
          {badge && (
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '1px 8px',
              borderRadius: '4px',
              background: badgeColor ? `${badgeColor}20` : 'var(--bg-card-hover)',
              color: badgeColor ?? 'var(--text-secondary)',
              whiteSpace: 'nowrap'
            }}>
              {badge}
            </span>
          )}
        </div>

        {/* 액션 버튼 */}
        {actions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
            {actions}
          </div>
        )}
      </div>

      {/* 콘텐츠 */}
      <div style={{ padding: '16px', flex: 1 }}>
        {children}
      </div>
    </div>
  )
}
