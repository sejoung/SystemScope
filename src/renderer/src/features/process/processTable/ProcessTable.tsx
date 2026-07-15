import { thStyle, searchStyle, infoBarStyle, infoLabelStyle, infoReasonStyle, killBtnStyle, killTreeBtnStyle, parentChipStyle, processNameStyle, processPidStyle, processMetricStackStyle, sectionStyle, headerStyle, titleRowStyle, titleStyle, badgeStyle, actionsStyle, cpuValueStyle, getCpuBadgeStyle } from './ProcessTable.styles'
import { List } from "react-window";
import type { ProcessInfo } from "@shared/types";
import { formatBytes } from "../../../utils/format";
import { StatusMessage } from "../../../components/ui/StatusMessage";
import { CopyableValue } from "../../../components/ui/CopyableValue";
import {
  CompactMetaItem,
  compactActionsStyle,
  compactCardHeaderStyle,
  compactCardStyle,
  compactListStyle,
  compactMetaGridStyle,
} from "../../../components/ui/CompactPrimitives";

const ROW_HEIGHT = 56;
const COL_WIDTHS = { pid: "60px", name: "1fr", cpu: "100px", memory: "100px", action: "184px" };
const GRID_TEMPLATE = `${COL_WIDTHS.pid} ${COL_WIDTHS.name} ${COL_WIDTHS.cpu} ${COL_WIDTHS.memory} ${COL_WIDTHS.action}`;

export { shouldUseProcessTableCompactLayout } from "./useProcessTableModel";
import { useProcessTableModel } from "./useProcessTableModel";
import { SortHeader, getCpuUsageTone, getCpuUsageToneLabel } from "./processTableSort";
export { getCpuUsageTone, getCpuUsageToneLabel, getProcessSortSummary } from "./processTableSort";

interface ProcessTableProps {
  processes: ProcessInfo[];
}

export function ProcessTable({ processes }: ProcessTableProps) {
  const { tk, search, setSearch, focusPid, setFocusPid, sortField, containerRef, containerWidth, compactLayout, handleSort, filtered, sortIcon, getAriaSort, sortSummary, handleKill, Row, listHeight } = useProcessTableModel(processes)

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
