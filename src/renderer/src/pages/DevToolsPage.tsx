import { useState } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { PageTab } from "../components/PageTab";
import { AIUsageSection } from "../features/devtools/AIUsageSection";
import { DevToolsOverviewSection } from "../features/devtools/DevToolsOverviewSection";
import { DevToolsSection } from "../features/devtools/DevToolsSection";
import { PortConflictCenterCard } from "../features/devtools/PortConflictCenterCard";
import { ProjectMonitorCard } from "../features/monitoring/ProjectMonitorCard";
import { useI18n } from "../i18n/useI18n";

type DevToolsTab = "overview" | "workspaces" | "ports" | "cleanup" | "ai-usage";

export function DevToolsPage() {
  const { t } = useI18n();
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
            {t("DevTools")}
          </h2>
          <div
            style={{
              fontSize: "13px",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            {t(
              "Review development toolchain cleanup opportunities, workspace growth, port conflicts, and AI usage from one place.",
            )}
          </div>
        </div>
        <div
          role="tablist"
          aria-label={t("DevTools")}
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
            {t("Overview")}
          </PageTab>
          <PageTab
            id="devtools-workspaces"
            active={tab === "workspaces"}
            onClick={() => setTab("workspaces")}
          >
            {t("Workspaces")}
          </PageTab>
          <PageTab
            id="devtools-ports"
            active={tab === "ports"}
            onClick={() => setTab("ports")}
          >
            {t("Ports")}
          </PageTab>
          <PageTab
            id="devtools-cleanup"
            active={tab === "cleanup"}
            onClick={() => setTab("cleanup")}
          >
            {t("Cleanup")}
          </PageTab>
          <PageTab
            id="devtools-ai-usage"
            active={tab === "ai-usage"}
            onClick={() => setTab("ai-usage")}
          >
            {t("AI Usage")}
          </PageTab>
        </div>
      </div>

      {tab === "overview" && (
        <div style={{ display: "grid", gap: 16, paddingBottom: 12 }}>
          <ErrorBoundary title={t("Developer Environment")}>
            <DevToolsOverviewSection sections={["health", "servers"]} compact />
          </ErrorBoundary>
          <ErrorBoundary title={t("Project Monitor")}>
            <ProjectMonitorCard compact />
          </ErrorBoundary>
        </div>
      )}

      {tab === "workspaces" && (
        <div style={{ display: "grid", gap: 16 }}>
          <ErrorBoundary title={t("Workspace Git Insights")}>
            <DevToolsOverviewSection sections={["workspaces"]} />
          </ErrorBoundary>
          <ErrorBoundary title={t("Project Monitor")}>
            <ProjectMonitorCard />
          </ErrorBoundary>
        </div>
      )}

      {tab === "ports" && (
        <div style={{ display: "grid", gap: 16 }}>
          <ErrorBoundary title={t("Port Conflict Center")}>
            <PortConflictCenterCard />
          </ErrorBoundary>
          <ErrorBoundary title={t("Dev Servers")}>
            <DevToolsOverviewSection sections={["servers"]} />
          </ErrorBoundary>
        </div>
      )}

      {tab === "cleanup" && (
        <div style={{ display: "grid", gap: 16 }}>
          <ErrorBoundary title={t("Developer Tools")}>
            <DevToolsSection />
          </ErrorBoundary>
        </div>
      )}

      {tab === "ai-usage" && (
        <div style={{ display: "grid", gap: 16 }}>
          <ErrorBoundary title={t("AI Usage")}>
            <AIUsageSection />
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}
