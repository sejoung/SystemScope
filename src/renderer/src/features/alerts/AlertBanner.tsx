import { useMemo } from "react";
import { useAlertStore } from "../../stores/useAlertStore";
import { useI18n } from "../../i18n/useI18n";

export function AlertBanner() {
  const allAlerts = useAlertStore((s) => s.alerts);
  const dismissAlert = useAlertStore((s) => s.dismissAlert);
  const { t } = useI18n();
  const alerts = useMemo(
    () => allAlerts.filter((a) => !a.dismissed),
    [allAlerts],
  );

  if (alerts.length === 0) return null;

  const latestAlerts = alerts.slice(0, 3);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        marginBottom: "16px",
      }}
    >
      {latestAlerts.map((alert) => (
        <div
          key={alert.id}
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            borderRadius: "var(--radius)",
            backgroundColor:
              alert.severity === "critical"
                ? "var(--alert-red-soft)"
                : "var(--alert-yellow-soft)",
            border: `1px solid ${alert.severity === "critical" ? "var(--alert-red-border)" : "var(--alert-yellow-border)"}`,
            fontSize: "13px",
          }}
        >
          <span
            style={{
              color:
                alert.severity === "critical"
                  ? "var(--accent-red)"
                  : "var(--accent-yellow)",
            }}
          >
            {alert.severity === "critical" ? `\u2715 ${t("CRITICAL")}` : `\u26A0 ${t("WARNING")}`}:{" "}
            {alert.message}
          </span>
          <button
            type="button"
            aria-label={t("Close")}
            onClick={() => {
              dismissAlert(alert.id);
              void window.systemScope.dismissAlert(alert.id);
            }}
            style={{
              border: "none",
              background: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: "16px",
              padding: "0 4px",
            }}
          >
            x
          </button>
        </div>
      ))}
    </div>
  );
}
