import { PageTab } from "../components/PageTab";
import { DiskAnalysisCleanupTab } from "../features/disk/DiskAnalysisCleanupTab";
import { DiskAnalysisOverviewTab } from "../features/disk/DiskAnalysisOverviewTab";
import { DiskAnalysisScanTab } from "../features/disk/DiskAnalysisScanTab";
import { useDiskAnalysisController } from "../features/disk/useDiskAnalysisController";

export function DiskAnalysisPage() {
  const {
    t,
    tk,
    tab,
    setTab,
    scanResult,
    largeFiles,
    extensions,
    isScanning,
    scanProgress,
    selectedFolder,
    quickScanState,
    scanOutcome,
    treemapRef,
    safeTreemapWidth,
    sectionResetKey,
    tryScan,
    handleQuickScan,
    handleSelectFolder,
    handleCancelScan,
    removeLargeFilesByPaths,
    refreshScanInBackground,
  } = useDiskAnalysisController();

  return (
    <div data-testid="page-disk">
      {/* Header + Tabs */}
      <div
        style={{
          display: "grid",
          gap: "10px",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "grid", gap: "6px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>
            {tk("disk.page.title")}
          </h2>
          <div
            style={{
              fontSize: "13px",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            {t(
              "Scan folders, inspect large files, and review cleanup candidates before deleting anything.",
            )}
          </div>
        </div>
        <div
          role="tablist"
          aria-label={tk("disk.page.title")}
          style={{
            display: "flex",
            gap: "4px",
            background: "var(--bg-secondary)",
            borderRadius: "8px",
            padding: "3px",
          }}
        >
          <PageTab
            id="storage-overview"
            active={tab === "overview"}
            onClick={() => setTab("overview")}
          >
            {tk("disk.tab.overview")}
          </PageTab>
          <PageTab
            id="storage-scan"
            active={tab === "scan"}
            onClick={() => setTab("scan")}
          >
            {tk("disk.tab.scan")}
            {isScanning && (
              <span
                style={{ marginLeft: "6px", color: "var(--accent-yellow)" }}
                aria-label={tk("disk.scan.preparing")}
              >
                {tk("disk.scan.status_running")}
              </span>
            )}
            {!isScanning && scanOutcome === "completed" && scanResult && (
              <span
                style={{ marginLeft: "6px", color: "var(--accent-green)" }}
                aria-label={tk("disk.scan.complete_label")}
              >
                {tk("disk.scan.status_complete")}
              </span>
            )}
            {!isScanning && scanOutcome === "cancelled" && (
              <span
                style={{ marginLeft: "6px", color: "var(--accent-yellow)" }}
                aria-label={tk("disk.scan.cancelled")}
              >
                {tk("disk.scan.status_cancelled")}
              </span>
            )}
          </PageTab>
          <PageTab
            id="storage-cleanup"
            active={tab === "cleanup"}
            onClick={() => setTab("cleanup")}
          >
            {tk("disk.tab.cleanup")}
          </PageTab>
        </div>
      </div>

      {/* Tab content */}
      {tab === "overview" && <DiskAnalysisOverviewTab tryScan={tryScan} />}

      {tab === "scan" && (
        <DiskAnalysisScanTab
          selectedFolder={selectedFolder}
          isScanning={isScanning}
          scanProgress={scanProgress}
          scanResult={scanResult}
          largeFiles={largeFiles}
          extensions={extensions}
          treemapRef={treemapRef}
          safeTreemapWidth={safeTreemapWidth}
          sectionResetKey={sectionResetKey}
          scanOutcome={scanOutcome}
          onSelectFolder={handleSelectFolder}
          onCancelScan={handleCancelScan}
        />
      )}

      {tab === "cleanup" && (
        <DiskAnalysisCleanupTab
          tryScan={tryScan}
          sectionResetKey={sectionResetKey}
          scanResult={scanResult}
          largeFiles={largeFiles}
          selectedFolder={selectedFolder}
          onFilesRemoved={removeLargeFilesByPaths}
          onRefreshRequested={() =>
            selectedFolder
              ? void refreshScanInBackground(selectedFolder)
              : undefined
          }
          quickScanState={quickScanState}
          onQuickScan={handleQuickScan}
        />
      )}
    </div>
  );
}
