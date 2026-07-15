import { CopyableValue } from '../../components/ui/CopyableValue'
import { PathRow, Section, btnStyle } from './SettingsPrimitives'
import type { SettingsPageModel } from './useSettingsPageModel'

export function SettingsSystemSections({ model }: { model: SettingsPageModel }) {
  const { tk, dataPath, systemLogPath, accessLogPath, aboutInfo, updateInfo, checkingUpdate, formattedCheckedAt, handleOpenPath, handleOpenAboutWindow, handleCheckForUpdates, handleOpenUpdateRelease } = model
  return <>
        <Section title={tk("settings.section.app_data")}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {tk("settings.app_data.description")}
          </div>
          {dataPath && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 14px",
                background: "var(--bg-primary)",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <CopyableValue
                  value={dataPath}
                  fontSize="13px"
                  maxWidth="100%"
                />
              </div>
              <button
                onClick={() =>
                  void handleOpenPath(
                    dataPath,
                    tk("settings.app_data.open_failed"),
                  )
                }
                style={btnStyle}
              >
                {tk("common.open")}
              </button>
            </div>
          )}
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              lineHeight: "1.6",
            }}
          >
            <div>{tk("settings.app_data.config")}</div>
            <div>{tk("settings.app_data.window_state")}</div>
            <div>{tk("settings.app_data.snapshots")}</div>
          </div>
        </Section>

        {/* Logs */}
        <Section title={tk("settings.section.logs")}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {tk("settings.logs.description")}
          </div>
          {systemLogPath && (
            <PathRow
              label={tk("settings.logs.system_path")}
              value={systemLogPath}
              openLabel={tk("common.open")}
              onOpen={() =>
                void handleOpenPath(
                  systemLogPath,
                  tk("settings.logs.open_failed"),
                )
              }
            />
          )}
          {accessLogPath && (
            <PathRow
              label={tk("settings.logs.access_path")}
              value={accessLogPath}
              openLabel={tk("common.open")}
              onOpen={() =>
                void handleOpenPath(
                  accessLogPath,
                  tk("settings.logs.open_failed"),
                )
              }
            />
          )}
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              lineHeight: "1.6",
            }}
          >
            <div>{tk("settings.logs.system_filename")}</div>
            <div>{tk("settings.logs.access_filename")}</div>
            <div>{tk("settings.logs.retention")}</div>
          </div>
        </Section>

        {/* About */}
        <Section title={tk("Updates")}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {tk(
              "Check for a newer version and open the official download page in your browser.",
            )}
          </div>
          <div
            style={{
              display: "grid",
              gap: "8px",
              padding: "12px 14px",
              background: "var(--bg-primary)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              {tk("Current version")}:{" "}
              {aboutInfo?.version ?? updateInfo?.currentVersion ?? "-"}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              {tk("Latest version")}:{" "}
              {updateInfo?.latestVersion ?? tk("Not checked yet")}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              {tk("Last checked")}: {formattedCheckedAt ?? tk("Not checked yet")}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: updateInfo?.hasUpdate
                  ? "var(--accent-blue)"
                  : "var(--text-secondary)",
              }}
            >
              {updateInfo?.hasUpdate
                ? tk("A new version v{version} is available.", {
                    version: updateInfo.latestVersion,
                  })
                : formattedCheckedAt
                  ? tk("You are using the latest version.")
                  : tk("No update check has been run yet.")}
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              onClick={() => void handleCheckForUpdates()}
              disabled={checkingUpdate}
              style={{
                ...btnStyle,
                opacity: checkingUpdate ? 0.6 : 1,
                cursor: checkingUpdate ? "default" : "pointer",
              }}
            >
              {checkingUpdate ? tk("Checking...") : tk("Check for Updates")}
            </button>
            {updateInfo?.hasUpdate ? (
              <button
                onClick={() => void handleOpenUpdateRelease()}
                style={btnStyle}
              >
                {tk("Download")}
              </button>
            ) : null}
          </div>
        </Section>

        {/* About */}
        <Section title={tk("settings.section.about")}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {tk("settings.about.description")}
          </div>
          <div
            style={{
              display: "grid",
              gap: "8px",
              padding: "12px 14px",
              background: "var(--bg-primary)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {aboutInfo?.appName ?? "SystemScope"}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              {tk("settings.about.version")}: {aboutInfo?.version ?? "-"}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              {tk("settings.about.developer")}: {aboutInfo?.author ?? "-"}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              {tk("settings.about.license")}: {aboutInfo?.license ?? "-"}
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              onClick={() => void handleOpenAboutWindow()}
              style={btnStyle}
            >
              {tk("settings.about.open_window")}
            </button>
          </div>
        </Section>
  </>
}
