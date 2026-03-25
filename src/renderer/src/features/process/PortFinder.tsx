import { useState, useMemo } from "react";
import { useToast } from "../../components/Toast";
import { usePortFinderStore } from "../../stores/usePortFinderStore";
import { getStateStyle } from "./portStateStyles";
import type { PortInfo, ProcessKillResult } from "@shared/types";
import { useI18n } from "../../i18n/useI18n";
import { StatusMessage } from "../../components/StatusMessage";
import { CopyableValue } from "../../components/CopyableValue";
import { AsyncTaskStatus } from "../../components/AsyncTaskStatus";

export function PortFinder() {
  const showToast = useToast((s) => s.show);
  const { tk, t } = useI18n();
  const {
    ports,
    loading,
    scanned,
    error,
    requestState,
    stateFilter,
    setStateFilter,
    fetchPorts,
  } = usePortFinderStore();
  const [search, setSearch] = useState("");
  const [searchScope, setSearchScope] = useState<"local" | "remote" | "all">(
    "local",
  );

  // 1단계: 검색어 필터 (scope 적용)
  const searchFiltered = useMemo(() => {
    if (!search.trim()) return ports;
    const q = search.toLowerCase();
    return ports.filter((p) => {
      if (searchScope === "local") {
        return (
          p.localPort.toString().includes(q) ||
          p.localAddress.toLowerCase().includes(q)
        );
      }
      if (searchScope === "remote") {
        return (
          p.peerPort.toString().includes(q) ||
          p.peerAddress.toLowerCase().includes(q)
        );
      }
      return (
        p.localPort.toString().includes(q) ||
        p.localAddress.toLowerCase().includes(q) ||
        p.peerPort.toString().includes(q) ||
        p.peerAddress.toLowerCase().includes(q)
      );
    });
  }, [ports, search, searchScope]);

  const orderedSearchFiltered = useMemo(() => {
    const stateWeight = {
      LISTEN: 0,
      ESTABLISHED: 1,
    } as const;

    return [...searchFiltered].sort((left, right) => {
      const stateDiff =
        (stateWeight[left.state as keyof typeof stateWeight] ?? 2) -
        (stateWeight[right.state as keyof typeof stateWeight] ?? 2);
      if (stateDiff !== 0) return stateDiff;

      const localPortDiff =
        Number(left.localPort || 0) - Number(right.localPort || 0);
      if (localPortDiff !== 0) return localPortDiff;

      return left.process.localeCompare(right.process);
    });
  }, [searchFiltered]);

  // 2단계: 상태 필터 (검색 결과 기준 카운트)
  const filtered = useMemo(() => {
    if (stateFilter === "LISTEN")
      return orderedSearchFiltered.filter((p) => p.state === "LISTEN");
    if (stateFilter === "ESTABLISHED")
      return orderedSearchFiltered.filter((p) => p.state === "ESTABLISHED");
    if (stateFilter === "other")
      return orderedSearchFiltered.filter(
        (p) => p.state !== "LISTEN" && p.state !== "ESTABLISHED",
      );
    return orderedSearchFiltered;
  }, [orderedSearchFiltered, stateFilter]);

  const listenCount = orderedSearchFiltered.filter(
    (p) => p.state === "LISTEN",
  ).length;

  const handleKill = async (portInfo: PortInfo) => {
    const remote = formatEndpoint(portInfo.peerAddress, portInfo.peerPort);
    const res = await window.systemScope.killProcess({
      pid: portInfo.pid,
      name: portInfo.process,
      command: `${portInfo.protocol.toUpperCase()} ${portInfo.localAddress}:${portInfo.localPort} -> ${remote}`,
      reason: "Activity > Ports",
    });
    if (!res.ok) {
      showToast(res.error?.message ?? tk("process.port_finder.kill_failed"));
      return;
    }

    const result = res.data as ProcessKillResult;
    if (result.cancelled) return;
    if (result.killed) {
      showToast(
        tk("process.port_finder.kill_sent", {
          name: result.name,
          pid: result.pid,
        }),
      );
      await fetchPorts();
    }
  };

  return (
    <section style={sectionStyle}>
      <div style={headerStyle}>
        <div style={titleRowStyle}>
          <span style={titleStyle}>{tk("process.port_finder.title")}</span>
          {scanned && (
            <span style={badgeStyle}>
              {tk("process.port_finder.badge", { count: listenCount })}
            </span>
          )}
        </div>
        <div style={actionsStyle}>
          <div
            onClick={(e) => e.stopPropagation()}
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
                aria-pressed={searchScope === s}
                onClick={() => setSearchScope(s)}
                style={{
                  padding: "4px 9px",
                  fontSize: "12px",
                  fontWeight: 600,
                  border: "none",
                  borderRadius: "4px",
                  background:
                    searchScope === s ? "var(--accent-cyan)" : "transparent",
                  color:
                    searchScope === s
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder={
              searchScope === "local"
                ? tk("process.port_finder.search_local")
                : searchScope === "remote"
                  ? tk("process.port_finder.search_remote")
                  : tk("process.port_finder.search_all")
            }
            aria-label={tk("process.port_finder.title")}
            style={searchStyle}
          />
          <button
            type="button"
            onClick={() => fetchPorts()}
            disabled={loading}
            style={btnStyle}
          >
            {loading
              ? "Scanning..."
              : scanned
                ? tk("apps.action.refresh")
                : tk("process.port_finder.scan")}
          </button>
        </div>
      </div>
      {!scanned && requestState !== "started" ? (
        <StatusMessage message={tk("process.port_finder.description")} />
      ) : (
        <div>
          <div style={{ marginBottom: "12px" }}>
            {requestState === "started" ? (
              <AsyncTaskStatus
                stage="started"
                taskLabel={tk("process.port_finder.title")}
                message={t(
                  "Port scan started. Collecting listening and connected socket information now.",
                )}
              />
            ) : requestState === "failed" && error ? (
              <AsyncTaskStatus
                stage="failed"
                taskLabel={tk("process.port_finder.title")}
                message={error}
                action={
                  <button
                    type="button"
                    onClick={() => fetchPorts()}
                    style={btnStyle}
                  >
                    {tk("apps.action.refresh")}
                  </button>
                }
              />
            ) : requestState === "completed" ? (
              <AsyncTaskStatus
                stage="completed"
                taskLabel={tk("process.port_finder.title")}
                message={t(
                  "Port scan completed. Filter by state or search local and remote endpoints to inspect the results.",
                )}
              />
            ) : (
              <StatusMessage message={tk("process.port_finder.helper")} />
            )}
          </div>
          <div style={infoBarStyle}>
            <span style={infoLabelStyle}>
              {t("Sorted by state first, then local port")}
            </span>
            <span style={infoReasonStyle}>
              {t(
                "Default order shows listening ports before active connections so server endpoints are easier to scan.",
              )}
            </span>
          </div>
          {/* State filter tabs */}
          <div
            style={{
              display: "flex",
              gap: "4px",
              marginBottom: "12px",
              flexWrap: "wrap",
            }}
          >
            <FilterBtn
              active={stateFilter === "all"}
              onClick={() => setStateFilter("all")}
            >
              {tk("process.port_finder.filter.all", {
                count: orderedSearchFiltered.length,
              })}
            </FilterBtn>
            <FilterBtn
              active={stateFilter === "LISTEN"}
              onClick={() => setStateFilter("LISTEN")}
            >
              {tk("process.port_finder.filter.listening", {
                count: listenCount,
              })}
            </FilterBtn>
            <FilterBtn
              active={stateFilter === "ESTABLISHED"}
              onClick={() => setStateFilter("ESTABLISHED")}
            >
              {tk("process.port_finder.filter.established", {
                count: orderedSearchFiltered.filter(
                  (p) => p.state === "ESTABLISHED",
                )
                  .length,
              })}
            </FilterBtn>
            <FilterBtn
              active={stateFilter === "other"}
              onClick={() => setStateFilter("other")}
            >
              {tk("process.port_finder.filter.other", {
                count: orderedSearchFiltered.filter(
                  (p) => p.state !== "LISTEN" && p.state !== "ESTABLISHED",
                ).length,
              })}
            </FilterBtn>
          </div>

          {filtered.length === 0 ? (
            <StatusMessage
              message={
                search
                  ? tk("process.port_finder.empty_search", { query: search })
                  : tk("process.port_finder.empty_state")
              }
            />
          ) : (
            <div style={{ maxHeight: "400px", overflow: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "13px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--border)",
                      position: "sticky",
                      top: 0,
                      background: "var(--bg-card)",
                      zIndex: 1,
                    }}
                  >
                    <th style={thStyle}>{tk("process.port_finder.proto")}</th>
                    <th style={thStyle}>
                      {tk("process.port_finder.local_port")}
                    </th>
                    <th style={thStyle}>{tk("process.port_finder.process")}</th>
                    <th style={thStyle}>PID</th>
                    <th style={thStyle}>{tk("process.port_finder.remote")}</th>
                    <th style={thStyle}>{tk("process.port_finder.state")}</th>
                    <th
                      style={{ ...thStyle, textAlign: "center", width: "92px" }}
                    >
                      {tk("process.port_finder.action")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr
                      key={`${p.protocol}-${p.localAddress}-${p.localPort}-${p.pid}`}
                      style={rowStyle}
                    >
                      <td
                        style={{
                          ...tdStyle,
                          fontFamily: "monospace",
                          fontSize: "13px",
                          color: "var(--text-muted)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {p.protocol}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          fontFamily: "monospace",
                          fontWeight: 600,
                          color: "var(--accent-cyan)",
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span style={portValueStyle}>{p.localPort}</span>
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          fontWeight: 500,
                          color: "var(--text-primary)",
                          maxWidth: "200px",
                        }}
                      >
                        <CopyableValue
                          value={p.process}
                          fontSize="13px"
                          color="var(--text-primary)"
                          maxWidth="200px"
                        />
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          fontFamily: "monospace",
                          fontSize: "13px",
                          color: "var(--text-muted)",
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.pid}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          fontFamily: "monospace",
                          fontSize: "13px",
                          color: "var(--text-muted)",
                          fontVariantNumeric: "tabular-nums",
                          lineHeight: 1.45,
                        }}
                      >
                        <CopyableValue
                          value={formatEndpoint(p.peerAddress, p.peerPort)}
                          fontSize="13px"
                          color="var(--text-muted)"
                          maxWidth="220px"
                        />
                      </td>
                      <td style={tdStyle}>
                        <StateBadge state={p.state} />
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <button
                          onClick={() => void handleKill(p)}
                          style={killBtnStyle}
                        >
                          {tk("process.port_finder.kill")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Helpers ───

export function formatEndpoint(addr: string, port: string): string {
  const hasAddr = addr && addr !== "*" && addr !== "";
  const hasPort = port && port !== "*" && port !== "0" && port !== "";
  if (hasAddr && hasPort) return `${addr}:${port}`;
  if (hasAddr) return addr;
  if (hasPort) return `:${port}`;
  return "-";
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

function FilterBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{
        padding: "5px 11px",
        fontSize: "12px",
        fontWeight: active ? 600 : 400,
        border: "none",
        borderRadius: "5px",
        background: active ? "var(--accent-cyan)" : "var(--bg-card-hover)",
        color: active ? "var(--text-on-accent)" : "var(--text-secondary)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

// ─── Styles ───

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 8px",
  color: "var(--text-muted)",
  fontWeight: 600,
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 8px",
  color: "var(--text-secondary)",
  fontSize: "14px",
  lineHeight: 1.4,
};

const searchStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: "13px",
  width: "220px",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
  outline: "none",
};

const infoBarStyle: React.CSSProperties = {
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

const infoLabelStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--text-primary)",
};

const infoReasonStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--text-muted)",
};

const btnStyle: React.CSSProperties = {
  padding: "7px 14px",
  fontSize: "13px",
  fontWeight: 600,
  border: "none",
  borderRadius: "6px",
  background: "var(--accent-cyan)",
  color: "var(--text-on-accent)",
  cursor: "pointer",
};

const killBtnStyle: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: "12px",
  fontWeight: 600,
  border: "none",
  borderRadius: "6px",
  background: "var(--accent-red)",
  color: "var(--text-on-accent)",
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

const actionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  flexWrap: "wrap",
  flexShrink: 0,
};

const rowStyle: React.CSSProperties = {
  borderBottom: "1px solid var(--border)",
};

const portValueStyle: React.CSSProperties = {
  color: "var(--text-primary)",
  fontWeight: 700,
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
