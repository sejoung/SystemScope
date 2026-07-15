import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../../components/ui/Toast'
import { useI18n } from '../../i18n/useI18n'
import { useSearchFilter } from '../../hooks/useSearchFilter'
import { useContainerWidth } from '../../hooks/useContainerWidth'
import { isCompactWidth, RESPONSIVE_WIDTH } from '../../hooks/useResponsiveLayout'
import { useVisibleIds } from '../../hooks/useVisibleIds'
import { useLeftoverAppsStore } from '../../stores/apps/useLeftoverAppsStore'
import type { ConfidenceFilter, LeftoverSort, PlatformFilter } from './appsShared'

export function shouldUseLeftoverAppsCompactLayout(width: number): boolean { return isCompactWidth(width, RESPONSIVE_WIDTH.leftoverAppsCompact) }

export function useLeftoverAppsModel(refreshToken?: number) {
  const showToast = useToast((s) => s.show);
  const { tk } = useI18n();
  const [containerRef, containerWidth] = useContainerWidth(1200);
  const leftoverItems = useLeftoverAppsStore((state) => state.items);
  const loadError = useLeftoverAppsStore((state) => state.loadError);
  const refreshing = useLeftoverAppsStore((state) => state.refreshing);
  const ensureLoaded = useLeftoverAppsStore((state) => state.ensureLoaded);
  const refreshLeftovers = useLeftoverAppsStore((state) => state.refresh);
  const setHydrationHints = useLeftoverAppsStore((state) => state.setHydrationHints);
  const search = useSearchFilter();
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("all");
  const [leftoverSort, setLeftoverSort] = useState<LeftoverSort>("priority");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  useEffect(() => {
    if (refreshToken !== undefined) {
      void refreshLeftovers();
    }
  }, [refreshLeftovers, refreshToken]);

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) => leftoverItems.some((entry) => entry.id === id)),
    );
  }, [leftoverItems]);

  const filteredLeftovers = useMemo(() => {
    const q = search.applied.trim().toLowerCase();
    const confidenceWeight = { high: 0, medium: 1, low: 2 } as const;

    return leftoverItems
      .filter((item) => {
        if (platformFilter !== "all" && item.platform !== platformFilter) return false;
        if (confidenceFilter !== "all" && item.confidence !== confidenceFilter) return false;
        if (!q) return true;
        return [item.appName, item.label, item.path].some((v) => v.toLowerCase().includes(q));
      })
      .sort((a, b) => {
        if (leftoverSort === "size") {
          const sizeDiff = (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0);
          if (sizeDiff !== 0) return sizeDiff;
          const cDiff = confidenceWeight[a.confidence] - confidenceWeight[b.confidence];
          if (cDiff !== 0) return cDiff;
          return a.appName.localeCompare(b.appName);
        }
        if (leftoverSort === "name") return a.appName.localeCompare(b.appName);
        const cDiff = confidenceWeight[a.confidence] - confidenceWeight[b.confidence];
        if (cDiff !== 0) return cDiff;
        return a.appName.localeCompare(b.appName);
      });
  }, [confidenceFilter, leftoverItems, platformFilter, search.applied, leftoverSort]);

  const leftoverSizePendingCount = useMemo(
    () => leftoverItems.filter((item) => item.sizeBytes === undefined).length,
    [leftoverItems],
  );
  const leftoverSizeReadyCount = leftoverItems.length - leftoverSizePendingCount;

  const leftoverPendingIdSet = useMemo(
    () => new Set(leftoverItems.filter((item) => item.sizeBytes === undefined).map((item) => item.id)),
    [leftoverItems],
  );
  const { visibleIdsRef, visibilityTrigger, observeRow } = useVisibleIds(leftoverPendingIdSet);

  useEffect(() => {
    const visiblePendingIds = filteredLeftovers
      .filter((item) => item.sizeBytes === undefined && visibleIdsRef.current.has(item.id))
      .map((item) => item.id);
    setHydrationHints(visiblePendingIds, leftoverSort === "size");

    return () => {
      setHydrationHints([], false);
    };
  }, [filteredLeftovers, leftoverSort, setHydrationHints, visibilityTrigger, visibleIdsRef]);

  const selectedFilteredCount = useMemo(
    () => filteredLeftovers.filter((item) => selectedIds.includes(item.id)).length,
    [filteredLeftovers, selectedIds],
  );
  const allFilteredChecked = filteredLeftovers.length > 0 && selectedFilteredCount === filteredLeftovers.length;

  const selectedItems = useMemo(
    () => filteredLeftovers.filter((item) => selectedIds.includes(item.id)),
    [filteredLeftovers, selectedIds],
  );
  const compactLayout = shouldUseLeftoverAppsCompactLayout(containerWidth);

  const handleRefresh = async () => {
    await refreshLeftovers();
  };

  const handleToggleId = (itemId: string) => {
    setSelectedIds((current) =>
      current.includes(itemId) ? current.filter((e) => e !== itemId) : [...current, itemId],
    );
  };

  const handleRemoveSelected = async () => {
    if (selectedIds.length === 0) return;
    setBusy(true);
    const res = await window.systemScope.removeLeftoverAppData(selectedIds);
    setBusy(false);

    if (!res.ok) {
      showToast(res.error?.message ?? tk("apps.error.remove_leftover"));
      return;
    }
    if (!res.data) return;

    const result = res.data as { deletedPaths: string[]; failedPaths: string[] };
    setSelectedIds([]);
    showToast(
      result.failedPaths.length === 0
        ? tk("apps.toast.leftover_all", { count: result.deletedPaths.length }) + " — " + tk("apps.toast.leftover_restore_hint")
        : tk("apps.toast.leftover_partial", { deletedCount: result.deletedPaths.length, failedCount: result.failedPaths.length }),
    );
    await refreshLeftovers();
  };

  const handleOpenPath = async (targetPath: string) => {
    const res = await window.systemScope.showInFolder(targetPath);
    if (!res.ok) showToast(res.error?.message ?? tk("apps.error.open_path"));
  };


  return { tk, containerRef, leftoverItems, loadError, refreshing, search, platformFilter, setPlatformFilter, confidenceFilter, setConfidenceFilter, leftoverSort, setLeftoverSort, selectedIds, setSelectedIds, expandedId, setExpandedId, busy, filteredLeftovers, leftoverSizePendingCount, leftoverSizeReadyCount, observeRow, selectedFilteredCount, allFilteredChecked, selectedItems, compactLayout, handleRefresh, handleToggleId, handleRemoveSelected, handleOpenPath }
}
