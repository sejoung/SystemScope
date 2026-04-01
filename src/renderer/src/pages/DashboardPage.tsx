import { useState } from "react";
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
import { DiagnosisCard } from "../features/diagnosis/DiagnosisCard";
import { PageLoading } from "../components/PageLoading";
import { useI18n } from "../i18n/useI18n";
import { useUpdateStore } from "../stores/useUpdateStore";
import { useToast } from "../components/Toast";
import { SnapshotButton } from "../features/sessionSnapshot/SnapshotButton";
import { ExportReportDialog } from "../features/report/ExportReportDialog";

export function DashboardPage() {
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage);
  const current = useSystemStore((s) => s.current);
  const updateInfo = useUpdateStore((s) => s.updateInfo);
  const dismissedVersion = useUpdateStore((s) => s.dismissedVersion);
  const dismissCurrent = useUpdateStore((s) => s.dismissCurrent);
  const { t } = useI18n();
  const showToast = useToast((s) => s.show);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  const visibleUpdate = updateInfo?.hasUpdate && dismissedVersion !== updateInfo.latestVersion ? updateInfo : null;

  if (!current) return <PageLoading message={t("Collecting system information...")} />;

  return (
    <div data-testid="page-dashboard">
      <div style={{ display: "grid", gap: "6px", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>
          {t("Overview")}
        </h2>
      <div
        style={{
          fontSize: "13px",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
          }}
        >
          {t(
            "Monitor live system usage, review alerts, and jump into storage or process details from one place.",
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <SnapshotButton />
          <button
            onClick={() => setReportDialogOpen(true)}
            style={{
              padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)",
              backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)",
              cursor: "pointer", fontSize: 12,
            }}
          >
            {t("Export Report")}
          </button>
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
              {t("A new version v{version} is available.", {
                version: visibleUpdate.latestVersion,
              })}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              {t("Download the latest release from GitHub to update manually.")}
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              onClick={() => {
                void window.systemScope.openUpdateRelease(visibleUpdate.releaseUrl).then((res) => {
                  if (!res.ok) {
                    showToast(res.error?.message ?? t("Unable to open the release download page."))
                  }
                })
              }}
              style={primaryButtonStyle}
            >
              {t("Download")}
            </button>
            <button onClick={dismissCurrent} style={secondaryButtonStyle}>
              {t("Dismiss")}
            </button>
            <button
              onClick={() => setCurrentPage("settings")}
              style={secondaryButtonStyle}
            >
              {t("View Details")}
            </button>
          </div>
        </div>
      ) : null}
      <AlertBanner />
      <ErrorBoundary title="Diagnosis"><DiagnosisCard /></ErrorBoundary>

      {/* Top: Gauges */}
      <div className="dashboard-grid-top">
        <ErrorBoundary title="CPU"><CpuWidget /></ErrorBoundary>
        <ErrorBoundary title="Memory"><MemoryWidget /></ErrorBoundary>
        <ErrorBoundary title="GPU"><GpuWidget /></ErrorBoundary>
        <ErrorBoundary title="Disk"><DiskWidget /></ErrorBoundary>
        <ErrorBoundary title="Network"><NetworkWidget /></ErrorBoundary>
      </div>

      {/* Middle: Realtime chart */}
      <div className="dashboard-section">
        <ErrorBoundary title="Realtime Chart"><RealtimeChart /></ErrorBoundary>
      </div>

      {/* Bottom row 1: Storage + Growth */}
      <div className="dashboard-grid-responsive">
        <ErrorBoundary title="Storage"><YourStorage onFolderClick={() => setCurrentPage("disk")} /></ErrorBoundary>
        <ErrorBoundary title="Growth"><GrowthView /></ErrorBoundary>
      </div>

      <div>
        <ErrorBoundary title="Top Consumers"><TopResourceConsumers /></ErrorBoundary>
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
