import { useEffect, useState } from "react";
import { isAIUsageOverview } from "@shared/types";
import type { AIUsageDetectedProvider } from "@shared/types";
import { useToast } from "../../components/Toast";
import { useI18n } from "../../i18n/useI18n";

export function AIUsageSection() {
  const { t } = useI18n();
  const showToast = useToast((s) => s.show);
  const [providers, setProviders] = useState<AIUsageDetectedProvider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadOverview();
  }, []);

  async function loadOverview() {
    setLoading(true);
    const res = await window.systemScope.getAIUsageOverview();
    if (!res.ok) {
      showToast(res.error?.message ?? t("Unable to load detected AI usage."), "danger");
      setLoading(false);
      return;
    }

    if (!isAIUsageOverview(res.data)) {
      showToast(t("Unable to load detected AI usage."), "danger");
      setLoading(false);
      return;
    }

    setProviders(res.data.providers);
    setLoading(false);
  }

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
            {t("AI Usage")}
          </h3>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.6 }}>
            {t("Automatically detect local AI tools and separate session limits from longer usage windows.")}
          </div>
        </div>
        <button type="button" onClick={() => void loadOverview()} style={buttonStyle}>
          {t("Refresh")}
        </button>
      </div>

      {loading ? (
        <div style={emptyStateStyle}>{t("Detecting local AI tooling...")}</div>
      ) : providers.length === 0 ? (
        <div style={emptyStateStyle}>{t("No supported local AI tools were detected.")}</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {providers.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProviderCard({ provider }: { provider: AIUsageDetectedProvider }) {
  const { t } = useI18n();

  return (
    <div style={providerCardStyle}>
      <div style={providerHeaderStyle}>
        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{provider.label}</span>
            <span style={badgeStyle}>{provider.installed ? t("Detected") : t("Missing")}</span>
            {provider.planType && <span style={badgeStyle}>{provider.planType}</span>}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", wordBreak: "break-all" }}>
            {provider.sourcePath ?? t("No local stats source")}
          </div>
        </div>
      </div>

      <div style={windowGridStyle}>
        {provider.windows.length === 0 ? (
          <div style={emptyMiniStateStyle}>{t("No usage window data available yet.")}</div>
        ) : (
          provider.windows.map((windowUsage) => (
            <div key={windowUsage.label} style={windowCardStyle}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700 }}>
                  {t(windowUsage.label)}
                </div>
                {windowUsage.usedPercent !== null ? (
                  <>
                    <div style={meterTrackStyle}>
                      <div
                        style={{
                          ...meterFillStyle,
                          width: `${Math.min(100, windowUsage.usedPercent)}%`,
                          background: windowUsage.usedPercent >= 90 ? "var(--accent-red)" : "var(--accent-blue)",
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                      {windowUsage.usedPercent.toFixed(1)}%
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                    {windowUsage.valueLabel ?? t("Unknown")}
                  </div>
                )}
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  {windowUsage.resetsAt
                    ? `${t("Resets")}: ${formatDate(windowUsage.resetsAt)}`
                    : windowUsage.kind === "usage"
                      ? t("Local usage snapshot")
                      : t("Reset time unavailable")}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={statsGridStyle}>
        {provider.totalTokens !== null && (
          <Stat label={t("Session Tokens")} value={formatNumber(provider.totalTokens)} />
        )}
        {provider.inputTokens !== null && (
          <Stat label={t("Input")} value={formatNumber(provider.inputTokens)} />
        )}
        {provider.outputTokens !== null && (
          <Stat label={t("Output")} value={formatNumber(provider.outputTokens)} />
        )}
        {provider.contextWindow !== null && (
          <Stat label={t("Context Window")} value={formatNumber(provider.contextWindow)} />
        )}
        <Stat
          label={t("Updated")}
          value={provider.lastUpdatedAt ? formatDate(provider.lastUpdatedAt) : t("Unknown")}
        />
      </div>

      {provider.modelUsage.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700 }}>
            {t("Model Breakdown")}
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {provider.modelUsage.slice(0, 5).map((model) => (
              <div key={model.model} style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "var(--text-primary)", wordBreak: "break-all" }}>{model.model}</span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{formatNumber(model.tokens)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gap: 3 }}>
      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

const cardStyle: React.CSSProperties = {
  padding: "16px",
  borderRadius: "var(--radius-lg)",
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  display: "grid",
  gap: 14,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const providerCardStyle: React.CSSProperties = {
  borderRadius: "10px",
  border: "1px solid var(--border)",
  background: "var(--bg-secondary)",
  padding: "14px",
  display: "grid",
  gap: 12,
};

const providerHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const badgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "var(--text-secondary)",
  border: "1px solid var(--border)",
  borderRadius: "999px",
  padding: "2px 8px",
  background: "var(--bg-card)",
};

const windowGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
};

const windowCardStyle: React.CSSProperties = {
  borderRadius: "10px",
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  padding: "12px",
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
};

const meterTrackStyle: React.CSSProperties = {
  width: "100%",
  height: 8,
  borderRadius: 999,
  overflow: "hidden",
  background: "color-mix(in srgb, var(--text-secondary) 15%, transparent)",
};

const meterFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: 999,
};

const buttonStyle: React.CSSProperties = {
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 700,
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--bg-secondary)",
  color: "var(--text-primary)",
  cursor: "pointer",
};

const emptyStateStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-secondary)",
  textAlign: "center",
  padding: "16px 12px",
  borderRadius: "10px",
  border: "1px dashed var(--border)",
  background: "var(--bg-secondary)",
};

const emptyMiniStateStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-secondary)",
  padding: "12px",
  borderRadius: "10px",
  border: "1px dashed var(--border)",
  background: "var(--bg-card)",
};
