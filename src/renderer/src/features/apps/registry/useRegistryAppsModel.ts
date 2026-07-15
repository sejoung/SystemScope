import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppLeftoverRegistryItem } from '@shared/types'
import { isAppLeftoverRegistryArray } from '@shared/types'
import { useToast } from '../../../components/ui/Toast'
import { useI18n } from '../../../i18n/useI18n'
import { useSearchFilter } from '../../../hooks/useSearchFilter'
import { useContainerWidth } from '../../../hooks/useContainerWidth'
import { isCompactWidth, RESPONSIVE_WIDTH } from '../../../hooks/useResponsiveLayout'

export function shouldUseRegistryAppsCompactLayout(width: number): boolean { return isCompactWidth(width, RESPONSIVE_WIDTH.registryAppsCompact) }

export function useRegistryAppsModel(refreshToken?: number) {
  const showToast = useToast((s) => s.show);
  const { tk } = useI18n();
  const [containerRef, containerWidth] = useContainerWidth(1200);

  const [registryItems, setRegistryItems] = useState<AppLeftoverRegistryItem[]>([]);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const search = useSearchFilter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadRegistry = useCallback(async () => {
    const res = await window.systemScope.listLeftoverAppRegistry();
    if (!res.ok) {
      const message = res.error?.message ?? tk("apps.error.load_registry");
      setLoadError(message);
      showToast(message);
      return;
    }
    if (isAppLeftoverRegistryArray(res.data)) {
      const items = res.data;
      setRegistryItems(items);
      setLoadError(undefined);
      setSelectedIds((current) =>
        current.filter((id) => items.some((entry) => entry.id === id)),
      );
    }
  }, [showToast, tk]);

  useEffect(() => {
    void loadRegistry();
  }, [loadRegistry, refreshToken]);

  const filteredRegistry = useMemo(() => {
    const q = search.applied.trim().toLowerCase();
    return registryItems.filter((item) => {
      if (!q) return true;
      return [item.appName, item.version, item.publisher, item.registryPath, item.installLocation, item.uninstallCommand]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [registryItems, search.applied]);

  const selectedFilteredCount = useMemo(
    () => filteredRegistry.filter((item) => selectedIds.includes(item.id)).length,
    [filteredRegistry, selectedIds],
  );
  const allFilteredChecked = filteredRegistry.length > 0 && selectedFilteredCount === filteredRegistry.length;
  const compactLayout = shouldUseRegistryAppsCompactLayout(containerWidth);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRegistry();
    setRefreshing(false);
  };

  const handleToggleId = (itemId: string) => {
    setSelectedIds((current) =>
      current.includes(itemId) ? current.filter((e) => e !== itemId) : [...current, itemId],
    );
  };

  const handleRemoveSelected = async () => {
    if (selectedIds.length === 0) return;
    setBusy(true);
    const res = await window.systemScope.removeLeftoverAppRegistry(selectedIds);
    setBusy(false);

    if (!res.ok) {
      showToast(res.error?.message ?? tk("apps.error.remove_registry"));
      return;
    }
    if (!res.data) return;

    const result = res.data as { deletedKeys: string[]; failedKeys: string[] };
    setSelectedIds([]);
    showToast(
      result.failedKeys.length === 0
        ? tk("apps.toast.registry_all", { count: result.deletedKeys.length })
        : tk("apps.toast.registry_partial", { deletedCount: result.deletedKeys.length, failedCount: result.failedKeys.length }),
    );
    await loadRegistry();
  };


  return { tk, containerRef, registryItems, loadError, refreshing, search, selectedIds, setSelectedIds, expandedId, setExpandedId, busy, filteredRegistry, selectedFilteredCount, allFilteredChecked, compactLayout, handleRefresh, handleToggleId, handleRemoveSelected }
}
