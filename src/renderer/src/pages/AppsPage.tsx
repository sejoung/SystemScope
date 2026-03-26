import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  AppLeftoverDataItem,
  AppLeftoverRegistryItem,
  AppRelatedDataItem,
  AppRemovalResult,
  InstalledApp,
} from "@shared/types";
import { useToast } from "../components/Toast";
import { useI18n } from "../i18n/useI18n";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useSearchFilter } from "../hooks/useSearchFilter";
import { useTabRefresh } from "../hooks/useTabRefresh";
import { StatusMessage } from "../components/StatusMessage";
import { PageLoading } from "../components/PageLoading";
import { CopyableValue } from "../components/CopyableValue";
import { formatBytes } from "../utils/format";

type PlatformFilter = "all" | "mac" | "windows";
type AppsTab = "installed" | "leftover" | "registry";
type ConfidenceFilter = "all" | "high" | "medium" | "low";
type LeftoverSort = "priority" | "name" | "size";

const LEFTOVER_SIZE_IDLE_BATCH_SIZE = 1;
const LEFTOVER_SIZE_PRIORITY_BATCH_SIZE = 4;
const LEFTOVER_SIZE_IDLE_DELAY_MS = 350;

export function AppsPage() {
  const showToast = useToast((s) => s.show);
  const { t, tk } = useI18n();
  const locale = useSettingsStore((state) => state.locale);
  const [activeTab, setActiveTab] = useState<AppsTab>("installed");
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [leftoverItems, setLeftoverItems] = useState<AppLeftoverDataItem[]>([]);
  const [registryItems, setRegistryItems] = useState<AppLeftoverRegistryItem[]>(
    [],
  );
  const installedSearch = useSearchFilter();
  const leftoverSearch = useSearchFilter();
  const registrySearch = useSearchFilter();
  const [installedPlatformFilter, setInstalledPlatformFilter] =
    useState<PlatformFilter>("all");
  const [leftoverPlatformFilter, setLeftoverPlatformFilter] =
    useState<PlatformFilter>("all");
  const [leftoverConfidenceFilter, setLeftoverConfidenceFilter] =
    useState<ConfidenceFilter>("all");
  const [leftoverSort, setLeftoverSort] = useState<LeftoverSort>("priority");
  const [busyAppId, setBusyAppId] = useState<string | null>(null);
  const [leftoverBusy, setLeftoverBusy] = useState(false);
  const [registryBusy, setRegistryBusy] = useState(false);
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);
  const [expandedLeftoverId, setExpandedLeftoverId] = useState<string | null>(
    null,
  );
  const [expandedRegistryId, setExpandedRegistryId] = useState<string | null>(
    null,
  );
  const [relatedLoadingAppId, setRelatedLoadingAppId] = useState<string | null>(
    null,
  );
  const [relatedDataByAppId, setRelatedDataByAppId] = useState<
    Record<string, AppRelatedDataItem[]>
  >({});
  const [selectedRelatedIdsByAppId, setSelectedRelatedIdsByAppId] = useState<
    Record<string, string[]>
  >({});
  const [selectedLeftoverIds, setSelectedLeftoverIds] = useState<string[]>([]);
  const [selectedRegistryIds, setSelectedRegistryIds] = useState<string[]>([]);
  const [pendingUninstallIds, setPendingUninstallIds] = useState<string[]>([]);
  const [loadErrors, setLoadErrors] = useState<
    Partial<Record<AppsTab, string>>
  >({});
  const uninstallRefreshTimersRef = useRef<number[]>([]);
  const leftoverSizeHydratingRef = useRef(false);
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const tkRef = useRef(tk);
  tkRef.current = tk;
  const isWindows = navigator.userAgent.includes("Windows");

  const loadApps = useCallback(async () => {
    const res = await window.systemScope.listInstalledApps();
    if (res.ok && res.data) {
      const items = res.data as InstalledApp[];
      setApps(items);
      setLoadErrors((current) => ({ ...current, installed: undefined }));
      setPendingUninstallIds((current) =>
        current.filter((id) => items.some((app) => app.id === id)),
      );
    } else {
      const message =
        res.error?.message ?? tkRef.current("apps.error.load_installed");
      setLoadErrors((current) => ({ ...current, installed: message }));
      showToastRef.current(message);
    }
  }, []);

  const loadLeftovers = useCallback(async () => {
    const res = await window.systemScope.listLeftoverAppData();
    if (res.ok && res.data) {
      const items = res.data as AppLeftoverDataItem[];
      setLeftoverItems(items);
      setLoadErrors((current) => ({ ...current, leftover: undefined }));
      setSelectedLeftoverIds((current) =>
        current.filter((itemId) => items.some((entry) => entry.id === itemId)),
      );
    } else {
      const message =
        res.error?.message ?? tkRef.current("apps.error.load_leftover");
      setLoadErrors((current) => ({ ...current, leftover: message }));
      showToastRef.current(message);
    }
  }, []);

  const loadRegistry = useCallback(async () => {
    const res = await window.systemScope.listLeftoverAppRegistry();
    if (res.ok && res.data) {
      const items = res.data as AppLeftoverRegistryItem[];
      setRegistryItems(items);
      setLoadErrors((current) => ({ ...current, registry: undefined }));
      setSelectedRegistryIds((current) =>
        current.filter((itemId) => items.some((entry) => entry.id === itemId)),
      );
    } else {
      const message =
        res.error?.message ?? tkRef.current("apps.error.load_registry");
      setLoadErrors((current) => ({ ...current, registry: message }));
      showToastRef.current(message);
    }
  }, []);

  const { loading, refreshingTab, refresh } = useTabRefresh<AppsTab>({
    installed: loadApps,
    leftover: loadLeftovers,
    registry: loadRegistry,
  });

  useEffect(() => {
    void refresh(activeTab, "initial");
  }, [activeTab, locale, refresh]);

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
          const normalizedQuery = installedSearch.applied.trim().toLowerCase();
          if (
            installedPlatformFilter !== "all" &&
            app.platform !== installedPlatformFilter
          )
            return false;
          if (!normalizedQuery) return true;
          return [app.name, app.version, app.publisher, app.installLocation]
            .filter(Boolean)
            .some((value) =>
              String(value).toLowerCase().includes(normalizedQuery),
            );
        })
        .sort((left, right) => left.name.localeCompare(right.name)),
    [
      apps,
      installedPlatformFilter,
      installedSearch.applied,
      pendingUninstallIds,
    ],
  );

  const filteredLeftovers = useMemo(() => {
    const normalizedQuery = leftoverSearch.applied.trim().toLowerCase();
    const confidenceWeight = { high: 0, medium: 1, low: 2 } as const;

    return leftoverItems
      .filter((item) => {
        if (
          leftoverPlatformFilter !== "all" &&
          item.platform !== leftoverPlatformFilter
        )
          return false;
        if (
          leftoverConfidenceFilter !== "all" &&
          item.confidence !== leftoverConfidenceFilter
        )
          return false;
        if (!normalizedQuery) return true;
        return [item.appName, item.label, item.path].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        );
      })
      .sort((left, right) => {
        if (leftoverSort === "size") {
          const sizeDiff = (right.sizeBytes ?? 0) - (left.sizeBytes ?? 0);
          if (sizeDiff !== 0) return sizeDiff;

          const confidenceDiff =
            confidenceWeight[left.confidence] -
            confidenceWeight[right.confidence];
          if (confidenceDiff !== 0) return confidenceDiff;

          return left.appName.localeCompare(right.appName);
        }

        if (leftoverSort === "name") {
          return left.appName.localeCompare(right.appName);
        }

        const confidenceDiff =
          confidenceWeight[left.confidence] -
          confidenceWeight[right.confidence];
        if (confidenceDiff !== 0) return confidenceDiff;

        return left.appName.localeCompare(right.appName);
      });
  }, [
    leftoverConfidenceFilter,
    leftoverItems,
    leftoverPlatformFilter,
    leftoverSearch.applied,
    leftoverSort,
  ]);

  const filteredRegistry = useMemo(() => {
    const normalizedQuery = registrySearch.applied.trim().toLowerCase();
    return registryItems.filter((item) => {
      if (!normalizedQuery) return true;
      return [
        item.appName,
        item.version,
        item.publisher,
        item.registryPath,
        item.installLocation,
        item.uninstallCommand,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [registryItems, registrySearch.applied]);

  const leftoverSizePendingCount = useMemo(
    () => leftoverItems.filter((item) => item.sizeBytes === undefined).length,
    [leftoverItems],
  );
  const leftoverSizeReadyCount = leftoverItems.length - leftoverSizePendingCount;

  useEffect(() => {
    if (activeTab !== "leftover" || leftoverSizeHydratingRef.current) return;

    const prioritizedItems =
      leftoverSort === "size" ? filteredLeftovers : leftoverItems;
    const batchSize =
      leftoverSort === "size"
        ? LEFTOVER_SIZE_PRIORITY_BATCH_SIZE
        : LEFTOVER_SIZE_IDLE_BATCH_SIZE;
    const pendingIds = prioritizedItems
      .filter((item) => item.sizeBytes === undefined)
      .slice(0, batchSize)
      .map((item) => item.id);
    if (pendingIds.length === 0) return;

    let cancelled = false;
    let idleTimerId: number | null = null;

    const runHydration = () => {
      leftoverSizeHydratingRef.current = true;
      void (async () => {
        const res = await window.systemScope.hydrateLeftoverAppDataSizes(
          pendingIds,
        );
        leftoverSizeHydratingRef.current = false;
        if (cancelled) return;

        if (res.ok && res.data) {
          const hydratedItems = res.data as AppLeftoverDataItem[];
          setLeftoverItems((current) =>
            mergeHydratedLeftovers(current, hydratedItems),
          );
          return;
        }

        showToastRef.current(
          res.error?.message ?? tkRef.current("apps.error.load_leftover"),
        );
      })();
    };

    if (leftoverSort === "size") {
      runHydration();
    } else {
      idleTimerId = window.setTimeout(runHydration, LEFTOVER_SIZE_IDLE_DELAY_MS);
    }

    return () => {
      cancelled = true;
      if (idleTimerId !== null) {
        window.clearTimeout(idleTimerId);
      }
    };
  }, [activeTab, filteredLeftovers, leftoverItems, leftoverSort]);

  const selectedFilteredLeftoverCount = useMemo(
    () =>
      filteredLeftovers.filter((item) => selectedLeftoverIds.includes(item.id))
        .length,
    [filteredLeftovers, selectedLeftoverIds],
  );
  const selectedFilteredRegistryCount = useMemo(
    () =>
      filteredRegistry.filter((item) => selectedRegistryIds.includes(item.id))
        .length,
    [filteredRegistry, selectedRegistryIds],
  );
  const allFilteredLeftoversChecked =
    filteredLeftovers.length > 0 &&
    selectedFilteredLeftoverCount === filteredLeftovers.length;
  const allFilteredRegistryChecked =
    filteredRegistry.length > 0 &&
    selectedFilteredRegistryCount === filteredRegistry.length;

  const selectedLeftoverItems = useMemo(
    () =>
      filteredLeftovers.filter((item) => selectedLeftoverIds.includes(item.id)),
    [filteredLeftovers, selectedLeftoverIds],
  );

  const handleUninstall = async (app: InstalledApp) => {
    setBusyAppId(app.id);
    const res = await window.systemScope.uninstallApp({
      appId: app.id,
      relatedDataIds: selectedRelatedIdsByAppId[app.id] ?? [],
    });
    setBusyAppId(null);

    if (!res.ok || !res.data) {
      showToast(res.error?.message ?? tk("apps.error.uninstall_start"));
      return;
    }

    const result = res.data as AppRemovalResult;
    if (result.cancelled) return;

    showToast(
      result.message
        ? t(result.message)
        : result.completed
          ? tk("apps.toast.removed")
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
    await loadLeftovers();
    if (isWindows) {
      await loadRegistry();
    }
  };

  const handleToggleLeftoverId = (itemId: string) => {
    setSelectedLeftoverIds((current) =>
      current.includes(itemId)
        ? current.filter((entry) => entry !== itemId)
        : [...current, itemId],
    );
  };

  const handleRemoveSelectedLeftovers = async () => {
    if (selectedLeftoverIds.length === 0) return;

    setLeftoverBusy(true);
    const res =
      await window.systemScope.removeLeftoverAppData(selectedLeftoverIds);
    setLeftoverBusy(false);

    if (!res.ok || !res.data) {
      showToast(res.error?.message ?? tk("apps.error.remove_leftover"));
      return;
    }

    const result = res.data as {
      deletedPaths: string[];
      failedPaths: string[];
    };
    setSelectedLeftoverIds([]);
    showToast(
      result.failedPaths.length === 0
        ? tk("apps.toast.leftover_all", { count: result.deletedPaths.length })
        : tk("apps.toast.leftover_partial", {
            deletedCount: result.deletedPaths.length,
            failedCount: result.failedPaths.length,
          }),
    );
    await loadLeftovers();
  };

  const handleOpenLeftoverPath = async (targetPath: string) => {
    const res = await window.systemScope.showInFolder(targetPath);
    if (!res.ok) {
      showToast(res.error?.message ?? tk("apps.error.open_path"));
    }
  };

  const handleToggleRelatedData = async (app: InstalledApp) => {
    if (expandedAppId === app.id) {
      setExpandedAppId(null);
      return;
    }

    setExpandedAppId(app.id);
    if (relatedDataByAppId[app.id]) {
      return;
    }

    setRelatedLoadingAppId(app.id);
    const res = await window.systemScope.getAppRelatedData(app.id);
    setRelatedLoadingAppId(null);

    if (!res.ok || !res.data) {
      showToast(res.error?.message ?? tk("apps.error.load_related"));
      return;
    }

    const items = res.data as AppRelatedDataItem[];
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

      return {
        ...current,
        [appId]: [...selected],
      };
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

  const handleToggleRegistryId = (itemId: string) => {
    setSelectedRegistryIds((current) =>
      current.includes(itemId)
        ? current.filter((entry) => entry !== itemId)
        : [...current, itemId],
    );
  };

  const handleRemoveSelectedRegistry = async () => {
    if (selectedRegistryIds.length === 0) return;

    setRegistryBusy(true);
    const res =
      await window.systemScope.removeLeftoverAppRegistry(selectedRegistryIds);
    setRegistryBusy(false);

    if (!res.ok || !res.data) {
      showToast(res.error?.message ?? tk("apps.error.remove_registry"));
      return;
    }

    const result = res.data as { deletedKeys: string[]; failedKeys: string[] };
    setSelectedRegistryIds([]);
    showToast(
      result.failedKeys.length === 0
        ? tk("apps.toast.registry_all", { count: result.deletedKeys.length })
        : tk("apps.toast.registry_partial", {
            deletedCount: result.deletedKeys.length,
            failedCount: result.failedKeys.length,
          }),
    );
    await loadRegistry();
    await loadApps();
  };

  return (
    <div data-testid="page-apps">
      <div style={pageHeaderStyle}>
        <div style={{ display: "grid", gap: "6px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>
            {tk("apps.page.title")}
          </h2>
          <div style={pageDescriptionStyle}>
            {t(
              "Review installed apps, inspect leftover data, and clean obsolete uninstall metadata from one place.",
            )}
          </div>
        </div>
        <div
          role="tablist"
          aria-label={tk("apps.page.title")}
          style={pageTabsStyle}
        >
          <PageTab
            id="apps-installed"
            active={activeTab === "installed"}
            onClick={() => setActiveTab("installed")}
          >
            {tk("apps.tab.installed")}
          </PageTab>
          <PageTab
            id="apps-leftover"
            active={activeTab === "leftover"}
            onClick={() => setActiveTab("leftover")}
          >
            {tk("apps.tab.leftover")}
          </PageTab>
          {isWindows && (
            <PageTab
              id="apps-registry"
              active={activeTab === "registry"}
              onClick={() => setActiveTab("registry")}
            >
              {tk("apps.tab.registry")}
            </PageTab>
          )}
        </div>
        <div style={pageHelpStyle}>
          {activeTab === "installed"
            ? tk("apps.description.installed")
            : activeTab === "leftover"
              ? tk("apps.description.leftover")
              : tk("apps.description.registry")}
        </div>
      </div>

      {loading ? (
        <PageLoading
          message={
            activeTab === "installed"
              ? tk("apps.loading.installed")
              : activeTab === "leftover"
                ? tk("apps.loading.leftover")
                : tk("apps.loading.registry")
          }
        />
      ) : activeTab === "installed" ? (
        <section style={sectionStyle}>
          <div style={headerStyle}>
            <div style={titleRowStyle}>
              <span style={titleStyle}>{tk("apps.tab.installed")}</span>
              <span style={badgeStyle}>{filteredApps.length}</span>
            </div>
            <div style={actionsStyle}>
              <button
                type="button"
                onClick={() => void refresh("installed")}
                disabled={refreshingTab === "installed"}
                style={secondaryBtnStyle(refreshingTab === "installed")}
              >
                {refreshingTab === "installed"
                  ? tk("common.refreshing")
                  : tk("apps.action.refresh")}
              </button>
              {isWindows ? (
                <button
                  type="button"
                  onClick={() => void handleOpenSystemSettings()}
                  style={secondaryButtonStyle}
                >
                  {tk("apps.action.open_system_settings")}
                </button>
              ) : null}
              <SearchInput
                value={installedSearch.draft}
                onChange={installedSearch.setDraft}
                onClear={installedSearch.clear}
                placeholder={tk("apps.search.installed_placeholder")}
              />
              <select
                value={installedPlatformFilter}
                onChange={(e) =>
                  setInstalledPlatformFilter(e.target.value as PlatformFilter)
                }
                style={inputStyle}
              >
                <option value="all">{tk("apps.platform.all")}</option>
                <option value="mac">macOS</option>
                <option value="windows">Windows</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: "12px" }}>
            <StatusMessage message={tk("apps.helper.installed")} />
          </div>
          <div style={infoBarStyle}>
            <span style={infoLabelStyle}>
              {t("Installed apps are sorted by name so known tools are easier to find.")}
            </span>
            <span style={infoReasonStyle}>
              {installedSearch.applied
                ? `${tk("apps.search.label")}: ${installedSearch.applied}`
                : tk("apps.count.installed_summary", { count: filteredApps.length })}
            </span>
          </div>

          {loadErrors.installed && apps.length === 0 ? (
            <StatusMessage
              tone="error"
              message={loadErrors.installed}
              action={
                <button
                  type="button"
                  onClick={() => void refresh("installed")}
                  style={btnStyle}
                >
                  {tk("apps.action.refresh")}
                </button>
              }
            />
          ) : filteredApps.length === 0 ? (
            <StatusMessage message={tk("apps.empty.installed")} />
          ) : (
            <>
              <StatusMessage message={tk("apps.danger.installed")} />
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={stickyHeaderRowStyle}>
                      <th style={thStyle}>{tk("apps.table.name")}</th>
                      <th style={thStyle}>{tk("apps.table.version")}</th>
                      <th style={thStyle}>{tk("apps.table.publisher")}</th>
                      <th style={thStyle}>{tk("apps.table.platform")}</th>
                      <th style={thStyle}>{tk("apps.table.location")}</th>
                      <th style={{ ...thStyle, textAlign: "right", width: "220px" }}>
                        {tk("apps.table.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApps.map((entry) => (
                      <Fragment key={entry.id}>
                        <tr style={rowStyle}>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                                {entry.name}
                              </span>
                              {entry.protected ? (
                                <span style={protectedBadgeStyle}>
                                  {tk("apps.badge.protected")}
                                </span>
                              ) : null}
                            </div>
                            {entry.protectedReason ? (
                              <div style={subtleTextStyle}>{t(entry.protectedReason)}</div>
                            ) : null}
                          </td>
                          <td style={monoCellStyle}>{entry.version ?? "-"}</td>
                          <td style={tdStyle}>{entry.publisher ?? "-"}</td>
                          <td style={tdStyle}>
                            <Badge
                              text={entry.platform === "mac" ? "macOS" : "Windows"}
                              color={
                                entry.platform === "mac"
                                  ? "var(--accent-cyan)"
                                  : "var(--accent-yellow)"
                              }
                            />
                          </td>
                          <td style={{ ...tdStyle, maxWidth: "340px" }}>
                            <CopyableValue
                              value={entry.installLocation ?? entry.launchPath ?? ""}
                              emptyValue="-"
                              fontSize="12px"
                              color="var(--text-muted)"
                              multiline
                              maxWidth="340px"
                            />
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                            <button
                              type="button"
                              onClick={() => void handleToggleRelatedData(entry)}
                              style={openBtn}
                            >
                              {expandedAppId === entry.id
                                ? tk("apps.action.hide_data")
                                : tk("apps.action.related_data")}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleOpenLocation(entry.id)}
                              style={openBtn}
                            >
                              {tk("apps.action.open")}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleUninstall(entry)}
                              disabled={entry.protected || busyAppId === entry.id}
                              style={{
                                ...actionBtnStyle,
                                opacity:
                                  entry.protected || busyAppId === entry.id ? 0.55 : 1,
                                cursor:
                                  entry.protected || busyAppId === entry.id
                                    ? "default"
                                    : "pointer",
                              }}
                            >
                              {busyAppId === entry.id
                                ? tk("apps.action.working")
                                : entry.platform === "mac"
                                  ? tk("apps.action.move_to_trash")
                                  : entry.uninstallKind === "open_settings"
                                    ? tk("apps.action.open_system_settings")
                                    : tk("apps.action.uninstall")}
                            </button>
                          </td>
                        </tr>
                        {expandedAppId === entry.id ? (
                          <tr style={rowStyle}>
                            <td colSpan={6} style={{ padding: "0 6px 12px 6px" }}>
                              <div style={relatedPanelStyle}>
                                <div style={detailsHeaderStyle}>
                                  <div>
                                    <div style={detailsTitleStyle}>{tk("apps.related.title")}</div>
                                    <div style={detailsBodyTextStyle}>
                                      {tk("apps.related.description")}
                                    </div>
                                  </div>
                                  <div style={detailsMetaStyle}>
                                    {tk("common.selected", {
                                      count:
                                        (selectedRelatedIdsByAppId[entry.id] ?? []).length,
                                    })}
                                  </div>
                                </div>
                                {relatedLoadingAppId === entry.id ? (
                                  <div style={relatedEmptyStyle}>
                                    {tk("apps.related.loading")}
                                  </div>
                                ) : (relatedDataByAppId[entry.id] ?? []).length === 0 ? (
                                  <div style={relatedEmptyStyle}>
                                    {tk("apps.related.empty")}
                                  </div>
                                ) : (
                                  <div style={{ display: "grid", gap: "8px" }}>
                                    {(relatedDataByAppId[entry.id] ?? []).map((item) => {
                                      const checked = (
                                        selectedRelatedIdsByAppId[entry.id] ?? []
                                      ).includes(item.id);
                                      return (
                                        <label key={item.id} style={relatedItemStyle}>
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() =>
                                              handleToggleRelatedId(entry.id, item.id)
                                            }
                                          />
                                          <div style={{ display: "grid", gap: "3px" }}>
                                            <span style={detailsTitleStyle}>{item.label}</span>
                                            <div style={detailsBodyTextStyle}>
                                              <CopyableValue
                                                value={item.path}
                                                fontSize="12px"
                                                color="var(--text-muted)"
                                                multiline
                                              />
                                            </div>
                                          </div>
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      ) : activeTab === "leftover" ? (
        <section style={sectionStyle}>
          <div style={headerStyle}>
            <div style={titleRowStyle}>
              <span style={titleStyle}>{tk("apps.tab.leftover")}</span>
              <span style={badgeStyle}>{filteredLeftovers.length}</span>
            </div>
            <div style={actionsStyle}>
              <button
                type="button"
                onClick={() => void refresh("leftover")}
                disabled={refreshingTab === "leftover"}
                style={secondaryBtnStyle(refreshingTab === "leftover")}
              >
                {refreshingTab === "leftover"
                  ? tk("common.refreshing")
                  : tk("apps.action.refresh")}
              </button>
              <SearchInput
                value={leftoverSearch.draft}
                onChange={leftoverSearch.setDraft}
                onClear={leftoverSearch.clear}
                placeholder={tk("apps.search.leftover_placeholder")}
              />
              <select
                value={leftoverPlatformFilter}
                onChange={(e) =>
                  setLeftoverPlatformFilter(e.target.value as PlatformFilter)
                }
                style={inputStyle}
              >
                <option value="all">{tk("apps.platform.all")}</option>
                <option value="mac">macOS</option>
                <option value="windows">Windows</option>
              </select>
              <select
                value={leftoverConfidenceFilter}
                onChange={(e) =>
                  setLeftoverConfidenceFilter(e.target.value as ConfidenceFilter)
                }
                style={inputStyle}
              >
                <option value="all">{tk("apps.confidence.all")}</option>
                <option value="high">{tk("apps.confidence.high")}</option>
                <option value="medium">{tk("apps.confidence.medium")}</option>
                <option value="low">{tk("apps.confidence.low")}</option>
              </select>
              <select
                value={leftoverSort}
                onChange={(e) => setLeftoverSort(e.target.value as LeftoverSort)}
                style={inputStyle}
              >
                <option value="size">{tk("apps.sort.size")}</option>
                <option value="priority">{tk("apps.sort.priority")}</option>
                <option value="name">{tk("apps.sort.name")}</option>
              </select>
              <button
                type="button"
                onClick={() => void handleRemoveSelectedLeftovers()}
                disabled={leftoverBusy || selectedLeftoverIds.length === 0}
                style={{
                  ...actionBtnStyle,
                  opacity:
                    leftoverBusy || selectedLeftoverIds.length === 0 ? 0.55 : 1,
                  cursor:
                    leftoverBusy || selectedLeftoverIds.length === 0
                      ? "default"
                      : "pointer",
                }}
              >
                {leftoverBusy
                  ? tk("apps.action.working")
                  : tk("apps.action.move_selected_to_trash")}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: "12px" }}>
            <StatusMessage message={tk("apps.helper.leftover")} />
          </div>
          <div style={infoBarStyle}>
            <span style={infoLabelStyle}>
              {leftoverSizePendingCount > 0
                ? tk("apps.status.leftover_sizes_loading", {
                    ready: leftoverSizeReadyCount,
                    total: leftoverItems.length,
                    remaining: leftoverSizePendingCount,
                  })
                : tk("apps.status.leftover_sizes_ready", {
                    count: leftoverItems.length,
                  })}
            </span>
            <span style={infoReasonStyle}>
              {leftoverSearch.applied
                ? `${tk("apps.search.label")}: ${leftoverSearch.applied}`
                : tk("apps.selection.leftover_summary", {
                    high: selectedLeftoverItems.filter(
                      (item) => item.confidence === "high",
                    ).length,
                    medium: selectedLeftoverItems.filter(
                      (item) => item.confidence === "medium",
                    ).length,
                    low: selectedLeftoverItems.filter(
                      (item) => item.confidence === "low",
                    ).length,
                  })}
            </span>
          </div>

          {loadErrors.leftover && leftoverItems.length === 0 ? (
            <StatusMessage
              tone="error"
              message={loadErrors.leftover}
              action={
                <button
                  type="button"
                  onClick={() => void refresh("leftover")}
                  style={btnStyle}
                >
                  {tk("apps.action.refresh")}
                </button>
              }
            />
          ) : filteredLeftovers.length === 0 ? (
            <StatusMessage message={tk("apps.empty.leftover")} />
          ) : (
            <>
              <StatusMessage message={tk("apps.danger.leftover")} />
              <div style={tableWrapStyle}>
                <table style={{ ...tableStyle, minWidth: "980px" }}>
                  <thead>
                    <tr style={stickyHeaderRowStyle}>
                      <th style={{ ...thStyle, width: "44px" }}>
                        <input
                          type="checkbox"
                          checked={allFilteredLeftoversChecked}
                          disabled={filteredLeftovers.length === 0}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setSelectedLeftoverIds((current) => {
                                const next = new Set(current);
                                filteredLeftovers.forEach((item) => next.add(item.id));
                                return [...next];
                              });
                            } else {
                              setSelectedLeftoverIds((current) =>
                                current.filter(
                                  (itemId) =>
                                    !filteredLeftovers.some((item) => item.id === itemId),
                                ),
                              );
                            }
                          }}
                        />
                      </th>
                      <th style={thStyle}>{tk("apps.table.name")}</th>
                      <th style={thStyle}>{tk("apps.confidence.all")}</th>
                      <th style={thStyle}>{tk("apps.table.platform")}</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>{t("Size")}</th>
                      <th style={thStyle}>{tk("apps.table.location")}</th>
                      <th style={{ ...thStyle, textAlign: "right", width: "180px" }}>
                        {tk("apps.table.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeftovers.map((item) => {
                      const checked = selectedLeftoverIds.includes(item.id);
                      return (
                        <Fragment key={item.id}>
                          <tr style={rowStyle}>
                            <td style={tdStyle}>
                              <input
                                id={`leftover-${item.id}`}
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleToggleLeftoverId(item.id)}
                              />
                            </td>
                            <td style={tdStyle}>
                              <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                                <label htmlFor={`leftover-${item.id}`} style={{ cursor: "pointer" }}>
                                  {item.appName}
                                </label>
                              </div>
                              <div style={subtleTextStyle}>{item.label}</div>
                            </td>
                            <td style={tdStyle}>
                              <Badge
                                text={getConfidenceLabel(item.confidence, tk)}
                                color={getConfidenceColor(item.confidence)}
                              />
                            </td>
                            <td style={tdStyle}>
                              <Badge
                                text={item.platform === "mac" ? "macOS" : "Windows"}
                                color={
                                  item.platform === "mac"
                                    ? "var(--accent-cyan)"
                                    : "var(--accent-yellow)"
                                }
                              />
                            </td>
                            <td style={{ ...monoCellStyle, textAlign: "right" }}>
                              {item.sizeBytes !== undefined ? (
                                formatBytes(item.sizeBytes)
                              ) : (
                                <span style={pendingValueStyle}>{t("Calculating...")}</span>
                              )}
                            </td>
                            <td style={{ ...tdStyle, maxWidth: "340px" }}>
                              <CopyableValue
                                value={item.path}
                                fontSize="12px"
                                color="var(--text-muted)"
                                multiline
                                maxWidth="340px"
                              />
                            </td>
                            <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedLeftoverId((current) =>
                                    current === item.id ? null : item.id,
                                  )
                                }
                                style={openBtn}
                              >
                                {expandedLeftoverId === item.id
                                  ? tk("apps.action.hide_data")
                                  : t("Details")}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleOpenLeftoverPath(item.path)}
                                style={openBtn}
                              >
                                {tk("apps.action.open")}
                              </button>
                            </td>
                          </tr>
                          {expandedLeftoverId === item.id ? (
                            <tr style={rowStyle}>
                              <td colSpan={7} style={{ padding: "0 8px 12px 8px" }}>
                                <div style={detailPanelStyle}>
                                  <div style={detailGridStyle}>
                                    <div style={detailBlockStyle}>
                                      <strong style={detailLabelStyle}>
                                        {tk("apps.table.location")}
                                      </strong>
                                      <div style={detailValueStyle}>
                                        <CopyableValue
                                          value={item.path}
                                          fontSize="12px"
                                          color="var(--text-secondary)"
                                          multiline
                                        />
                                      </div>
                                    </div>
                                    <div style={detailBlockStyle}>
                                      <strong style={detailLabelStyle}>
                                        {tk("apps.reason.why")}
                                      </strong>
                                      <div style={detailsBodyTextStyle}>{t(item.reason)}</div>
                                    </div>
                                    <div style={detailBlockStyle}>
                                      <strong style={detailLabelStyle}>
                                        {tk("apps.reason.risk")}
                                      </strong>
                                      <div style={detailsBodyTextStyle}>{t(item.risk)}</div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      ) : (
        <section style={sectionStyle}>
          <div style={headerStyle}>
            <div style={titleRowStyle}>
              <span style={titleStyle}>{tk("apps.tab.registry")}</span>
              <span style={badgeStyle}>{filteredRegistry.length}</span>
            </div>
            <div style={actionsStyle}>
              <button
                type="button"
                onClick={() => void refresh("registry")}
                disabled={refreshingTab === "registry"}
                style={secondaryBtnStyle(refreshingTab === "registry")}
              >
                {refreshingTab === "registry"
                  ? tk("common.refreshing")
                  : tk("apps.action.refresh")}
              </button>
              <SearchInput
                value={registrySearch.draft}
                onChange={registrySearch.setDraft}
                onClear={registrySearch.clear}
                placeholder={tk("apps.search.registry_placeholder")}
              />
              <button
                type="button"
                onClick={() => void handleRemoveSelectedRegistry()}
                disabled={registryBusy || selectedRegistryIds.length === 0}
                style={{
                  ...actionBtnStyle,
                  opacity:
                    registryBusy || selectedRegistryIds.length === 0 ? 0.55 : 1,
                  cursor:
                    registryBusy || selectedRegistryIds.length === 0
                      ? "default"
                      : "pointer",
                }}
              >
                {registryBusy
                  ? tk("apps.action.working")
                  : tk("apps.action.remove_selected_registry")}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: "12px" }}>
            <StatusMessage message={tk("apps.helper.registry")} />
          </div>
          <div style={infoBarStyle}>
            <span style={infoLabelStyle}>{tk("apps.registry.warning")}</span>
            <span style={infoReasonStyle}>
              {registrySearch.applied
                ? `${tk("apps.search.label")}: ${registrySearch.applied}`
                : tk("common.selected", { count: selectedFilteredRegistryCount })}
            </span>
          </div>

          {loadErrors.registry && registryItems.length === 0 ? (
            <StatusMessage
              tone="error"
              message={loadErrors.registry}
              action={
                <button
                  type="button"
                  onClick={() => void refresh("registry")}
                  style={btnStyle}
                >
                  {tk("apps.action.refresh")}
                </button>
              }
            />
          ) : filteredRegistry.length === 0 ? (
            <StatusMessage
              title={tk("apps.empty.registry")}
              message={tk("apps.empty.registry_detail")}
            />
          ) : (
            <>
              <StatusMessage tone="error" message={tk("apps.danger.registry")} />
              <div style={tableWrapStyle}>
                <table style={{ ...tableStyle, minWidth: "980px" }}>
                  <thead>
                    <tr style={stickyHeaderRowStyle}>
                      <th style={{ ...thStyle, width: "44px" }}>
                        <input
                          type="checkbox"
                          checked={allFilteredRegistryChecked}
                          disabled={filteredRegistry.length === 0}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setSelectedRegistryIds((current) => {
                                const next = new Set(current);
                                filteredRegistry.forEach((item) => next.add(item.id));
                                return [...next];
                              });
                            } else {
                              setSelectedRegistryIds((current) =>
                                current.filter(
                                  (itemId) =>
                                    !filteredRegistry.some((item) => item.id === itemId),
                                ),
                              );
                            }
                          }}
                        />
                      </th>
                      <th style={thStyle}>{tk("apps.table.name")}</th>
                      <th style={thStyle}>{tk("apps.table.version")}</th>
                      <th style={thStyle}>{tk("apps.table.publisher")}</th>
                      <th style={thStyle}>{tk("apps.registry.install_location")}</th>
                      <th style={{ ...thStyle, textAlign: "right", width: "140px" }}>
                        {tk("apps.table.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRegistry.map((item) => {
                      const checked = selectedRegistryIds.includes(item.id);
                      return (
                        <Fragment key={item.id}>
                          <tr style={rowStyle}>
                            <td style={tdStyle}>
                              <input
                                id={`registry-${item.id}`}
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleToggleRegistryId(item.id)}
                              />
                            </td>
                            <td style={tdStyle}>
                              <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                                <label htmlFor={`registry-${item.id}`} style={{ cursor: "pointer" }}>
                                  {item.appName}
                                </label>
                              </div>
                              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" }}>
                                <Badge text="Windows" color="var(--accent-yellow)" />
                                <Badge
                                  text={
                                    item.installLocationExists
                                      ? tk("apps.registry.install_missing")
                                      : tk("apps.registry.install_unavailable")
                                  }
                                  color="var(--accent-red)"
                                />
                                <Badge
                                  text={
                                    item.uninstallerExists
                                      ? tk("apps.registry.uninstaller_missing")
                                      : tk("apps.registry.uninstall_unavailable")
                                  }
                                  color="var(--accent-red)"
                                />
                              </div>
                            </td>
                            <td style={monoCellStyle}>{item.version ?? "-"}</td>
                            <td style={tdStyle}>{item.publisher ?? "-"}</td>
                            <td style={{ ...tdStyle, maxWidth: "320px" }}>
                              <CopyableValue
                                value={item.installLocation ?? ""}
                                emptyValue="-"
                                fontSize="12px"
                                color="var(--text-muted)"
                                multiline
                                maxWidth="320px"
                              />
                            </td>
                            <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedRegistryId((current) =>
                                    current === item.id ? null : item.id,
                                  )
                                }
                                style={openBtn}
                              >
                                {expandedRegistryId === item.id
                                  ? tk("apps.action.hide_data")
                                  : t("Details")}
                              </button>
                            </td>
                          </tr>
                          {expandedRegistryId === item.id ? (
                            <tr style={rowStyle}>
                              <td colSpan={6} style={{ padding: "0 8px 12px 8px" }}>
                                <div style={detailPanelStyle}>
                                  <div style={detailGridStyle}>
                                    <div style={detailBlockStyle}>
                                      <strong style={detailLabelStyle}>
                                        {tk("apps.registry.path")}
                                      </strong>
                                      <div style={detailValueStyle}>
                                        <CopyableValue
                                          value={item.registryPath}
                                          fontSize="12px"
                                          color="var(--text-secondary)"
                                          multiline
                                        />
                                      </div>
                                    </div>
                                    <div style={detailBlockStyle}>
                                      <strong style={detailLabelStyle}>
                                        {tk("apps.registry.install_location")}
                                      </strong>
                                      <div style={detailValueStyle}>
                                        <CopyableValue
                                          value={item.installLocation ?? ""}
                                          emptyValue="-"
                                          fontSize="12px"
                                          color="var(--text-secondary)"
                                          multiline
                                        />
                                      </div>
                                    </div>
                                    <div style={detailBlockStyle}>
                                      <strong style={detailLabelStyle}>
                                        {tk("apps.registry.uninstall_command")}
                                      </strong>
                                      <div style={detailValueStyle}>
                                        <CopyableValue
                                          value={item.uninstallCommand ?? ""}
                                          emptyValue="-"
                                          fontSize="12px"
                                          color="var(--text-secondary)"
                                          multiline
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

export function getConfidenceLabel(
  confidence: AppLeftoverDataItem["confidence"],
  tk: (
    key:
      | "apps.confidence.high"
      | "apps.confidence.medium"
      | "apps.confidence.low",
  ) => string,
): string {
  switch (confidence) {
    case "high":
      return tk("apps.confidence.high");
    case "medium":
      return tk("apps.confidence.medium");
    default:
      return tk("apps.confidence.low");
  }
}

function mergeHydratedLeftovers(
  currentItems: AppLeftoverDataItem[],
  hydratedItems: AppLeftoverDataItem[],
): AppLeftoverDataItem[] {
  const hydratedById = new Map(hydratedItems.map((item) => [item.id, item]));
  return currentItems.map((item) => hydratedById.get(item.id) ?? item);
}

export function getConfidenceColor(
  confidence: AppLeftoverDataItem["confidence"],
): string {
  switch (confidence) {
    case "high":
      return "var(--accent-green)";
    case "medium":
      return "var(--accent-yellow)";
    default:
      return "var(--accent-red)";
  }
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

const secondaryButtonStyle: React.CSSProperties = {
  padding: "8px 14px",
  fontSize: "13px",
  fontWeight: 600,
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  background: "var(--bg-card-hover)",
  color: "var(--text-primary)",
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  padding: "7px 10px",
  fontSize: "12px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
};

const pageHeaderStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
  marginBottom: "16px",
};

const pageDescriptionStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--text-secondary)",
  lineHeight: 1.6,
};

const pageTabsStyle: React.CSSProperties = {
  display: "flex",
  gap: "4px",
  background: "var(--bg-secondary)",
  borderRadius: "8px",
  padding: "3px",
};

const pageHelpStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--text-muted)",
  lineHeight: 1.6,
};

function secondaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    ...secondaryButtonStyle,
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? "default" : "pointer",
  };
}

const sectionStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-card)",
  borderRadius: "var(--radius-lg)",
  border: "1px solid var(--border)",
  padding: "16px",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "16px",
};

const titleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  minWidth: 0,
};

const titleStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-secondary)",
};

const badgeStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: "999px",
  background: "var(--bg-card-hover)",
  color: "var(--text-secondary)",
  whiteSpace: "nowrap",
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
};

const searchWrapStyle: React.CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
};

const clearSearchButtonStyle: React.CSSProperties = {
  position: "absolute",
  right: "8px",
  border: "none",
  background: "transparent",
  color: "var(--text-muted)",
  cursor: "pointer",
  fontSize: "14px",
  padding: "0 2px",
  lineHeight: 1,
};

const tableWrapStyle: React.CSSProperties = {
  overflowX: "auto",
  overflowY: "clip",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: "860px",
  borderCollapse: "collapse",
  fontSize: "13px",
};

const stickyHeaderRowStyle: React.CSSProperties = {
  borderBottom: "1px solid var(--border)",
  position: "sticky",
  top: 0,
  background: "var(--bg-card)",
  zIndex: 1,
  boxShadow: "0 1px 0 var(--border)",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 8px",
  color: "var(--text-muted)",
  fontWeight: 600,
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 8px",
  color: "var(--text-secondary)",
  verticalAlign: "top",
  fontSize: "14px",
  lineHeight: 1.4,
};

const monoCellStyle: React.CSSProperties = {
  ...tdStyle,
  fontFamily: "monospace",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

const subtleTextStyle: React.CSSProperties = {
  marginTop: "6px",
  color: "var(--text-muted)",
  lineHeight: 1.5,
};

const openBtn: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: "12px",
  fontWeight: 600,
  border: "none",
  borderRadius: "6px",
  background: "var(--bg-card-hover)",
  color: "var(--text-primary)",
  cursor: "pointer",
  marginRight: "6px",
};

const actionBtnStyle: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: "12px",
  fontWeight: 600,
  border: "none",
  borderRadius: "6px",
  background: "var(--accent-red)",
  color: "var(--text-on-accent)",
  cursor: "pointer",
};

const protectedBadgeStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: "999px",
  background: "var(--alert-yellow-soft)",
  color: "var(--accent-yellow)",
};

const relatedPanelStyle: React.CSSProperties = {
  marginTop: "4px",
  padding: "14px",
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
};

const rowStyle: React.CSSProperties = {
  borderBottom: "1px solid var(--border)",
};

const relatedItemStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "16px 1fr",
  alignItems: "start",
  gap: "10px",
  padding: "10px 12px",
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  cursor: "pointer",
};

const relatedEmptyStyle: React.CSSProperties = {
  padding: "14px 12px",
  color: "var(--text-muted)",
  fontSize: "13px",
  lineHeight: 1.5,
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
  borderRadius: "10px",
};

const infoBarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  marginBottom: "12px",
  padding: "10px 14px",
  background: "var(--bg-primary)",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  flexWrap: "wrap",
};

const infoLabelStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--text-primary)",
};

const infoReasonStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--text-muted)",
};

const detailPanelStyle: React.CSSProperties = {
  padding: "14px",
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
};

const detailGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
};

const detailBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: "6px",
};

const detailLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--text-secondary)",
};

const detailValueStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--text-muted)",
  fontFamily: "monospace",
  wordBreak: "break-all",
  lineHeight: 1.55,
};

const detailsHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "10px",
  gap: "10px",
  flexWrap: "wrap",
};

const detailsTitleStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 700,
  color: "var(--text-primary)",
};

const detailsBodyTextStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--text-muted)",
  lineHeight: 1.55,
};

const detailsMetaStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--text-secondary)",
  fontWeight: 600,
};

const pendingValueStyle: React.CSSProperties = {
  color: "var(--text-muted)",
  fontFamily: "inherit",
  fontStyle: "italic",
};

function SearchInput({
  value,
  onChange,
  onClear,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder: string;
}) {
  return (
    <div style={searchWrapStyle}>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        style={{ ...inputStyle, minWidth: "240px", paddingRight: "30px" }}
      />
      {value ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          style={clearSearchButtonStyle}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      style={{
        fontSize: "11px",
        fontWeight: 700,
        padding: "3px 8px",
        borderRadius: "999px",
        background: `${color}20`,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

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
