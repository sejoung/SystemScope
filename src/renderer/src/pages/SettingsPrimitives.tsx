import type React from 'react'
import type { AppLocale } from '@shared/i18n'
import { CopyableValue } from '../components/ui/CopyableValue'
import { ErrorBoundary } from '../components/layout/ErrorBoundary'
import { useI18n } from '../i18n/useI18n'

export function Section({
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

export function PathRow({
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

export function ThresholdGroup({
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

export const inputStyle: React.CSSProperties = {
  width: "80px",
  padding: "6px 10px",
  fontSize: "13px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
};

export const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: "13px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
};

export const btnStyle: React.CSSProperties = {
  padding: "6px 16px",
  fontSize: "12px",
  fontWeight: 600,
  border: "none",
  borderRadius: "var(--radius)",
  background: "var(--accent-blue)",
  color: "var(--text-on-accent)",
  cursor: "pointer",
};

export const changedBadgeStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  padding: "2px 8px",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--accent-blue) 14%, transparent)",
  color: "var(--accent-blue)",
};

export const validationListStyle: React.CSSProperties = {
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
