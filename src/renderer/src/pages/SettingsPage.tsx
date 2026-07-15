import { btnStyle, changedBadgeStyle, validationListStyle } from "./SettingsPrimitives";
import { SettingsGeneralSections } from "./SettingsGeneralSections";
import { SettingsSystemSections } from "./SettingsSystemSections";
export { SaveTimingNote, formatUpdateCheckedAt } from "./SettingsPrimitives";

export { shouldUseSettingsPageCompactLayout } from "./useSettingsPageModel";
import { useSettingsPageModel } from "./useSettingsPageModel";

export function SettingsPage() {
  const model = useSettingsPageModel()
  const { tk, containerRef, compactLayout, saved, isSaving, validationIssues, hasValidationIssues, changedSections, isDirty, handleSave } = model

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
        <SettingsGeneralSections model={model} />
        <SettingsSystemSections model={model} />
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
