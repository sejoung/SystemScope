import { useEffect, useState } from "react";
import type { ProcessNetworkSnapshot, ProcessNetworkUsage, PortInfo } from "@shared/types";
import { useI18n } from "../../i18n/useI18n";
import { StatusMessage } from "../../components/StatusMessage";
import { usePidNetworkHistory } from "./usePidNetworkHistory";
import { Sparkline } from "./Sparkline";
import { peerLabel } from './peerLabel'

type SortKey = "rxBps" | "txBps" | "totalRxBytes" | "totalTxBytes";

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatBps(bps: number | null): string {
  if (bps === null) return "—";
  if (bps < 1024) return `${bps.toFixed(0)} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  if (bps < 1024 * 1024 * 1024) return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${(bps / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
}

function nullLastDesc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function sortProcesses(list: ProcessNetworkUsage[], key: SortKey): ProcessNetworkUsage[] {
  return [...list].sort((a, b) => nullLastDesc(a[key], b[key]));
}

interface ExpandedRowProps {
  pid: number;
}

function ExpandedRow({ pid }: ExpandedRowProps) {
  const [ports, setPorts] = useState<PortInfo[] | null>(null);
  const [hostnames, setHostnames] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await window.systemScope.getNetworkPorts();
      if (res.ok && res.data) {
        const filtered = (res.data as PortInfo[]).filter((p) => p.pid === pid);
        setPorts(filtered);
        const peerIps = Array.from(
          new Set(filtered.map((p) => p.peerAddress).filter((ip) => !!ip && ip !== '*'))
        );
        if (peerIps.length > 0) {
          const dnsRes = await window.systemScope.resolveHostnames(peerIps);
          if (dnsRes.ok && dnsRes.data) {
            setHostnames(dnsRes.data as Record<string, string | null>);
          }
        }
      } else if (!res.ok) {
        setError(res.error?.message ?? "Unable to fetch port information.");
      }
    })();
  }, [pid]);

  if (error) {
    return (
      <tr>
        <td colSpan={6} style={{ padding: "8px 12px", fontSize: "12px", color: "var(--accent-red)" }}>
          {error}
        </td>
      </tr>
    );
  }

  if (ports === null) {
    return (
      <tr>
        <td colSpan={6} style={{ padding: "8px 12px", fontSize: "12px", color: "var(--text-secondary)" }}>
          Loading ports...
        </td>
      </tr>
    );
  }

  if (ports.length === 0) {
    return (
      <tr>
        <td colSpan={6} style={{ padding: "8px 12px", fontSize: "12px", color: "var(--text-secondary)" }}>
          No ports found for this process.
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={6} style={{ padding: "8px 12px 12px 12px", background: "var(--bg-subtle, var(--bg-card))" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {ports.map((p, i) => (
            <span
              key={i}
              style={{
                fontSize: "11px",
                fontFamily: "var(--font-mono, monospace)",
                padding: "2px 6px",
                borderRadius: "var(--radius-sm, 4px)",
                background: "var(--bg-tag, var(--border))",
                color: "var(--text-secondary)",
              }}
            >
              {p.protocol} {p.localAddress}:{p.localPort} → {peerLabel(p.peerAddress, hostnames[p.peerAddress] ?? null)}:{p.peerPort} [{p.state}]
            </span>
          ))}
        </div>
      </td>
    </tr>
  );
}

export function ProcessNetworkPanel() {
  const { tk } = useI18n();
  const [snapshot, setSnapshot] = useState<ProcessNetworkSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("rxBps");
  const [expandedPid, setExpandedPid] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      const res = await window.systemScope.getNetworkUsage();
      if (!mounted) return;
      if (res.ok && res.data) {
        setSnapshot(res.data as ProcessNetworkSnapshot);
        setError(null);
      } else if (!res.ok) {
        setError(res.error?.message ?? "Unable to fetch network usage.");
      }
    };

    void fetchData();
    const interval = setInterval(() => { void fetchData(); }, 2000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const history = usePidNetworkHistory(snapshot);

  if (snapshot && !snapshot.supported) {
    return (
      <StatusMessage
        message={tk("process.network_usage.unsupported")}
        tone="info"
      />
    );
  }

  if (error) {
    return (
      <StatusMessage
        message={error}
        tone="error"
      />
    );
  }

  if (!snapshot) {
    return null;
  }

  const sorted = sortProcesses(snapshot.processes, sortKey);

  const hasBaseline = snapshot.intervalSec !== null;
  const totalRx = hasBaseline
    ? snapshot.processes.reduce((acc, p) => acc + (p.rxBps ?? 0), 0)
    : null;
  const totalTx = hasBaseline
    ? snapshot.processes.reduce((acc, p) => acc + (p.txBps ?? 0), 0)
    : null;

  const thStyle: React.CSSProperties = {
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--text-secondary)",
    textAlign: "left",
    borderBottom: "1px solid var(--border)",
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
  };

  const tdStyle: React.CSSProperties = {
    padding: "8px 12px",
    fontSize: "13px",
    color: "var(--text-primary)",
    borderBottom: "1px solid var(--border)",
  };

  const makeThClick = (key: SortKey) => () => setSortKey(key);

  return (
    <div>
      <div
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: "12px",
        }}
      >
        {tk("process.network_usage.title")}
      </div>
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 10px",
            borderRadius: "var(--radius-sm, 4px)",
            background: "var(--bg-tag, var(--border))",
            fontSize: "12px",
            color: "var(--text-secondary)",
          }}
        >
          <span style={{ color: "var(--accent-blue, #3b82f6)" }}>↓</span>
          <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
            {tk("process.network_usage.total_download")}
          </span>
          <span>{totalRx === null ? "—" : formatBps(totalRx)}</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 10px",
            borderRadius: "var(--radius-sm, 4px)",
            background: "var(--bg-tag, var(--border))",
            fontSize: "12px",
            color: "var(--text-secondary)",
          }}
        >
          <span style={{ color: "var(--accent-green, #10b981)" }}>↑</span>
          <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
            {tk("process.network_usage.total_upload")}
          </span>
          <span>{totalTx === null ? "—" : formatBps(totalTx)}</span>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>{tk("process.network_usage.col.process")}</th>
              <th
                style={{ ...thStyle, color: sortKey === "rxBps" ? "var(--text-primary)" : "var(--text-secondary)" }}
                onClick={makeThClick("rxBps")}
              >
                ↓ {tk("process.network_usage.col.rxBps")}
              </th>
              <th
                style={{ ...thStyle, color: sortKey === "txBps" ? "var(--text-primary)" : "var(--text-secondary)" }}
                onClick={makeThClick("txBps")}
              >
                ↑ {tk("process.network_usage.col.txBps")}
              </th>
              <th style={{ ...thStyle, cursor: "default" }}>
                {tk("process.network_usage.col.activity")}
              </th>
              <th
                style={{ ...thStyle, color: sortKey === "totalRxBytes" ? "var(--text-primary)" : "var(--text-secondary)" }}
                onClick={makeThClick("totalRxBytes")}
              >
                {tk("process.network_usage.col.totalRx")}
              </th>
              <th
                style={{ ...thStyle, color: sortKey === "totalTxBytes" ? "var(--text-primary)" : "var(--text-secondary)" }}
                onClick={makeThClick("totalTxBytes")}
              >
                {tk("process.network_usage.col.totalTx")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((proc) => {
              const isExpanded = expandedPid === proc.pid;
              return (
                <>
                  <tr
                    key={proc.pid}
                    style={{ cursor: "pointer" }}
                    onClick={() => setExpandedPid(isExpanded ? null : proc.pid)}
                  >
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 500 }}>{proc.name}</span>
                      <span style={{ marginLeft: "6px", fontSize: "11px", color: "var(--text-secondary)" }}>
                        {proc.pid}
                      </span>
                    </td>
                    <td style={tdStyle}>{formatBps(proc.rxBps)}</td>
                    <td style={tdStyle}>{formatBps(proc.txBps)}</td>
                    <td style={{ ...tdStyle, padding: "4px 12px" }}>
                      <Sparkline samples={history.get(proc.pid)?.samples ?? []} />
                    </td>
                    <td style={tdStyle}>{formatBytes(proc.totalRxBytes)}</td>
                    <td style={tdStyle}>{formatBytes(proc.totalTxBytes)}</td>
                  </tr>
                  {isExpanded && <ExpandedRow key={`expanded-${proc.pid}`} pid={proc.pid} />}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
