import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppRelatedDataItem, InstalledApp } from '@shared/types'
import { isAppRelatedDataArray, isAppRemovalResult, isInstalledAppArray } from '@shared/types'
import { useToast } from '../../../components/ui/Toast'
import { useI18n } from '../../../i18n/useI18n'
import { useSearchFilter } from '../../../hooks/useSearchFilter'
import { useContainerWidth } from '../../../hooks/useContainerWidth'
import { isCompactWidth, RESPONSIVE_WIDTH } from '../../../hooks/useResponsiveLayout'
import type { PlatformFilter } from '../appsShared'

export function shouldUseInstalledAppsCompactLayout(width: number): boolean { return isCompactWidth(width, RESPONSIVE_WIDTH.installedAppsCompact) }

export function useInstalledAppsModel(refreshToken?: number) {
  const showToast = useToast((s) => s.show);
  const { tk } = useI18n();
  const isWindows = navigator.userAgent.includes("Windows");
  const [containerRef, containerWidth] = useContainerWidth(1200);

  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const search = useSearchFilter();
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [busyAppId, setBusyAppId] = useState<string | null>(null);
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);
  const [relatedLoadingAppId, setRelatedLoadingAppId] = useState<string | null>(null);
  const [relatedDataByAppId, setRelatedDataByAppId] = useState<Record<string, AppRelatedDataItem[]>>({});
  const [selectedRelatedIdsByAppId, setSelectedRelatedIdsByAppId] = useState<Record<string, string[]>>({});
  const [pendingUninstallIds, setPendingUninstallIds] = useState<string[]>([]);
  const uninstallRefreshTimersRef = useRef<number[]>([]);

  const loadApps = useCallback(async () => {
    const res = await window.systemScope.listInstalledApps();
    if (!res.ok) {
      const message = res.error?.message ?? tk("apps.error.load_installed");
      setLoadError(message);
      showToast(message);
      return;
    }
    if (isInstalledAppArray(res.data)) {
      const items = res.data;
      setApps(items);
      setLoadError(undefined);
      setPendingUninstallIds((current) =>
        current.filter((id) => items.some((app) => app.id === id)),
      );
    }
  }, [showToast, tk]);

  useEffect(() => {
    void loadApps();
  }, [loadApps, refreshToken]);

  useEffect(() => {
  
  return () => {
      for (const timerId of uninstallRefreshTimersRef.current) {
        window.clearTimeout(timerId);
      }
      uninstallRefreshTimersRef.current = [];
    };
  }, []);

  const filteredApps = useMemo(
    () =>
      apps
        .filter((app) => !pendingUninstallIds.includes(app.id))
        .filter((app) => {
          const q = search.applied.trim().toLowerCase();
          if (platformFilter !== "all" && app.platform !== platformFilter) return false;
          if (!q) return true;
          return [app.name, app.version, app.publisher, app.installLocation]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q));
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [apps, platformFilter, search.applied, pendingUninstallIds],
  );
  const compactLayout = shouldUseInstalledAppsCompactLayout(containerWidth);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadApps();
    setRefreshing(false);
  };

  const handleUninstall = async (app: InstalledApp) => {
    setBusyAppId(app.id);
    const res = await window.systemScope.uninstallApp({
      appId: app.id,
      relatedDataIds: selectedRelatedIdsByAppId[app.id] ?? [],
    });
    setBusyAppId(null);

    if (!res.ok) {
      showToast(res.error?.message ?? tk("apps.error.uninstall_start"));
      return;
    }

    if (!res.data || !isAppRemovalResult(res.data)) return;
    const result = res.data;
    if (result.cancelled) return;

    showToast(
      result.message
        ? tk(result.message)
        : result.completed
          ? tk("apps.toast.removed") + " — " + tk("apps.toast.removed_restore_hint")
          : tk("apps.toast.uninstaller_started"),
    );

    if (
      !result.completed &&
      app.platform === "windows" &&
      result.action === "uninstaller"
    ) {
      setPendingUninstallIds((current) =>
        current.includes(app.id) ? current : [...current, app.id],
      );
      setApps((current) => current.filter((entry) => entry.id !== app.id));
      for (const delay of [1500, 5000, 15000]) {
        const timerId = window.setTimeout(() => {
          void loadApps();
        }, delay);
        uninstallRefreshTimersRef.current.push(timerId);
      }
    }

    await loadApps();
  };

  const handleToggleRelatedData = async (app: InstalledApp) => {
    if (expandedAppId === app.id) {
      setExpandedAppId(null);
      return;
    }

    setExpandedAppId(app.id);
    if (relatedDataByAppId[app.id]) return;

    setRelatedLoadingAppId(app.id);
    const res = await window.systemScope.getAppRelatedData(app.id);
    setRelatedLoadingAppId(null);

    if (!res.ok) {
      showToast(res.error?.message ?? tk("apps.error.load_related"));
      return;
    }

    if (!res.data || !isAppRelatedDataArray(res.data)) return;
    const items = res.data;
    setRelatedDataByAppId((current) => ({ ...current, [app.id]: items }));
    setSelectedRelatedIdsByAppId((current) => ({
      ...current,
      [app.id]: items.map((item) => item.id),
    }));
  };

  const handleToggleRelatedId = (appId: string, itemId: string) => {
    setSelectedRelatedIdsByAppId((current) => {
      const selected = new Set(current[appId] ?? []);
      if (selected.has(itemId)) selected.delete(itemId);
      else selected.add(itemId);
      return { ...current, [appId]: [...selected] };
    });
  };

  const handleOpenLocation = async (appId: string) => {
    const res = await window.systemScope.openAppLocation(appId);
    if (!res.ok) {
      showToast(res.error?.message ?? tk("apps.error.open_location"));
    }
  };

  const handleOpenSystemSettings = async () => {
    const res = await window.systemScope.openSystemUninstallSettings();
    if (!res.ok) {
      showToast(res.error?.message ?? tk("apps.error.open_system_settings"));
    }
  };

  return { tk, isWindows, containerRef, apps, loadError, refreshing, search, platformFilter, setPlatformFilter, busyAppId, expandedAppId, relatedLoadingAppId, relatedDataByAppId, selectedRelatedIdsByAppId, filteredApps, compactLayout, handleRefresh, handleUninstall, handleToggleRelatedData, handleToggleRelatedId, handleOpenLocation, handleOpenSystemSettings }
}
