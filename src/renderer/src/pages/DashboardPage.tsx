import { useSettingsStore } from "../stores/useSettingsStore";
import { useSystemStore } from "../stores/useSystemStore";
import { CpuWidget } from "../features/monitoring/CpuWidget";
import { MemoryWidget } from "../features/monitoring/MemoryWidget";
import { GpuWidget } from "../features/monitoring/GpuWidget";
import { RealtimeChart } from "../features/monitoring/RealtimeChart";
import { YourStorage } from "../features/disk/YourStorage";
import { GrowthView } from "../features/disk/GrowthView";
import { TopResourceConsumers } from "../features/process/TopResourceConsumers";
import { AlertBanner } from "../features/alerts/AlertBanner";
import { PageLoading } from "../components/PageLoading";
import { useI18n } from "../i18n/useI18n";

export function DashboardPage() {
  const setCurrentPage = useSettingsStore((s) => s.setCurrentPage);
  const current = useSystemStore((s) => s.current);
  const { t } = useI18n();

  if (!current) return <PageLoading />;

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
      </div>
      <AlertBanner />

      {/* Top: Gauges */}
      <div className="dashboard-grid-3">
        <CpuWidget />
        <MemoryWidget />
        <GpuWidget />
      </div>

      {/* Middle: Realtime chart */}
      <div className="dashboard-section">
        <RealtimeChart />
      </div>

      {/* Bottom row 1: Storage + Growth */}
      <div className="dashboard-grid-responsive">
        <YourStorage onFolderClick={() => setCurrentPage("disk")} />
        <GrowthView />
      </div>

      <div>
        <TopResourceConsumers />
      </div>
    </div>
  );
}
