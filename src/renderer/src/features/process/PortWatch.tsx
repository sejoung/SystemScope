import { useState, useCallback, useEffect, useMemo } from "react";
import { useInterval } from "../../hooks/useInterval";
import { useToast } from "../../components/Toast";
import { usePortWatchStore } from "../../stores/usePortWatchStore";
import { getStateStyle } from "./portStateStyles";
import type { PortInfo } from "@shared/types";
import {
  formatPortAddress,
  matchWatchPorts,
  parseWatchPattern,
} from "./portWatchUtils";
import { useI18n } from "../../i18n/useI18n";

const POLL_OPTIONS = [
  { value: 1000, label: "1s" },
  { value: 2000, label: "2s" },
  { value: 5000, label: "5s" },
  { value: 10000, label: "10s" },
  { value: 30000, label: "30s" },
];

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

const DISPLAY_LIMIT = 100;

export function PortWatch() {
  const showToast = useToast((s) => s.show);
  const { tk, t } = useI18n();
  const {
    watches,
    statuses,
    history,
    monitoring,
    pollInterval,
    expandedWatch,
    watchFilters,
    addWatch: storeAddWatch,
    removeWatch,
    setStatuses,
    addHistory,
    clearHistory,
    setMonitoring,
    setPollInterval,
    toggleExpanded,
    setWatchFilter,
    setPrevMatched,
  } = usePortWatchStore();

  const [input, setInput] = useState("");
  const [watchScope, setWatchScope] = useState<"local" | "remote" | "all">(
    "local",
  );
  type PortWatchHistoryEntry = (typeof history)[number];
  const [historyFilter, setHistoryFilter] = useState<
    "all" | "connected" | "disconnected"
  >("all");
  const [inputError, setInputError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const connectedHistoryCount = useMemo(
    () => history.filter((entry) => entry.event === "connected").length,
    [history],
  );
  const disconnectedHistoryCount = useMemo(
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

  const handleAddWatch = () => {
    const entry = parseWatchPattern(input, watchScope);
    if (!entry) {
      setInputError(t("Enter a valid port, IP, or IP:Port."));
      return;
    }
    if (watches.some((w) => w.pattern === entry.pattern)) {
      setInputError(null);
      showToast(tk("process.port_watch.duplicate", { pattern: entry.pattern }));
      return;
    }
    storeAddWatch(entry);
    setInput("");
    setInputError(null);
  };

  const pollPorts = useCallback(async () => {
    if (watches.length === 0) return;

    const res = await window.systemScope.getNetworkPorts();
    if (!res.ok || !res.data) {
      setStatusError(
        res.error?.message ?? t("Unable to refresh port watch status."),
      );
      return;
    }
    setStatusError(null);
    const ports = res.data as PortInfo[];
    const now = Date.now();
    const newStatuses: Record<
      string,
      { id: string; matched: boolean; matches: PortInfo[]; lastChecked: number }
    > = {};
    const newHistory: {
      timestamp: number;
      watchId: string;
      pattern: string;
      event: "connected" | "disconnected";
      process: string;
      detail: string;
    }[] = [];

    // store에서 직접 읽어 의존성 루프 방지
    const currentPrevMatched = usePortWatchStore.getState().prevMatched;

    for (const watch of watches) {
      const matches = matchWatchPorts(watch, ports);
      const matched = matches.length > 0;
      const prev = currentPrevMatched[watch.id];

      newStatuses[watch.id] = {
        id: watch.id,
        matched,
        matches,
        lastChecked: now,
      };

      if (prev !== undefined && prev !== matched) {
        const proc = matches[0]?.process ?? "-";
        const detail = matched
          ? matches
              .slice(0, 3)
              .map(
                (m) =>
                  `${formatPortAddress(m.localAddress, m.localPort)}→${formatPortAddress(m.peerAddress, m.peerPort)} (${m.state})`,
              )
              .join(", ")
          : "";

        newHistory.push({
          timestamp: now,
          watchId: watch.id,
          pattern: watch.pattern,
          event: matched ? "connected" : "disconnected",
          process: proc,
          detail,
        });

        showToast(
          matched
            ? tk("process.port_watch.connected", {
                pattern: watch.pattern,
                process: proc,
              })
            : tk("process.port_watch.disconnected", { pattern: watch.pattern }),
        );
      }

      setPrevMatched(watch.id, matched);
    }

    setStatuses(newStatuses);
    if (newHistory.length > 0) addHistory(newHistory);
  }, [watches, showToast, setStatuses, addHistory, setPrevMatched]);

  useEffect(() => {
    if (monitoring && watches.length > 0) pollPorts();
  }, [monitoring, watches.length, pollPorts]);

  useInterval(
    monitoring && watches.length > 0 ? pollPorts : () => {},
    pollInterval,
  );

  return (
    <section style={sectionStyle}>
      <div style={headerStyle}>
        <div style={titleRowStyle}>
          <span style={titleStyle}>{tk("process.port_watch.title")}</span>
          {monitoring && watches.length > 0 && (
            <span style={badgeStyle}>
              {tk("process.port_watch.badge", { count: watches.length })}
            </span>
          )}
        </div>
      </div>
      {/* Input */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "2px",
            background: "var(--bg-primary)",
            borderRadius: "6px",
            padding: "2px",
          }}
        >
          {(["local", "remote", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={watchScope === s}
              onClick={() => setWatchScope(s)}
              style={{
                padding: "4px 9px",
                fontSize: "12px",
                fontWeight: 600,
                border: "none",
                borderRadius: "4px",
                background:
                  watchScope === s ? "var(--accent-cyan)" : "transparent",
                color:
                  watchScope === s
                    ? "var(--text-on-accent)"
                    : "var(--text-muted)",
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (inputError) setInputError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddWatch();
          }}
          placeholder={
            watchScope === "local"
              ? tk("process.port_watch.placeholder_local")
              : watchScope === "remote"
                ? tk("process.port_watch.placeholder_remote")
                : tk("process.port_watch.placeholder_all")
          }
          aria-label={tk("process.port_watch.title")}
          aria-invalid={inputError ? "true" : "false"}
          aria-describedby={inputError ? "port-watch-input-error" : undefined}
          style={inputStyle}
        />
        <button type="button" onClick={handleAddWatch} style={btnStyle}>
          {tk("process.port_watch.add")}
        </button>
        {watches.length > 0 && (
          <button
            type="button"
            onClick={() => setMonitoring(!monitoring)}
            aria-pressed={monitoring}
            style={{
              ...btnStyle,
              background: monitoring
                ? "var(--accent-red)"
                : "var(--accent-green)",
            }}
          >
            {monitoring ? tk("common.pause") : tk("common.resume")}
          </button>
        )}
        {watches.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: "2px",
              background: "var(--bg-primary)",
              borderRadius: "6px",
              padding: "2px",
            }}
          >
            {POLL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={pollInterval === opt.value}
                onClick={() => setPollInterval(opt.value)}
                style={{
                  padding: "4px 9px",
                  fontSize: "12px",
                  fontWeight: 600,
                  border: "none",
                  borderRadius: "5px",
                  background:
                    pollInterval === opt.value
                      ? "var(--accent-cyan)"
                      : "transparent",
                  color:
                    pollInterval === opt.value
                      ? "var(--text-on-accent)"
                      : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
        {monitoring && watches.length > 0 && (
          <span style={{ fontSize: "13px", color: "var(--accent-green)" }}>
            ● {tk("process.port_watch.monitoring")}
          </span>
        )}
      </div>
      {inputError && (
        <div id="port-watch-input-error" role="alert" style={errorTextStyle}>
          {inputError}
        </div>
      )}
      {statusError && (
        <div role="alert" style={errorTextStyle}>
          {statusError}
        </div>
      )}

      {watches.length === 0 ? (
        <div
          style={{
            fontSize: "13px",
            color: "var(--text-muted)",
            padding: "4px 0",
          }}
        >
          {tk("process.port_watch.description")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Watch list */}
          <div>
            <div style={sectionTitle}>{tk("process.port_watch.list")}</div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            >
              {watches.map((watch) => {
                const status = statuses[watch.id];
                const isOpen = expandedWatch[watch.id];
                const connCount = status?.matches.length ?? 0;
                const matches = status?.matches ?? [];
                const listenC = matches.filter(
                  (m) => m.state === "LISTEN",
                ).length;
                const estC = matches.filter(
                  (m) => m.state === "ESTABLISHED",
                ).length;
                const otherC = matches.length - listenC - estC;
                const activeFilter = watchFilters[watch.id] ?? "all";

                const filtered =
                  activeFilter === "all"
                    ? matches
                    : activeFilter === "other"
                      ? matches.filter(
                          (m) =>
                            m.state !== "LISTEN" && m.state !== "ESTABLISHED",
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
                          onClick={() => setWatchFilter(watch.id, "LISTEN")}
                        />
                        <StateCount
                          label="E"
                          count={estC}
                          color="var(--accent-blue)"
                          active={activeFilter === "ESTABLISHED"}
                          onClick={() =>
                            setWatchFilter(watch.id, "ESTABLISHED")
                          }
                        />
                        {otherC > 0 && (
                          <StateCount
                            label="O"
                            count={otherC}
                            color="var(--accent-yellow)"
                            active={activeFilter === "other"}
                            onClick={() => setWatchFilter(watch.id, "other")}
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
                          onClick={() => toggleExpanded(watch.id)}
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
                        onClick={() => removeWatch(watch.id)}
                        style={removeBtnStyle}
                        aria-label={tk("process.port_watch.remove")}
                      >
                        ×
                      </button>
                    </div>

                    {/* Detail table */}
                    {isOpen && connCount > 0 && (
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
                                  count: filtered.length,
                                })
                              : activeFilter === "ESTABLISHED"
                                ? tk(
                                    "process.port_watch.filtered_established",
                                    { count: filtered.length },
                                  )
                                : tk("process.port_watch.filtered_other", {
                                    count: filtered.length,
                                  })}
                          </div>
                        )}
                        <div style={{ maxHeight: "250px", overflow: "auto" }}>
                          <table
                            style={{
                              width: "100%",
                              borderCollapse: "collapse",
                              fontSize: "14px",
                            }}
                          >
                            <thead>
                              <tr
                                style={{
                                  borderBottom: "1px solid var(--border)",
                                }}
                              >
                                <th style={thStyle}>
                                  {tk("process.port_watch.proto")}
                                </th>
                                <th style={thStyle}>
                                  {tk("process.port_watch.local")}
                                </th>
                                <th style={thStyle}>
                                  {tk("process.port_watch.remote")}
                                </th>
                                <th style={thStyle}>
                                  {tk("process.port_watch.process")}
                                </th>
                                <th style={thStyle}>
                                  {tk("process.port_watch.state")}
                                </th>
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
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* History */}
          {history.length > 0 && (
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
                      count: connectedHistoryCount,
                    })}
                  />
                  <HistoryFilterButton
                    active={historyFilter === "disconnected"}
                    onClick={() => setHistoryFilter("disconnected")}
                    label={tk("process.port_watch.filter.disconnected", {
                      count: disconnectedHistoryCount,
                    })}
                  />
                  <button
                    type="button"
                    onClick={clearHistory}
                    style={removeBtnStyle}
                  >
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
                  connected: connectedHistoryCount,
                  disconnected: disconnectedHistoryCount,
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
                {filteredHistory.map((entry: PortWatchHistoryEntry) => (
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
          )}
        </div>
      )}
    </section>
  );
}

// ─── Sub-components ───

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

// ─── Styles ───

const inputStyle: React.CSSProperties = {
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

const errorTextStyle: React.CSSProperties = {
  marginBottom: "12px",
  padding: "10px 12px",
  borderRadius: "8px",
  background: "var(--alert-red-soft)",
  border: "1px solid var(--alert-red-border)",
  color: "var(--accent-red)",
  fontSize: "13px",
  lineHeight: 1.5,
};

const btnStyle: React.CSSProperties = {
  padding: "7px 16px",
  fontSize: "13px",
  fontWeight: 600,
  border: "none",
  borderRadius: "6px",
  background: "var(--accent-cyan)",
  color: "var(--text-on-accent)",
  cursor: "pointer",
};

const removeBtnStyle: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: "14px",
  fontWeight: 600,
  border: "none",
  borderRadius: "4px",
  background: "transparent",
  color: "var(--text-muted)",
  cursor: "pointer",
};

const detailsBtn: React.CSSProperties = {
  padding: "5px 10px",
  fontSize: "12px",
  fontWeight: 500,
  border: "none",
  borderRadius: "4px",
  background: "transparent",
  cursor: "pointer",
};

const sectionStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-card)",
  borderRadius: "var(--radius-lg)",
  border: "1px solid var(--border)",
  padding: "16px",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "16px",
};

const titleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  minWidth: 0,
};

const titleStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-secondary)",
};

const badgeStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--accent-cyan) 16%, transparent)",
  color: "var(--accent-cyan)",
  whiteSpace: "nowrap",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "6px",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 8px",
  color: "var(--text-muted)",
  fontWeight: 600,
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 8px",
  color: "var(--text-secondary)",
  fontSize: "14px",
  lineHeight: 1.4,
};

const rowStyle: React.CSSProperties = {
  borderBottom: "1px solid var(--border)",
};

const stateBadgeStyle: React.CSSProperties = {
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
