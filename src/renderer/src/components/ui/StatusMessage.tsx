import type { ReactNode } from "react";

interface StatusMessageProps {
  title?: string;
  message: string;
  tone?: "info" | "error";
  action?: ReactNode;
}

export function StatusMessage({
  title,
  message,
  tone = "info",
  action,
}: StatusMessageProps) {
  const isError = tone === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      style={{
        padding: "18px 16px",
        borderRadius: "var(--radius-lg)",
        border: `1px solid ${isError ? "var(--alert-red-border)" : "var(--border)"}`,
        background: isError ? "var(--alert-red-soft)" : "var(--bg-card)",
        display: "grid",
        gap: "8px",
      }}
    >
      {title ? (
        <div
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: isError ? "var(--accent-red)" : "var(--text-primary)",
          }}
        >
          {title}
        </div>
      ) : null}
      <div
        style={{
          fontSize: "13px",
          lineHeight: 1.6,
          color: isError ? "var(--text-primary)" : "var(--text-secondary)",
        }}
      >
        {message}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
