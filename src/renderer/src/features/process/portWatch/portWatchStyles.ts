export const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: "13px",
  flex: 1,
  minWidth: "200px",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
  outline: "none",
  fontFamily: "monospace",
};

export const errorTextStyle: React.CSSProperties = {
  marginBottom: "12px",
  padding: "10px 12px",
  borderRadius: "8px",
  background: "var(--alert-red-soft)",
  border: "1px solid var(--alert-red-border)",
  color: "var(--accent-red)",
  fontSize: "13px",
  lineHeight: 1.5,
};

export const btnStyle: React.CSSProperties = {
  padding: "7px 16px",
  fontSize: "13px",
  fontWeight: 600,
  border: "none",
  borderRadius: "6px",
  background: "var(--accent-cyan)",
  color: "var(--text-on-accent)",
  cursor: "pointer",
};

export const removeBtnStyle: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: "14px",
  fontWeight: 600,
  border: "none",
  borderRadius: "4px",
  background: "transparent",
  color: "var(--text-muted)",
  cursor: "pointer",
};

export const detailsBtn: React.CSSProperties = {
  padding: "5px 10px",
  fontSize: "12px",
  fontWeight: 500,
  border: "none",
  borderRadius: "4px",
  background: "transparent",
  cursor: "pointer",
};

export const sectionStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-card)",
  borderRadius: "var(--radius-lg)",
  border: "1px solid var(--border)",
  padding: "16px",
};

export const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "16px",
};

export const titleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  minWidth: 0,
};

export const titleStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-secondary)",
};

export const badgeStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--accent-cyan) 16%, transparent)",
  color: "var(--accent-cyan)",
  whiteSpace: "nowrap",
};

export const sectionTitle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "6px",
};

export const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 8px",
  color: "var(--text-muted)",
  fontWeight: 600,
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

export const tdStyle: React.CSSProperties = {
  padding: "12px 8px",
  color: "var(--text-secondary)",
  fontSize: "14px",
  lineHeight: 1.4,
};

export const rowStyle: React.CSSProperties = {
  borderBottom: "1px solid var(--border)",
};

export const stateBadgeStyle: React.CSSProperties = {
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
