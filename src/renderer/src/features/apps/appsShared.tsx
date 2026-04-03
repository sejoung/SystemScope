import type React from "react";
import type { TranslateFn } from "@shared/i18n";
import type { AppLeftoverDataItem } from "@shared/types";

// --- Types ---

export type PlatformFilter = "all" | "mac" | "windows";
export type AppsTab = "installed" | "leftover" | "registry";
export type ConfidenceFilter = "all" | "high" | "medium" | "low";
export type LeftoverSort = "priority" | "name" | "size";

// --- Helper Functions ---

export function getConfidenceLabel(
  confidence: AppLeftoverDataItem["confidence"],
  tk: TranslateFn,
): string {
  switch (confidence) {
    case "high": return tk("apps.confidence.high");
    case "medium": return tk("apps.confidence.medium");
    default: return tk("apps.confidence.low");
  }
}

export function getConfidenceColor(
  confidence: AppLeftoverDataItem["confidence"],
): string {
  switch (confidence) {
    case "high": return "var(--accent-green)";
    case "medium": return "var(--accent-yellow)";
    default: return "var(--accent-red)";
  }
}

export function secondaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    ...secondaryButtonStyle,
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? "default" : "pointer",
  };
}

// --- Components ---

export function SearchInput({ value, onChange, onClear, placeholder, clearLabel = "Clear search" }: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder: string;
  clearLabel?: string;
}) {
  return (
    <div style={searchWrapStyle}>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        style={{ ...inputStyle, minWidth: "240px", paddingRight: "30px" }}
      />
      {value ? (
        <button type="button" onClick={onClear} aria-label={clearLabel} style={clearSearchButtonStyle}>
          ×
        </button>
      ) : null}
    </div>
  );
}

export function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      fontSize: "11px", fontWeight: 700, padding: "3px 8px",
      borderRadius: "999px", background: `${color}20`, color, whiteSpace: "nowrap",
    }}>
      {text}
    </span>
  );
}

export function PageTab({ id, active, onClick, children }: {
  id: string; active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      id={id}
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: "7px 16px", fontSize: "13px", fontWeight: active ? 600 : 500,
        border: "none", borderRadius: "6px",
        background: active ? "var(--accent-blue)" : "transparent",
        color: active ? "var(--text-on-accent)" : "var(--text-secondary)",
        cursor: "pointer", transition: "background 0.15s, color 0.15s",
      }}
    >
      {children}
    </button>
  );
}

// --- Style Constants ---

export const btnStyle: React.CSSProperties = {
  padding: "8px 16px", fontSize: "13px", fontWeight: 500,
  border: "none", borderRadius: "var(--radius)",
  background: "var(--accent-blue)", color: "var(--text-on-accent)", cursor: "pointer",
};

export const secondaryButtonStyle: React.CSSProperties = {
  padding: "8px 14px", fontSize: "13px", fontWeight: 600,
  border: "1px solid var(--border)", borderRadius: "var(--radius)",
  background: "var(--bg-card-hover)", color: "var(--text-primary)", cursor: "pointer",
};

export const inputStyle: React.CSSProperties = {
  padding: "7px 10px", fontSize: "12px",
  border: "1px solid var(--border)", borderRadius: "var(--radius)",
  background: "var(--bg-primary)", color: "var(--text-primary)",
};

export const pageHeaderStyle: React.CSSProperties = { display: "grid", gap: "10px", marginBottom: "16px" };
export const pageDescriptionStyle: React.CSSProperties = { fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6 };
export const pageTabsStyle: React.CSSProperties = { display: "flex", gap: "4px", background: "var(--bg-secondary)", borderRadius: "8px", padding: "3px" };
export const pageHelpStyle: React.CSSProperties = { fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.6 };

export const sectionStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-card)", borderRadius: "var(--radius-lg)",
  border: "1px solid var(--border)", padding: "16px",
};

export const headerStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  gap: "12px", flexWrap: "wrap", marginBottom: "16px",
};

export const titleRowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: "8px", minWidth: 0 };
export const titleStyle: React.CSSProperties = { fontSize: "14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" };
export const badgeCountStyle: React.CSSProperties = { fontSize: "13px", fontWeight: 600, padding: "2px 8px", borderRadius: "999px", background: "var(--bg-card-hover)", color: "var(--text-secondary)", whiteSpace: "nowrap" };
export const actionsStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" };

export const tableWrapStyle: React.CSSProperties = { overflowX: "auto", overflowY: "clip" };
export const tableStyle: React.CSSProperties = { width: "100%", minWidth: "860px", borderCollapse: "collapse", fontSize: "13px" };
export const stickyHeaderRowStyle: React.CSSProperties = { borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 1, boxShadow: "0 1px 0 var(--border)" };
export const thStyle: React.CSSProperties = { textAlign: "left", padding: "12px 8px", color: "var(--text-muted)", fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em" };
export const tdStyle: React.CSSProperties = { padding: "12px 8px", color: "var(--text-secondary)", verticalAlign: "top", fontSize: "14px", lineHeight: 1.4 };
export const monoCellStyle: React.CSSProperties = { ...tdStyle, fontFamily: "monospace", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
export const subtleTextStyle: React.CSSProperties = { marginTop: "6px", color: "var(--text-muted)", lineHeight: 1.5 };
export const openBtn: React.CSSProperties = { padding: "6px 10px", fontSize: "12px", fontWeight: 600, border: "none", borderRadius: "6px", background: "var(--bg-card-hover)", color: "var(--text-primary)", cursor: "pointer", marginRight: "6px" };
export const actionBtnStyle: React.CSSProperties = { padding: "6px 10px", fontSize: "12px", fontWeight: 600, border: "1px solid rgba(239, 68, 68, 0.25)", borderRadius: "6px", background: "rgba(239, 68, 68, 0.12)", color: "var(--accent-red)", cursor: "pointer" };
export const protectedBadgeStyle: React.CSSProperties = { fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "999px", background: "var(--alert-yellow-soft)", color: "var(--accent-yellow)" };
export const rowStyle: React.CSSProperties = { borderBottom: "1px solid var(--border)" };

export const relatedPanelStyle: React.CSSProperties = { marginTop: "4px", padding: "14px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px" };
export const relatedItemStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "16px 1fr", alignItems: "start", gap: "10px", padding: "10px 12px", background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: "10px", cursor: "pointer" };
export const relatedEmptyStyle: React.CSSProperties = { padding: "14px 12px", color: "var(--text-muted)", fontSize: "13px", lineHeight: 1.5, background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: "10px" };

export const infoBarStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "12px", padding: "10px 14px", background: "var(--bg-primary)", borderRadius: "10px", border: "1px solid var(--border)", flexWrap: "wrap" };
export const infoLabelStyle: React.CSSProperties = { fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" };
export const infoReasonStyle: React.CSSProperties = { fontSize: "13px", color: "var(--text-muted)" };

export const detailPanelStyle: React.CSSProperties = { padding: "14px", background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: "12px" };
export const detailGridStyle: React.CSSProperties = { display: "grid", gap: "12px" };
export const detailBlockStyle: React.CSSProperties = { display: "grid", gap: "6px" };
export const detailLabelStyle: React.CSSProperties = { fontSize: "12px", color: "var(--text-secondary)" };
export const detailValueStyle: React.CSSProperties = { fontSize: "12px", color: "var(--text-muted)", fontFamily: "monospace", wordBreak: "break-all", lineHeight: 1.55 };
export const detailsHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", gap: "10px", flexWrap: "wrap" };
export const detailsTitleStyle: React.CSSProperties = { fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" };
export const detailsBodyTextStyle: React.CSSProperties = { fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.55 };
export const detailsMetaStyle: React.CSSProperties = { fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 };
export const pendingValueStyle: React.CSSProperties = { color: "var(--text-muted)", fontFamily: "inherit", fontStyle: "italic" };

const searchWrapStyle: React.CSSProperties = { position: "relative", display: "inline-flex", alignItems: "center" };
const clearSearchButtonStyle: React.CSSProperties = { position: "absolute", right: "8px", border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: "14px", padding: "0 2px", lineHeight: 1 };
