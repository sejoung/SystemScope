import type { AutomationSchedule } from '@shared/types'
import { ProfileSection } from '../../features/profiles/ProfileSection'
import { SaveTimingNote, Section, ThresholdGroup, selectStyle } from './SettingsPrimitives'
import { SNAPSHOT_OPTIONS, THRESHOLD_PRESETS } from './settingsOptions'
import type { SettingsPageModel } from './useSettingsPageModel'

export function SettingsGeneralSections({ model }: { model: SettingsPageModel }) {
  const { tk, local, setLocal, snapshotInterval, setSnapshotInterval, localTheme, setLocalTheme, localLocale, setLocalLocale, automationSchedule, setAutomationSchedule, hasEditedRef, languageDirty, appearanceDirty, alertsDirty, snapshotsDirty, automationDirty, updateField } = model
  return <>
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
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {THRESHOLD_PRESETS.map((preset) => (
              <button
                key={preset.labelKey}
                onClick={() => {
                  setLocal(preset.thresholds);
                  hasEditedRef.current = true;
                }}
                style={{
                  padding: "5px 12px",
                  fontSize: "11px",
                  fontWeight: 600,
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  background: "var(--bg-card)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                {tk(preset.labelKey)}
              </button>
            ))}
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
        <Section title={tk("Workspace Profiles")}>
          <ProfileSection />
        </Section>

        {/* Data Storage */}
  </>
}
