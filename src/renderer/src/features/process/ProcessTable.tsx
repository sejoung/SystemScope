import { cellStyle, thStyle, searchStyle, infoBarStyle, infoLabelStyle, infoReasonStyle, killBtnStyle, killTreeBtnStyle, actionCellStyle, parentChipStyle, processNameStyle, processPidStyle, processMetricStackStyle, sectionStyle, headerStyle, titleRowStyle, titleStyle, badgeStyle, actionsStyle, metricCellStyle, cpuValueStyle, getCpuBadgeStyle } from './ProcessTable.styles'
import type { CpuUsageTone } from './ProcessTable.styles'
import { useState, useMemo, useCallback } from "react";
import { List, type RowComponentProps } from "react-window";
import type { ProcessInfo, ProcessKillResult } from "@shared/types";
import type { TranslateFn } from "@shared/i18n";
import { formatBytes } from "../../utils/format";
import { useToast } from "../../components/ui/Toast";
import { useI18n } from "../../i18n/useI18n";
import { StatusMessage } from "../../components/ui/StatusMessage";
import { CopyableValue } from "../../components/ui/CopyableValue";
import {
  CompactMetaItem,
  compactActionsStyle,
  compactCardHeaderStyle,
  compactCardStyle,
  compactListStyle,
  compactMetaGridStyle,
} from "../../components/ui/CompactPrimitives";
import { useContainerWidth } from "../../hooks/useContainerWidth";
import { isCompactWidth, RESPONSIVE_WIDTH } from "../../hooks/useResponsiveLayout";

type SortField = "cpu" | "memory" | "name" | "pid";
type SortDir = "asc" | "desc";

const ROW_HEIGHT = 56;
const LIST_HEIGHT = 520;
const COL_WIDTHS = { pid: "60px", name: "1fr", cpu: "100px", memory: "100px", action: "184px" };
const GRID_TEMPLATE = `${COL_WIDTHS.pid} ${COL_WIDTHS.name} ${COL_WIDTHS.cpu} ${COL_WIDTHS.memory} ${COL_WIDTHS.action}`;

export function shouldUseProcessTableCompactLayout(width: number): boolean {
  return isCompactWidth(width, RESPONSIVE_WIDTH.processTableCompact);
}

interface ProcessTableProps {
  processes: ProcessInfo[];
}

export function ProcessTable({ processes }: ProcessTableProps) {
  const showToast = useToast((s) => s.show);
  const { tk } = useI18n();
  const [search, setSearch] = useState("");
  // Exact-PID focus used by the "jump to parent" chip, so jumping to PID 123 doesn't
  // also surface 1234/5123 the way a substring text search would.
  const [focusPid, setFocusPid] = useState<number | null>(null);
  // PID currently being killed — used to disable the row's kill buttons so the
  // non-blocking native confirm dialog can't be queued twice.
  const [killingPid, setKillingPid] = useState<number | null>(null);
  const [sortField, setSortField] = useState<SortField>("cpu");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [containerRef, containerWidth] = useContainerWidth(720);
  const compactLayout = shouldUseProcessTableCompactLayout(containerWidth);

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

    if (focusPid !== null) {
      list = list.filter((p) => p.pid === focusPid);
    } else if (search.trim()) {
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
  }, [processes, search, focusPid, sortField, sortDir]);

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return "";
    return sortDir === "desc" ? " ▼" : " ▲";
  };

  const getAriaSort = (field: SortField): React.AriaAttributes["aria-sort"] => {
    if (sortField !== field) return "none";
    return sortDir === "desc" ? "descending" : "ascending";
  };

  const sortSummary = getProcessSortSummary(sortField, sortDir, tk);

  const handleKill = async (processInfo: ProcessInfo, tree: boolean) => {
    if (killingPid !== null) return;
    setKillingPid(processInfo.pid);
    try {
      const res = await window.systemScope.killProcess({
        pid: processInfo.pid,
        name: processInfo.name,
        command: processInfo.command,
        reason: "Activity > Processes",
        tree,
      });
      if (!res.ok) {
        showToast(res.error?.message ?? tk("process.table.kill_failed"));
        return;
      }

      const result = res.data as ProcessKillResult;
      if (result.cancelled) return;
      if (result.killed) {
        const descendants = result.killedPids.length - 1;
        showToast(
          descendants > 0
            ? tk("process.table.kill_tree_sent", {
                name: result.name,
                count: descendants,
              })
            : tk("process.table.kill_sent", { name: result.name, pid: result.pid }),
        );
      }
    } finally {
      setKillingPid(null);
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
            {p.ppid > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearch("");
                  setFocusPid(p.ppid);
                }}
                style={parentChipStyle}
                title={tk("process.table.jump_to_parent")}
              >
                {tk("process.table.parent_chip", {
                  name: p.parentName ?? `PID ${p.ppid}`,
                  pid: p.ppid,
                })}
              </button>
            )}
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
            <div style={actionCellStyle}>
              <button
                onClick={() => void handleKill(p, false)}
                disabled={killingPid !== null}
                style={killBtnStyle}
              >
                {tk("process.table.kill")}
              </button>
              {p.descendantCount > 0 && (
                <button
                  onClick={() => void handleKill(p, true)}
                  disabled={killingPid !== null}
                  style={killTreeBtnStyle}
                  title={tk("process.table.kill_tree")}
                >
                  {tk("process.table.kill_tree_with_count", {
                    count: p.descendantCount,
                  })}
                </button>
              )}
            </div>
          </div>
        </div>
      );
    },
    [filtered, tk, killingPid],
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
              onChange={(e) => {
                setFocusPid(null);
                setSearch(e.target.value);
              }}
              placeholder={tk("process.table.search_placeholder")}
              aria-label={tk("process.table.search_placeholder")}
              style={{ ...searchStyle, paddingRight: "30px" }}
            />
            {(search || focusPid !== null) && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setFocusPid(null);
                }}
                aria-label={tk("Clear search")}
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
        {!compactLayout ? (
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
        ) : null}

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
          compactLayout ? (
            <div style={compactListStyle}>
              {filtered.map((p) => (
                <div key={p.pid} style={compactCardStyle}>
                  <div style={compactCardHeaderStyle}>
                    <div style={{ display: "grid", gap: "4px", minWidth: 0 }}>
                      <div style={processNameStyle}>{p.name}</div>
                      <div style={processPidStyle}>PID {p.pid}</div>
                      {p.ppid > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSearch(String(p.ppid));
                          }}
                          style={parentChipStyle}
                          title={tk("process.table.jump_to_parent")}
                        >
                          {tk("process.table.parent_chip", {
                            name: p.parentName ?? `PID ${p.ppid}`,
                            pid: p.ppid,
                          })}
                        </button>
                      )}
                    </div>
                    <div style={processMetricStackStyle}>
                      <span style={cpuValueStyle}>{p.cpu.toFixed(1)}%</span>
                      <span style={getCpuBadgeStyle(getCpuUsageTone(p.cpu))}>
                        {getCpuUsageToneLabel(getCpuUsageTone(p.cpu), tk)}
                      </span>
                    </div>
                  </div>
                  {p.command && p.command !== p.name ? (
                    <CopyableValue
                      value={p.command}
                      fontSize="12px"
                      color="var(--text-muted)"
                      multiline
                    />
                  ) : null}
                  <div style={compactMetaGridStyle}>
                    <CompactMetaItem
                      label={tk("process.table.memory")}
                      value={formatBytes(p.memoryBytes)}
                      mono
                    />
                    <CompactMetaItem label="PID" value={String(p.pid)} mono />
                  </div>
                  <div
                    style={{
                      ...compactActionsStyle,
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      onClick={() => void handleKill(p, false)}
                      style={killBtnStyle}
                    >
                      {tk("process.table.kill")}
                    </button>
                    {p.descendantCount > 0 && (
                      <button
                        onClick={() => void handleKill(p, true)}
                        style={killTreeBtnStyle}
                        title={tk("process.table.kill_tree")}
                      >
                        {tk("process.table.kill_tree_with_count", {
                          count: p.descendantCount,
                        })}
                      </button>
                    )}
                  </div>
                </div>
              ))}
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
          )
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
  tk: TranslateFn,
) {
  if (sortField === "cpu") {
    return {
      label:
        sortDir === "desc"
          ? tk("Sorted by CPU usage, highest first")
          : tk("Sorted by CPU usage, lowest first"),
      reason: tk(
        "Default order starts with CPU-heavy processes so sudden load is easier to spot.",
      ),
    };
  }

  if (sortField === "memory") {
    return {
      label:
        sortDir === "desc"
          ? tk("Sorted by memory usage, highest first")
          : tk("Sorted by memory usage, lowest first"),
      reason: tk(
        "Memory sort helps compare which processes occupy the most space right now.",
      ),
    };
  }

  if (sortField === "pid") {
    return {
      label:
        sortDir === "desc"
          ? tk("Sorted by PID, highest first")
          : tk("Sorted by PID, lowest first"),
      reason: tk(
        "PID order is useful when you already know the target process number.",
      ),
    };
  }

  return {
    label:
      sortDir === "desc"
        ? tk("Sorted by name, Z to A")
        : tk("Sorted by name, A to Z"),
    reason: tk(
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
