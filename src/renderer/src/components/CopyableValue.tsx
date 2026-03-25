import { useMemo, useState } from "react";
import { useToast } from "./Toast";
import { useI18n } from "../i18n/useI18n";

interface CopyableValueProps {
  value: string;
  emptyValue?: string;
  multiline?: boolean;
  fontSize?: string;
  color?: string;
  maxWidth?: string;
}

const COLLAPSE_THRESHOLD = 72;

export function canExpandCopyableValue(
  value: string,
  multiline: boolean,
  threshold: number = COLLAPSE_THRESHOLD,
) {
  return multiline && value.trim().length > threshold;
}

export function CopyableValue({
  value,
  emptyValue = "-",
  multiline = false,
  fontSize = "12px",
  color = "var(--text-primary)",
  maxWidth,
}: CopyableValueProps) {
  const showToast = useToast((s) => s.show);
  const { tk } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const safeValue = value.trim();
  const canExpand = useMemo(
    () => canExpandCopyableValue(safeValue, multiline),
    [multiline, safeValue],
  );

  if (!safeValue) {
    return (
      <span style={{ fontSize, color: "var(--text-muted)" }}>{emptyValue}</span>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(safeValue);
      showToast(tk("common.copied"), "success");
    } catch {
      showToast(tk("common.copy_failed"), "danger");
    }
  };

  return (
    <div style={{ display: "grid", gap: "6px", minWidth: 0 }}>
      <div
        title={safeValue}
        style={{
          fontSize,
          fontFamily: "monospace",
          lineHeight: 1.5,
          color,
          maxWidth,
          overflow: multiline && expanded ? "visible" : "hidden",
          textOverflow: multiline && expanded ? "clip" : "ellipsis",
          whiteSpace: multiline && expanded ? "pre-wrap" : "nowrap",
          wordBreak: multiline && expanded ? "break-all" : "normal",
        }}
      >
        {safeValue}
      </div>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => void handleCopy()}
          style={actionBtnStyle}
        >
          {tk("common.copy")}
        </button>
        {canExpand ? (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            style={actionBtnStyle}
          >
            {expanded ? tk("common.show_less") : tk("common.show_full")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  padding: "3px 8px",
  fontSize: "11px",
  fontWeight: 600,
  borderRadius: "6px",
  border: "1px solid var(--border)",
  background: "var(--bg-primary)",
  color: "var(--text-secondary)",
  cursor: "pointer",
};
