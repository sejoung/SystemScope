import { useState, useMemo, useCallback } from "react";
import { List, type RowComponentProps } from "react-window";
import type { ProcessInfo, ProcessKillResult } from "@shared/types";
import { formatBytes } from "../../utils/format";
import { useToast } from "../../components/Toast";
import { useI18n } from "../../i18n/useI18n";
import { StatusMessage } from "../../components/StatusMessage";
import { CopyableValue } from "../../components/CopyableValue";
import { useContainerWidth } from "../../hooks/useContainerWidth";

type SortField = "cpu" | "memory" | "name" | "pid";
type SortDir = "asc" | "desc";

type CpuUsageTone = "high" | "medium" | "normal";

const ROW_HEIGHT = 56;
const LIST_HEIGHT = 520;
const COL_WIDTHS = { pid: "60px", name: "1fr", cpu: "100px", memory: "100px", action: "92px" };
const GRID_TEMPLATE = `${COL_WIDTHS.pid} ${COL_WIDTHS.name} ${COL_WIDTHS.cpu} ${COL_WIDTHS.memory} ${COL_WIDTHS.action}`;

interface ProcessTableProps {
  processes: ProcessInfo[];
}

export function ProcessTable({ processes }: ProcessTableProps) {
  const showToast = useToast((s) => s.show);
  const { tk, t } = useI18n();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("cpu");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [containerRef, containerWidth] = useContainerWidth(720);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir(field === "name" ? "asc" : "desc");
    }
  };

  const filtered = useMemo(() => {
    let list = processes;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.pid.toString().includes(q) ||
          p.command.toLowerCase().includes(q),
      );
    }

    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "cpu":
          cmp = a.cpu - b.cpu;
          break;
        case "memory":
          cmp = a.memoryBytes - b.memoryBytes;
          break;
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "pid":
          cmp = a.pid - b.pid;
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return list;
  }, [processes, search, sortField, sortDir]);

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return "";
    return sortDir === "desc" ? " ▼" : " ▲";
  };

  const getAriaSort = (field: SortField): React.AriaAttributes["aria-sort"] => {
    if (sortField !== field) return "none";
    return sortDir === "desc" ? "descending" : "ascending";
  };

  const sortSummary = getProcessSortSummary(sortField, sortDir, t);

  const handleKill = async (processInfo: ProcessInfo) => {
    const res = await window.systemScope.killProcess({
      pid: processInfo.pid,
      name: processInfo.name,
      command: processInfo.command,
      reason: "Activity > Processes",
    });
    if (!res.ok) {
      showToast(res.error?.message ?? tk("process.table.kill_failed"));
      return;
    }

    const result = res.data as ProcessKillResult;
    if (result.cancelled) return;
    if (result.killed) {
      showToast(
        tk("process.table.kill_sent", { name: result.name, pid: result.pid }),
      );
    }
  };

  const Row = useCallback(
    ({ index, style }: RowComponentProps) => {
      const p = filtered[index];
      return (
        <div
          style={{
            ...style,
            display: "grid",
            gridTemplateColumns: GRID_TEMPLATE,
            alignItems: "center",
            borderBottom: "1px solid var(--border)",
            minWidth: "720px",
          }}
        >
          <div
            style={{
              ...cellStyle,
              color: "var(--text-muted)",
              fontFamily: "monospace",
              fontSize: "13px",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {p.pid}
          </div>
          <div
            style={{
              ...cellStyle,
              fontWeight: 500,
              color: "var(--text-primary)",
              overflow: "hidden",
            }}
          >
            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.name}
            </div>
            {p.command && p.command !== p.name && (
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  marginTop: "2px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "360px",
                }}
              >
                <CopyableValue
                  value={p.command}
                  fontSize="12px"
                  color="var(--text-muted)"
                  maxWidth="360px"
                />
              </div>
            )}
          </div>
          <div
            style={{
              ...cellStyle,
              textAlign: "right",
              fontFamily: "monospace",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <div style={metricCellStyle}>
              <span style={cpuValueStyle}>{p.cpu.toFixed(1)}%</span>
              <span style={getCpuBadgeStyle(getCpuUsageTone(p.cpu))}>
                {getCpuUsageToneLabel(getCpuUsageTone(p.cpu), tk)}
              </span>
            </div>
          </div>
          <div
            style={{
              ...cellStyle,
              textAlign: "right",
              fontFamily: "monospace",
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {formatBytes(p.memoryBytes)}
          </div>
          <div style={{ ...cellStyle, textAlign: "center" }}>
            <button
              onClick={() => void handleKill(p)}
              style={killBtnStyle}
            >
              {tk("process.table.kill")}
            </button>
          </div>
        </div>
      );
    },
    [filtered, tk],
  );

  const listHeight = Math.min(LIST_HEIGHT, filtered.length * ROW_HEIGHT);

  return (
    <section style={sectionStyle}>
      <div style={headerStyle}>
        <div style={titleRowStyle}>
          <span style={titleStyle}>
            {tk("process.table.title", { count: filtered.length })}
          </span>
          {processes.length > 0 && (
            <span style={badgeStyle}>{processes.length}</span>
          )}
        </div>
        <div style={actionsStyle}>
          <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tk("process.table.search_placeholder")}
              aria-label={tk("process.table.search_placeholder")}
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
        </div>
      </div>
      <div style={{ marginBottom: "12px" }}>
        <StatusMessage message={tk("process.table.helper")} />
      </div>
      <div style={infoBarStyle}>
        <span style={infoLabelStyle}>{sortSummary.label}</span>
        <span style={infoReasonStyle}>{sortSummary.reason}</span>
      </div>

      <div ref={containerRef} style={{ overflowX: "auto" }}>
        {/* Header */}
        <div
          role="row"
          style={{
            display: "grid",
            gridTemplateColumns: GRID_TEMPLATE,
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-card)",
            position: "sticky",
            top: 0,
            zIndex: 1,
            minWidth: "720px",
          }}
        >
          <SortHeader field="pid" current={sortField} onClick={handleSort} ariaSort={getAriaSort("pid")} align="left">
            PID{sortIcon("pid")}
          </SortHeader>
          <SortHeader field="name" current={sortField} onClick={handleSort} ariaSort={getAriaSort("name")} align="left">
            {tk("process.table.name")}{sortIcon("name")}
          </SortHeader>
          <SortHeader field="cpu" current={sortField} onClick={handleSort} ariaSort={getAriaSort("cpu")} align="right">
            CPU %{sortIcon("cpu")}
          </SortHeader>
          <SortHeader field="memory" current={sortField} onClick={handleSort} ariaSort={getAriaSort("memory")} align="right">
            {tk("process.table.memory")}{sortIcon("memory")}
          </SortHeader>
          <div style={{ ...thStyle, textAlign: "center" }}>
            {tk("process.table.action")}
          </div>
        </div>

        {/* Virtualized rows */}
        {filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "var(--text-muted)",
              padding: "20px",
              fontSize: "13px",
            }}
          >
            {search
              ? tk("process.table.empty_search", { query: search })
              : tk("process.table.empty")}
          </div>
        ) : (
          <List
            rowComponent={Row}
            rowCount={filtered.length}
            rowHeight={ROW_HEIGHT}
            rowProps={{}}
            overscanCount={10}
            style={{ height: listHeight, width: Math.max(containerWidth, 720) }}
          />
        )}
      </div>
    </section>
  );
}

export function getCpuUsageTone(cpu: number): CpuUsageTone {
  if (cpu > 80) return "high";
  if (cpu > 30) return "medium";
  return "normal";
}

export function getCpuUsageToneLabel(
  tone: CpuUsageTone,
  tk: (
    key:
      | "process.table.cpu_high"
      | "process.table.cpu_medium"
      | "process.table.cpu_normal",
    params?: Record<string, string | number>,
  ) => string,
) {
  switch (tone) {
    case "high":
      return tk("process.table.cpu_high");
    case "medium":
      return tk("process.table.cpu_medium");
    default:
      return tk("process.table.cpu_normal");
  }
}

function getProcessSortSummary(
  sortField: SortField,
  sortDir: SortDir,
  t: (text: string, params?: Record<string, string | number>) => string,
) {
  if (sortField === "cpu") {
    return {
      label:
        sortDir === "desc"
          ? t("Sorted by CPU usage, highest first")
          : t("Sorted by CPU usage, lowest first"),
      reason: t(
        "Default order starts with CPU-heavy processes so sudden load is easier to spot.",
      ),
    };
  }

  if (sortField === "memory") {
    return {
      label:
        sortDir === "desc"
          ? t("Sorted by memory usage, highest first")
          : t("Sorted by memory usage, lowest first"),
      reason: t(
        "Memory sort helps compare which processes occupy the most space right now.",
      ),
    };
  }

  if (sortField === "pid") {
    return {
      label:
        sortDir === "desc"
          ? t("Sorted by PID, highest first")
          : t("Sorted by PID, lowest first"),
      reason: t(
        "PID order is useful when you already know the target process number.",
      ),
    };
  }

  return {
    label:
      sortDir === "desc"
        ? t("Sorted by name, Z to A")
        : t("Sorted by name, A to Z"),
    reason: t(
      "Name order is useful when you already know the process name you want to inspect.",
    ),
  };
}

function SortHeader({
  field,
  current,
  onClick,
  ariaSort,
  align,
  children,
}: {
  field: SortField;
  current: SortField;
  onClick: (field: SortField) => void;
  ariaSort: React.AriaAttributes["aria-sort"];
  align?: string;
  children: React.ReactNode;
}) {
  const isActive = current === field;
  return (
    <div
      role="columnheader"
      aria-sort={ariaSort}
      style={{
        ...thStyle,
        textAlign: (align as React.CSSProperties["textAlign"]) ?? "left",
        cursor: "pointer",
        color: isActive ? "var(--text-primary)" : "var(--text-muted)",
        userSelect: "none",
      }}
    >
      <button
        type="button"
        onClick={() => onClick(field)}
        style={{
          border: "none",
          background: "transparent",
          color: "inherit",
          cursor: "pointer",
          font: "inherit",
          padding: 0,
          width: "100%",
          textAlign: (align as React.CSSProperties["textAlign"]) ?? "left",
        }}
      >
        {children}
      </button>
    </div>
  );
}

// ─── Styles ───

const cellStyle: React.CSSProperties = {
  padding: "8px 8px",
  color: "var(--text-secondary)",
  fontSize: "14px",
  lineHeight: 1.4,
};

const thStyle: React.CSSProperties = {
  padding: "12px 8px",
  fontWeight: 600,
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const searchStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: "13px",
  width: "240px",
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
  background: "var(--bg-card-hover)",
  color: "var(--text-secondary)",
  whiteSpace: "nowrap",
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  flexShrink: 0,
};

const metricCellStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "8px",
  flexWrap: "wrap",
};

const cpuValueStyle: React.CSSProperties = {
  color: "var(--text-primary)",
  fontWeight: 600,
};

function getCpuBadgeStyle(tone: CpuUsageTone): React.CSSProperties {
  if (tone === "high") {
    return {
      ...cpuBadgeBaseStyle,
      color: "var(--accent-red)",
      background: "var(--alert-red-soft)",
      borderColor: "var(--alert-red-border)",
    };
  }

  if (tone === "medium") {
    return {
      ...cpuBadgeBaseStyle,
      color: "var(--accent-yellow)",
      background: "var(--alert-yellow-soft)",
      borderColor: "var(--alert-yellow-border)",
    };
  }

  return {
    ...cpuBadgeBaseStyle,
    color: "var(--accent-green)",
    background: "var(--success-soft)",
    borderColor: "color-mix(in srgb, var(--accent-green) 24%, transparent)",
  };
}

const cpuBadgeBaseStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "72px",
  padding: "3px 8px",
  borderRadius: "999px",
  border: "1px solid transparent",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};
