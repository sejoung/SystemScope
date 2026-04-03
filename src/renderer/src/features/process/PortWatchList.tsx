import type { PortInfo } from "@shared/types";
import { getStateStyle } from "./portStateStyles";
import { formatPortAddress } from "./portWatchUtils";
import { useI18n } from "../../i18n/useI18n";
import {
  detailsBtn,
  removeBtnStyle,
  sectionTitle,
  stateBadgeStyle,
  tdStyle,
  thStyle,
  rowStyle,
} from "./portWatchStyles";

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

const DISPLAY_LIMIT = 100;

interface WatchEntry {
  id: string;
  pattern: string;
  scope: string;
  type: string;
}

interface WatchStatus {
  id: string;
  matched: boolean;
  matches: PortInfo[];
  lastChecked: number;
}

export function PortWatchList({
  watches,
  statuses,
  expandedWatch,
  watchFilters,
  compactLayout = false,
  onToggleExpanded,
  onSetWatchFilter,
  onRemoveWatch,
}: {
  watches: WatchEntry[];
  statuses: Record<string, WatchStatus>;
  expandedWatch: Record<string, boolean>;
  watchFilters: Record<string, string>;
  compactLayout?: boolean;
  onToggleExpanded: (id: string) => void;
  onSetWatchFilter: (id: string, filter: string) => void;
  onRemoveWatch: (id: string) => void;
}) {
  const { tk } = useI18n();

  return (
    <div>
      <div style={sectionTitle}>{tk("process.port_watch.list")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {watches.map((watch) => {
          const status = statuses[watch.id];
          const isOpen = expandedWatch[watch.id];
          const connCount = status?.matches.length ?? 0;
          const matches = status?.matches ?? [];
          const listenC = matches.filter((m) => m.state === "LISTEN").length;
          const estC = matches.filter((m) => m.state === "ESTABLISHED").length;
          const otherC = matches.length - listenC - estC;
          const activeFilter = watchFilters[watch.id] ?? "all";

          const filtered =
            activeFilter === "all"
              ? matches
              : activeFilter === "other"
                ? matches.filter(
                    (m) => m.state !== "LISTEN" && m.state !== "ESTABLISHED",
                  )
                : matches.filter((m) => m.state === activeFilter);
          const display = filtered.slice(0, DISPLAY_LIMIT);
          const hidden = filtered.length - display.length;

          return (
            <div
              key={watch.id}
              style={{
                borderRadius: "8px",
                background: status?.matched
                  ? "var(--success-soft)"
                  : "var(--bg-primary)",
                border: `1px solid ${status?.matched ? "var(--accent-green)" : "var(--border)"}`,
                overflow: "hidden",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 12px",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontFamily: "monospace",
                    color: "var(--text-muted)",
                    flexShrink: 0,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {status ? formatTime(status.lastChecked) : "--:--:--"}
                </span>
                <span
                  role="status"
                  aria-label={
                    status?.matched
                      ? tk("process.port_watch.connected_label")
                      : tk("process.port_watch.disconnected_label")
                  }
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    flexShrink: 0,
                    backgroundColor: status?.matched
                      ? "var(--accent-green)"
                      : "var(--text-muted)",
                    boxShadow: status?.matched
                      ? "0 0 6px var(--accent-green)"
                      : "none",
                  }}
                />
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: status?.matched
                      ? "var(--accent-green)"
                      : "var(--text-muted)",
                  }}
                >
                  {status?.matched
                    ? tk("process.port_watch.connected_label")
                    : tk("process.port_watch.disconnected_label")}
                </span>
                <span
                  style={{
                    fontSize: "15px",
                    fontWeight: 600,
                    fontFamily: "monospace",
                    color: "var(--text-primary)",
                  }}
                >
                  {watch.pattern}
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    color: "var(--text-muted)",
                    padding: "3px 8px",
                    borderRadius: "999px",
                    background: "var(--bg-card-hover)",
                  }}
                >
                  {watch.scope}:{watch.type}
                </span>
                <span style={{ flex: 1 }} />

                {/* State counts */}
                <div
                  style={{
                    display: "flex",
                    gap: "4px",
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <StateCount
                    label="L"
                    count={listenC}
                    color="var(--accent-green)"
                    active={activeFilter === "LISTEN"}
                    onClick={() => onSetWatchFilter(watch.id, "LISTEN")}
                  />
                  <StateCount
                    label="E"
                    count={estC}
                    color="var(--accent-blue)"
                    active={activeFilter === "ESTABLISHED"}
                    onClick={() => onSetWatchFilter(watch.id, "ESTABLISHED")}
                  />
                  {otherC > 0 && (
                    <StateCount
                      label="O"
                      count={otherC}
                      color="var(--accent-yellow)"
                      active={activeFilter === "other"}
                      onClick={() => onSetWatchFilter(watch.id, "other")}
                    />
                  )}
                  <span
                    style={{
                      fontSize: "13px",
                      color: "var(--text-muted)",
                      fontFamily: "monospace",
                      marginLeft: "4px",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {connCount}
                  </span>
                </div>

                {connCount > 0 && (
                  <button
                    type="button"
                    onClick={() => onToggleExpanded(watch.id)}
                    style={{
                      ...detailsBtn,
                      color: isOpen
                        ? "var(--accent-cyan)"
                        : "var(--text-muted)",
                    }}
                  >
                    {isOpen
                      ? `▼ ${tk("process.port_watch.hide")}`
                      : `▶ ${tk("process.port_watch.details")}`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveWatch(watch.id)}
                  style={removeBtnStyle}
                  aria-label={tk("process.port_watch.remove")}
                >
                  ×
                </button>
              </div>

              {/* Detail table */}
              {isOpen && connCount > 0 && (
                <WatchDetailTable
                  display={display}
                  hidden={hidden}
                  activeFilter={activeFilter}
                  filteredCount={filtered.length}
                  compactLayout={compactLayout}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sub-components ───

function WatchDetailTable({
  display,
  hidden,
  activeFilter,
  filteredCount,
  compactLayout,
}: {
  display: PortInfo[];
  hidden: number;
  activeFilter: string;
  filteredCount: number;
  compactLayout: boolean;
}) {
  const { tk } = useI18n();
  return (
    <div
      style={{
        borderTop: "1px solid var(--border)",
        padding: "6px 10px",
      }}
    >
      {activeFilter !== "all" && (
        <div
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            marginBottom: "6px",
          }}
        >
          {activeFilter === "LISTEN"
            ? tk("process.port_watch.filtered_listening", {
                count: filteredCount,
              })
            : activeFilter === "ESTABLISHED"
              ? tk("process.port_watch.filtered_established", {
                  count: filteredCount,
                })
              : tk("process.port_watch.filtered_other", {
                  count: filteredCount,
                })}
        </div>
      )}
      <div style={{ maxHeight: compactLayout ? undefined : "250px", overflow: compactLayout ? "visible" : "auto" }}>
        {compactLayout ? (
          <div style={compactWatchCardListStyle}>
            {display.map((m) => (
              <div
                key={`${m.protocol}-${m.localAddress}-${m.localPort}-${m.peerAddress}-${m.peerPort}`}
                style={compactWatchCardStyle}
              >
                <div style={compactWatchCardHeaderStyle}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <span style={compactWatchProtocolStyle}>{m.protocol.toUpperCase()}</span>
                    <StateBadge state={m.state} />
                  </div>
                  <div style={compactWatchProcessStyle}>{m.process}</div>
                </div>
                <div style={compactWatchMetaGridStyle}>
                  <WatchMeta label={tk("process.port_watch.local")} value={formatPortAddress(m.localAddress, m.localPort)} />
                  <WatchMeta label={tk("process.port_watch.remote")} value={formatPortAddress(m.peerAddress, m.peerPort)} />
                </div>
              </div>
            ))}
          </div>
        ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "14px",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={thStyle}>{tk("process.port_watch.proto")}</th>
              <th style={thStyle}>{tk("process.port_watch.local")}</th>
              <th style={thStyle}>{tk("process.port_watch.remote")}</th>
              <th style={thStyle}>{tk("process.port_watch.process")}</th>
              <th style={thStyle}>{tk("process.port_watch.state")}</th>
            </tr>
          </thead>
          <tbody>
            {display.map((m) => (
              <tr
                key={`${m.protocol}-${m.localAddress}-${m.localPort}-${m.peerAddress}-${m.peerPort}`}
                style={rowStyle}
              >
                <td
                  style={{
                    ...tdStyle,
                    color: "var(--text-muted)",
                    fontFamily: "monospace",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {m.protocol}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    fontFamily: "monospace",
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1.45,
                  }}
                >
                  {formatPortAddress(m.localAddress, m.localPort)}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    fontFamily: "monospace",
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1.45,
                  }}
                >
                  {formatPortAddress(m.peerAddress, m.peerPort)}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    lineHeight: 1.45,
                  }}
                >
                  {m.process}
                </td>
                <td style={tdStyle}>
                  <StateBadge state={m.state} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
      {hidden > 0 && (
        <div
          style={{
            padding: "8px 0",
            fontSize: "13px",
            color: "var(--text-muted)",
            textAlign: "center",
          }}
        >
          {tk("process.port_watch.more", {
            count: hidden.toLocaleString(),
            limit: DISPLAY_LIMIT,
          })}
        </div>
      )}
    </div>
  );
}

function WatchMeta({ label, value }: { label: string; value: string }) {
  return (
    <div style={compactWatchMetaItemStyle}>
      <div style={compactWatchMetaLabelStyle}>{label}</div>
      <div style={compactWatchMetaValueStyle}>{value}</div>
    </div>
  );
}

function StateCount({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  const { tk } = useI18n();
  if (count === 0) return null;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "3px 8px",
        fontSize: "12px",
        fontWeight: 600,
        border: active ? `1px solid ${color}` : "1px solid transparent",
        borderRadius: "999px",
        background: active ? `${color}20` : "transparent",
        color,
        cursor: "pointer",
      }}
      title={tk("process.port_watch.state_filter_title", {
        label:
          label === "L"
            ? tk("process.port_watch.state.listening")
            : label === "E"
              ? tk("process.port_watch.state.established")
              : tk("process.port_watch.state.other"),
      })}
    >
      {label}:{count.toLocaleString()}
    </button>
  );
}

function StateBadge({ state }: { state: string }) {
  const s = getStateStyle(state);
  return (
    <span
      style={{
        ...stateBadgeStyle,
        background: s.bg,
        color: s.color,
        borderColor: s.color,
      }}
      title={s.tip}
    >
      {state}
    </span>
  );
}

const compactWatchCardListStyle: React.CSSProperties = {
  display: "grid",
  gap: "8px",
};

const compactWatchCardStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
  padding: "12px",
  borderRadius: "10px",
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
};

const compactWatchCardHeaderStyle: React.CSSProperties = {
  display: "grid",
  gap: "8px",
};

const compactWatchProtocolStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: "999px",
  background: "var(--bg-primary)",
  color: "var(--text-muted)",
  border: "1px solid var(--border)",
};

const compactWatchProcessStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "var(--text-primary)",
  wordBreak: "break-word",
};

const compactWatchMetaGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "10px",
};

const compactWatchMetaItemStyle: React.CSSProperties = {
  display: "grid",
  gap: "4px",
  padding: "10px 12px",
  borderRadius: "10px",
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
};

const compactWatchMetaLabelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-muted)",
};

const compactWatchMetaValueStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--text-primary)",
  lineHeight: 1.5,
  fontFamily: "monospace",
  wordBreak: "break-word",
};
