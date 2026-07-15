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
import { formatBytes } from "../../../utils/format";
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
} from "../appsShared";

export { shouldUseLeftoverAppsCompactLayout } from "./useLeftoverAppsModel";
import { useLeftoverAppsModel } from "./useLeftoverAppsModel";
import { CompactMeta, compactBadgeStackStyle, compactCardTitleWrapStyle, compactTitleStyle, renderLeftoverDetails } from "./LeftoverAppDetails";

export function LeftoverApps({ refreshToken }: { refreshToken?: number }) {
  const { tk, containerRef, leftoverItems, loadError, refreshing, search, platformFilter, setPlatformFilter, confidenceFilter, setConfidenceFilter, leftoverSort, setLeftoverSort, selectedIds, setSelectedIds, expandedId, setExpandedId, busy, filteredLeftovers, leftoverSizePendingCount, leftoverSizeReadyCount, observeRow, selectedFilteredCount, allFilteredChecked, selectedItems, compactLayout, handleRefresh, handleToggleId, handleRemoveSelected, handleOpenPath } = useLeftoverAppsModel(refreshToken)

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
          <SearchInput value={search.draft} onChange={search.setDraft} onClear={search.clear} placeholder={tk("apps.search.leftover_placeholder")} clearLabel={tk("Clear search")} />
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
        <StatusMessage tone="error" message={tk(loadError)} action={<button type="button" onClick={() => void handleRefresh()} style={btnStyle}>{tk("apps.action.refresh")}</button>} />
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
                      <CompactMeta label={tk("Size")} value={item.sizeBytes !== undefined ? formatBytes(item.sizeBytes) : tk("Calculating...")} mono={item.sizeBytes !== undefined} muted={item.sizeBytes === undefined} />
                      <CompactMeta label={tk("apps.table.location")} value={item.path} multiline />
                    </div>

                    <div style={compactActionsStyle}>
                      <button type="button" onClick={() => setExpandedId((c) => c === item.id ? null : item.id)} style={openBtn}>
                        {expandedId === item.id ? tk("apps.action.hide_data") : tk("Details")}
                      </button>
                      <button type="button" onClick={() => void handleOpenPath(item.path)} style={openBtn}>
                        {tk("apps.action.open")}
                      </button>
                    </div>

                    {expandedId === item.id ? (
                      <div style={{ marginTop: "4px" }}>
                        {renderLeftoverDetails(item, tk)}
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
                    <th style={{ ...thStyle, textAlign: "right" }}>{tk("Size")}</th>
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
                            {item.sizeBytes !== undefined ? formatBytes(item.sizeBytes) : <span style={pendingValueStyle}>{tk("Calculating...")}</span>}
                          </td>
                          <td style={{ ...tdStyle, maxWidth: "340px" }}>
                            <CopyableValue value={item.path} fontSize="12px" color="var(--text-muted)" multiline maxWidth="340px" />
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                            <button type="button" onClick={() => setExpandedId((c) => c === item.id ? null : item.id)} style={openBtn}>
                              {expandedId === item.id ? tk("apps.action.hide_data") : tk("Details")}
                            </button>
                            <button type="button" onClick={() => void handleOpenPath(item.path)} style={openBtn}>
                              {tk("apps.action.open")}
                            </button>
                          </td>
                        </tr>
                        {expandedId === item.id ? (
                          <tr style={rowStyle}>
                            <td colSpan={7} style={{ padding: "0 8px 12px 8px" }}>
                              {renderLeftoverDetails(item, tk)}
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
