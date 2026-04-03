import {
  Fragment,
  useEffect,
  useMemo,
  useState,
} from "react";
import type React from "react";
import type { TranslationKey } from "@shared/i18n";
import { useToast } from "../../components/Toast";
import { useI18n } from "../../i18n/useI18n";
import { useSearchFilter } from "../../hooks/useSearchFilter";
import { useContainerWidth } from "../../hooks/useContainerWidth";
import { isCompactWidth, RESPONSIVE_WIDTH } from "../../hooks/useResponsiveLayout";
import { useVisibleIds } from "../../hooks/useVisibleIds";
import { useLeftoverAppsStore } from "../../stores/useLeftoverAppsStore";
import { StatusMessage } from "../../components/StatusMessage";
import { CopyableValue } from "../../components/CopyableValue";
import {
  CompactMetaItem,
  compactActionsStyle,
  compactBulkBarStyle,
  compactBulkTextStyle,
  compactCardHeaderStyle,
  compactCardStyle,
  compactListStyle,
  compactMetaGridStyle,
  compactStatusSpacingStyle,
} from "../../components/CompactPrimitives";
import { formatBytes } from "../../utils/format";
import {
  type ConfidenceFilter,
  type LeftoverSort,
  type PlatformFilter,
  Badge,
  SearchInput,
  actionBtnStyle,
  actionsStyle,
  badgeCountStyle,
  btnStyle,
  detailBlockStyle,
  detailGridStyle,
  detailLabelStyle,
  detailPanelStyle,
  detailValueStyle,
  detailsBodyTextStyle,
  getConfidenceColor,
  getConfidenceLabel,
  headerStyle,
  infoBarStyle,
  infoLabelStyle,
  infoReasonStyle,
  inputStyle,
  monoCellStyle,
  openBtn,
  pendingValueStyle,
  rowStyle,
  sectionStyle,
  secondaryBtnStyle,
  stickyHeaderRowStyle,
  subtleTextStyle,
  tableStyle,
  tableWrapStyle,
  tdStyle,
  thStyle,
  titleRowStyle,
  titleStyle,
} from "./appsShared";

export function shouldUseLeftoverAppsCompactLayout(width: number): boolean {
  return isCompactWidth(width, RESPONSIVE_WIDTH.leftoverAppsCompact);
}

export function LeftoverApps({ refreshToken }: { refreshToken?: number }) {
  const showToast = useToast((s) => s.show);
  const { t, tk } = useI18n();
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

  return (
    <section style={sectionStyle} ref={containerRef}>
      <div style={headerStyle}>
        <div style={titleRowStyle}>
          <span style={titleStyle}>{tk("apps.tab.leftover")}</span>
          <span style={badgeCountStyle}>{filteredLeftovers.length}</span>
        </div>
        <div style={actionsStyle}>
          <button type="button" onClick={() => void handleRefresh()} disabled={refreshing} style={secondaryBtnStyle(refreshing)}>
            {refreshing ? tk("common.refreshing") : tk("apps.action.refresh")}
          </button>
          <SearchInput value={search.draft} onChange={search.setDraft} onClear={search.clear} placeholder={tk("apps.search.leftover_placeholder")} clearLabel={t("Clear search")} />
          <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value as PlatformFilter)} style={inputStyle}>
            <option value="all">{tk("apps.platform.all")}</option>
            <option value="mac">macOS</option>
            <option value="windows">Windows</option>
          </select>
          <select value={confidenceFilter} onChange={(e) => setConfidenceFilter(e.target.value as ConfidenceFilter)} style={inputStyle}>
            <option value="all">{tk("apps.confidence.all")}</option>
            <option value="high">{tk("apps.confidence.high")}</option>
            <option value="medium">{tk("apps.confidence.medium")}</option>
            <option value="low">{tk("apps.confidence.low")}</option>
          </select>
          <select value={leftoverSort} onChange={(e) => setLeftoverSort(e.target.value as LeftoverSort)} style={inputStyle}>
            <option value="size">{tk("apps.sort.size")}</option>
            <option value="priority">{tk("apps.sort.priority")}</option>
            <option value="name">{tk("apps.sort.name")}</option>
          </select>
          <button
            type="button"
            onClick={() => void handleRemoveSelected()}
            disabled={busy || selectedIds.length === 0}
            style={{ ...actionBtnStyle, opacity: busy || selectedIds.length === 0 ? 0.55 : 1, cursor: busy || selectedIds.length === 0 ? "default" : "pointer" }}
          >
            {busy ? tk("apps.action.working") : tk("apps.action.move_selected_to_trash")}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <StatusMessage message={tk("apps.helper.leftover")} />
      </div>
      <div style={infoBarStyle}>
        <span style={infoLabelStyle}>
          {leftoverSizePendingCount > 0
            ? tk("apps.status.leftover_sizes_loading", { ready: leftoverSizeReadyCount, total: leftoverItems.length, remaining: leftoverSizePendingCount })
            : tk("apps.status.leftover_sizes_ready", { count: leftoverItems.length })}
        </span>
        <span style={infoReasonStyle}>
          {search.applied
            ? `${tk("apps.search.label")}: ${search.applied}`
            : tk("apps.selection.leftover_summary", {
                high: selectedItems.filter((i) => i.confidence === "high").length,
                medium: selectedItems.filter((i) => i.confidence === "medium").length,
                low: selectedItems.filter((i) => i.confidence === "low").length,
              })}
        </span>
      </div>

      {loadError && leftoverItems.length === 0 ? (
        <StatusMessage tone="error" message={t(loadError)} action={<button type="button" onClick={() => void handleRefresh()} style={btnStyle}>{tk("apps.action.refresh")}</button>} />
      ) : filteredLeftovers.length === 0 ? (
        <StatusMessage message={tk("apps.empty.leftover")} />
      ) : (
        <>
          <div style={compactStatusSpacingStyle}>
            <StatusMessage message={tk("apps.danger.leftover")} />
          </div>
          {compactLayout ? (
            <div style={compactListStyle}>
              <div style={compactBulkBarStyle}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <input
                    type="checkbox"
                    checked={allFilteredChecked}
                    disabled={filteredLeftovers.length === 0}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSelectedIds((current) => {
                          const next = new Set(current);
                          filteredLeftovers.forEach((item) => next.add(item.id));
                          return [...next];
                        });
                      } else {
                        setSelectedIds((current) =>
                          current.filter((id) => !filteredLeftovers.some((item) => item.id === id)),
                        );
                      }
                    }}
                  />
                  <span style={compactBulkTextStyle}>
                    {tk("common.selected", { count: selectedFilteredCount })}
                  </span>
                </label>
              </div>

              {filteredLeftovers.map((item) => {
                const checked = selectedIds.includes(item.id);
                return (
                  <div key={item.id} ref={observeRow(item.id)} style={compactCardStyle}>
                    <div style={compactCardHeaderStyle}>
                      <label htmlFor={`leftover-card-${item.id}`} style={compactCardTitleWrapStyle}>
                        <input
                          id={`leftover-card-${item.id}`}
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleId(item.id)}
                        />
                        <div style={{ display: "grid", gap: "4px", minWidth: 0 }}>
                          <div style={compactTitleStyle}>{item.appName}</div>
                          <div style={subtleTextStyle}>{item.label}</div>
                        </div>
                      </label>
                      <div style={compactBadgeStackStyle}>
                        <Badge text={getConfidenceLabel(item.confidence, tk)} color={getConfidenceColor(item.confidence)} />
                        <Badge text={item.platform === "mac" ? "macOS" : "Windows"} color={item.platform === "mac" ? "var(--accent-cyan)" : "var(--accent-yellow)"} />
                      </div>
                    </div>

                    <div style={compactMetaGridStyle}>
                      <CompactMeta label={t("Size")} value={item.sizeBytes !== undefined ? formatBytes(item.sizeBytes) : t("Calculating...")} mono={item.sizeBytes !== undefined} muted={item.sizeBytes === undefined} />
                      <CompactMeta label={tk("apps.table.location")} value={item.path} multiline />
                    </div>

                    <div style={compactActionsStyle}>
                      <button type="button" onClick={() => setExpandedId((c) => c === item.id ? null : item.id)} style={openBtn}>
                        {expandedId === item.id ? tk("apps.action.hide_data") : t("Details")}
                      </button>
                      <button type="button" onClick={() => void handleOpenPath(item.path)} style={openBtn}>
                        {tk("apps.action.open")}
                      </button>
                    </div>

                    {expandedId === item.id ? (
                      <div style={{ marginTop: "4px" }}>
                        {renderLeftoverDetails(item, tk, t)}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={tableWrapStyle}>
              <table style={{ ...tableStyle, minWidth: "980px" }}>
                <thead>
                  <tr style={stickyHeaderRowStyle}>
                    <th style={{ ...thStyle, width: "44px" }}>
                      <input
                        type="checkbox"
                        checked={allFilteredChecked}
                        disabled={filteredLeftovers.length === 0}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelectedIds((current) => {
                              const next = new Set(current);
                              filteredLeftovers.forEach((item) => next.add(item.id));
                              return [...next];
                            });
                          } else {
                            setSelectedIds((current) =>
                              current.filter((id) => !filteredLeftovers.some((item) => item.id === id)),
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
                    <th style={{ ...thStyle, textAlign: "right", width: "180px" }}>{tk("apps.table.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeftovers.map((item) => {
                    const checked = selectedIds.includes(item.id);
                    return (
                      <Fragment key={item.id}>
                        <tr ref={observeRow(item.id)} style={rowStyle}>
                          <td style={tdStyle}>
                            <input id={`leftover-${item.id}`} type="checkbox" checked={checked} onChange={() => handleToggleId(item.id)} />
                          </td>
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                              <label htmlFor={`leftover-${item.id}`} style={{ cursor: "pointer" }}>{item.appName}</label>
                            </div>
                            <div style={subtleTextStyle}>{item.label}</div>
                          </td>
                          <td style={tdStyle}>
                            <Badge text={getConfidenceLabel(item.confidence, tk)} color={getConfidenceColor(item.confidence)} />
                          </td>
                          <td style={tdStyle}>
                            <Badge text={item.platform === "mac" ? "macOS" : "Windows"} color={item.platform === "mac" ? "var(--accent-cyan)" : "var(--accent-yellow)"} />
                          </td>
                          <td style={{ ...monoCellStyle, textAlign: "right" }}>
                            {item.sizeBytes !== undefined ? formatBytes(item.sizeBytes) : <span style={pendingValueStyle}>{t("Calculating...")}</span>}
                          </td>
                          <td style={{ ...tdStyle, maxWidth: "340px" }}>
                            <CopyableValue value={item.path} fontSize="12px" color="var(--text-muted)" multiline maxWidth="340px" />
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                            <button type="button" onClick={() => setExpandedId((c) => c === item.id ? null : item.id)} style={openBtn}>
                              {expandedId === item.id ? tk("apps.action.hide_data") : t("Details")}
                            </button>
                            <button type="button" onClick={() => void handleOpenPath(item.path)} style={openBtn}>
                              {tk("apps.action.open")}
                            </button>
                          </td>
                        </tr>
                        {expandedId === item.id ? (
                          <tr style={rowStyle}>
                            <td colSpan={7} style={{ padding: "0 8px 12px 8px" }}>
                              {renderLeftoverDetails(item, tk, t)}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function renderLeftoverDetails(
  item: { path: string; reason: string; risk: string },
  tk: (key: TranslationKey, params?: Record<string, string | number>) => string,
  t: (text: string, params?: Record<string, string | number>) => string,
) {
  return (
    <div style={detailPanelStyle}>
      <div style={detailGridStyle}>
        <div style={detailBlockStyle}>
          <strong style={detailLabelStyle}>{tk("apps.table.location")}</strong>
          <div style={detailValueStyle}>
            <CopyableValue value={item.path} fontSize="12px" color="var(--text-secondary)" multiline />
          </div>
        </div>
        <div style={detailBlockStyle}>
          <strong style={detailLabelStyle}>{tk("apps.reason.why")}</strong>
          <div style={detailsBodyTextStyle}>{t(item.reason)}</div>
        </div>
        <div style={detailBlockStyle}>
          <strong style={detailLabelStyle}>{tk("apps.reason.risk")}</strong>
          <div style={detailsBodyTextStyle}>{t(item.risk)}</div>
        </div>
      </div>
    </div>
  );
}

function CompactMeta({
  label,
  value,
  mono = false,
  multiline = false,
  muted = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  multiline?: boolean;
  muted?: boolean;
}) {
  return <CompactMetaItem label={label} value={value} mono={mono} multiline={multiline} muted={muted} />;
}

const compactCardTitleWrapStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "10px",
  minWidth: 0,
  cursor: "pointer",
};

const compactTitleStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 700,
  color: "var(--text-primary)",
};

const compactBadgeStackStyle: React.CSSProperties = {
  display: "flex",
  gap: "6px",
  flexWrap: "wrap",
  justifyContent: "flex-end",
};
