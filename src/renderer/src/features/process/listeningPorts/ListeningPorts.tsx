import { searchStyle, segmentedControlStyle, infoBarStyle, summaryGridStyle, infoLabelStyle, infoReasonStyle, btnStyle, sectionStyle, headerStyle, titleRowStyle, titleStyle, badgeStyle, actionsStyle } from './ListeningPorts.styles'
import type React from "react";
import { StatusMessage } from "../../../components/ui/StatusMessage";
import { AsyncTaskStatus } from "../../../components/ui/AsyncTaskStatus";
import { FilterBtn, PortConflictCenterPanel, SummaryCard } from './ListeningPortPanels'
export { dedupeListeningPorts, dedupePassivePorts, filterPortsBySearch, filterPortsByState, formatEndpoint, getDisplayedPorts, getPortConflicts, normalizePortState, sortPortsForDisplay } from './listeningPortUtils'
export { PortConflictCenterPanel } from './ListeningPortPanels'

interface ListeningPortsProps {
  showConflictCenter?: boolean;
}

export { shouldUseListeningPortsCompactLayout } from "./useListeningPortsModel";
import { useListeningPortsModel } from "./useListeningPortsModel";
import { ListeningPortRows } from './ListeningPortRows'

export function ListeningPorts({ showConflictCenter = true }: ListeningPortsProps = {}) {
  const { tk, containerRef, loading, scanned, error, requestState, stateFilter, search, searchScope, setStateFilter, setSearch, setSearchScope, fetchPorts, compactLayout, orderedSearchFiltered, displayRows, listenCount, establishedCount, otherCount, portConflicts, localhostListenCount, exposedListenCount, uniqueProcessCount, handleKill } = useListeningPortsModel()

  return (
    <section style={sectionStyle} ref={containerRef}>
      <div style={headerStyle}>
        <div style={titleRowStyle}>
          <span style={titleStyle}>{tk("process.port_finder.title")}</span>
          {scanned && (
            <span style={badgeStyle}>
              {tk("Listening {count}", { count: listenCount })}
            </span>
          )}
        </div>
        <div style={{ ...actionsStyle, width: "100%" }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={segmentedControlStyle}
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
                  ? tk("Process")
                  : s === "local"
                    ? tk("Local")
                    : s === "remote"
                      ? tk("Remote")
                      : tk("All")}
              </button>
            ))}
          </div>
          <div style={{ position: "relative", display: "inline-flex", alignItems: "center", flex: compactLayout ? "1 1 100%" : undefined }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder={
                searchScope === "process"
                  ? tk("Search by process name or PID")
                  : searchScope === "local"
                  ? tk("process.port_finder.search_local")
                  : searchScope === "remote"
                    ? tk("process.port_finder.search_remote")
                    : tk("process.port_finder.search_all")
              }
              aria-label={tk("process.port_finder.title")}
              style={{ ...searchStyle, paddingRight: "30px", width: compactLayout ? "100%" : searchStyle.width }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
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
          <button
            type="button"
            onClick={() => fetchPorts()}
            disabled={loading}
            style={btnStyle}
          >
            {loading
              ? tk("Scanning...")
              : scanned
                ? tk("apps.action.refresh")
                : tk("process.port_finder.scan")}
          </button>
        </div>
      </div>
      {!scanned && requestState !== "started" ? (
        <StatusMessage
          message={tk(
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
                message={tk(
                  "Listening port scan started. Collecting listeners and active socket information now.",
                )}
              />
            ) : requestState === "failed" && error ? (
              <AsyncTaskStatus
                stage="failed"
                taskLabel={tk("process.port_finder.title")}
                message={tk(error)}
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
                message={tk(
                  "Listening port scan completed. Review exposed bindings first, then inspect or kill the owning process.",
                )}
              />
            ) : (
              <StatusMessage
                message={tk(
                  "Use the listening filter to focus on open ports, then expand your search to process, local, or remote values.",
                )}
              />
            )}
          </div>
          <div style={summaryGridStyle}>
            <SummaryCard
              label={tk("Listening Ports")}
              value={listenCount}
              tone="var(--accent-cyan)"
              note={tk("Ports currently accepting inbound connections")}
            />
            <SummaryCard
              label={tk("Exposed Bindings")}
              value={exposedListenCount}
              tone="var(--accent-red)"
              note={tk("Listening on non-loopback addresses")}
            />
            <SummaryCard
              label={tk("Localhost Only")}
              value={localhostListenCount}
              tone="var(--accent-green)"
              note={tk("Bound only to 127.0.0.1, ::1, or localhost")}
            />
            <SummaryCard
              label={tk("Owning Processes")}
              value={uniqueProcessCount}
              tone="var(--accent-yellow)"
              note={tk("Unique PIDs currently holding listening ports")}
            />
          </div>
          {showConflictCenter ? (
            <PortConflictCenterPanel
              conflicts={portConflicts}
              onKill={handleKill}
              onInspectPort={(port) => {
                setSearch(String(port));
                setSearchScope("local");
                setStateFilter("LISTEN");
              }}
              tk={tk}
            />
          ) : null}
          <div style={infoBarStyle}>
            <span style={infoLabelStyle}>
              {tk("Listening ports are prioritized first, then sorted by local port")}
            </span>
            <span style={infoReasonStyle}>
              {tk(
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
              {tk("All ({count})", {
                count: orderedSearchFiltered.length,
              })}
            </FilterBtn>
            <FilterBtn
              active={stateFilter === "LISTEN"}
              onClick={() => setStateFilter("LISTEN")}
            >
              {tk("Listening ({count})", { count: listenCount })}
            </FilterBtn>
            <FilterBtn
              active={stateFilter === "ESTABLISHED"}
              onClick={() => setStateFilter("ESTABLISHED")}
            >
              {tk("Established ({count})", { count: establishedCount })}
            </FilterBtn>
            <FilterBtn
              active={stateFilter === "other"}
              onClick={() => setStateFilter("other")}
            >
              {tk("Other ({count})", { count: otherCount })}
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
            <ListeningPortRows compactLayout={compactLayout} displayRows={displayRows} handleKill={handleKill} tk={tk} />
          )}
        </div>
      )}
    </section>
  );
}
