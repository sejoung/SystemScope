import { lazy, Suspense } from "react";
import type { DiskScanResult } from "@shared/types";
import { Accordion } from "../../components/Accordion";
import { AsyncTaskStatus } from "../../components/AsyncTaskStatus";
import { CopyableValue } from "../../components/CopyableValue";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { StatusMessage } from "../../components/StatusMessage";
import { useI18n } from "../../i18n/useI18n";
import { type useDiskStore } from "../../stores/useDiskStore";
import { formatBytes } from "../../utils/format";
import { SectionFallback, Stat } from "./DiskAnalysisShared";
import {
  dangerButtonStyle,
  getScanScopeMessageKey,
  primaryButtonStyle,
  secondaryButtonStyle,
  shouldShowCancelledScanMessage,
  type ScanOutcome,
} from "./diskAnalysisHelpers";

const TreemapChart = lazy(async () =>
  import("./TreemapChart").then((mod) => ({
    default: mod.TreemapChart,
  })),
);

const FileInsights = lazy(async () =>
  import("./FileInsights").then((mod) => ({
    default: mod.FileInsights,
  })),
);

const RecentGrowth = lazy(async () =>
  import("./RecentGrowth").then((mod) => ({
    default: mod.RecentGrowth,
  })),
);

interface DiskAnalysisScanTabProps {
  selectedFolder: string | null;
  isScanning: boolean;
  scanProgress: string;
  scanResult: DiskScanResult | null;
  largeFiles: ReturnType<typeof useDiskStore.getState>["largeFiles"];
  extensions: ReturnType<typeof useDiskStore.getState>["extensions"];
  treemapRef: React.RefObject<HTMLDivElement | null>;
  safeTreemapWidth: number;
  sectionResetKey: string;
  scanOutcome: ScanOutcome;
  onSelectFolder: () => void;
  onCancelScan: () => void;
}

export function DiskAnalysisScanTab({
  selectedFolder,
  isScanning,
  scanProgress,
  scanResult,
  largeFiles,
  extensions,
  treemapRef,
  safeTreemapWidth,
  sectionResetKey,
  scanOutcome,
  onSelectFolder,
  onCancelScan,
}: DiskAnalysisScanTabProps) {
  const { tk } = useI18n();

  return (
    <div>
      <div
        style={{
          display: "grid",
          gap: "8px",
          padding: "12px 16px",
          marginBottom: "16px",
          background: "var(--bg-card)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={onSelectFolder}
            disabled={isScanning}
            style={primaryButtonStyle}
          >
            {tk("disk.scan.browse_folder")}
          </button>
          {selectedFolder && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <CopyableValue
                  value={selectedFolder}
                  fontSize="13px"
                  color="var(--text-secondary)"
                  maxWidth="100%"
                />
              </div>
              <button
                type="button"
                onClick={() => window.systemScope.showInFolder(selectedFolder)}
                style={secondaryButtonStyle}
              >
                {tk("disk.scan.open")}
              </button>
            </>
          )}
          {isScanning && (
            <button
              type="button"
              onClick={onCancelScan}
              style={dangerButtonStyle}
            >
              {tk("disk.scan.cancel")}
            </button>
          )}
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            lineHeight: 1.6,
          }}
        >
          {tk(getScanScopeMessageKey(selectedFolder))}
        </div>
      </div>

      {shouldShowCancelledScanMessage(scanOutcome, isScanning) && (
        <div style={{ marginBottom: "16px" }}>
          <StatusMessage message={tk("disk.scan.cancelled_detail")} />
        </div>
      )}

      {!isScanning && scanOutcome === "failed" && scanProgress && (
        <div style={{ marginBottom: "16px" }}>
          <AsyncTaskStatus
            stage="failed"
            taskLabel={tk("disk.tab.scan")}
            message={scanProgress}
          />
        </div>
      )}

      {isScanning && (
        <div style={{ marginBottom: "16px" }}>
          <AsyncTaskStatus
            stage={scanProgress ? "running" : "started"}
            taskLabel={tk("disk.tab.scan")}
            message={scanProgress || tk("disk.scan.preparing")}
            action={
              <button
                type="button"
                onClick={onCancelScan}
                style={dangerButtonStyle}
              >
                {tk("disk.scan.cancel")}
              </button>
            }
          />
        </div>
      )}

      {!isScanning && scanOutcome === "completed" && scanResult && (
        <div style={{ marginBottom: "16px" }}>
          <AsyncTaskStatus
            stage="completed"
            taskLabel={tk("disk.tab.scan")}
            message={tk("disk.scan.complete_label")}
          />
        </div>
      )}

      {!isScanning && !scanResult && (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "var(--text-muted)",
            fontSize: "13px",
          }}
        >
          <div>{tk("disk.scan.empty")}</div>
        </div>
      )}

      {scanResult && (
        <>
          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: "16px",
              fontSize: "13px",
              padding: "10px 16px",
              background: "var(--bg-card)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
            }}
          >
            <Stat
              label={tk("disk.scan.total")}
              value={formatBytes(scanResult.totalSize)}
            />
            <Stat
              label={tk("disk.scan.files")}
              value={scanResult.fileCount.toLocaleString()}
            />
            <Stat
              label={tk("disk.scan.folders")}
              value={scanResult.folderCount.toLocaleString()}
            />
            <Stat
              label={tk("disk.scan.duration")}
              value={`${(scanResult.scanDuration / 1000).toFixed(1)}s`}
            />
          </div>

          <div ref={treemapRef} style={{ marginBottom: "16px" }}>
            <ErrorBoundary
              title={tk("disk.section.folder_map")}
              resetKey={sectionResetKey}
            >
              <Suspense
                fallback={
                  <SectionFallback title={tk("disk.section.folder_map")} />
                }
              >
                <Accordion title={tk("disk.section.folder_map")} defaultOpen>
                  <TreemapChart
                    data={scanResult.tree}
                    width={safeTreemapWidth}
                    height={300}
                  />
                </Accordion>
              </Suspense>
            </ErrorBoundary>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <ErrorBoundary
              title={tk("disk.section.file_insights")}
              resetKey={sectionResetKey}
            >
              <Suspense
                fallback={
                  <SectionFallback title={tk("disk.section.file_insights")} />
                }
              >
                <FileInsights
                  extensions={extensions}
                  largeFiles={largeFiles}
                  folderPath={selectedFolder!}
                  hiddenTabs={["old", "duplicates"]}
                  showDelete={false}
                />
              </Suspense>
            </ErrorBoundary>
          </div>

          <ErrorBoundary
            title={tk("disk.section.recent_growth")}
            resetKey={sectionResetKey}
          >
            <Suspense
              fallback={
                <SectionFallback title={tk("disk.section.recent_growth")} />
              }
            >
              <RecentGrowth folderPath={selectedFolder!} />
            </Suspense>
          </ErrorBoundary>
        </>
      )}
    </div>
  );
}
