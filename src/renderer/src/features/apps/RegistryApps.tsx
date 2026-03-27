import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { AppLeftoverRegistryItem } from "@shared/types";
import { isAppLeftoverRegistryArray } from "@shared/types";
import { useToast } from "../../components/Toast";
import { useI18n } from "../../i18n/useI18n";
import { useSearchFilter } from "../../hooks/useSearchFilter";
import { StatusMessage } from "../../components/StatusMessage";
import { CopyableValue } from "../../components/CopyableValue";
import {
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
  headerStyle,
  infoBarStyle,
  infoLabelStyle,
  infoReasonStyle,
  monoCellStyle,
  openBtn,
  rowStyle,
  sectionStyle,
  secondaryBtnStyle,
  stickyHeaderRowStyle,
  tableStyle,
  tableWrapStyle,
  tdStyle,
  thStyle,
  titleRowStyle,
  titleStyle,
} from "./appsShared";

export function RegistryApps({ refreshToken }: { refreshToken?: number }) {
  const showToast = useToast((s) => s.show);
  const { t, tk } = useI18n();

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

  return (
    <section style={sectionStyle}>
      <div style={headerStyle}>
        <div style={titleRowStyle}>
          <span style={titleStyle}>{tk("apps.tab.registry")}</span>
          <span style={badgeCountStyle}>{filteredRegistry.length}</span>
        </div>
        <div style={actionsStyle}>
          <button type="button" onClick={() => void handleRefresh()} disabled={refreshing} style={secondaryBtnStyle(refreshing)}>
            {refreshing ? tk("common.refreshing") : tk("apps.action.refresh")}
          </button>
          <SearchInput value={search.draft} onChange={search.setDraft} onClear={search.clear} placeholder={tk("apps.search.registry_placeholder")} />
          <button
            type="button"
            onClick={() => void handleRemoveSelected()}
            disabled={busy || selectedIds.length === 0}
            style={{ ...actionBtnStyle, opacity: busy || selectedIds.length === 0 ? 0.55 : 1, cursor: busy || selectedIds.length === 0 ? "default" : "pointer" }}
          >
            {busy ? tk("apps.action.working") : tk("apps.action.remove_selected_registry")}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <StatusMessage message={tk("apps.helper.registry")} />
      </div>
      <div style={infoBarStyle}>
        <span style={infoLabelStyle}>{tk("apps.registry.warning")}</span>
        <span style={infoReasonStyle}>
          {search.applied
            ? `${tk("apps.search.label")}: ${search.applied}`
            : tk("common.selected", { count: selectedFilteredCount })}
        </span>
      </div>

      {loadError && registryItems.length === 0 ? (
        <StatusMessage
          tone="error"
          message={loadError}
          action={<button type="button" onClick={() => void handleRefresh()} style={btnStyle}>{tk("apps.action.refresh")}</button>}
        />
      ) : filteredRegistry.length === 0 ? (
        <StatusMessage title={tk("apps.empty.registry")} message={tk("apps.empty.registry_detail")} />
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
                      checked={allFilteredChecked}
                      disabled={filteredRegistry.length === 0}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedIds((current) => {
                            const next = new Set(current);
                            filteredRegistry.forEach((item) => next.add(item.id));
                            return [...next];
                          });
                        } else {
                          setSelectedIds((current) =>
                            current.filter((id) => !filteredRegistry.some((item) => item.id === id)),
                          );
                        }
                      }}
                    />
                  </th>
                  <th style={thStyle}>{tk("apps.table.name")}</th>
                  <th style={thStyle}>{tk("apps.table.version")}</th>
                  <th style={thStyle}>{tk("apps.table.publisher")}</th>
                  <th style={thStyle}>{tk("apps.registry.install_location")}</th>
                  <th style={{ ...thStyle, textAlign: "right", width: "140px" }}>{tk("apps.table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRegistry.map((item) => {
                  const checked = selectedIds.includes(item.id);
                  return (
                    <Fragment key={item.id}>
                      <tr style={rowStyle}>
                        <td style={tdStyle}>
                          <input id={`registry-${item.id}`} type="checkbox" checked={checked} onChange={() => handleToggleId(item.id)} />
                        </td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                            <label htmlFor={`registry-${item.id}`} style={{ cursor: "pointer" }}>{item.appName}</label>
                          </div>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" }}>
                            <Badge text="Windows" color="var(--accent-yellow)" />
                            <Badge
                              text={item.installLocationExists ? tk("apps.registry.install_missing") : tk("apps.registry.install_unavailable")}
                              color="var(--accent-red)"
                            />
                            <Badge
                              text={item.uninstallerExists ? tk("apps.registry.uninstaller_missing") : tk("apps.registry.uninstall_unavailable")}
                              color="var(--accent-red)"
                            />
                          </div>
                        </td>
                        <td style={monoCellStyle}>{item.version ?? "-"}</td>
                        <td style={tdStyle}>{item.publisher ?? "-"}</td>
                        <td style={{ ...tdStyle, maxWidth: "320px" }}>
                          <CopyableValue value={item.installLocation ?? ""} emptyValue="-" fontSize="12px" color="var(--text-muted)" multiline maxWidth="320px" />
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                          <button type="button" onClick={() => setExpandedId((c) => c === item.id ? null : item.id)} style={openBtn}>
                            {expandedId === item.id ? tk("apps.action.hide_data") : t("Details")}
                          </button>
                        </td>
                      </tr>
                      {expandedId === item.id ? (
                        <tr style={rowStyle}>
                          <td colSpan={6} style={{ padding: "0 8px 12px 8px" }}>
                            <div style={detailPanelStyle}>
                              <div style={detailGridStyle}>
                                <div style={detailBlockStyle}>
                                  <strong style={detailLabelStyle}>{tk("apps.registry.path")}</strong>
                                  <div style={detailValueStyle}>
                                    <CopyableValue value={item.registryPath} fontSize="12px" color="var(--text-secondary)" multiline />
                                  </div>
                                </div>
                                <div style={detailBlockStyle}>
                                  <strong style={detailLabelStyle}>{tk("apps.registry.install_location")}</strong>
                                  <div style={detailValueStyle}>
                                    <CopyableValue value={item.installLocation ?? ""} emptyValue="-" fontSize="12px" color="var(--text-secondary)" multiline />
                                  </div>
                                </div>
                                <div style={detailBlockStyle}>
                                  <strong style={detailLabelStyle}>{tk("apps.registry.uninstall_command")}</strong>
                                  <div style={detailValueStyle}>
                                    <CopyableValue value={item.uninstallCommand ?? ""} emptyValue="-" fontSize="12px" color="var(--text-secondary)" multiline />
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
  );
}
