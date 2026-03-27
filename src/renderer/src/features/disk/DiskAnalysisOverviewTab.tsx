import { ErrorBoundary } from "../../components/ErrorBoundary";
import { useI18n } from "../../i18n/useI18n";
import { GrowthView } from "./GrowthView";
import { YourStorage } from "./YourStorage";

export function DiskAnalysisOverviewTab({
  tryScan,
}: {
  tryScan: (path: string) => void;
}) {
  const { tk } = useI18n();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
        gap: "16px",
      }}
    >
      <ErrorBoundary title={tk("disk.section.home_storage")}>
        <YourStorage onFolderClick={tryScan} />
      </ErrorBoundary>
      <ErrorBoundary title={tk("disk.section.storage_growth")}>
        <GrowthView />
      </ErrorBoundary>
    </div>
  );
}
