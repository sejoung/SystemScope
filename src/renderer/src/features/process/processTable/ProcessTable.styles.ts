import type { CSSProperties } from 'react'

export const cellStyle: CSSProperties = {
  padding: "8px 8px",
  color: "var(--text-secondary)",
  fontSize: "14px",
  lineHeight: 1.4,
};

export const thStyle: CSSProperties = {
  padding: "12px 8px",
  fontWeight: 600,
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
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

export const infoLabelStyle: CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--text-primary)",
};

export const infoReasonStyle: CSSProperties = {
  fontSize: "13px",
  color: "var(--text-muted)",
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

export const actionCellStyle: CSSProperties = {
  display: "inline-flex",
  gap: "6px",
  justifyContent: "center",
  flexWrap: "wrap",
};

export const parentChipStyle: CSSProperties = {
  alignSelf: "flex-start",
  marginTop: "2px",
  padding: "1px 6px",
  fontSize: "11px",
  fontWeight: 500,
  border: "1px solid var(--border)",
  borderRadius: "4px",
  background: "transparent",
  color: "var(--accent-cyan)",
  cursor: "pointer",
  fontFamily: "inherit",
  maxWidth: "260px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export const processNameStyle: CSSProperties = {
  fontSize: "15px",
  fontWeight: 700,
  color: "var(--text-primary)",
};

export const processPidStyle: CSSProperties = {
  fontSize: "12px",
  color: "var(--text-muted)",
  fontFamily: "monospace",
};

export const processMetricStackStyle: CSSProperties = {
  display: "grid",
  justifyItems: "end",
  gap: "6px",
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
  flexShrink: 0,
};

export const metricCellStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "8px",
  flexWrap: "wrap",
};

export const cpuValueStyle: CSSProperties = {
  color: "var(--text-primary)",
  fontWeight: 600,
};

export type CpuUsageTone = "high" | "medium" | "normal";

export function getCpuBadgeStyle(tone: CpuUsageTone): CSSProperties {
  if (tone === "high") {
    return {
      ...cpuBadgeBaseStyle,
      color: "var(--accent-red)",
      background: "var(--alert-red-soft)",
      borderColor: "var(--alert-red-border)",
    };
  }

  if (tone === "medium") {
    return {
      ...cpuBadgeBaseStyle,
      color: "var(--accent-yellow)",
      background: "var(--alert-yellow-soft)",
      borderColor: "var(--alert-yellow-border)",
    };
  }

  return {
    ...cpuBadgeBaseStyle,
    color: "var(--accent-green)",
    background: "var(--success-soft)",
    borderColor: "color-mix(in srgb, var(--accent-green) 24%, transparent)",
  };
}

export const cpuBadgeBaseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "72px",
  padding: "3px 8px",
  borderRadius: "999px",
  border: "1px solid transparent",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};
