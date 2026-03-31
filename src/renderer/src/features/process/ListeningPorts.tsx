import { useEffect, useMemo } from "react";
import { useToast } from "../../components/Toast";
import { usePortFinderStore } from "../../stores/usePortFinderStore";
import { getStateStyle } from "./portStateStyles";
import type { PortInfo, ProcessKillResult } from "@shared/types";
import { useI18n } from "../../i18n/useI18n";
import { StatusMessage } from "../../components/StatusMessage";
import { CopyableValue } from "../../components/CopyableValue";
import { AsyncTaskStatus } from "../../components/AsyncTaskStatus";

export function ListeningPorts() {
  const showToast = useToast((s) => s.show);
  const { tk, t } = useI18n();
  const {
    ports,
    loading,
    scanned,
    error,
    requestState,
    stateFilter,
    search,
    searchScope,
    setStateFilter,
    setSearch,
    setSearchScope,
    fetchPorts,
  } = usePortFinderStore();

  useEffect(() => {
    if (!scanned && !loading) {
      void fetchPorts();
    }
  }, [fetchPorts, loading, scanned]);

  const searchFiltered = useMemo(
    () => filterPortsBySearch(ports, search, searchScope),
    [ports, search, searchScope],
  );

  const orderedSearchFiltered = useMemo(() => {
    return sortPortsForDisplay(searchFiltered);
  }, [searchFiltered]);

  const displayRows = useMemo(() => {
    return getDisplayedPorts(ports, search, searchScope, stateFilter);
  }, [ports, search, searchScope, stateFilter]);

  const listenCount = orderedSearchFiltered.filter(
    (p) => normalizePortState(p.state) === "LISTEN",
  ).length;
  const establishedCount = orderedSearchFiltered.filter(
    (p) => normalizePortState(p.state) === "ESTABLISHED",
  ).length;
  const otherCount = orderedSearchFiltered.length - listenCount - establishedCount;
  const listeningPorts = useMemo(
    () => filterPortsByState(orderedSearchFiltered, "LISTEN"),
    [orderedSearchFiltered],
  );
  const localhostListenCount = listeningPorts.filter((port) =>
    isLoopbackAddress(port.localAddress),
  ).length;
  const exposedListenCount = listeningPorts.filter((port) =>
    !isLoopbackAddress(port.localAddress),
  ).length;
  const uniqueProcessCount = new Set(
    listeningPorts.map((port) => port.pid),
  ).size;

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
              {t("Listening {count}", { count: listenCount })}
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
            {(["process", "local", "remote", "all"] as const).map((s) => (
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
                {s === "process"
                  ? t("Process")
                  : s === "local"
                    ? t("Local")
                    : s === "remote"
                      ? t("Remote")
                      : t("All")}
              </button>
            ))}
          </div>
          <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder={
                searchScope === "process"
                  ? t("Search by process name or PID")
                  : searchScope === "local"
                  ? tk("process.port_finder.search_local")
                  : searchScope === "remote"
                    ? tk("process.port_finder.search_remote")
                    : tk("process.port_finder.search_all")
              }
              aria-label={tk("process.port_finder.title")}
              style={{ ...searchStyle, paddingRight: "30px" }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label={t("Clear search")}
                style={{
                  position: "absolute",
                  right: "8px",
                  border: "none",
                  background: "transparent",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "14px",
                  padding: "0 2px",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => fetchPorts()}
            disabled={loading}
            style={btnStyle}
          >
            {loading
              ? t("Scanning...")
              : scanned
                ? tk("apps.action.refresh")
                : tk("process.port_finder.scan")}
          </button>
        </div>
      </div>
      {!scanned && requestState !== "started" ? (
        <StatusMessage
          message={t(
            "Scan listening ports and active connections, then kill the owning process directly from the table when needed.",
          )}
        />
      ) : (
        <div>
          <div style={{ marginBottom: "12px" }}>
            {requestState === "started" ? (
              <AsyncTaskStatus
                stage="started"
                taskLabel={tk("process.port_finder.title")}
                message={t(
                  "Listening port scan started. Collecting listeners and active socket information now.",
                )}
              />
            ) : requestState === "failed" && error ? (
              <AsyncTaskStatus
                stage="failed"
                taskLabel={tk("process.port_finder.title")}
                message={t(error)}
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
                  "Listening port scan completed. Review exposed bindings first, then inspect or kill the owning process.",
                )}
              />
            ) : (
              <StatusMessage
                message={t(
                  "Use the listening filter to focus on open ports, then expand your search to process, local, or remote values.",
                )}
              />
            )}
          </div>
          <div style={summaryGridStyle}>
            <SummaryCard
              label={t("Listening Ports")}
              value={listenCount}
              tone="var(--accent-cyan)"
              note={t("Ports currently accepting inbound connections")}
            />
            <SummaryCard
              label={t("Exposed Bindings")}
              value={exposedListenCount}
              tone="var(--accent-red)"
              note={t("Listening on non-loopback addresses")}
            />
            <SummaryCard
              label={t("Localhost Only")}
              value={localhostListenCount}
              tone="var(--accent-green)"
              note={t("Bound only to 127.0.0.1, ::1, or localhost")}
            />
            <SummaryCard
              label={t("Owning Processes")}
              value={uniqueProcessCount}
              tone="var(--accent-yellow)"
              note={t("Unique PIDs currently holding listening ports")}
            />
          </div>
          <div style={infoBarStyle}>
            <span style={infoLabelStyle}>
              {t("Listening ports are prioritized first, then sorted by local port")}
            </span>
            <span style={infoReasonStyle}>
              {t(
                "Start with listeners to find open services quickly. Switch to established connections only when you need connection-level troubleshooting.",
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
              {t("All ({count})", {
                count: orderedSearchFiltered.length,
              })}
            </FilterBtn>
            <FilterBtn
              active={stateFilter === "LISTEN"}
              onClick={() => setStateFilter("LISTEN")}
            >
              {t("Listening ({count})", { count: listenCount })}
            </FilterBtn>
            <FilterBtn
              active={stateFilter === "ESTABLISHED"}
              onClick={() => setStateFilter("ESTABLISHED")}
            >
              {t("Established ({count})", { count: establishedCount })}
            </FilterBtn>
            <FilterBtn
              active={stateFilter === "other"}
              onClick={() => setStateFilter("other")}
            >
              {t("Other ({count})", { count: otherCount })}
            </FilterBtn>
          </div>

          {displayRows.length === 0 ? (
            <StatusMessage
              message={
                search
                  ? tk("process.port_finder.empty_search", { query: search })
                  : tk("process.port_finder.empty_state")
              }
            />
          ) : (
            <div style={{ overflowX: "auto", overflowY: "clip" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: "980px",
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
                      boxShadow: "0 1px 0 var(--border)",
                    }}
                  >
                    <th style={thStyle}>{tk("process.port_finder.proto")}</th>
                    <th style={thStyle}>
                      {tk("process.port_finder.local_port")}
                    </th>
                    <th style={thStyle}>{tk("process.port_finder.process")}</th>
                    <th style={thStyle}>PID</th>
                    <th style={thStyle}>{t("Exposure")}</th>
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
                  {displayRows.map((p) => (
                    <tr
                      key={`${p.protocol}-${p.localAddress}-${p.localPort}-${p.peerAddress}-${p.peerPort}-${p.state}-${p.pid}`}
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
                          whiteSpace: "nowrap",
                        }}
                      >
                        <ExposureBadge address={p.localAddress} />
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

export function filterPortsBySearch(
  ports: PortInfo[],
  rawQuery: string,
  searchScope: "local" | "remote" | "process" | "all",
): PortInfo[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return ports;
  }

  return ports.filter((port) => {
    if (searchScope === "local") {
      return (
        String(port.localPort).includes(query) ||
        port.localAddress.toLowerCase().includes(query)
      );
    }

    if (searchScope === "remote") {
      return (
        String(port.peerPort).includes(query) ||
        port.peerAddress.toLowerCase().includes(query)
      );
    }

    if (searchScope === "process") {
      return (
        port.process.toLowerCase().includes(query) ||
        String(port.pid).includes(query)
      );
    }

    return (
      String(port.localPort).includes(query) ||
      port.localAddress.toLowerCase().includes(query) ||
      String(port.peerPort).includes(query) ||
      port.peerAddress.toLowerCase().includes(query) ||
      port.process.toLowerCase().includes(query) ||
      String(port.pid).includes(query)
    );
  });
}

export function filterPortsByState(
  ports: PortInfo[],
  stateFilter: "all" | "LISTEN" | "ESTABLISHED" | "other",
): PortInfo[] {
  if (stateFilter === "LISTEN") {
    return ports.filter((port) => normalizePortState(port.state) === "LISTEN");
  }

  if (stateFilter === "ESTABLISHED") {
    return ports.filter((port) => normalizePortState(port.state) === "ESTABLISHED");
  }

  if (stateFilter === "other") {
    return ports.filter(
      (port) => {
        const normalized = normalizePortState(port.state);
        return normalized !== "LISTEN" && normalized !== "ESTABLISHED";
      },
    );
  }

  return ports;
}

export function sortPortsForDisplay(ports: PortInfo[]): PortInfo[] {
  const stateWeight = {
    LISTEN: 0,
    ESTABLISHED: 1,
  } as const;

  return [...ports].sort((left, right) => {
    const stateDiff =
      (stateWeight[normalizePortState(left.state) as keyof typeof stateWeight] ?? 2) -
      (stateWeight[normalizePortState(right.state) as keyof typeof stateWeight] ?? 2);
    if (stateDiff !== 0) return stateDiff;

    const localPortDiff =
      getSortableLocalPort(left) - getSortableLocalPort(right);
    if (localPortDiff !== 0) return localPortDiff;

    return left.process.localeCompare(right.process);
  });
}

export function normalizePortState(state: string): string {
  const normalized = state.trim().toUpperCase();
  if (normalized === "LISTENING") {
    return "LISTEN";
  }
  return normalized;
}

export function dedupeListeningPorts(ports: PortInfo[]): PortInfo[] {
  return dedupePassivePorts(ports);
}

export function dedupePassivePorts(ports: PortInfo[]): PortInfo[] {
  const seen = new Set<string>();
  const result: PortInfo[] = [];

  for (const port of ports) {
    const key = `${port.protocol}:${port.localAddress}:${port.localPort}:${port.pid}:${normalizePortState(port.state)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(port);
  }

  return result;
}

export function getDisplayedPorts(
  ports: PortInfo[],
  search: string,
  searchScope: "local" | "remote" | "process" | "all",
  stateFilter: "all" | "LISTEN" | "ESTABLISHED" | "other",
): PortInfo[] {
  const searchFiltered = filterPortsBySearch(ports, search, searchScope);
  const ordered = sortPortsForDisplay(searchFiltered);
  const stateFiltered = filterPortsByState(ordered, stateFilter);

  if (stateFilter === "LISTEN") {
    return dedupePassivePorts(stateFiltered);
  }

  if (stateFilter === "other") {
    return dedupePassivePorts(stateFiltered);
  }

  if (stateFilter === "all") {
    const establishedRows = stateFiltered.filter(
      (port) => normalizePortState(port.state) === "ESTABLISHED",
    );
    const passiveRows = dedupePassivePorts(
      stateFiltered.filter(
        (port) => normalizePortState(port.state) !== "ESTABLISHED",
      ),
    );

    return sortPortsForDisplay([...passiveRows, ...establishedRows]);
  }

  return stateFiltered;
}

function ExposureBadge({ address }: { address: string }) {
  const exposure = getExposure(address);
  return (
    <span
      style={{
        ...stateBadgeStyle,
        minWidth: "96px",
        background: exposure.bg,
        color: exposure.color,
        borderColor: exposure.color,
      }}
      title={exposure.note}
    >
      {exposure.label}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  note,
}: {
  label: string;
  value: number;
  tone: string;
  note: string;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: "10px",
        border: "1px solid var(--border)",
        background: "var(--bg-primary)",
        display: "grid",
        gap: "4px",
      }}
    >
      <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ fontSize: "24px", fontWeight: 700, color: tone, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
        {note}
      </div>
    </div>
  );
}

function isLoopbackAddress(address: string): boolean {
  const normalized = address.trim().toLowerCase();
  return (
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "localhost"
  );
}

function getExposure(address: string): {
  label: string;
  color: string;
  bg: string;
  note: string;
} {
  const normalized = address.trim().toLowerCase();

  if (isLoopbackAddress(normalized)) {
    return {
      label: "Loopback",
      color: "var(--accent-green)",
      bg: "color-mix(in srgb, var(--accent-green) 16%, transparent)",
      note: "Reachable only from this machine."
    };
  }

  if (
    normalized === "0.0.0.0" ||
    normalized === "::" ||
    normalized === "*" ||
    normalized === ""
  ) {
    return {
      label: "All Interfaces",
      color: "var(--accent-red)",
      bg: "color-mix(in srgb, var(--accent-red) 16%, transparent)",
      note: "Bound broadly and potentially reachable from other hosts."
    };
  }

  return {
    label: "Specific Host",
    color: "var(--accent-yellow)",
    bg: "color-mix(in srgb, var(--accent-yellow) 16%, transparent)",
    note: "Bound to a non-loopback interface."
  };
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

function getSortableLocalPort(port: PortInfo): number {
  if (Number.isFinite(port.localPortNum) && port.localPortNum > 0) {
    return port.localPortNum;
  }

  const parsed = Number(port.localPort);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return Number.MAX_SAFE_INTEGER;
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

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "10px",
  marginBottom: "12px",
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
