import { useEffect, useMemo, useRef, useState } from 'react'
import { useSettingsStore } from '../stores/settings/useSettingsStore'
import { useToast } from '../components/ui/Toast'
import type { AlertThresholds, AppSettings, AutomationSchedule, SnapshotIntervalMin } from '@shared/types'
import { translate, type AppLocale } from '@shared/i18n'
import type { SystemScopeAboutInfo } from '@shared/contracts/systemScope'
import { useI18n } from '../i18n/useI18n'
import { useContainerWidth } from '../hooks/useContainerWidth'
import { isCompactWidth, RESPONSIVE_WIDTH } from '../hooks/useResponsiveLayout'
import { useUpdateStore } from '../stores/update/useUpdateStore'
import { applySettingsToStore, loadAboutInfo, loadAppSettings, loadPathValue } from '../utils/settingsBootstrap'
import { formatUpdateCheckedAt } from './SettingsPrimitives'
import { findInvalidThresholdLabels } from './settingsValidation'

export function shouldUseSettingsPageCompactLayout(width: number): boolean { return isCompactWidth(width, RESPONSIVE_WIDTH.settingsPageCompact) }

export function useSettingsPageModel() {
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
  const { tk } = useI18n();
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
            translate(
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
    const invalidLabels = findInvalidThresholdLabels(local, {
      cpu: tk('settings.alerts.cpu'),
      disk: tk('settings.alerts.storage'),
      memory: tk('settings.alerts.memory'),
      gpuMemory: tk('settings.alerts.gpu_memory'),
    })
    return invalidLabels.map((label) =>
      tk('settings.validation.warning_before_critical', { label }),
    )
  }, [local, tk])

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
          res.error?.message ?? tk("Unable to check for updates right now."),
        );
        return;
      }

      if (res.data) {
        applyUpdateStatus(res.data);
      }
    } catch {
      showToast(tk("Unable to check for updates right now."));
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
        res.error?.message ?? tk("Unable to open the release download page."),
      );
    }
  };

  const formattedCheckedAt = formatUpdateCheckedAt(lastCheckedAt, localLocale);


  return { tk, containerRef, compactLayout, local, setLocal, snapshotInterval, setSnapshotInterval, localTheme, setLocalTheme, localLocale, setLocalLocale, automationSchedule, setAutomationSchedule, saved, dataPath, systemLogPath, accessLogPath, aboutInfo, isSaving, hasEditedRef, updateInfo, checkingUpdate, lastCheckedAt, appearanceDirty, languageDirty, alertsDirty, snapshotsDirty, automationDirty, validationIssues, hasValidationIssues, changedSections, isDirty, handleSave, updateField, handleOpenPath, handleOpenAboutWindow, handleCheckForUpdates, handleOpenUpdateRelease, formattedCheckedAt }
}
export type SettingsPageModel = ReturnType<typeof useSettingsPageModel>
