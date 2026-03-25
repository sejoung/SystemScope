import {
  lazy,
  Suspense,
  useCallback,
  useRef,
  useState,
  useEffect,
} from "react";
import { useDiskStore } from "../stores/useDiskStore";
import { useIpcListener } from "../hooks/useIpc";
import { Accordion } from "../components/Accordion";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { formatBytes } from "../utils/format";
import { useToast } from "../components/Toast";
import { YourStorage } from "../features/disk/YourStorage";
import { GrowthView } from "../features/disk/GrowthView";
import type { TranslationKey } from "@shared/i18n";
import type { DiskScanResult } from "@shared/types";
import { useI18n } from "../i18n/useI18n";
import { StatusMessage } from "../components/StatusMessage";
import { CopyableValue } from "../components/CopyableValue";
import { AsyncTaskStatus } from "../components/AsyncTaskStatus";

const TreemapChart = lazy(async () =>
  import("../features/disk/TreemapChart").then((mod) => ({
    default: mod.TreemapChart,
  })),
);
const FileInsights = lazy(async () =>
  import("../features/disk/FileInsights").then((mod) => ({
    default: mod.FileInsights,
  })),
);
const QuickScan = lazy(async () =>
  import("../features/disk/QuickScan").then((mod) => ({
    default: mod.QuickScan,
  })),
);
const RecentGrowth = lazy(async () =>
  import("../features/disk/RecentGrowth").then((mod) => ({
    default: mod.RecentGrowth,
  })),
);

type StorageTab = "overview" | "scan" | "cleanup";
type ScanOutcome = "idle" | "running" | "completed" | "failed" | "cancelled";

export function shouldShowCancelledScanMessage(
  scanOutcome: ScanOutcome,
  isScanning: boolean,
) {
  return !isScanning && scanOutcome === "cancelled";
}

export function getScanScopeMessageKey(
  selectedFolder: string | null,
): TranslationKey {
  return selectedFolder ? "disk.scan.scope_selected" : "disk.scan.scope_empty";
}

export function DiskAnalysisPage() {
  const { tk, t } = useI18n();
  const {
    scanResult,
    largeFiles,
    extensions,
    isScanning,
    scanJobId,
    scanProgress,
    selectedFolder,
    setScanResult,
    setLargeFiles,
    setExtensions,
    setScanning,
    setScanProgress,
    setSelectedFolder,
    removeLargeFilesByPaths,
    clearScan,
  } = useDiskStore();

  const showToast = useToast((s) => s.show);
  const [tab, setTab] = useState<StorageTab>("overview");
  const [scanOutcome, setScanOutcome] = useState<ScanOutcome>("idle");
  const sectionResetKey = `${selectedFolder ?? "none"}:${scanResult?.scanDuration ?? 0}:${isScanning}`;
  const pendingRefreshRef = useRef(false);

  // Treemap 컨테이너 폭 측정
  const treemapRef = useRef<HTMLDivElement>(null);
  const [treemapWidth, setTreemapWidth] = useState(600);
  const safeTreemapWidth = Math.max(treemapWidth - 40, 320);
  useEffect(() => {
    if (!treemapRef.current) return;
    if (typeof ResizeObserver === "undefined") {
      setTreemapWidth(Math.max(treemapRef.current.clientWidth, 600));
      return;
    }
    setTreemapWidth(Math.max(treemapRef.current.clientWidth, 600));
    let rafId = 0;
    const observer = new ResizeObserver(([entry]) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setTreemapWidth(Math.max(Math.floor(entry.contentRect.width), 320));
      });
    });
    observer.observe(treemapRef.current);
    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [scanResult]);

  // --- Scan logic ---
  const startScan = useCallback(
    async (folderPath: string) => {
      clearScan();
      setScanOutcome("running");
      setSelectedFolder(folderPath);
      setScanning(true);
      setTab("scan"); // 스캔 시작하면 Scan 탭으로 자동 이동
      const res = await window.systemScope.scanFolder(folderPath);
      if (res.ok && res.data) {
        setScanning(true, (res.data as { jobId: string }).jobId);
      } else {
        setScanning(false);
        setScanOutcome("failed");
        setScanProgress(res.error?.message ?? tk("disk.scan.failed"));
        showToast(res.error?.message ?? tk("disk.scan.start_failed"));
      }
    },
    [clearScan, setSelectedFolder, setScanning, setScanProgress, showToast],
  );

  const tryScan = useCallback(
    (folderPath: string) => {
      if (isScanning) {
        showToast(tk("disk.scan.in_progress"));
        return;
      }
      startScan(folderPath);
    },
    [isScanning, startScan, showToast],
  );

  const handleCancelScan = useCallback(() => {
    if (scanJobId) {
      window.systemScope.cancelJob(scanJobId).catch(() => {});
      setScanning(false);
      setScanOutcome("cancelled");
      setScanProgress(tk("disk.scan.cancelled"));
    }
  }, [scanJobId, setScanning, setScanProgress, tk]);

  const handleSelectFolder = useCallback(async () => {
    if (isScanning) {
      showToast(tk("disk.scan.in_progress"));
      return;
    }
    const res = await window.systemScope.selectFolder();
    if (res.ok && res.data) {
      startScan(res.data as string);
    }
  }, [isScanning, startScan, showToast]);

  const refreshScanInBackground = useCallback(
    async (folderPath: string) => {
      if (isScanning) {
        pendingRefreshRef.current = true;
        return;
      }

      setScanning(true);
      setScanOutcome("running");
      setScanProgress(tk("disk.scan.refreshing_after_delete"));

      const res = await window.systemScope.scanFolder(folderPath);
      if (res.ok && res.data) {
        setScanning(true, (res.data as { jobId: string }).jobId);
        return;
      }

      setScanning(false);
      setScanOutcome("failed");
      setScanProgress(
        res.error?.message ?? tk("disk.scan.refresh_failed_short"),
      );
      showToast(res.error?.message ?? tk("disk.scan.refresh_failed"));
    },
    [isScanning, setScanning, setScanProgress, showToast, tk],
  );

  // --- IPC listeners ---
  const handleJobProgress = useCallback(
    (data: unknown) => {
      const d = data as { id: string; currentStep: string };
      if (d.id === scanJobId) setScanProgress(d.currentStep);
    },
    [scanJobId, setScanProgress],
  );
  useIpcListener(window.systemScope.onJobProgress, handleJobProgress);

  const handleJobCompleted = useCallback(
    (data: unknown) => {
      const d = data as { id: string; data: DiskScanResult };
      if (d.id === scanJobId) {
        setScanResult(d.data);
        setScanOutcome("completed");
        if (selectedFolder) {
          window.systemScope
            .getLargeFiles(selectedFolder, 50)
            .then((res) => {
              if (res.ok && res.data) setLargeFiles(res.data);
            })
            .catch(() => {
              /* IPC failure — scan result still usable */
            });
          window.systemScope
            .getExtensionBreakdown(selectedFolder)
            .then((res) => {
              if (res.ok && res.data) setExtensions(res.data);
            })
            .catch(() => {
              /* IPC failure — scan result still usable */
            });
        }
        if (pendingRefreshRef.current && selectedFolder) {
          pendingRefreshRef.current = false;
          void refreshScanInBackground(selectedFolder);
        }
      }
    },
    [
      scanJobId,
      selectedFolder,
      setScanResult,
      setLargeFiles,
      setExtensions,
      refreshScanInBackground,
    ],
  );
  useIpcListener(window.systemScope.onJobCompleted, handleJobCompleted);

  const handleJobFailed = useCallback(
    (data: unknown) => {
      const d = data as { id: string; error: string };
      if (d.id === scanJobId) {
        setScanning(false);
        setScanOutcome("failed");
        setScanProgress(d.error);
        if (pendingRefreshRef.current && selectedFolder) {
          pendingRefreshRef.current = false;
          void refreshScanInBackground(selectedFolder);
        }
      }
    },
    [
      scanJobId,
      selectedFolder,
      setScanning,
      setScanProgress,
      refreshScanInBackground,
    ],
  );
  useIpcListener(window.systemScope.onJobFailed, handleJobFailed);

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
      {tab === "overview" && <OverviewTab tryScan={tryScan} />}

      {tab === "scan" && (
        <ScanTab
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
        <CleanupTab
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
        />
      )}
    </div>
  );
}

// ─── Overview Tab ───

function OverviewTab({ tryScan }: { tryScan: (path: string) => void }) {
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

// ─── Scan Tab ───

function ScanTab({
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
}: {
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
}) {
  const { tk } = useI18n();
  return (
    <div>
      {/* Scan controls */}
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
            onClick={onSelectFolder}
            disabled={isScanning}
            style={btnStyle}
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
                onClick={() => window.systemScope.showInFolder(selectedFolder)}
                style={{
                  ...btnStyle,
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                {tk("disk.scan.open")}
              </button>
            </>
          )}
          {isScanning && (
            <button
              onClick={onCancelScan}
              style={{ ...btnStyle, background: "var(--accent-red)" }}
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

      {/* Scan progress */}
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
                style={{ ...btnStyle, background: "var(--accent-red)" }}
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

      {/* Empty state */}
      {!isScanning && !scanResult && (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "var(--text-muted)",
            fontSize: "13px",
            display: "grid",
            gap: "16px",
            justifyItems: "center",
          }}
        >
          <div>{tk("disk.scan.empty")}</div>
          <button
            onClick={onSelectFolder}
            style={{
              padding: "10px 24px",
              fontSize: "13px",
              fontWeight: 600,
              border: "none",
              borderRadius: "var(--radius)",
              background: "var(--accent-blue)",
              color: "var(--text-on-accent)",
              cursor: "pointer",
            }}
          >
            {tk("disk.scan.browse_folder")}
          </button>
        </div>
      )}

      {/* Scan results */}
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

// ─── Cleanup Tab ───

function CleanupTab({
  tryScan,
  sectionResetKey,
  scanResult,
  largeFiles,
  selectedFolder,
  onFilesRemoved,
  onRefreshRequested,
}: {
  tryScan: (path: string) => void;
  sectionResetKey: string;
  scanResult: DiskScanResult | null;
  largeFiles: ReturnType<typeof useDiskStore.getState>["largeFiles"];
  selectedFolder: string | null;
  onFilesRemoved: (paths: string[]) => void;
  onRefreshRequested: () => void;
}) {
  const { tk } = useI18n();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Quick Cleanup — 항상 표시 */}
      <ErrorBoundary
        title={tk("disk.section.quick_cleanup")}
        resetKey={sectionResetKey}
      >
        <Suspense
          fallback={
            <SectionFallback title={tk("disk.section.quick_cleanup")} />
          }
        >
          <QuickScan onFolderClick={tryScan} />
        </Suspense>
      </ErrorBoundary>

      {/* 스캔 결과 기반 삭제 대상 — 스캔 완료 시에만 표시 */}
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

// ─── Shared ───

function PageTab({
  id,
  active,
  onClick,
  children,
}: {
  id: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      id={id}
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: "6px 16px",
        fontSize: "13px",
        fontWeight: active ? 600 : 400,
        border: "none",
        borderRadius: "6px",
        background: active ? "var(--accent-blue)" : "transparent",
        color: active ? "var(--text-on-accent)" : "var(--text-secondary)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
      }}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ color: "var(--text-muted)" }}>
      {label}: <strong style={{ color: "var(--text-primary)" }}>{value}</strong>
    </span>
  );
}

function SectionFallback({ title }: { title: string }) {
  const { tk } = useI18n();
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "16px",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          fontWeight: 700,
          color: "var(--text-secondary)",
          marginBottom: "8px",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
        {tk("disk.common.loading")}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: "13px",
  fontWeight: 500,
  border: "none",
  borderRadius: "var(--radius)",
  background: "var(--accent-blue)",
  color: "var(--text-on-accent)",
  cursor: "pointer",
};
