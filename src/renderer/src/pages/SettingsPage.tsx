import { useEffect, useMemo, useRef, useState } from "react";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useToast } from "../components/Toast";
import type {
  AlertThresholds,
  AppSettings,
  SnapshotIntervalMin,
  AutomationSchedule,
} from "@shared/types";
import { useI18n } from "../i18n/useI18n";
import { translateLiteral, type AppLocale } from "@shared/i18n";
import type { SystemScopeAboutInfo } from "@shared/contracts/systemScope";
import { CopyableValue } from "../components/CopyableValue";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ProfileSection } from "../features/profiles/ProfileSection";
import { useContainerWidth } from "../hooks/useContainerWidth";
import { isCompactWidth, RESPONSIVE_WIDTH } from "../hooks/useResponsiveLayout";
import { useUpdateStore } from "../stores/useUpdateStore";
import {
  applySettingsToStore,
  loadAboutInfo,
  loadAppSettings,
  loadPathValue,
} from "../utils/settingsBootstrap";

const SNAPSHOT_OPTIONS = [
  { value: 15, labelKey: "settings.snapshots.option_15m" },
  { value: 30, labelKey: "settings.snapshots.option_30m" },
  { value: 60, labelKey: "settings.snapshots.option_1h" },
  { value: 120, labelKey: "settings.snapshots.option_2h" },
  { value: 360, labelKey: "settings.snapshots.option_6h" },
] as const;

export function shouldUseSettingsPageCompactLayout(width: number): boolean {
  return isCompactWidth(width, RESPONSIVE_WIDTH.settingsPageCompact);
}

export function SettingsPage() {
  const [containerRef, containerWidth] = useContainerWidth(1200);
  const thresholds = useSettingsStore((s) => s.thresholds);
  const setThresholds = useSettingsStore((s) => s.setThresholds);
  const theme = useSettingsStore((s) => s.theme);
  const locale = useSettingsStore((s) => s.locale);
  const setLocale = useSettingsStore((s) => s.setLocale);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setHasUnsavedSettings = useSettingsStore(
    (s) => s.setHasUnsavedSettings,
  );
  const [local, setLocal] = useState<AlertThresholds>(thresholds);
  const [snapshotInterval, setSnapshotInterval] =
    useState<SnapshotIntervalMin>(60);
  const [localTheme, setLocalTheme] = useState<"dark" | "light">(theme);
  const [localLocale, setLocalLocale] = useState<AppLocale>(locale);
  const [automationSchedule, setAutomationSchedule] = useState<AutomationSchedule>({
    enabled: false,
    frequency: "weekly",
  });
  const [saved, setSaved] = useState(false);
  const [dataPath, setDataPath] = useState<string | null>(null);
  const [systemLogPath, setSystemLogPath] = useState<string | null>(null);
  const [accessLogPath, setAccessLogPath] = useState<string | null>(null);
  const [aboutInfo, setAboutInfo] = useState<SystemScopeAboutInfo | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasEditedRef = useRef(false);
  const persistedRef = useRef<{
    thresholds: AlertThresholds;
    snapshotInterval: number;
    theme: "dark" | "light";
    locale: AppLocale;
    automationSchedule: AutomationSchedule;
  }>({
    thresholds,
    snapshotInterval: 60 as SnapshotIntervalMin,
    theme,
    locale,
    automationSchedule: { enabled: false, frequency: "weekly" },
  });
  const showToast = useToast((s) => s.show);
  const updateInfo = useUpdateStore((s) => s.updateInfo);
  const checkingUpdate = useUpdateStore((s) => s.checking);
  const lastCheckedAt = useUpdateStore((s) => s.lastCheckedAt);
  const applyUpdateStatus = useUpdateStore((s) => s.applyStatus);
  const setUpdateChecking = useUpdateStore((s) => s.setChecking);
  const { t, tk } = useI18n();
  const compactLayout = shouldUseSettingsPageCompactLayout(containerWidth);

  const applyPersistedSettings = (settings: AppSettings) => {
    persistedRef.current.thresholds = settings.thresholds;
    persistedRef.current.snapshotInterval = settings.snapshotIntervalMin;
    persistedRef.current.theme = settings.theme;
    persistedRef.current.locale = settings.locale;
    persistedRef.current.automationSchedule = settings.automation.schedule;

    if (!hasEditedRef.current) {
      setLocal(settings.thresholds);
      setSnapshotInterval(settings.snapshotIntervalMin);
      setLocalTheme(settings.theme);
      setLocalLocale(settings.locale);
      setAutomationSchedule(settings.automation.schedule);
    }
  };

  useEffect(() => {
    void Promise.all([
      loadAppSettings("settings-page"),
      loadPathValue("settings-page", "dataPath", () =>
        window.systemScope.getDataPath(),
      ),
      loadPathValue("settings-page", "systemLogPath", () =>
        window.systemScope.getSystemLogPath(),
      ),
      loadPathValue("settings-page", "accessLogPath", () =>
        window.systemScope.getAccessLogPath(),
      ),
      loadAboutInfo("settings-page"),
    ]).then(
      ([
        settings,
        nextDataPath,
        nextSystemLogPath,
        nextAccessLogPath,
        nextAboutInfo,
      ]) => {
        if (settings) {
          applyPersistedSettings(settings);
          applySettingsToStore(settings);
        } else {
          showToast(
            translateLiteral(
              useSettingsStore.getState().locale,
              "Failed to load settings.",
            ),
            "danger",
          );
        }

        setDataPath(nextDataPath);
        setSystemLogPath(nextSystemLogPath);
        setAccessLogPath(nextAccessLogPath);

        if (nextAboutInfo) {
          setAboutInfo(nextAboutInfo);
        }
      },
    );

    return () => {
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
        savedTimerRef.current = null;
      }
      // hasEditedRef로 실제 변경 여부를 확인하여 strict mode remount 시 오동작 방지
      if (!hasEditedRef.current) {
        setHasUnsavedSettings(false);
      }
    };
  }, [setHasUnsavedSettings, showToast]);

  const appearanceDirty = localTheme !== persistedRef.current.theme;
  const languageDirty = localLocale !== persistedRef.current.locale;
  const alertsDirty = useMemo(
    () =>
      JSON.stringify(local) !== JSON.stringify(persistedRef.current.thresholds),
    [local],
  );
  const snapshotsDirty =
    snapshotInterval !== persistedRef.current.snapshotInterval;
  const automationDirty =
    JSON.stringify(automationSchedule) !==
    JSON.stringify(persistedRef.current.automationSchedule);
  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    const thresholdGroups = [
      {
        label: tk("settings.alerts.cpu"),
        warning: local.cpuWarning,
        critical: local.cpuCritical,
      },
      {
        label: tk("settings.alerts.storage"),
        warning: local.diskWarning,
        critical: local.diskCritical,
      },
      {
        label: tk("settings.alerts.memory"),
        warning: local.memoryWarning,
        critical: local.memoryCritical,
      },
      {
        label: tk("settings.alerts.gpu_memory"),
        warning: local.gpuMemoryWarning,
        critical: local.gpuMemoryCritical,
      },
    ];

    for (const group of thresholdGroups) {
      if (group.warning >= group.critical) {
        issues.push(
          tk("settings.validation.warning_before_critical", {
            label: group.label,
          }),
        );
      }
    }

    return issues;
  }, [
    local.cpuCritical,
    local.cpuWarning,
    local.diskCritical,
    local.diskWarning,
    local.gpuMemoryCritical,
    local.gpuMemoryWarning,
    local.memoryCritical,
    local.memoryWarning,
    tk,
  ]);

  const hasValidationIssues = validationIssues.length > 0;
  const changedSections = [
    languageDirty ? tk("settings.section.language") : null,
    appearanceDirty ? tk("settings.section.appearance") : null,
    alertsDirty ? tk("settings.section.alerts") : null,
    snapshotsDirty ? tk("settings.section.snapshots") : null,
    automationDirty ? tk("cleanup.schedule.title") : null,
  ].filter(Boolean) as string[];
  const isDirty =
    appearanceDirty ||
    languageDirty ||
    alertsDirty ||
    snapshotsDirty ||
    automationDirty;

  useEffect(() => {
    setHasUnsavedSettings(isDirty);
    if (isDirty && saved) {
      setSaved(false);
    }
  }, [isDirty, saved, setHasUnsavedSettings]);

  const handleSave = async () => {
    if (!isDirty || isSaving || hasValidationIssues) return;
    setIsSaving(true);
    try {
      const settingsRes = await window.systemScope.getSettings();
      const res = await window.systemScope.setSettings({
        thresholds: local,
        theme: localTheme,
        locale: localLocale,
        snapshotIntervalMin: snapshotInterval,
        automation: {
          ...(settingsRes.ok
            ? settingsRes.data.automation
            : { schedule: automationSchedule, rules: [] }),
          schedule: automationSchedule,
        },
      });
      if (res.ok) {
        persistedRef.current = {
          thresholds: local,
          snapshotInterval,
          theme: localTheme,
          locale: localLocale,
          automationSchedule,
        };
        hasEditedRef.current = false;
        setThresholds(local);
        setTheme(localTheme);
        setLocale(localLocale);
        setSaved(true);
        showToast(tk("settings.status.saved"), "success");
        if (savedTimerRef.current) {
          clearTimeout(savedTimerRef.current);
        }
        savedTimerRef.current = setTimeout(() => {
          setSaved(false);
          savedTimerRef.current = null;
        }, 2000);
      } else {
        showToast(res.error?.message ?? tk("settings.error.save_failed"));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (key: keyof AlertThresholds, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 5 && num <= 100) {
      hasEditedRef.current = true;
      setLocal({ ...local, [key]: num });
    }
  };

  const handleOpenPath = async (
    targetPath: string | null,
    errorMessage: string,
  ) => {
    if (!targetPath) return;
    const res = await window.systemScope.openPath(targetPath);
    if (!res.ok) {
      showToast(res.error?.message ?? errorMessage);
    }
  };

  const handleOpenAboutWindow = async () => {
    const res = await window.systemScope.openAboutWindow();
    if (!res.ok) {
      showToast(res.error?.message ?? tk("settings.about.open_failed"));
    }
  };

  const handleCheckForUpdates = async () => {
    setUpdateChecking(true);
    try {
      const res = await window.systemScope.checkForUpdate();
      if (!res.ok) {
        showToast(
          res.error?.message ?? t("Unable to check for updates right now."),
        );
        return;
      }

      if (res.data) {
        applyUpdateStatus(res.data);
      }
    } catch {
      showToast(t("Unable to check for updates right now."));
    } finally {
      setUpdateChecking(false);
    }
  };

  const handleOpenUpdateRelease = async () => {
    if (!updateInfo?.releaseUrl) return;
    const res = await window.systemScope.openUpdateRelease(
      updateInfo.releaseUrl,
    );
    if (!res.ok) {
      showToast(
        res.error?.message ?? t("Unable to open the release download page."),
      );
    }
  };

  const formattedCheckedAt = formatUpdateCheckedAt(lastCheckedAt, localLocale);

  return (
    <div data-testid="page-settings" ref={containerRef}>
      <div
        style={{
          display: "flex",
          alignItems: compactLayout ? "flex-start" : "center",
          flexDirection: compactLayout ? "column" : "row",
          gap: "12px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>
          {tk("settings.page.title")}
        </h2>
        <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
          {tk("settings.page.description")}
        </span>
        <span
          style={{
            fontSize: "12px",
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: "999px",
            background: isDirty
              ? "rgba(245, 158, 11, 0.16)"
              : "rgba(34, 197, 94, 0.16)",
            color: isDirty ? "var(--accent-yellow)" : "var(--accent-green)",
          }}
        >
          {isSaving
            ? tk("settings.status.saving")
            : saved
              ? tk("settings.status.saved")
              : isDirty
                ? tk("settings.status.unsaved_changes")
                : tk("settings.status.all_changes_saved")}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "16px",
        }}
      >
        {/* Language */}
        <Section
          title={tk("settings.section.language")}
          badge={languageDirty ? tk("settings.badge.edited") : undefined}
        >
          <SaveTimingNote text={tk("settings.note.save_required")} />
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {tk("settings.language.description")}
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {[
              { value: "en" as const, label: tk("settings.language.english") },
              { value: "ko" as const, label: tk("settings.language.korean") },
            ].map((option) => {
              const active = localLocale === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => {
                    hasEditedRef.current = true;
                    setLocalLocale(option.value);
                  }}
                  style={{
                    padding: "8px 18px",
                    fontSize: "13px",
                    fontWeight: 600,
                    borderRadius: "var(--radius)",
                    border: active
                      ? "1px solid transparent"
                      : "1px solid var(--border)",
                    background: active
                      ? "var(--accent-blue)"
                      : "var(--bg-card)",
                    color: active
                      ? "var(--text-on-accent)"
                      : "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Appearance */}
        <Section
          title={tk("settings.section.appearance")}
          badge={appearanceDirty ? tk("settings.badge.edited") : undefined}
        >
          <SaveTimingNote text={tk("settings.note.save_required")} />
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {tk("settings.theme.description")}
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {[
              { value: "dark", label: tk("settings.theme.dark") },
              { value: "light", label: tk("settings.theme.light") },
            ].map((option) => {
              const active = localTheme === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => {
                    hasEditedRef.current = true;
                    setLocalTheme(option.value as "dark" | "light");
                  }}
                  style={{
                    padding: "8px 18px",
                    fontSize: "13px",
                    fontWeight: 600,
                    borderRadius: "var(--radius)",
                    border: active
                      ? "1px solid transparent"
                      : "1px solid var(--border)",
                    background: active
                      ? "var(--accent-blue)"
                      : "var(--bg-card)",
                    color: active
                      ? "var(--text-on-accent)"
                      : "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Alert Thresholds */}
        <Section
          title={tk("settings.section.alerts")}
          badge={alertsDirty ? tk("settings.badge.edited") : undefined}
        >
          <SaveTimingNote text={tk("settings.note.save_required")} />
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {tk("settings.alerts.description")}
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            <ThresholdGroup
              label={tk("settings.alerts.cpu")}
              warning={local.cpuWarning}
              critical={local.cpuCritical}
              onWarningChange={(v) => updateField("cpuWarning", v)}
              onCriticalChange={(v) => updateField("cpuCritical", v)}
            />
            <ThresholdGroup
              label={tk("settings.alerts.storage")}
              warning={local.diskWarning}
              critical={local.diskCritical}
              onWarningChange={(v) => updateField("diskWarning", v)}
              onCriticalChange={(v) => updateField("diskCritical", v)}
            />
            <ThresholdGroup
              label={tk("settings.alerts.memory")}
              warning={local.memoryWarning}
              critical={local.memoryCritical}
              onWarningChange={(v) => updateField("memoryWarning", v)}
              onCriticalChange={(v) => updateField("memoryCritical", v)}
            />
            <ThresholdGroup
              label={tk("settings.alerts.gpu_memory")}
              warning={local.gpuMemoryWarning}
              critical={local.gpuMemoryCritical}
              onWarningChange={(v) => updateField("gpuMemoryWarning", v)}
              onCriticalChange={(v) => updateField("gpuMemoryCritical", v)}
            />
          </div>
        </Section>

        {/* Snapshot Settings */}
        <Section
          title={tk("settings.section.snapshots")}
          badge={snapshotsDirty ? tk("settings.badge.edited") : undefined}
        >
          <SaveTimingNote text={tk("settings.note.save_required")} />
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {tk("settings.snapshots.description")}
          </div>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {SNAPSHOT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  hasEditedRef.current = true;
                  setSnapshotInterval(opt.value);
                }}
                style={{
                  padding: "6px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  borderRadius: "var(--radius)",
                  background:
                    snapshotInterval === opt.value
                      ? "var(--accent-blue)"
                      : "var(--bg-card-hover)",
                  color:
                    snapshotInterval === opt.value
                      ? "var(--text-on-accent)"
                      : "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                {tk(opt.labelKey)}
              </button>
            ))}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            {tk("settings.snapshots.current", {
              interval: snapshotInterval,
              days: Math.round((168 * snapshotInterval) / 60 / 24),
            })}
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            {tk("settings.snapshots.guidance")}
          </div>
        </Section>

        <Section
          title={tk("cleanup.schedule.title")}
          badge={automationDirty ? tk("settings.badge.edited") : undefined}
        >
          <SaveTimingNote text={tk("settings.note.save_required")} />
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {tk("cleanup.schedule.enabled")}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <input
              type="checkbox"
              checked={automationSchedule.enabled}
              onChange={(event) => {
                hasEditedRef.current = true;
                setAutomationSchedule((prev) => ({
                  ...prev,
                  enabled: event.target.checked,
                }));
              }}
            />
            <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>
              {tk("cleanup.schedule.enabled")}
            </span>
          </label>
          <div style={{ display: "grid", gap: "8px" }}>
            <label style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              {tk("cleanup.schedule.frequency")}
            </label>
            <select
              value={automationSchedule.frequency}
              onChange={(event) => {
                hasEditedRef.current = true;
                setAutomationSchedule((prev) => ({
                  ...prev,
                  frequency: event.target.value as AutomationSchedule["frequency"],
                }));
              }}
              style={selectStyle}
            >
              <option value="daily">{tk("cleanup.schedule.frequency.daily")}</option>
              <option value="weekly">{tk("cleanup.schedule.frequency.weekly")}</option>
              <option value="manual">{tk("cleanup.schedule.frequency.manual")}</option>
            </select>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            {tk("cleanup.schedule.last_run")}:{" "}
            {automationSchedule.lastRunAt
              ? new Date(automationSchedule.lastRunAt).toLocaleString()
              : tk("cleanup.schedule.never")}
          </div>
        </Section>

        {/* Workspace Profiles */}
        <Section title={t("Workspace Profiles")}>
          <ProfileSection />
        </Section>

        {/* Data Storage */}
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
        <Section title={t("Updates")}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {t(
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
              {t("Current version")}:{" "}
              {aboutInfo?.version ?? updateInfo?.currentVersion ?? "-"}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              {t("Latest version")}:{" "}
              {updateInfo?.latestVersion ?? t("Not checked yet")}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              {t("Last checked")}: {formattedCheckedAt ?? t("Not checked yet")}
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
                ? t("A new version v{version} is available.", {
                    version: updateInfo.latestVersion,
                  })
                : formattedCheckedAt
                  ? t("You are using the latest version.")
                  : t("No update check has been run yet.")}
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
              {checkingUpdate ? t("Checking...") : t("Check for Updates")}
            </button>
            {updateInfo?.hasUpdate ? (
              <button
                onClick={() => void handleOpenUpdateRelease()}
                style={btnStyle}
              >
                {t("Download")}
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
      </div>

      {/* Save bar — 하단 고정 */}
      <div
        style={{
          display: "flex",
          alignItems: compactLayout ? "stretch" : "center",
          flexDirection: compactLayout ? "column" : "row",
          gap: "10px",
          position: "sticky",
          bottom: 0,
          marginTop: "20px",
          padding: "12px 16px",
          background: "var(--bg-card)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)",
          zIndex: 10,
        }}
      >
        <div style={{ display: "grid", gap: "6px", flex: 1, minWidth: 0 }}>
          {changedSections.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {changedSections.map((section) => (
                <span key={section} style={changedBadgeStyle}>
                  {section}
                </span>
              ))}
            </div>
          )}
          {hasValidationIssues && (
            <div style={validationListStyle}>
              {validationIssues.map((issue) => (
                <div key={issue}>{issue}</div>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={!isDirty || isSaving || hasValidationIssues}
          style={{
            ...btnStyle,
            width: compactLayout ? "100%" : undefined,
            opacity: !isDirty || isSaving || hasValidationIssues ? 0.55 : 1,
            cursor:
              !isDirty || isSaving || hasValidationIssues
                ? "default"
                : "pointer",
          }}
        >
          {isSaving
            ? tk("settings.status.saving")
            : isDirty
              ? tk("settings.save.save_all")
              : tk("settings.status.saved")}
        </button>
        <span
          style={{
            fontSize: "12px",
            color: saved
              ? "var(--accent-green)"
              : isDirty
                ? "var(--accent-yellow)"
                : "var(--text-muted)",
          }}
        >
          {hasValidationIssues
            ? tk("settings.validation.resolve_before_save")
            : saved
              ? tk("settings.footer.saved")
              : isDirty
                ? tk("settings.footer.unsaved")
                : tk("settings.footer.current_saved")}
        </span>
        <span
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            marginLeft: compactLayout ? 0 : "auto",
          }}
        >
          {tk("settings.footer.description")}
        </span>
      </div>
    </div>
  );
}

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary title={title}>
      <div
        style={{
          backgroundColor: "var(--bg-card)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-secondary)",
            }}
          >
            {title}
          </span>
          {badge && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "1px 8px",
                borderRadius: "4px",
                background: "rgba(245, 158, 11, 0.12)",
                color: "var(--accent-yellow)",
              }}
            >
              {badge}
            </span>
          )}
        </div>
        {children}
      </div>
    </ErrorBoundary>
  );
}

export function formatUpdateCheckedAt(
  lastCheckedAt: string | null,
  locale: AppLocale,
): string | null {
  if (!lastCheckedAt) {
    return null;
  }

  const checkedAt = new Date(lastCheckedAt);
  if (Number.isNaN(checkedAt.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(checkedAt);
}

function PathRow({
  label,
  value,
  openLabel,
  onOpen,
}: {
  label: string;
  value: string;
  openLabel: string;
  onOpen: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "10px",
        padding: "10px 14px",
        background: "var(--bg-primary)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            marginBottom: "4px",
          }}
        >
          {label}
        </div>
        <CopyableValue value={value} fontSize="13px" maxWidth="100%" />
      </div>
      <button onClick={onOpen} style={{ ...btnStyle, width: "100%", maxWidth: "160px" }}>
        {openLabel}
      </button>
    </div>
  );
}

export function SaveTimingNote({ text }: { text: string }) {
  return (
    <div
      style={{
        fontSize: "11px",
        fontWeight: 700,
        color: "var(--accent-blue)",
        background: "color-mix(in srgb, var(--accent-blue) 12%, transparent)",
        borderRadius: "999px",
        padding: "4px 10px",
        alignSelf: "flex-start",
      }}
    >
      {text}
    </div>
  );
}

function ThresholdGroup({
  label,
  warning,
  critical,
  onWarningChange,
  onCriticalChange,
}: {
  label: string;
  warning: number;
  critical: number;
  onWarningChange: (v: string) => void;
  onCriticalChange: (v: string) => void;
}) {
  const { tk } = useI18n();
  const hasError = warning >= critical;

  return (
    <div>
      <div
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: "8px",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <label
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              display: "block",
              marginBottom: "4px",
            }}
          >
            {tk("settings.alerts.warning")}
          </label>
          <input
            type="number"
            min={5}
            max={100}
            value={warning}
            onChange={(e) => onWarningChange(e.target.value)}
            style={{
              ...inputStyle,
              width: "100%",
              minWidth: "96px",
              borderColor: hasError ? "var(--accent-red)" : undefined,
            }}
          />
        </div>
        <div>
          <label
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              display: "block",
              marginBottom: "4px",
            }}
          >
            {tk("settings.alerts.critical")}
          </label>
          <input
            type="number"
            min={5}
            max={100}
            value={critical}
            onChange={(e) => onCriticalChange(e.target.value)}
            style={{
              ...inputStyle,
              width: "100%",
              minWidth: "96px",
              borderColor: hasError ? "var(--accent-red)" : undefined,
            }}
          />
        </div>
      </div>
      {hasError && (
        <div
          style={{
            fontSize: "11px",
            color: "var(--accent-red)",
            marginTop: "6px",
          }}
        >
          {tk("settings.validation.warning_before_critical", { label })}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "80px",
  padding: "6px 10px",
  fontSize: "13px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: "13px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
};

const btnStyle: React.CSSProperties = {
  padding: "6px 16px",
  fontSize: "12px",
  fontWeight: 600,
  border: "none",
  borderRadius: "var(--radius)",
  background: "var(--accent-blue)",
  color: "var(--text-on-accent)",
  cursor: "pointer",
};

const changedBadgeStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  padding: "2px 8px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--accent-blue) 14%, transparent)",
  color: "var(--accent-blue)",
};

const validationListStyle: React.CSSProperties = {
  display: "grid",
  gap: "4px",
  padding: "8px 10px",
  borderRadius: "8px",
  background: "var(--alert-red-soft)",
  border: "1px solid var(--alert-red-border)",
  color: "var(--accent-red)",
  fontSize: "12px",
  lineHeight: 1.5,
};
