import { Fragment } from "react";
import { StatusMessage } from "../../components/ui/StatusMessage";
import { CopyableValue } from "../../components/ui/CopyableValue";
import {
  compactActionsStyle,
  compactCardHeaderStyle,
  compactCardStyle,
  compactListStyle,
  compactMetaLabelStyle,
  compactMetaGridStyle,
  compactStatusSpacingStyle,
} from "../../components/ui/CompactPrimitives";
import {
  type PlatformFilter,
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
  inputStyle,
  monoCellStyle,
  openBtn,
  protectedBadgeStyle,
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

export { shouldUseInstalledAppsCompactLayout } from "./useInstalledAppsModel";
import { useInstalledAppsModel } from "./useInstalledAppsModel";
import { CompactMeta, compactLocationBlockStyle, compactTitleStyle, renderRelatedDataPanel } from "./InstalledAppRelatedPanel";

export function InstalledApps({ refreshToken }: { refreshToken?: number }) {
  const { tk, isWindows, containerRef, apps, loadError, refreshing, search, platformFilter, setPlatformFilter, busyAppId, expandedAppId, relatedLoadingAppId, relatedDataByAppId, selectedRelatedIdsByAppId, filteredApps, compactLayout, handleRefresh, handleUninstall, handleToggleRelatedData, handleToggleRelatedId, handleOpenLocation, handleOpenSystemSettings } = useInstalledAppsModel(refreshToken)

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
            clearLabel={tk("Clear search")}
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
          {tk("Installed apps are sorted by name so known tools are easier to find.")}
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
          <div style={compactStatusSpacingStyle}>
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
                        <div style={subtleTextStyle}>{tk(entry.protectedReason)}</div>
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
                            <div style={subtleTextStyle}>{tk(entry.protectedReason)}</div>
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
