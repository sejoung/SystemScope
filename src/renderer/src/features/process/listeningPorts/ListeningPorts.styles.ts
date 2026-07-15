import type { CSSProperties } from 'react'

export const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "12px 8px",
  color: "var(--text-muted)",
  fontWeight: 600,
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  whiteSpace: "nowrap",
};

export const tdStyle: CSSProperties = {
  padding: "10px 8px",
  color: "var(--text-secondary)",
  fontSize: "13px",
  lineHeight: 1.4,
};

export const searchStyle: CSSProperties = {
  padding: "8px 12px",
  fontSize: "13px",
  width: "240px",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
  outline: "none",
};

export const segmentedControlStyle: CSSProperties = {
  display: "flex",
  gap: "2px",
  background: "var(--bg-primary)",
  borderRadius: "6px",
  padding: "2px",
  flexWrap: "wrap",
};

export const infoBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  marginBottom: "12px",
  padding: "10px 12px",
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  flexWrap: "wrap",
};

export const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "10px",
  marginBottom: "10px",
};

export const infoLabelStyle: CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--text-primary)",
};

export const infoReasonStyle: CSSProperties = {
  fontSize: "13px",
  color: "var(--text-muted)",
};

export const btnStyle: CSSProperties = {
  padding: "7px 14px",
  fontSize: "13px",
  fontWeight: 600,
  border: "none",
  borderRadius: "6px",
  background: "var(--accent-cyan)",
  color: "var(--text-on-accent)",
  cursor: "pointer",
};

export const killBtnStyle: CSSProperties = {
  padding: "6px 10px",
  fontSize: "12px",
  fontWeight: 600,
  border: "1px solid rgba(239, 68, 68, 0.25)",
  borderRadius: "6px",
  background: "rgba(239, 68, 68, 0.12)",
  color: "var(--accent-red)",
  cursor: "pointer",
};

export const killTreeBtnStyle: CSSProperties = {
  padding: "6px 10px",
  fontSize: "12px",
  fontWeight: 700,
  border: "1px solid var(--accent-red)",
  borderRadius: "6px",
  background: "var(--accent-red)",
  color: "var(--text-on-accent)",
  cursor: "pointer",
};

export const killActionsStyle: CSSProperties = {
  display: "inline-flex",
  gap: "6px",
  justifyContent: "center",
  flexWrap: "wrap",
};

export const sectionStyle: CSSProperties = {
  backgroundColor: "var(--bg-card)",
  borderRadius: "var(--radius-lg)",
  border: "1px solid var(--border)",
  padding: "16px",
};

export const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "16px",
};

export const titleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  minWidth: 0,
};

export const titleStyle: CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-secondary)",
};

export const badgeStyle: CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: "999px",
  background: "var(--bg-card-hover)",
  color: "var(--text-secondary)",
  whiteSpace: "nowrap",
};

export const actionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  flexWrap: "wrap",
  flexShrink: 0,
};

export const protocolPillStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: "999px",
  background: "var(--bg-primary)",
  color: "var(--text-muted)",
  border: "1px solid var(--border)",
  letterSpacing: "0.04em",
};

export const rowStyle: CSSProperties = {
  borderBottom: "1px solid var(--border)",
};

export const desktopTableWrapStyle: CSSProperties = {
  overflowX: "auto",
  overflowY: "clip",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  background: "var(--bg-card)",
};

export const stickyHeaderRowStyle: CSSProperties = {
  borderBottom: "1px solid var(--border)",
  position: "sticky",
  top: 0,
  background: "var(--bg-card)",
  zIndex: 1,
  boxShadow: "0 1px 0 var(--border)",
};

export const portValueStyle: CSSProperties = {
  color: "var(--text-primary)",
  fontWeight: 700,
};

export const stateBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "108px",
  padding: "4px 8px",
  borderRadius: "999px",
  border: "1px solid transparent",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
};

export const conflictCardStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
  marginBottom: "12px",
  padding: "14px 16px",
  borderRadius: "12px",
  border: "1px solid color-mix(in srgb, var(--accent-red) 22%, var(--border))",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--accent-red) 7%, var(--bg-card)) 0%, var(--bg-card) 100%)",
};

export const conflictHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "flex-start",
};

export const conflictTitleStyle: CSSProperties = {
  fontSize: "14px",
  fontWeight: 700,
  color: "var(--text-primary)",
};

export const conflictSubtitleStyle: CSSProperties = {
  fontSize: "12px",
  color: "var(--text-secondary)",
  lineHeight: 1.5,
};

export const conflictBadgeStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--accent-red) 14%, transparent)",
  color: "var(--accent-red)",
  whiteSpace: "nowrap",
};

export const conflictEmptyStyle: CSSProperties = {
  fontSize: "12px",
  color: "var(--text-muted)",
  lineHeight: 1.6,
};

export const conflictRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  padding: "10px 12px",
  borderRadius: "10px",
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
};

export const conflictMainRowStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
  flexWrap: "wrap",
};

export const conflictPortStyle: CSSProperties = {
  fontFamily: "monospace",
  fontWeight: 700,
  color: "var(--accent-red)",
};

export const conflictProcessStyle: CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--text-primary)",
};

export const conflictPidStyle: CSSProperties = {
  fontSize: "12px",
  color: "var(--text-muted)",
  fontFamily: "monospace",
};

export const conflictHintStyle: CSSProperties = {
  marginTop: "4px",
  fontSize: "12px",
  color: "var(--text-secondary)",
  lineHeight: 1.5,
};

export const conflictActionsStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
  flexShrink: 0,
};

export const inspectBtnStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: "8px",
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: 600,
};

export const resolveBtnStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: "8px",
  border: "1px solid rgba(239, 68, 68, 0.25)",
  background: "rgba(239, 68, 68, 0.12)",
  color: "var(--accent-red)",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: 700,
};

export const resolveTreeBtnStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: "8px",
  border: "1px solid var(--accent-red)",
  background: "var(--accent-red)",
  color: "var(--text-on-accent)",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: 700,
};
