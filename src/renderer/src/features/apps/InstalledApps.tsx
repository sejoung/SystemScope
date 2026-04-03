import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type React from "react";
import type {
  AppRelatedDataItem,
  InstalledApp,
} from "@shared/types";
import type { TranslationKey } from "@shared/i18n";
import { isInstalledAppArray, isAppRelatedDataArray, isAppRemovalResult } from "@shared/types";
import { useToast } from "../../components/Toast";
import { useI18n } from "../../i18n/useI18n";
import { useSearchFilter } from "../../hooks/useSearchFilter";
import { StatusMessage } from "../../components/StatusMessage";
import { CopyableValue } from "../../components/CopyableValue";
import { useContainerWidth } from "../../hooks/useContainerWidth";
import {
  type PlatformFilter,
  Badge,
  SearchInput,
  actionBtnStyle,
  actionsStyle,
  badgeCountStyle,
  btnStyle,
  detailsBodyTextStyle,
  detailsHeaderStyle,
  detailsMetaStyle,
  detailsTitleStyle,
  headerStyle,
  infoBarStyle,
  infoLabelStyle,
  infoReasonStyle,
  inputStyle,
  monoCellStyle,
  openBtn,
  protectedBadgeStyle,
  relatedEmptyStyle,
  relatedItemStyle,
  relatedPanelStyle,
  rowStyle,
  secondaryBtnStyle,
  secondaryButtonStyle,
  sectionStyle,
  stickyHeaderRowStyle,
  subtleTextStyle,
  tableStyle,
  tableWrapStyle,
  tdStyle,
  thStyle,
  titleRowStyle,
  titleStyle,
} from "./appsShared";

const INSTALLED_APPS_COMPACT_WIDTH = 980;

export function shouldUseInstalledAppsCompactLayout(width: number): boolean {
  return width < INSTALLED_APPS_COMPACT_WIDTH;
}

export function InstalledApps({ refreshToken }: { refreshToken?: number }) {
  const showToast = useToast((s) => s.show);
  const { t, tk } = useI18n();
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

  return (
    <section style={sectionStyle} ref={containerRef}>
      <div style={headerStyle}>
        <div style={titleRowStyle}>
          <span style={titleStyle}>{tk("apps.tab.installed")}</span>
          <span style={badgeCountStyle}>{filteredApps.length}</span>
        </div>
        <div style={actionsStyle}>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            style={secondaryBtnStyle(refreshing)}
          >
            {refreshing ? tk("common.refreshing") : tk("apps.action.refresh")}
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
            value={search.draft}
            onChange={search.setDraft}
            onClear={search.clear}
            placeholder={tk("apps.search.installed_placeholder")}
            clearLabel={t("Clear search")}
          />
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value as PlatformFilter)}
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
          {search.applied
            ? `${tk("apps.search.label")}: ${search.applied}`
            : tk("apps.count.installed_summary", { count: filteredApps.length })}
        </span>
      </div>

      {loadError && apps.length === 0 ? (
        <StatusMessage
          tone="error"
          message={loadError}
          action={
            <button type="button" onClick={() => void handleRefresh()} style={btnStyle}>
              {tk("apps.action.refresh")}
            </button>
          }
        />
      ) : filteredApps.length === 0 ? (
        <StatusMessage message={tk("apps.empty.installed")} />
      ) : (
        <>
          <div style={{ marginBottom: "14px" }}>
            <StatusMessage message={tk("apps.danger.installed")} />
          </div>
          {compactLayout ? (
            <div style={compactListStyle}>
              {filteredApps.map((entry) => (
                <div key={entry.id} style={compactCardStyle}>
                  <div style={compactCardHeaderStyle}>
                    <div style={{ display: "grid", gap: "6px", minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span style={compactTitleStyle}>{entry.name}</span>
                        {entry.protected ? (
                          <span style={protectedBadgeStyle}>{tk("apps.badge.protected")}</span>
                        ) : null}
                      </div>
                      {entry.protectedReason ? (
                        <div style={subtleTextStyle}>{t(entry.protectedReason)}</div>
                      ) : null}
                    </div>
                    <Badge
                      text={entry.platform === "mac" ? "macOS" : "Windows"}
                      color={entry.platform === "mac" ? "var(--accent-cyan)" : "var(--accent-yellow)"}
                    />
                  </div>

                  <div style={compactMetaGridStyle}>
                    <CompactMeta label={tk("apps.table.version")} value={entry.version ?? "-"} mono />
                    <CompactMeta label={tk("apps.table.publisher")} value={entry.publisher ?? "-"} />
                  </div>

                  <div style={compactLocationBlockStyle}>
                    <div style={compactMetaLabelStyle}>{tk("apps.table.location")}</div>
                    <CopyableValue
                      value={entry.installLocation ?? entry.launchPath ?? ""}
                      emptyValue="-"
                      fontSize="12px"
                      color="var(--text-muted)"
                      multiline
                    />
                  </div>

                  <div style={compactActionsStyle}>
                    <button type="button" onClick={() => void handleToggleRelatedData(entry)} style={openBtn}>
                      {expandedAppId === entry.id ? tk("apps.action.hide_data") : tk("apps.action.related_data")}
                    </button>
                    <button type="button" onClick={() => void handleOpenLocation(entry.id)} style={openBtn}>
                      {tk("apps.action.open")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleUninstall(entry)}
                      disabled={entry.protected || busyAppId === entry.id}
                      style={{
                        ...actionBtnStyle,
                        opacity: entry.protected || busyAppId === entry.id ? 0.55 : 1,
                        cursor: entry.protected || busyAppId === entry.id ? "default" : "pointer",
                        marginLeft: "auto",
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
                  </div>

                  {expandedAppId === entry.id ? (
                    <div style={{ marginTop: "4px" }}>
                      {renderRelatedDataPanel({
                        entry,
                        tk,
                        relatedLoadingAppId,
                        relatedDataByAppId,
                        selectedRelatedIdsByAppId,
                        handleToggleRelatedId,
                      })}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
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
                              <span style={protectedBadgeStyle}>{tk("apps.badge.protected")}</span>
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
                            color={entry.platform === "mac" ? "var(--accent-cyan)" : "var(--accent-yellow)"}
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
                          <button type="button" onClick={() => void handleToggleRelatedData(entry)} style={openBtn}>
                            {expandedAppId === entry.id ? tk("apps.action.hide_data") : tk("apps.action.related_data")}
                          </button>
                          <button type="button" onClick={() => void handleOpenLocation(entry.id)} style={openBtn}>
                            {tk("apps.action.open")}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleUninstall(entry)}
                            disabled={entry.protected || busyAppId === entry.id}
                            style={{
                              ...actionBtnStyle,
                              opacity: entry.protected || busyAppId === entry.id ? 0.55 : 1,
                              cursor: entry.protected || busyAppId === entry.id ? "default" : "pointer",
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
                            {renderRelatedDataPanel({
                              entry,
                              tk,
                              relatedLoadingAppId,
                              relatedDataByAppId,
                              selectedRelatedIdsByAppId,
                              handleToggleRelatedId,
                            })}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function CompactMeta({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={compactMetaItemStyle}>
      <div style={compactMetaLabelStyle}>{label}</div>
      <div style={mono ? compactMetaValueMonoStyle : compactMetaValueStyle}>{value}</div>
    </div>
  );
}

function renderRelatedDataPanel({
  entry,
  tk,
  relatedLoadingAppId,
  relatedDataByAppId,
  selectedRelatedIdsByAppId,
  handleToggleRelatedId,
}: {
  entry: InstalledApp;
  tk: (key: TranslationKey, params?: Record<string, string | number>) => string;
  relatedLoadingAppId: string | null;
  relatedDataByAppId: Record<string, AppRelatedDataItem[]>;
  selectedRelatedIdsByAppId: Record<string, string[]>;
  handleToggleRelatedId: (appId: string, itemId: string) => void;
}) {
  return (
    <div style={relatedPanelStyle}>
      <div style={detailsHeaderStyle}>
        <div>
          <div style={detailsTitleStyle}>{tk("apps.related.title")}</div>
          <div style={detailsBodyTextStyle}>{tk("apps.related.description")}</div>
        </div>
        <div style={detailsMetaStyle}>
          {tk("common.selected", { count: (selectedRelatedIdsByAppId[entry.id] ?? []).length })}
        </div>
      </div>
      {relatedLoadingAppId === entry.id ? (
        <div style={relatedEmptyStyle}>{tk("apps.related.loading")}</div>
      ) : (relatedDataByAppId[entry.id] ?? []).length === 0 ? (
        <div style={relatedEmptyStyle}>{tk("apps.related.empty")}</div>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          {(relatedDataByAppId[entry.id] ?? []).map((item) => {
            const checked = (selectedRelatedIdsByAppId[entry.id] ?? []).includes(item.id);
            return (
              <label key={item.id} style={relatedItemStyle}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handleToggleRelatedId(entry.id, item.id)}
                />
                <div style={{ display: "grid", gap: "3px" }}>
                  <span style={detailsTitleStyle}>{item.label}</span>
                  <div style={detailsBodyTextStyle}>
                    <CopyableValue value={item.path} fontSize="12px" color="var(--text-muted)" multiline />
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

const compactListStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
};

const compactCardStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  padding: "14px",
  borderRadius: "12px",
  background: "var(--bg-primary)",
  border: "1px solid var(--border)",
};

const compactCardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const compactTitleStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 700,
  color: "var(--text-primary)",
};

const compactMetaGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "10px",
};

const compactMetaItemStyle: React.CSSProperties = {
  display: "grid",
  gap: "4px",
  padding: "10px 12px",
  borderRadius: "10px",
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
};

const compactMetaLabelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-muted)",
};

const compactMetaValueStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--text-primary)",
  lineHeight: 1.5,
};

const compactMetaValueMonoStyle: React.CSSProperties = {
  ...compactMetaValueStyle,
  fontFamily: "monospace",
  fontVariantNumeric: "tabular-nums",
};

const compactLocationBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: "6px",
};

const compactActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  alignItems: "center",
};
