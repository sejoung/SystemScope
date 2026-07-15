import type { CSSProperties } from 'react'

export const cardStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 16,
  borderRadius: 'var(--radius-lg)',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
}

export const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 10,
}

export const tileHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
}

export const tileStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: '12px 14px',
  borderRadius: 'var(--radius)',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
}

export const rowCardStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: '12px 14px',
  borderRadius: 'var(--radius)',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
}

export const sectionTitleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--text-primary)',
}

export const sectionDescriptionStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--text-secondary)',
  lineHeight: 1.6,
}

export const tileTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--text-primary)',
}

export const detailStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--text-secondary)',
}

export const hintStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)',
  lineHeight: 1.5,
}

export const pathStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-mono, monospace)',
  wordBreak: 'break-word',
}

export const statusPillStyle: CSSProperties = {
  padding: '2px 8px',
  borderRadius: 999,
  border: '1px solid transparent',
  fontSize: 11,
  fontWeight: 700,
  whiteSpace: 'nowrap',
}

export const metaPillStyle: CSSProperties = {
  padding: '4px 8px',
  borderRadius: 999,
  fontSize: 11,
  color: 'var(--text-secondary)',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

export const selectStyle: CSSProperties = {
  padding: '7px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  fontSize: 12,
  minWidth: 180,
  maxWidth: '100%',
  flex: '1 1 220px',
}

export const actionButtonStyle: CSSProperties = {
  padding: '7px 12px',
  borderRadius: 8,
  border: 'none',
  background: 'var(--accent-blue)',
  color: 'var(--text-on-accent)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  flexShrink: 0,
}

export const removeButtonStyle: CSSProperties = {
  padding: '5px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--accent-red)',
  fontSize: 11,
  cursor: 'pointer',
}

export const subsectionLabelStyle: CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
}

export const listRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
}

export const errorStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--accent-red)',
}

export const emptyStyle: CSSProperties = {
  padding: '8px 0',
  fontSize: 12,
  color: 'var(--text-muted)',
}

export const sectionHeaderRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
}

export const workspaceToolbarStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  alignItems: 'center',
  width: '100%',
  maxWidth: 420,
}

export const workspaceHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
}

export const workspaceMetaColumnStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  justifyItems: 'end',
  maxWidth: '100%',
}

export const workspaceMetaWrapStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  maxWidth: '100%',
}

export const serverActionRowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
}

export const overviewToolbarStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
}

export const secondaryActionButtonStyle: CSSProperties = {
  padding: '5px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  fontSize: 11,
  cursor: 'pointer',
}
