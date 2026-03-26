import { useMemo, useState } from "react";
import { useI18n } from "../../i18n/useI18n";
import { removeBtnStyle, sectionTitle } from "./portWatchStyles";
import { formatTime } from "./PortWatchList";

interface HistoryEntry {
  timestamp: number;
  watchId: string;
  pattern: string;
  event: "connected" | "disconnected";
  process: string;
  detail: string;
}

export function PortWatchHistory({
  history,
  onClear,
}: {
  history: HistoryEntry[];
  onClear: () => void;
}) {
  const { tk } = useI18n();
  const [historyFilter, setHistoryFilter] = useState<
    "all" | "connected" | "disconnected"
  >("all");

  const connectedCount = useMemo(
    () => history.filter((entry) => entry.event === "connected").length,
    [history],
  );
  const disconnectedCount = useMemo(
    () => history.filter((entry) => entry.event === "disconnected").length,
    [history],
  );
  const filteredHistory = useMemo(
    () =>
      historyFilter === "all"
        ? history
        : history.filter((entry) => entry.event === historyFilter),
    [history, historyFilter],
  );

  if (history.length === 0) return null;

  return (
    <div>
      <div
        style={{
          ...sectionTitle,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>{tk("process.port_watch.history")}</span>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <HistoryFilterButton
            active={historyFilter === "all"}
            onClick={() => setHistoryFilter("all")}
            label={tk("process.port_watch.filter.all", {
              count: history.length,
            })}
          />
          <HistoryFilterButton
            active={historyFilter === "connected"}
            onClick={() => setHistoryFilter("connected")}
            label={tk("process.port_watch.filter.connected", {
              count: connectedCount,
            })}
          />
          <HistoryFilterButton
            active={historyFilter === "disconnected"}
            onClick={() => setHistoryFilter("disconnected")}
            label={tk("process.port_watch.filter.disconnected", {
              count: disconnectedCount,
            })}
          />
          <button type="button" onClick={onClear} style={removeBtnStyle}>
            {tk("process.port_watch.clear")}
          </button>
        </div>
      </div>
      <div
        style={{
          fontSize: "13px",
          color: "var(--text-muted)",
          marginBottom: "8px",
        }}
      >
        {tk("process.port_watch.history_summary", {
          connected: connectedCount,
          disconnected: disconnectedCount,
        })}
      </div>
      <div
        style={{
          maxHeight: "200px",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        {filteredHistory.map((entry) => (
          <div
            key={`${entry.timestamp}-${entry.watchId}-${entry.event}`}
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "flex-start",
              padding: "10px 12px",
              fontSize: "14px",
              borderLeft: `3px solid ${entry.event === "connected" ? "var(--accent-green)" : "var(--accent-red)"}`,
              borderRadius: "8px",
              background: "var(--bg-primary)",
            }}
          >
            <span
              style={{
                color: "var(--text-muted)",
                fontFamily: "monospace",
                fontSize: "13px",
                flexShrink: 0,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatTime(entry.timestamp)}
            </span>
            <span
              style={{
                fontFamily: "monospace",
                fontWeight: 600,
                color: "var(--accent-cyan)",
                flexShrink: 0,
                fontSize: "14px",
              }}
            >
              {entry.pattern}
            </span>
            <span
              style={{
                fontSize: "11px",
                lineHeight: 1.4,
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: "999px",
                background:
                  entry.event === "connected"
                    ? "var(--success-soft)"
                    : "var(--alert-red-soft)",
                color:
                  entry.event === "connected"
                    ? "var(--accent-green)"
                    : "var(--accent-red)",
                flexShrink: 0,
              }}
            >
              {entry.event === "connected"
                ? tk("process.port_watch.connected_label")
                : tk("process.port_watch.disconnected_label")}
            </span>
            <span
              style={{
                color: "var(--text-secondary)",
                lineHeight: 1.5,
                minWidth: 0,
              }}
            >
              {entry.process}
              {entry.detail ? ` — ${entry.detail}` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoryFilterButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{
        padding: "4px 8px",
        fontSize: "12px",
        fontWeight: 600,
        borderRadius: "6px",
        border: "1px solid var(--border)",
        background: active ? "var(--bg-card-hover)" : "transparent",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
