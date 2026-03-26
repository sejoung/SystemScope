import {
  Fragment,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AppLeftoverDataItem } from "@shared/types";
import { useToast } from "../../components/Toast";
import { useI18n } from "../../i18n/useI18n";
import { useSearchFilter } from "../../hooks/useSearchFilter";
import { useVisibleIds } from "../../hooks/useVisibleIds";
import { StatusMessage } from "../../components/StatusMessage";
import { CopyableValue } from "../../components/CopyableValue";
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

const LEFTOVER_SIZE_IDLE_BATCH_SIZE = 1;
const LEFTOVER_SIZE_PRIORITY_BATCH_SIZE = 4;
const LEFTOVER_SIZE_IDLE_DELAY_MS = 350;

export function LeftoverApps({ refreshToken }: { refreshToken?: number }) {
  const showToast = useToast((s) => s.show);
  const { t, tk } = useI18n();

  const [leftoverItems, setLeftoverItems] = useState<AppLeftoverDataItem[]>([]);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const search = useSearchFilter();
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("all");
  const [leftoverSort, setLeftoverSort] = useState<LeftoverSort>("priority");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const leftoverSizeHydratingRef = useRef(false);
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const tkRef = useRef(tk);
  tkRef.current = tk;

  const loadLeftovers = useCallback(async () => {
    const res = await window.systemScope.listLeftoverAppData();
    if (res.ok && res.data) {
      const items = res.data as AppLeftoverDataItem[];
      setLeftoverItems(items);
      setLoadError(undefined);
      setSelectedIds((current) =>
        current.filter((id) => items.some((entry) => entry.id === id)),
      );
    } else {
      const message = res.error?.message ?? tkRef.current("apps.error.load_leftover");
      setLoadError(message);
      showToastRef.current(message);
    }
  }, []);

  useEffect(() => {
    void loadLeftovers();
  }, [loadLeftovers, refreshToken]);

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
    if (leftoverSizeHydratingRef.current) return;

    const sourceItems = leftoverSort === "size" ? filteredLeftovers : leftoverItems;
    const batchSize = leftoverSort === "size" ? LEFTOVER_SIZE_PRIORITY_BATCH_SIZE : LEFTOVER_SIZE_IDLE_BATCH_SIZE;
    const allPending = sourceItems.filter((item) => item.sizeBytes === undefined);
    if (allPending.length === 0) return;

    const visiblePending = allPending.filter((item) => visibleIdsRef.current.has(item.id));
    const pendingIds = (visiblePending.length > 0 ? visiblePending : allPending)
      .slice(0, batchSize)
      .map((item) => item.id);
    if (pendingIds.length === 0) return;

    let cancelled = false;
    let idleTimerId: number | null = null;

    const runHydration = () => {
      leftoverSizeHydratingRef.current = true;
      void (async () => {
        const res = await window.systemScope.hydrateLeftoverAppDataSizes(pendingIds);
        leftoverSizeHydratingRef.current = false;
        if (cancelled) return;

        if (res.ok && res.data) {
          const hydratedItems = res.data as AppLeftoverDataItem[];
          startTransition(() => {
            setLeftoverItems((current) => mergeHydratedLeftovers(current, hydratedItems));
          });
          return;
        }

        showToastRef.current(res.error?.message ?? tkRef.current("apps.error.load_leftover"));
      })();
    };

    if (leftoverSort === "size") {
      runHydration();
    } else {
      idleTimerId = window.setTimeout(runHydration, LEFTOVER_SIZE_IDLE_DELAY_MS);
    }

    return () => {
      cancelled = true;
      if (idleTimerId !== null) window.clearTimeout(idleTimerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredLeftovers, leftoverItems, leftoverSort, visibilityTrigger]);

  const selectedFilteredCount = useMemo(
    () => filteredLeftovers.filter((item) => selectedIds.includes(item.id)).length,
    [filteredLeftovers, selectedIds],
  );
  const allFilteredChecked = filteredLeftovers.length > 0 && selectedFilteredCount === filteredLeftovers.length;

  const selectedItems = useMemo(
    () => filteredLeftovers.filter((item) => selectedIds.includes(item.id)),
    [filteredLeftovers, selectedIds],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLeftovers();
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
    const res = await window.systemScope.removeLeftoverAppData(selectedIds);
    setBusy(false);

    if (!res.ok || !res.data) {
      showToast(res.error?.message ?? tk("apps.error.remove_leftover"));
      return;
    }

    const result = res.data as { deletedPaths: string[]; failedPaths: string[] };
    setSelectedIds([]);
    showToast(
      result.failedPaths.length === 0
        ? tk("apps.toast.leftover_all", { count: result.deletedPaths.length })
        : tk("apps.toast.leftover_partial", { deletedCount: result.deletedPaths.length, failedCount: result.failedPaths.length }),
    );
    await loadLeftovers();
  };

  const handleOpenPath = async (targetPath: string) => {
    const res = await window.systemScope.showInFolder(targetPath);
    if (!res.ok) showToast(res.error?.message ?? tk("apps.error.open_path"));
  };

  return (
    <section style={sectionStyle}>
      <div style={headerStyle}>
        <div style={titleRowStyle}>
          <span style={titleStyle}>{tk("apps.tab.leftover")}</span>
          <span style={badgeCountStyle}>{filteredLeftovers.length}</span>
        </div>
        <div style={actionsStyle}>
          <button type="button" onClick={() => void handleRefresh()} disabled={refreshing} style={secondaryBtnStyle(refreshing)}>
            {refreshing ? tk("common.refreshing") : tk("apps.action.refresh")}
          </button>
          <SearchInput value={search.draft} onChange={search.setDraft} onClear={search.clear} placeholder={tk("apps.search.leftover_placeholder")} />
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
        <StatusMessage tone="error" message={loadError} action={<button type="button" onClick={() => void handleRefresh()} style={btnStyle}>{tk("apps.action.refresh")}</button>} />
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
  );
}

function mergeHydratedLeftovers(
  currentItems: AppLeftoverDataItem[],
  hydratedItems: AppLeftoverDataItem[],
): AppLeftoverDataItem[] {
  const hydratedById = new Map(hydratedItems.map((item) => [item.id, item]));
  return currentItems.map((item) => hydratedById.get(item.id) ?? item);
}
