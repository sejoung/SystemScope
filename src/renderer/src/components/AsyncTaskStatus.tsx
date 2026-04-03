import type { ReactNode } from "react";
import { useI18n } from "../i18n/useI18n";

type AsyncTaskStage = "started" | "running" | "completed" | "failed";

interface AsyncTaskStatusProps {
  stage: AsyncTaskStage;
  taskLabel: string;
  message: string;
  action?: ReactNode;
}

const stageTone: Record<AsyncTaskStage, "info" | "success" | "error"> = {
  started: "info",
  running: "info",
  completed: "success",
  failed: "error",
};

export function AsyncTaskStatus({
  stage,
  taskLabel,
  message,
  action,
}: AsyncTaskStatusProps) {
  const { tk } = useI18n();
  const tone = stageTone[stage];
  const isError = tone === "error";
  const borderColor =
    tone === "error"
      ? "var(--alert-red-border)"
      : tone === "success"
        ? "var(--accent-green)"
        : "var(--border)";
  const backgroundColor =
    tone === "error"
      ? "var(--alert-red-soft)"
      : tone === "success"
        ? "color-mix(in srgb, var(--accent-green) 14%, var(--bg-card))"
        : "var(--bg-card)";
  const badgeBackground =
    tone === "error"
      ? "var(--accent-red)"
      : tone === "success"
        ? "var(--accent-green)"
        : "var(--accent-blue)";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      style={{
        padding: "14px 16px",
        borderRadius: "var(--radius-lg)",
        border: `1px solid ${borderColor}`,
        background: backgroundColor,
        display: "grid",
        gap: "8px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          {taskLabel}
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 8px",
            borderRadius: "999px",
            background: badgeBackground,
            color: "var(--text-on-accent)",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
          }}
        >
          {getStageLabel(stage, tk)}
        </span>
      </div>
      <div
        style={{
          fontSize: "13px",
          lineHeight: 1.6,
          color: "var(--text-secondary)",
        }}
      >
        {message}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

function getStageLabel(
  stage: AsyncTaskStage,
  tk: (text: string, params?: Record<string, string | number>) => string,
) {
  switch (stage) {
    case "started":
      return tk("Started");
    case "running":
      return tk("In progress");
    case "completed":
      return tk("Completed");
    case "failed":
      return tk("Failed");
  }
}
