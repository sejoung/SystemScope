import { useCallback, useMemo, useState } from 'react'
import type { RowComponentProps } from 'react-window'
import type { ProcessInfo, ProcessKillResult } from '@shared/types'
import { formatBytes } from '../../utils/format'
import { useToast } from '../../components/ui/Toast'
import { useI18n } from '../../i18n/useI18n'
import { CopyableValue } from '../../components/ui/CopyableValue'
import { useContainerWidth } from '../../hooks/useContainerWidth'
import { isCompactWidth, RESPONSIVE_WIDTH } from '../../hooks/useResponsiveLayout'
import { actionCellStyle, cellStyle, cpuValueStyle, getCpuBadgeStyle, killBtnStyle, killTreeBtnStyle, metricCellStyle, parentChipStyle } from './ProcessTable.styles'
import { getCpuUsageTone, getCpuUsageToneLabel, getProcessSortSummary, type SortDir, type SortField } from './processTableSort'

const ROW_HEIGHT = 56
const LIST_HEIGHT = 520
const GRID_TEMPLATE = '60px 1fr 100px 100px 184px'
export function shouldUseProcessTableCompactLayout(width: number): boolean { return isCompactWidth(width, RESPONSIVE_WIDTH.processTableCompact) }

export function useProcessTableModel(processes: ProcessInfo[]) {
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


  return { tk, search, setSearch, focusPid, setFocusPid, sortField, sortDir, containerRef, containerWidth, compactLayout, handleSort, filtered, sortIcon, getAriaSort, sortSummary, handleKill, Row, listHeight }
}
