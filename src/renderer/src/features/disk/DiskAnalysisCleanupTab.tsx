import { lazy, Suspense } from "react";
import type { DiskScanResult } from "@shared/types";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { useI18n } from "../../i18n/useI18n";
import { useDiskStore } from "../../stores/useDiskStore";
import { SectionFallback } from "./DiskAnalysisShared";

const FileInsights = lazy(async () =>
  import("./FileInsights").then((mod) => ({
    default: mod.FileInsights,
  })),
);

const QuickScan = lazy(async () =>
  import("./QuickScan").then((mod) => ({
    default: mod.QuickScan,
  })),
);

interface DiskAnalysisCleanupTabProps {
  tryScan: (path: string) => void;
  sectionResetKey: string;
  scanResult: DiskScanResult | null;
  largeFiles: ReturnType<typeof useDiskStore.getState>["largeFiles"];
  selectedFolder: string | null;
  onFilesRemoved: (paths: string[]) => void;
  onRefreshRequested: () => void;
  quickScanState: ReturnType<typeof useDiskStore.getState>["quickScan"];
  onQuickScan: () => void;
}

export function DiskAnalysisCleanupTab({
  tryScan,
  sectionResetKey,
  scanResult,
  largeFiles,
  selectedFolder,
  onFilesRemoved,
  onRefreshRequested,
  quickScanState,
  onQuickScan,
}: DiskAnalysisCleanupTabProps) {
  const { tk } = useI18n();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <ErrorBoundary
        title={tk("disk.section.quick_cleanup")}
        resetKey={sectionResetKey}
      >
        <Suspense
          fallback={
            <SectionFallback title={tk("disk.section.quick_cleanup")} />
          }
        >
          <QuickScan
            onFolderClick={tryScan}
            state={quickScanState}
            onScan={onQuickScan}
          />
        </Suspense>
      </ErrorBoundary>

      {scanResult && selectedFolder ? (
        <ErrorBoundary
          title={tk("disk.section.file_cleanup")}
          resetKey={sectionResetKey}
        >
          <Suspense
            fallback={
              <SectionFallback title={tk("disk.section.file_cleanup")} />
            }
          >
            <FileInsights
              extensions={[]}
              largeFiles={largeFiles}
              folderPath={selectedFolder}
              defaultTab="largest"
              title={tk("disk.section.file_cleanup")}
              hiddenTabs={["types"]}
              onFilesRemoved={onFilesRemoved}
              onRefreshRequested={onRefreshRequested}
            />
          </Suspense>
        </ErrorBoundary>
      ) : (
        <div
          style={{
            padding: "24px",
            textAlign: "center",
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              color: "var(--text-muted)",
              marginBottom: "8px",
            }}
          >
            {tk("disk.cleanup.empty_title")}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {tk("disk.cleanup.empty_detail")}
          </div>
        </div>
      )}
    </div>
  );
}
