import { useI18n } from "../../i18n/useI18n";

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ color: "var(--text-muted)" }}>
      {label}: <strong style={{ color: "var(--text-primary)" }}>{value}</strong>
    </span>
  );
}

export function SectionFallback({ title }: { title: string }) {
  const { tk } = useI18n();
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "16px",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          fontWeight: 700,
          color: "var(--text-secondary)",
          marginBottom: "8px",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
        {tk("disk.common.loading")}
      </div>
    </div>
  );
}
