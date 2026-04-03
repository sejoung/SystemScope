import { useState, useCallback, useEffect } from "react";
import { useInterval } from "../../hooks/useInterval";
import { useToast } from "../../components/Toast";
import { usePortWatchStore } from "../../stores/usePortWatchStore";
import type { PortInfo } from "@shared/types";
import { isPortInfoArray } from "@shared/types";
import { useContainerWidth } from "../../hooks/useContainerWidth";
import { isCompactWidth, RESPONSIVE_WIDTH } from "../../hooks/useResponsiveLayout";
import {
  formatPortAddress,
  matchWatchPorts,
  parseWatchPattern,
} from "./portWatchUtils";
import { useI18n } from "../../i18n/useI18n";
import { PortWatchList } from "./PortWatchList";
import { PortWatchHistory } from "./PortWatchHistory";
import {
  btnStyle,
  errorTextStyle,
  headerStyle,
  inputStyle,
  sectionStyle,
  titleRowStyle,
  titleStyle,
  badgeStyle,
} from "./portWatchStyles";

const POLL_OPTIONS = [
  { value: 1000, label: "1s" },
  { value: 2000, label: "2s" },
  { value: 5000, label: "5s" },
  { value: 10000, label: "10s" },
  { value: 30000, label: "30s" },
];

export function shouldUsePortWatchCompactLayout(width: number): boolean {
  return isCompactWidth(width, RESPONSIVE_WIDTH.portWatchCompact);
}

export function PortWatch() {
  const showToast = useToast((s) => s.show);
  const { tk } = useI18n();
  const [containerRef, containerWidth] = useContainerWidth(1100);
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
  const [inputError, setInputError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const compactLayout = shouldUsePortWatchCompactLayout(containerWidth);

  const handleAddWatch = () => {
    const entry = parseWatchPattern(input, watchScope);
    if (!entry) {
      setInputError(tk("Enter a valid port, IP, or IP:Port."));
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
    if (!res.ok) {
      setStatusError(
        res.error?.message ?? tk("Unable to refresh port watch status."),
      );
      return;
    }
    if (!res.data) return;
    setStatusError(null);
    if (!isPortInfoArray(res.data)) return;
    const ports = res.data;
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
    pollPorts,
    monitoring && watches.length > 0 ? pollInterval : null,
  );

  return (
    <section style={sectionStyle} ref={containerRef}>
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

      {/* Input controls */}
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
            flexWrap: "wrap",
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
          style={{ ...inputStyle, minWidth: compactLayout ? "100%" : inputStyle.minWidth }}
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
          <PortWatchList
            watches={watches}
            statuses={statuses}
            expandedWatch={expandedWatch}
            watchFilters={watchFilters}
            compactLayout={compactLayout}
            onToggleExpanded={toggleExpanded}
            onSetWatchFilter={setWatchFilter}
            onRemoveWatch={removeWatch}
          />
          <PortWatchHistory history={history} onClear={clearHistory} />
        </div>
      )}
    </section>
  );
}
