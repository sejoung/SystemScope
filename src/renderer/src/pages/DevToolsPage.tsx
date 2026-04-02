import { ErrorBoundary } from "../components/ErrorBoundary";
import { DevToolsSection } from "../features/devtools/DevToolsSection";
import { PortConflictCenterCard } from "../features/devtools/PortConflictCenterCard";
import { ProjectMonitorCard } from "../features/monitoring/ProjectMonitorCard";
import { useI18n } from "../i18n/useI18n";

export function DevToolsPage() {
  const { t } = useI18n();

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
              "Review development toolchain cleanup opportunities, workspace growth, and port conflicts from one place.",
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        <ErrorBoundary title={t("Port Conflict Center")}>
          <PortConflictCenterCard />
        </ErrorBoundary>
        <ErrorBoundary title={t("Project Monitor")}>
          <ProjectMonitorCard />
        </ErrorBoundary>
        <ErrorBoundary title={t("Developer Tools")}>
          <DevToolsSection />
        </ErrorBoundary>
      </div>
    </div>
  );
}
