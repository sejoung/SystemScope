import { useI18n } from "../i18n/useI18n";

export function PageLoading({
  message,
  detail,
}: {
  message?: string;
  detail?: string;
}) {
  const { tk } = useI18n();
  const resolvedMessage = message ?? tk("monitoring.loading");

  return (
    <div
      data-testid="page-loading"
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        padding: "80px 0",
        color: "var(--text-muted)",
      }}
    >
      <div
        style={{
          width: "24px",
          height: "24px",
          border: "2.5px solid var(--border)",
          borderTop: "2.5px solid var(--accent-blue)",
          borderRadius: "50%",
          animation: "page-loading-spin 0.8s linear infinite",
        }}
      />
      <span style={{ fontSize: "13px" }}>{resolvedMessage}</span>
      {detail ? (
        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
          {detail}
        </span>
      ) : null}
    </div>
  );
}
