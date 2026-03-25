import { useState, useEffect, type ReactNode } from 'react'

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
  defaultOpen = false,
  forceOpen,
  badge,
  badgeColor,
  actions,
  children
}: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    if (forceOpen !== undefined) setOpen(forceOpen)
  }, [forceOpen])

  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
      overflow: 'hidden'
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 16px',
        gap: '8px',
        flexWrap: 'wrap',
        minHeight: '40px'
      }}>
        {/* 토글 영역 */}
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flex: '1 1 auto',
            minWidth: 0,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            padding: '2px 0'
          }}
        >
          <span style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            transition: 'transform 0.2s',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            display: 'inline-block',
            flexShrink: 0
          }}>
            ▶
          </span>
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
        </button>

        {/* 액션 버튼 */}
        {actions && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}
          >
            {actions}
          </div>
        )}
      </div>

      {/* 콘텐츠 */}
      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          {children}
        </div>
      )}
    </div>
  )
}
