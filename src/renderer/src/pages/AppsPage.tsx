import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
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
import { CopyableValue } from "../components/CopyableValue";
import { formatBytes } from "../utils/format";

type PlatformFilter = "all" | "mac" | "windows";
type AppsTab = "installed" | "leftover" | "registry";
type ConfidenceFilter = "all" | "high" | "medium" | "low";
type LeftoverSort = "priority" | "name" | "size";

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
      installedSearch.applied,
      installedPlatformFilter,
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
  }, [registrySearch.applied, registryItems]);
  const selectedFilteredLeftoverCount = useMemo(
    () =>
      filteredLeftovers.filter((item) => selectedLeftoverIds.includes(item.id))
        .length,
    [filteredLeftovers, selectedLeftoverIds],
  );
  const allFilteredLeftoversChecked =
    filteredLeftovers.length > 0 &&
    selectedFilteredLeftoverCount === filteredLeftovers.length;
  const selectedFilteredRegistryCount = useMemo(
    () =>
      filteredRegistry.filter((item) => selectedRegistryIds.includes(item.id))
        .length,
    [filteredRegistry, selectedRegistryIds],
  );
  const allFilteredRegistryChecked =
    filteredRegistry.length > 0 &&
    selectedFilteredRegistryCount === filteredRegistry.length;
  const selectedLeftoverItems = filteredLeftovers.filter((item) =>
    selectedLeftoverIds.includes(item.id),
  );
  const selectedRegistryItems = filteredRegistry.filter((item) =>
    selectedRegistryIds.includes(item.id),
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
      if (selected.has(itemId)) {
        selected.delete(itemId);
      } else {
        selected.add(itemId);
      }

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
      <div style={stickyHeaderStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "16px",
            flexWrap: "wrap",
          }}
        >
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>
            {tk("apps.page.title")}
          </h2>
          <div
            role="tablist"
            aria-label={tk("apps.page.title")}
            style={{
              display: "flex",
              gap: "4px",
              background: "var(--bg-secondary)",
              borderRadius: "8px",
              padding: "3px",
            }}
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
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "14px",
            padding: "10px 14px",
            background: "var(--bg-card)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <StepBadge
              active={activeTab === "installed"}
              text={tk("apps.flow.installed")}
            />
            <StepBadge
              active={activeTab === "leftover"}
              text={tk("apps.flow.leftover")}
            />
            {isWindows ? (
              <StepBadge
                active={activeTab === "registry"}
                text={tk("apps.flow.registry")}
              />
            ) : null}
          </div>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {activeTab === "installed"
              ? tk("apps.description.installed")
              : activeTab === "leftover"
                ? tk("apps.description.leftover")
                : tk("apps.description.registry")}
          </span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: "12px",
              color: "var(--text-secondary)",
              fontWeight: 600,
            }}
          >
            {activeTab === "installed"
              ? tk("apps.count.apps", { count: filteredApps.length })
              : activeTab === "leftover"
                ? tk("apps.count.items", { count: filteredLeftovers.length })
                : tk("apps.count.items", { count: filteredRegistry.length })}
          </span>
          {activeTab === "installed" && installedSearch.applied && (
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {tk("apps.search.label")}:{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {installedSearch.applied}
              </strong>
            </span>
          )}
          {activeTab === "leftover" && leftoverSearch.applied && (
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {tk("apps.search.label")}:{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {leftoverSearch.applied}
              </strong>
            </span>
          )}
          {activeTab === "registry" && registrySearch.applied && (
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {tk("apps.search.label")}:{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {registrySearch.applied}
              </strong>
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <StatusMessage
          message={
            activeTab === "installed"
              ? tk("apps.loading.installed")
              : activeTab === "leftover"
                ? tk("apps.loading.leftover")
                : tk("apps.loading.registry")
          }
        />
      ) : activeTab === "installed" ? (
        <div>
          <div style={stickyTabControlsWrapStyle}>
            <div style={tabControlsStyle}>
              <button
                onClick={() => void refresh("installed")}
                disabled={refreshingTab === "installed"}
                style={secondaryBtnStyle(refreshingTab === "installed")}
              >
                {refreshingTab === "installed"
                  ? tk("common.refreshing")
                  : tk("apps.action.refresh")}
              </button>
              {isWindows && (
                <button
                  onClick={() => void handleOpenSystemSettings()}
                  style={{
                    ...btnStyle,
                    background: "var(--bg-card-hover)",
                    color: "var(--text-primary)",
                  }}
                >
                  {tk("apps.action.open_system_settings")}
                </button>
              )}
              <input
                value={installedSearch.draft}
                onChange={(e) => installedSearch.setDraft(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") installedSearch.apply();
                }}
                placeholder={tk("apps.search.installed_placeholder")}
                aria-label={tk("apps.search.installed_placeholder")}
                style={{ ...inputStyle, minWidth: "220px", flex: "1 1 220px" }}
              />
              <button onClick={installedSearch.apply} style={btnStyle}>
                {tk("common.search")}
              </button>
              <button
                onClick={installedSearch.clear}
                disabled={installedSearch.isEmpty}
                style={secondaryBtnStyle(installedSearch.isEmpty)}
              >
                {tk("common.clear")}
              </button>
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
              <div style={infoBarStyle}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {refreshingTab === "installed" ? (
                    <span style={refreshingHintStyle}>
                      <span style={refreshDotStyle} />
                      {tk("common.refreshing")}
                    </span>
                  ) : (
                    tk("apps.helper.installed")
                  )}
                </span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {t(
                    "Sorted by app name, A to Z so known apps are easier to find.",
                  )}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    fontWeight: 600,
                  }}
                >
                  {tk("apps.count.installed_summary", {
                    count: filteredApps.length,
                  })}
                </span>
              </div>
              <StatusMessage message={tk("apps.danger.installed")} />
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "14px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--border)",
                      position: "sticky",
                      top: 0,
                      background: "var(--bg-card)",
                      zIndex: 1,
                    }}
                  >
                    <th style={thStyle}>{tk("apps.table.name")}</th>
                    <th style={thStyle}>{tk("apps.table.version")}</th>
                    <th style={thStyle}>{tk("apps.table.publisher")}</th>
                    <th style={thStyle}>{tk("apps.table.platform")}</th>
                    <th style={thStyle}>{tk("apps.table.location")}</th>
                    <th
                      style={{ ...thStyle, width: "210px", textAlign: "right" }}
                    >
                      {tk("apps.table.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApps.map((entry) => (
                    <Fragment key={entry.id}>
                      <tr style={rowStyle}>
                        <td style={tdStyle}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 600,
                                color: "var(--text-primary)",
                              }}
                            >
                              {entry.name}
                            </span>
                            {entry.protected && (
                              <span style={protectedBadgeStyle}>
                                {tk("apps.badge.protected")}
                              </span>
                            )}
                          </div>
                          {entry.protectedReason && (
                            <div
                              style={{
                                marginTop: "6px",
                                color: "var(--text-muted)",
                                lineHeight: 1.5,
                              }}
                            >
                              {t(entry.protectedReason)}
                            </div>
                          )}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            fontFamily: "monospace",
                            fontVariantNumeric: "tabular-nums",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {entry.version ?? "-"}
                        </td>
                        <td style={tdStyle}>
                          {entry.publisher ? (
                            <span
                              style={{
                                color: "var(--text-secondary)",
                                lineHeight: 1.45,
                              }}
                            >
                              {entry.publisher}
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>
                              -
                            </span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <Badge
                            text={
                              entry.platform === "mac" ? "macOS" : "Windows"
                            }
                            color={
                              entry.platform === "mac"
                                ? "var(--accent-cyan)"
                                : "var(--accent-yellow)"
                            }
                          />
                        </td>
                        <td style={{ ...tdStyle, maxWidth: "340px" }}>
                          <CopyableValue
                            value={
                              entry.installLocation ?? entry.launchPath ?? ""
                            }
                            emptyValue="-"
                            fontSize="12px"
                            color="var(--text-muted)"
                            multiline
                            maxWidth="340px"
                          />
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            textAlign: "right",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <button
                            onClick={() => void handleToggleRelatedData(entry)}
                            style={openBtn}
                          >
                            {expandedAppId === entry.id
                              ? tk("apps.action.hide_data")
                              : tk("apps.action.related_data")}
                          </button>
                          <button
                            onClick={() => void handleOpenLocation(entry.id)}
                            style={openBtn}
                          >
                            {tk("apps.action.open")}
                          </button>
                          <button
                            onClick={() => void handleUninstall(entry)}
                            disabled={entry.protected || busyAppId === entry.id}
                            style={{
                              ...actionBtnStyle,
                              opacity:
                                entry.protected || busyAppId === entry.id
                                  ? 0.55
                                  : 1,
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
                      {expandedAppId === entry.id && (
                        <tr style={rowStyle}>
                          <td colSpan={6} style={{ padding: "0 6px 12px 6px" }}>
                            <div style={relatedPanelStyle}>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  marginBottom: "10px",
                                  gap: "10px",
                                  flexWrap: "wrap",
                                }}
                              >
                                <div>
                                  <div
                                    style={{
                                      fontSize: "13px",
                                      fontWeight: 700,
                                      color: "var(--text-primary)",
                                    }}
                                  >
                                    {tk("apps.related.title")}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: "12px",
                                      color: "var(--text-muted)",
                                      marginTop: "3px",
                                      lineHeight: 1.5,
                                    }}
                                  >
                                    {tk("apps.related.description")}
                                  </div>
                                </div>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: "var(--text-secondary)",
                                    fontWeight: 600,
                                  }}
                                >
                                  {tk("common.selected", {
                                    count: (
                                      selectedRelatedIdsByAppId[entry.id] ?? []
                                    ).length,
                                  })}
                                </div>
                              </div>

                              {relatedLoadingAppId === entry.id ? (
                                <div style={relatedEmptyStyle}>
                                  {tk("apps.related.loading")}
                                </div>
                              ) : (relatedDataByAppId[entry.id] ?? [])
                                  .length === 0 ? (
                                <div style={relatedEmptyStyle}>
                                  {tk("apps.related.empty")}
                                </div>
                              ) : (
                                <div style={{ display: "grid", gap: "8px" }}>
                                  {(relatedDataByAppId[entry.id] ?? []).map(
                                    (item) => {
                                      const checked = (
                                        selectedRelatedIdsByAppId[entry.id] ??
                                        []
                                      ).includes(item.id);
                                      return (
                                        <label
                                          key={item.id}
                                          style={relatedItemStyle}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() =>
                                              handleToggleRelatedId(
                                                entry.id,
                                                item.id,
                                              )
                                            }
                                          />
                                          <div
                                            style={{
                                              display: "grid",
                                              gap: "3px",
                                            }}
                                          >
                                            <span
                                              style={{
                                                fontSize: "13px",
                                                fontWeight: 600,
                                                color: "var(--text-primary)",
                                              }}
                                            >
                                              {item.label}
                                            </span>
                                            <div
                                              style={{
                                                fontSize: "12px",
                                                color: "var(--text-muted)",
                                              }}
                                            >
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
                                    },
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      ) : activeTab === "leftover" ? (
        <div style={{ display: "grid", gap: "12px" }}>
          <div style={stickyTabControlsWrapStyle}>
            <div style={tabControlsStyle}>
              <button
                onClick={() => void refresh("leftover")}
                disabled={refreshingTab === "leftover"}
                style={secondaryBtnStyle(refreshingTab === "leftover")}
              >
                {refreshingTab === "leftover"
                  ? tk("common.refreshing")
                  : tk("apps.action.refresh")}
              </button>
              <input
                value={leftoverSearch.draft}
                onChange={(e) => leftoverSearch.setDraft(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") leftoverSearch.apply();
                }}
                placeholder={tk("apps.search.leftover_placeholder")}
                aria-label={tk("apps.search.leftover_placeholder")}
                style={{ ...inputStyle, minWidth: "220px", flex: "1 1 220px" }}
              />
              <button onClick={leftoverSearch.apply} style={btnStyle}>
                {tk("common.search")}
              </button>
              <button
                onClick={leftoverSearch.clear}
                disabled={leftoverSearch.isEmpty}
                style={secondaryBtnStyle(leftoverSearch.isEmpty)}
              >
                {tk("common.clear")}
              </button>
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
                  setLeftoverConfidenceFilter(
                    e.target.value as ConfidenceFilter,
                  )
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
                onChange={(e) =>
                  setLeftoverSort(e.target.value as LeftoverSort)
                }
                style={inputStyle}
              >
                <option value="size">{tk("apps.sort.size")}</option>
                <option value="priority">{tk("apps.sort.priority")}</option>
                <option value="name">{tk("apps.sort.name")}</option>
              </select>
            </div>
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
              <div style={infoBarStyle}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {refreshingTab === "leftover" ? (
                    <span style={refreshingHintStyle}>
                      <span style={refreshDotStyle} />
                      {tk("common.refreshing")}
                    </span>
                  ) : (
                    tk("apps.helper.leftover")
                  )}
                </span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {leftoverSort === "size"
                    ? tk("apps.sort.size_detail")
                    : leftoverSort === "priority"
                      ? tk("apps.sort.priority_detail")
                      : tk("apps.sort.name_detail")}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    fontWeight: 600,
                  }}
                >
                  {tk("common.selected", {
                    count: selectedFilteredLeftoverCount,
                  })}
                </span>
              </div>
              <div style={bulkToggleRowStyle}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "var(--text-secondary)",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={allFilteredLeftoversChecked}
                    disabled={filteredLeftovers.length === 0}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSelectedLeftoverIds((current) => {
                          const next = new Set(current);
                          filteredLeftovers.forEach((item) =>
                            next.add(item.id),
                          );
                          return [...next];
                        });
                      } else {
                        setSelectedLeftoverIds((current) =>
                          current.filter(
                            (itemId) =>
                              !filteredLeftovers.some(
                                (item) => item.id === itemId,
                              ),
                          ),
                        );
                      }
                    }}
                  />
                  <span>
                    {tk("apps.count.leftover_summary", {
                      count: filteredLeftovers.length,
                    })}
                  </span>
                </label>
                <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  {tk("apps.selection.leftover_summary", {
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
              <StatusMessage message={tk("apps.danger.leftover")} />
              <div
                style={{ display: "grid", gap: "10px", paddingBottom: "84px" }}
              >
                {filteredLeftovers.map((item) => {
                  const checked = selectedLeftoverIds.includes(item.id);
                  return (
                    <div key={item.id} style={leftoverCardStyle}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "12px",
                        }}
                      >
                        <input
                          id={`leftover-${item.id}`}
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleLeftoverId(item.id)}
                          style={{ marginTop: "3px" }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              gap: "12px",
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                              <div
                                style={{
                                  fontSize: "14px",
                                  fontWeight: 700,
                                  color: "var(--text-primary)",
                                  wordBreak: "break-word",
                                }}
                              >
                                <label
                                  htmlFor={`leftover-${item.id}`}
                                  style={{ cursor: "pointer" }}
                                >
                                  {item.appName}
                                </label>
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  gap: "6px",
                                  flexWrap: "wrap",
                                  marginTop: "6px",
                                }}
                              >
                                <Badge
                                  text={
                                    item.platform === "mac"
                                      ? "macOS"
                                      : "Windows"
                                  }
                                  color={
                                    item.platform === "mac"
                                      ? "var(--accent-cyan)"
                                      : "var(--accent-yellow)"
                                  }
                                />
                                <Badge
                                  text={item.label}
                                  color="var(--accent-green)"
                                />
                                {item.sizeBytes !== undefined && (
                                  <Badge
                                    text={formatBytes(item.sizeBytes)}
                                    color="var(--accent-blue)"
                                  />
                                )}
                                <Badge
                                  text={getConfidenceLabel(item.confidence, tk)}
                                  color={getConfidenceColor(item.confidence)}
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                void handleOpenLeftoverPath(item.path);
                              }}
                              style={{ ...openBtn, marginRight: 0 }}
                            >
                              {tk("apps.action.open")}
                            </button>
                          </div>
                          <div
                            style={{
                              marginTop: "10px",
                            }}
                          >
                            <CopyableValue
                              value={item.path}
                              fontSize="12px"
                              color="var(--text-muted)"
                              multiline
                            />
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gap: "6px",
                              marginTop: "10px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "12px",
                                color: "var(--text-secondary)",
                                lineHeight: 1.55,
                              }}
                            >
                              <strong style={{ color: "var(--text-primary)" }}>
                                {tk("apps.reason.why")}
                              </strong>{" "}
                              {t(item.reason)}
                            </div>
                            <div
                              style={{
                                fontSize: "12px",
                                color: "var(--text-secondary)",
                                lineHeight: 1.55,
                              }}
                            >
                              <strong style={{ color: "var(--text-primary)" }}>
                                {tk("apps.reason.risk")}
                              </strong>{" "}
                              {t(item.risk)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={stickyActionBarStyle}>
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--text-secondary)",
                    fontWeight: 600,
                  }}
                >
                  {tk("common.selected", {
                    count: selectedFilteredLeftoverCount,
                  })}
                </div>
                <button
                  onClick={() => void handleRemoveSelectedLeftovers()}
                  disabled={leftoverBusy || selectedLeftoverIds.length === 0}
                  style={{
                    ...actionBtnStyle,
                    minWidth: "170px",
                    opacity:
                      leftoverBusy || selectedLeftoverIds.length === 0
                        ? 0.55
                        : 1,
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
            </>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          <div style={stickyTabControlsWrapStyle}>
            <div style={tabControlsStyle}>
              <button
                onClick={() => void refresh("registry")}
                disabled={refreshingTab === "registry"}
                style={secondaryBtnStyle(refreshingTab === "registry")}
              >
                {refreshingTab === "registry"
                  ? tk("common.refreshing")
                  : tk("apps.action.refresh")}
              </button>
              <input
                value={registrySearch.draft}
                onChange={(e) => registrySearch.setDraft(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") registrySearch.apply();
                }}
                placeholder={tk("apps.search.registry_placeholder")}
                aria-label={tk("apps.search.registry_placeholder")}
                style={{ ...inputStyle, minWidth: "220px", flex: "1 1 220px" }}
              />
              <button onClick={registrySearch.apply} style={btnStyle}>
                {tk("common.search")}
              </button>
              <button
                onClick={registrySearch.clear}
                disabled={registrySearch.isEmpty}
                style={secondaryBtnStyle(registrySearch.isEmpty)}
              >
                {tk("common.clear")}
              </button>
            </div>
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
              <div style={infoBarStyle}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {refreshingTab === "registry" ? (
                    <span style={refreshingHintStyle}>
                      <span style={refreshDotStyle} />
                      {tk("common.refreshing")}
                    </span>
                  ) : (
                    tk("apps.helper.registry")
                  )}
                </span>
                <span style={{ fontSize: "12px", color: "var(--accent-red)" }}>
                  {tk("apps.registry.warning")}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    fontWeight: 600,
                  }}
                >
                  {tk("common.selected", {
                    count: selectedFilteredRegistryCount,
                  })}
                </span>
              </div>
              <div style={bulkToggleRowStyle}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "var(--text-secondary)",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
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
                              !filteredRegistry.some(
                                (item) => item.id === itemId,
                              ),
                          ),
                        );
                      }
                    }}
                  />
                  <span>
                    {tk("apps.count.registry_summary", {
                      count: filteredRegistry.length,
                    })}
                  </span>
                </label>
                <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  {tk("apps.selection.registry_summary", {
                    count: selectedRegistryItems.length,
                  })}
                </span>
              </div>
              <StatusMessage
                tone="error"
                message={tk("apps.danger.registry")}
              />
              <div
                style={{ display: "grid", gap: "10px", paddingBottom: "84px" }}
              >
                {filteredRegistry.map((item) => {
                  const checked = selectedRegistryIds.includes(item.id);
                  return (
                    <div key={item.id} style={leftoverCardStyle}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "12px",
                        }}
                      >
                        <input
                          id={`registry-${item.id}`}
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleRegistryId(item.id)}
                          style={{ marginTop: "3px" }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              gap: "12px",
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                              <div
                                style={{
                                  fontSize: "14px",
                                  fontWeight: 700,
                                  color: "var(--text-primary)",
                                  wordBreak: "break-word",
                                }}
                              >
                                <label
                                  htmlFor={`registry-${item.id}`}
                                  style={{ cursor: "pointer" }}
                                >
                                  {item.appName}
                                </label>
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  gap: "6px",
                                  flexWrap: "wrap",
                                  marginTop: "6px",
                                }}
                              >
                                <Badge
                                  text="Windows"
                                  color="var(--accent-yellow)"
                                />
                                <Badge
                                  text={
                                    item.installLocation
                                      ? tk("apps.registry.install_missing")
                                      : tk("apps.registry.install_unavailable")
                                  }
                                  color="var(--accent-red)"
                                />
                                <Badge
                                  text={
                                    item.uninstallCommand
                                      ? tk("apps.registry.uninstaller_missing")
                                      : tk(
                                          "apps.registry.uninstall_unavailable",
                                        )
                                  }
                                  color="var(--accent-red)"
                                />
                              </div>
                            </div>
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gap: "8px",
                              marginTop: "10px",
                            }}
                          >
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
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={stickyActionBarStyle}>
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--text-secondary)",
                    fontWeight: 600,
                  }}
                >
                  {tk("common.selected", {
                    count: selectedFilteredRegistryCount,
                  })}
                </div>
                <button
                  onClick={() => void handleRemoveSelectedRegistry()}
                  disabled={registryBusy || selectedRegistryIds.length === 0}
                  style={{
                    ...actionBtnStyle,
                    minWidth: "220px",
                    opacity:
                      registryBusy || selectedRegistryIds.length === 0
                        ? 0.55
                        : 1,
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
            </>
          )}
        </div>
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

const inputStyle: React.CSSProperties = {
  padding: "7px 10px",
  fontSize: "12px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
};

const stickyHeaderStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 5,
  paddingBottom: "8px",
  marginBottom: "8px",
  background: "color-mix(in srgb, var(--bg-primary) 92%, transparent)",
  backdropFilter: "blur(10px)",
};

const tabControlsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
  padding: "0 0 12px 0",
};

const stickyTabControlsWrapStyle: React.CSSProperties = {
  position: "sticky",
  top: "112px",
  zIndex: 4,
  background: "color-mix(in srgb, var(--bg-primary) 94%, transparent)",
  backdropFilter: "blur(10px)",
};

function secondaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    ...btnStyle,
    background: "var(--bg-card-hover)",
    color: "var(--text-primary)",
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? "default" : "pointer",
  };
}

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
  background: "var(--bg-card)",
  borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
  flexWrap: "wrap",
};

const refreshingHintStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  color: "var(--accent-blue)",
  fontWeight: 600,
};

const refreshDotStyle: React.CSSProperties = {
  width: "8px",
  height: "8px",
  borderRadius: "999px",
  background: "var(--accent-blue)",
  boxShadow: "0 0 0 0 color-mix(in srgb, var(--accent-blue) 36%, transparent)",
  animation: "systemscope-refresh-pulse 1.1s ease-in-out infinite",
};

const bulkToggleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "2px 4px",
  flexWrap: "wrap",
};

const leftoverCardStyle: React.CSSProperties = {
  display: "block",
  padding: "16px",
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  cursor: "pointer",
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

const stickyActionBarStyle: React.CSSProperties = {
  position: "sticky",
  bottom: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "12px 14px",
  background: "color-mix(in srgb, var(--bg-card) 92%, transparent)",
  backdropFilter: "blur(12px)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  boxShadow: "var(--shadow)",
  flexWrap: "wrap",
};

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

function StepBadge({ active, text }: { active: boolean; text: string }) {
  return (
    <span
      style={{
        fontSize: "11px",
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: "999px",
        background: active
          ? "color-mix(in srgb, var(--accent-blue) 18%, transparent)"
          : "var(--bg-primary)",
        border: `1px solid ${active ? "var(--accent-blue)" : "var(--border)"}`,
        color: active ? "var(--accent-blue)" : "var(--text-secondary)",
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
