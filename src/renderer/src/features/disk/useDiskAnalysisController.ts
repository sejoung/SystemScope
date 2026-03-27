import { useCallback, useRef, useState } from "react";
import { isJobCompleted, isJobFailed, isJobProgress, isQuickScanFolderArray } from "@shared/types";
import { useToast } from "../../components/Toast";
import { useIpcListener } from "../../hooks/useIpc";
import { useContainerWidth } from "../../hooks/useContainerWidth";
import { useI18n } from "../../i18n/useI18n";
import { useDiskStore } from "../../stores/useDiskStore";
import type { ScanOutcome, StorageTab } from "./diskAnalysisHelpers";

export function useDiskAnalysisController() {
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
    quickScan: quickScanState,
    setQuickScanState,
  } = useDiskStore();

  const showToast = useToast((s) => s.show);
  const [tab, setTab] = useState<StorageTab>("overview");
  const [scanOutcome, setScanOutcome] = useState<ScanOutcome>("idle");
  const pendingRefreshRef = useRef(false);
  const [treemapRef, treemapWidth] = useContainerWidth(600);
  const safeTreemapWidth = Math.max(treemapWidth - 40, 320);
  const sectionResetKey = `${selectedFolder ?? "none"}:${scanResult?.scanDuration ?? 0}:${isScanning}`;

  const handleQuickScan = useCallback(async () => {
    setQuickScanState((prev) => ({ ...prev, scanning: true, error: null }));
    const res = await window.systemScope.quickScan();
    if (res.ok && res.data && isQuickScanFolderArray(res.data)) {
      setQuickScanState({
        results: res.data,
        scanning: false,
        scanned: true,
        error: null,
      });
      return;
    }

    setQuickScanState({
      results: [],
      scanning: false,
      scanned: true,
      error: res.error?.message ?? tk("disk.quick_cleanup.scan_failed"),
    });
  }, [setQuickScanState, tk]);

  const startScan = useCallback(
    async (folderPath: string) => {
      clearScan();
      setScanOutcome("running");
      setSelectedFolder(folderPath);
      setScanning(true);
      setTab("scan");

      const res = await window.systemScope.scanFolder(folderPath);
      if (res.ok && res.data) {
        setScanning(
          true,
          (res.data as { jobId: string }).jobId,
        );
        return;
      }

      setScanning(false);
      setScanOutcome("failed");
      setScanProgress(res.error?.message ?? tk("disk.scan.failed"));
      showToast(res.error?.message ?? tk("disk.scan.start_failed"));
    },
    [
      clearScan,
      setScanProgress,
      setScanning,
      setSelectedFolder,
      showToast,
      tk,
    ],
  );

  const tryScan = useCallback(
    (folderPath: string) => {
      if (isScanning) {
        showToast(tk("disk.scan.in_progress"));
        return;
      }
      void startScan(folderPath);
    },
    [isScanning, showToast, startScan, tk],
  );

  const handleCancelScan = useCallback(() => {
    if (!scanJobId) return;

    window.systemScope.cancelJob(scanJobId).catch(() => {});
    setScanning(false);
    setScanOutcome("cancelled");
    setScanProgress(tk("disk.scan.cancelled"));
  }, [scanJobId, setScanProgress, setScanning, tk]);

  const handleSelectFolder = useCallback(async () => {
    if (isScanning) {
      showToast(tk("disk.scan.in_progress"));
      return;
    }
    const res = await window.systemScope.selectFolder();
    if (res.ok && res.data) {
      void startScan(res.data as string);
    }
  }, [isScanning, showToast, startScan, tk]);

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
      setScanProgress(res.error?.message ?? tk("disk.scan.refresh_failed_short"));
      showToast(res.error?.message ?? tk("disk.scan.refresh_failed"));
    },
    [isScanning, setScanProgress, setScanning, showToast, tk],
  );

  const handleJobProgress = useCallback(
    (data: unknown) => {
      if (!isJobProgress(data)) return;
      if (data.id === scanJobId) setScanProgress(data.currentStep);
    },
    [scanJobId, setScanProgress],
  );
  useIpcListener(window.systemScope.onJobProgress, handleJobProgress);

  const handleJobCompleted = useCallback(
    (data: unknown) => {
      if (!isJobCompleted(data)) return;
      if (data.id !== scanJobId) return;

      setScanResult(data.data);
      setScanOutcome("completed");

      if (selectedFolder) {
        window.systemScope
          .getLargeFiles(selectedFolder, 50)
          .then((res) => {
            if (res.ok && res.data) setLargeFiles(res.data);
          })
          .catch(() => {});

        window.systemScope
          .getExtensionBreakdown(selectedFolder)
          .then((res) => {
            if (res.ok && res.data) setExtensions(res.data);
          })
          .catch(() => {});
      }

      if (pendingRefreshRef.current && selectedFolder) {
        pendingRefreshRef.current = false;
        void refreshScanInBackground(selectedFolder);
      }
    },
    [
      refreshScanInBackground,
      scanJobId,
      selectedFolder,
      setExtensions,
      setLargeFiles,
      setScanResult,
    ],
  );
  useIpcListener(window.systemScope.onJobCompleted, handleJobCompleted);

  const handleJobFailed = useCallback(
    (data: unknown) => {
      if (!isJobFailed(data)) return;
      if (data.id !== scanJobId) return;

      setScanning(false);
      setScanOutcome("failed");
      setScanProgress(data.error);

      if (pendingRefreshRef.current && selectedFolder) {
        pendingRefreshRef.current = false;
        void refreshScanInBackground(selectedFolder);
      }
    },
    [
      refreshScanInBackground,
      scanJobId,
      selectedFolder,
      setScanProgress,
      setScanning,
    ],
  );
  useIpcListener(window.systemScope.onJobFailed, handleJobFailed);

  return {
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
  };
}
