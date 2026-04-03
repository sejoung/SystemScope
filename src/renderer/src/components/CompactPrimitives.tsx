import type React from "react";

export function CompactMetaItem({
  label,
  value,
  mono = false,
  multiline = false,
  muted = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  multiline?: boolean;
  muted?: boolean;
}) {
  return (
    <div style={compactMetaItemStyle}>
      <div style={compactMetaLabelStyle}>{label}</div>
      <div
        style={{
          ...(mono ? compactMetaValueMonoStyle : compactMetaValueStyle),
          color: muted ? "var(--text-muted)" : undefined,
          wordBreak: multiline ? "break-word" : undefined,
          whiteSpace: multiline ? "normal" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export const compactStatusSpacingStyle: React.CSSProperties = {
  marginBottom: "14px",
};

export const compactListStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
};

export const compactBulkBarStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  background: "var(--bg-primary)",
};

export const compactBulkTextStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--text-primary)",
};

export const compactCardStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  padding: "14px",
  borderRadius: "12px",
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
};

export const compactCardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "flex-start",
  flexWrap: "wrap",
};

export const compactMetaGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "10px",
};

export const compactMetaItemStyle: React.CSSProperties = {
  display: "grid",
  gap: "4px",
  padding: "10px 12px",
  borderRadius: "10px",
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
};

export const compactMetaLabelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-muted)",
};

export const compactMetaValueStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--text-primary)",
  lineHeight: 1.5,
};

export const compactMetaValueMonoStyle: React.CSSProperties = {
  ...compactMetaValueStyle,
  fontFamily: "monospace",
  fontVariantNumeric: "tabular-nums",
};

export const compactActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  alignItems: "center",
};
