import { Fragment } from "react";
import { StatusMessage } from "../../../components/ui/StatusMessage";
import { CopyableValue } from "../../../components/ui/CopyableValue";
import {
  compactActionsStyle,
  compactBulkBarStyle,
  compactBulkTextStyle,
  compactCardHeaderStyle,
  compactCardStyle,
  compactListStyle,
  compactMetaGridStyle,
  compactStatusSpacingStyle,
} from "../../../components/ui/CompactPrimitives";
import {
  Badge,
  SearchInput,
  actionBtnStyle,
  actionsStyle,
  badgeCountStyle,
  btnStyle,
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
} from "../appsShared";

export { shouldUseRegistryAppsCompactLayout } from "./useRegistryAppsModel";
import { useRegistryAppsModel } from "./useRegistryAppsModel";
import { CompactMeta, compactCardTitleWrapStyle, compactTitleStyle, renderRegistryDetails } from "./RegistryAppDetails";

export function RegistryApps({ refreshToken }: { refreshToken?: number }) {
  const { tk, containerRef, registryItems, loadError, refreshing, search, selectedIds, setSelectedIds, expandedId, setExpandedId, busy, filteredRegistry, selectedFilteredCount, allFilteredChecked, compactLayout, handleRefresh, handleToggleId, handleRemoveSelected } = useRegistryAppsModel(refreshToken)

  return (
    <section style={sectionStyle} ref={containerRef}>
      <div style={headerStyle}>
        <div style={titleRowStyle}>
          <span style={titleStyle}>{tk("apps.tab.registry")}</span>
          <span style={badgeCountStyle}>{filteredRegistry.length}</span>
        </div>
        <div style={actionsStyle}>
          <button type="button" onClick={() => void handleRefresh()} disabled={refreshing} style={secondaryBtnStyle(refreshing)}>
            {refreshing ? tk("common.refreshing") : tk("apps.action.refresh")}
          </button>
          <SearchInput value={search.draft} onChange={search.setDraft} onClear={search.clear} placeholder={tk("apps.search.registry_placeholder")} clearLabel={tk("Clear search")} />
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
          <div style={compactStatusSpacingStyle}>
            <StatusMessage tone="error" message={tk("apps.danger.registry")} />
          </div>
          {compactLayout ? (
            <div style={compactListStyle}>
              <div style={compactBulkBarStyle}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
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
                  <span style={compactBulkTextStyle}>
                    {tk("common.selected", { count: selectedFilteredCount })}
                  </span>
                </label>
              </div>

              {filteredRegistry.map((item) => {
                const checked = selectedIds.includes(item.id);
                return (
                  <div key={item.id} style={compactCardStyle}>
                    <div style={compactCardHeaderStyle}>
                      <label htmlFor={`registry-card-${item.id}`} style={compactCardTitleWrapStyle}>
                        <input
                          id={`registry-card-${item.id}`}
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleId(item.id)}
                        />
                        <div style={{ display: "grid", gap: "4px", minWidth: 0 }}>
                          <div style={compactTitleStyle}>{item.appName}</div>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
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
                        </div>
                      </label>
                    </div>

                    <div style={compactMetaGridStyle}>
                      <CompactMeta label={tk("apps.table.version")} value={item.version ?? "-"} mono />
                      <CompactMeta label={tk("apps.table.publisher")} value={item.publisher ?? "-"} />
                      <CompactMeta label={tk("apps.registry.install_location")} value={item.installLocation ?? "-"} multiline muted={!item.installLocation} />
                    </div>

                    <div style={compactActionsStyle}>
                      <button type="button" onClick={() => setExpandedId((c) => c === item.id ? null : item.id)} style={openBtn}>
                        {expandedId === item.id ? tk("apps.action.hide_data") : tk("Details")}
                      </button>
                    </div>

                    {expandedId === item.id ? (
                      <div style={{ marginTop: "4px" }}>
                        {renderRegistryDetails(item, tk)}
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
                            {expandedId === item.id ? tk("apps.action.hide_data") : tk("Details")}
                          </button>
                        </td>
                      </tr>
                      {expandedId === item.id ? (
                        <tr style={rowStyle}>
                          <td colSpan={6} style={{ padding: "0 8px 12px 8px" }}>
                            {renderRegistryDetails(item, tk)}
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
