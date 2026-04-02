import { Suspense, lazy } from "react";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { AsyncTaskStatus } from "../../components/AsyncTaskStatus";
import { useI18n } from "../../i18n/useI18n";
import { useDiskAnalysisController } from "../disk/useDiskAnalysisController";

const FileInsights = lazy(async () =>
  import("../disk/FileInsights").then((mod) => ({
    default: mod.FileInsights,
  })),
);

const QuickScan = lazy(async () =>
  import("../disk/QuickScan").then((mod) => ({
    default: mod.QuickScan,
  })),
);

export function CleanupWorkspaceView() {
  const { t } = useI18n();
  const {
    tryScan,
    scanResult,
    largeFiles,
    selectedFolder,
    removeLargeFilesByPaths,
    refreshScanInBackground,
    quickScanState,
    handleQuickScan,
    handleSelectFolder,
    isScanning,
    scanProgress,
  } = useDiskAnalysisController();

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={panelStyle}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={titleStyle}>{t("Cleanup Workspace")}</div>
          <div style={subtleStyle}>
            {t(
              "Run a quick cleanup scan for common cache folders, or inspect one folder in detail before deleting large, old, or duplicate files.",
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void handleSelectFolder()}
            disabled={isScanning}
            style={primaryButtonStyle}
          >
            {selectedFolder ? t("Choose Another Folder") : t("Choose Folder")}
          </button>
          {selectedFolder ? (
            <span style={pathPillStyle}>{selectedFolder}</span>
          ) : null}
        </div>
        {isScanning ? (
          <AsyncTaskStatus
            stage="started"
            taskLabel={t("Cleanup Workspace")}
            message={scanProgress || t("Scanning the selected folder.")}
          />
        ) : null}
      </div>

      <ErrorBoundary title={t("Quick Cleanup")}>
        <Suspense fallback={null}>
          <QuickScan
            onFolderClick={tryScan}
            state={quickScanState}
            onScan={handleQuickScan}
          />
        </Suspense>
      </ErrorBoundary>

      {scanResult && selectedFolder ? (
        <ErrorBoundary title={t("File Cleanup")}>
          <Suspense fallback={null}>
            <FileInsights
              extensions={[]}
              largeFiles={largeFiles}
              folderPath={selectedFolder}
              defaultTab="largest"
              title={t("File Cleanup")}
              hiddenTabs={["types"]}
              onFilesRemoved={removeLargeFilesByPaths}
              onRefreshRequested={() =>
                void refreshScanInBackground(selectedFolder)
              }
            />
          </Suspense>
        </ErrorBoundary>
      ) : (
        <div style={emptyStateStyle}>
          <div style={titleStyle}>{t("Detailed File Review")}</div>
          <div style={subtleStyle}>
            {t(
              "Select a folder or scan one from Quick Cleanup to inspect large files, old files, and duplicates before cleanup.",
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  padding: "14px 16px",
  borderRadius: "var(--radius)",
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
};

const emptyStateStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "20px 16px",
  borderRadius: "var(--radius)",
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
};

const titleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "var(--text-primary)",
};

const subtleStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-secondary)",
  lineHeight: 1.6,
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "7px 14px",
  fontSize: "12px",
  fontWeight: 600,
  border: "none",
  borderRadius: "8px",
  background: "var(--accent-blue)",
  color: "var(--text-on-accent)",
  cursor: "pointer",
};

const pathPillStyle: React.CSSProperties = {
  padding: "7px 10px",
  fontSize: 11,
  borderRadius: 999,
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  color: "var(--text-secondary)",
  fontFamily: "var(--font-mono, monospace)",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
