import { useState } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { PageTab } from "../components/PageTab";
import { DevToolsOverviewSection } from "../features/devtools/DevToolsOverviewSection";
import { DevToolsSection } from "../features/devtools/DevToolsSection";
import { PortConflictCenterCard } from "../features/devtools/PortConflictCenterCard";
import { ProjectMonitorCard } from "../features/monitoring/ProjectMonitorCard";
import { useI18n } from "../i18n/useI18n";

type DevToolsTab = "overview" | "workspaces" | "ports" | "cleanup";

export function DevToolsPage() {
  const { tk } = useI18n();
  const [tab, setTab] = useState<DevToolsTab>("overview");

  return (
    <div data-testid="page-devtools">
      <div
        style={{
          display: "grid",
          gap: "10px",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "grid", gap: "6px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>
            {tk("DevTools")}
          </h2>
          <div
            style={{
              fontSize: "13px",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            {tk(
              "Review development toolchain cleanup opportunities, workspace growth, Docker runtime status, and port conflicts from one place.",
            )}
          </div>
        </div>
        <div
          role="tablist"
          aria-label={tk("DevTools")}
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
            id="devtools-overview"
            active={tab === "overview"}
            onClick={() => setTab("overview")}
          >
            {tk("Overview")}
          </PageTab>
          <PageTab
            id="devtools-workspaces"
            active={tab === "workspaces"}
            onClick={() => setTab("workspaces")}
          >
            {tk("Workspaces")}
          </PageTab>
          <PageTab
            id="devtools-ports"
            active={tab === "ports"}
            onClick={() => setTab("ports")}
          >
            {tk("Ports")}
          </PageTab>
          <PageTab
            id="devtools-cleanup"
            active={tab === "cleanup"}
            onClick={() => setTab("cleanup")}
          >
            {tk("Cleanup")}
          </PageTab>
        </div>
      </div>

      {tab === "overview" && (
        <div style={{ display: "grid", gap: 16, paddingBottom: 12 }}>
          <ErrorBoundary title={tk("Developer Environment")}>
            <DevToolsOverviewSection sections={["health", "docker", "servers"]} compact />
          </ErrorBoundary>
          <ErrorBoundary title={tk("Project Monitor")}>
            <ProjectMonitorCard compact />
          </ErrorBoundary>
        </div>
      )}

      {tab === "workspaces" && (
        <div style={{ display: "grid", gap: 16 }}>
          <ErrorBoundary title={tk("Workspace Git Insights")}>
            <DevToolsOverviewSection sections={["workspaces"]} />
          </ErrorBoundary>
          <ErrorBoundary title={tk("Project Monitor")}>
            <ProjectMonitorCard />
          </ErrorBoundary>
        </div>
      )}

      {tab === "ports" && (
        <div style={{ display: "grid", gap: 16 }}>
          <ErrorBoundary title={tk("Port Conflict Center")}>
            <PortConflictCenterCard />
          </ErrorBoundary>
          <ErrorBoundary title={tk("Dev Servers")}>
            <DevToolsOverviewSection sections={["servers"]} />
          </ErrorBoundary>
        </div>
      )}

      {tab === "cleanup" && (
        <div style={{ display: "grid", gap: 16 }}>
          <ErrorBoundary title={tk("Developer Tools")}>
            <DevToolsSection />
          </ErrorBoundary>
        </div>
      )}

    </div>
  );
}
