import { useMemo, useState } from "react";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useSystemStore } from "../stores/useSystemStore";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { CpuWidget } from "../features/monitoring/CpuWidget";
import { MemoryWidget } from "../features/monitoring/MemoryWidget";
import { GpuWidget } from "../features/monitoring/GpuWidget";
import { DiskWidget } from "../features/monitoring/DiskWidget";
import { NetworkWidget } from "../features/monitoring/NetworkWidget";
import { RealtimeChart } from "../features/monitoring/RealtimeChart";
import { YourStorage } from "../features/disk/YourStorage";
import { GrowthView } from "../features/disk/GrowthView";
import { TopResourceConsumers } from "../features/process/TopResourceConsumers";
import { AlertBanner } from "../features/alerts/AlertBanner";
import { SystemEventBanner } from "../features/alerts/SystemEventBanner";
import { DiagnosisCard } from "../features/diagnosis/DiagnosisCard";
import { PageLoading } from "../components/PageLoading";
import { useI18n } from "../i18n/useI18n";
import { useUpdateStore } from "../stores/useUpdateStore";
import { useToast } from "../components/Toast";
import { SnapshotButton } from "../features/sessionSnapshot/SnapshotButton";
import { ExportReportDialog } from "../features/report/ExportReportDialog";
import { ProfileSelector } from "../features/profiles/ProfileSelector";
import { useProfileStore } from "../stores/useProfileStore";
import type { DashboardWidgetKey } from "@shared/types";
import { ProjectMonitorCard } from "../features/monitoring/ProjectMonitorCard";
import { useContainerWidth } from "../hooks/useContainerWidth";
import { isCompactWidth, RESPONSIVE_WIDTH } from "../hooks/useResponsiveLayout";

export function shouldUseDashboardSingleColumnLayout(width: number): boolean {
  return isCompactWidth(width, RESPONSIVE_WIDTH.dashboardSingleColumn);
}

export function DashboardPage() {
  const [containerRef, containerWidth] = useContainerWidth(1280);
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage);
  const current = useSystemStore((s) => s.current);
  const updateInfo = useUpdateStore((s) => s.updateInfo);
  const dismissedVersion = useUpdateStore((s) => s.dismissedVersion);
  const dismissCurrent = useUpdateStore((s) => s.dismissCurrent);
  const { tk } = useI18n();
  const showToast = useToast((s) => s.show);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const activeProfile = useProfileStore((s) => {
    const id = s.activeProfileId;
    return id ? s.profiles.find((p) => p.id === id) ?? null : null;
  });
  const hiddenWidgets = useMemo(() => new Set<DashboardWidgetKey>(activeProfile?.hiddenWidgets ?? []), [activeProfile?.hiddenWidgets]);
  const singleColumnLayout = shouldUseDashboardSingleColumnLayout(containerWidth);

  const visibleUpdate = updateInfo?.hasUpdate && dismissedVersion !== updateInfo.latestVersion ? updateInfo : null;

  if (!current) return <PageLoading message={tk("Collecting system information...")} />;

  return (
    <div data-testid="page-dashboard" ref={containerRef}>
      <div style={{ display: "grid", gap: "6px", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>
          {tk("Overview")}
        </h2>
      <div
        style={{
          fontSize: "13px",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
          }}
        >
          {tk(
            "Monitor live system usage, review alerts, and jump into storage or process details from one place.",
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ProfileSelector />
          <SnapshotButton />
          <button
            onClick={() => setReportDialogOpen(true)}
            style={{
              padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)",
              backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)",
              cursor: "pointer", fontSize: 12,
            }}
          >
            {tk("Export Report")}
          </button>
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "-4px" }}>
          {tk("Customize dashboard widgets with profiles")}
        </div>
      </div>

      <ExportReportDialog open={reportDialogOpen} onClose={() => setReportDialogOpen(false)} />

      {visibleUpdate ? (
        <div
          style={{
            display: "grid",
            gap: "10px",
            padding: "14px 16px",
            marginBottom: "16px",
            borderRadius: "var(--radius-lg)",
            border: "1px solid color-mix(in srgb, var(--accent-blue) 28%, var(--border))",
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--accent-blue) 10%, var(--bg-card)) 0%, var(--bg-card) 100%)",
          }}
        >
          <div style={{ display: "grid", gap: "4px" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
              {tk("A new version v{version} is available.", {
                version: visibleUpdate.latestVersion,
              })}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              {tk("Download the latest release from GitHub to update manually.")}
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              onClick={() => {
                void window.systemScope.openUpdateRelease(visibleUpdate.releaseUrl).then((res) => {
                  if (!res.ok) {
                    showToast(res.error?.message ?? tk("Unable to open the release download page."))
                  }
                })
              }}
              style={primaryButtonStyle}
            >
              {tk("Download")}
            </button>
            <button onClick={dismissCurrent} style={secondaryButtonStyle}>
              {tk("Dismiss")}
            </button>
            <button
              onClick={() => setCurrentPage("settings")}
              style={secondaryButtonStyle}
            >
              {tk("View Details")}
            </button>
          </div>
        </div>
      ) : null}
      <AlertBanner />
      <SystemEventBanner />

      {/* Top: Live system gauges */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "16px",
          marginBottom: "16px",
        }}
      >
        {!hiddenWidgets.has('cpu') && <ErrorBoundary title={tk("monitoring.cpu.title")}><CpuWidget /></ErrorBoundary>}
        {!hiddenWidgets.has('memory') && <ErrorBoundary title={tk("monitoring.memory.title")}><MemoryWidget /></ErrorBoundary>}
        {!hiddenWidgets.has('gpu') && <ErrorBoundary title={tk("monitoring.gpu.title")}><GpuWidget /></ErrorBoundary>}
        {!hiddenWidgets.has('disk') && <ErrorBoundary title={tk("monitoring.disk.title")}><DiskWidget /></ErrorBoundary>}
        {!hiddenWidgets.has('network') && <ErrorBoundary title={tk("monitoring.network.title")}><NetworkWidget /></ErrorBoundary>}
      </div>

      {/* Realtime trend */}
      <div style={{ marginBottom: "16px" }}>
        {!hiddenWidgets.has('realtimeChart') && <ErrorBoundary title={tk("monitoring.live_usage.title")}><RealtimeChart /></ErrorBoundary>}
      </div>

      {/* Diagnosis and workspace summary */}
      <ErrorBoundary title={tk("diagnosis.title")}><DiagnosisCard /></ErrorBoundary>
      <ErrorBoundary title={tk("devtools.section.project_monitor")}><ProjectMonitorCard compact /></ErrorBoundary>

      {/* Storage and growth analysis */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: singleColumnLayout
            ? "1fr"
            : "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "16px",
          marginBottom: "16px",
        }}
      >
        {!hiddenWidgets.has('storage') && <ErrorBoundary title={tk("disk.section.home_storage")}><YourStorage onFolderClick={() => setCurrentPage("disk")} /></ErrorBoundary>}
        {!hiddenWidgets.has('growth') && <ErrorBoundary title={tk("disk.section.storage_growth")}><GrowthView /></ErrorBoundary>}
      </div>

      {/* Process pressure */}
      <div>
        {!hiddenWidgets.has('topProcesses') && <ErrorBoundary title={tk("process.top_resources.title")}><TopResourceConsumers /></ErrorBoundary>}
      </div>
    </div>
  );
}

const primaryButtonStyle: React.CSSProperties = {
  padding: "7px 14px",
  fontSize: "12px",
  fontWeight: 700,
  border: "none",
  borderRadius: "var(--radius)",
  background: "var(--accent-blue)",
  color: "var(--text-on-accent)",
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "7px 14px",
  fontSize: "12px",
  fontWeight: 700,
  borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
  cursor: "pointer",
};
