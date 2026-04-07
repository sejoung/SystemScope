import { useState } from "react";
import { useProcessStore } from "../stores/useProcessStore";
import { ProcessTable } from "../features/process/ProcessTable";
import { ListeningPorts } from "../features/process/ListeningPorts";
import { ProcessNetworkPanel } from "../features/process/ProcessNetworkPanel";
import { PortWatch } from "../features/process/PortWatch";
import { PageLoading } from "../components/PageLoading";
import { PageTab } from "../components/PageTab";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useI18n } from "../i18n/useI18n";
import { StartupItemList } from "../features/startup/StartupItemList";

type ActivityTab = "processes" | "ports" | "network" | "watch" | "startup";

export function ProcessPage() {
  const allProcesses = useProcessStore((s) => s.allProcesses);
  const allProcessesLoaded = useProcessStore((s) => s.allProcessesLoaded);
  const [tab, setTab] = useState<ActivityTab>("processes");
  const { tk } = useI18n();

  if (tab === "processes" && !allProcessesLoaded) {
    return (
      <PageLoading
        message={tk("Loading process data...")}
        detail={tk(
          "Currently inspect active network ports and the processes holding them.",
        )}
      />
    );
  }

  return (
    <div data-testid="page-process">
      <div
        style={{
          display: "grid",
          gap: "10px",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "grid", gap: "6px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>
            {tk("process.page.title")}
          </h2>
          <div
            style={{
              fontSize: "13px",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            {tk(
              "Search active processes, inspect ports, and watch specific connections over time.",
            )}
          </div>
        </div>
        <div
          role="tablist"
          aria-label={tk("process.page.title")}
          style={{
            display: "flex",
            gap: "4px",
            background: "var(--bg-secondary)",
            borderRadius: "8px",
            padding: "3px",
            flexWrap: "wrap",
          }}
        >
          <PageTab
            id="activity-processes"
            active={tab === "processes"}
            onClick={() => setTab("processes")}
          >
            {tk("process.tab.processes")}
          </PageTab>
          <PageTab
            id="activity-ports"
            active={tab === "ports"}
            onClick={() => setTab("ports")}
          >
            {tk("process.tab.ports")}
          </PageTab>
          <PageTab
            id="activity-network"
            active={tab === "network"}
            onClick={() => setTab("network")}
          >
            {tk("process.tab.network")}
          </PageTab>
          <PageTab
            id="activity-watch"
            active={tab === "watch"}
            onClick={() => setTab("watch")}
          >
            {tk("process.tab.watch")}
          </PageTab>
          <PageTab
            id="activity-startup"
            active={tab === "startup"}
            onClick={() => setTab("startup")}
          >
            {tk("Startup")}
          </PageTab>
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            lineHeight: 1.6,
          }}
        >
          {tab === "startup"
            ? tk("Manage startup programs that run when you log in.")
            : tab === "processes"
            ? tk("process.page.tab.processes_help")
            : tab === "ports"
              ? tk(
                  "Review every listening port on this system, identify exposed bindings quickly, and terminate the owning process when needed.",
                )
              : tab === "network"
                ? tk("process.page.tab.network_help")
                : tk("process.page.tab.watch_help")}
        </div>
      </div>

      {tab === "processes" && <ErrorBoundary title={tk("process.tab.processes")}><ProcessTable processes={allProcesses} /></ErrorBoundary>}
      {tab === "ports" && <ErrorBoundary title={tk("process.tab.ports")}><ListeningPorts showConflictCenter={false} /></ErrorBoundary>}
      {tab === "network" && <ErrorBoundary title={tk("process.tab.network")}><ProcessNetworkPanel /></ErrorBoundary>}
      {tab === "watch" && <ErrorBoundary title={tk("process.tab.watch")}><PortWatch /></ErrorBoundary>}
      {tab === "startup" && <ErrorBoundary title={tk("process.tab.startup")}><StartupItemList /></ErrorBoundary>}
    </div>
  );
}
