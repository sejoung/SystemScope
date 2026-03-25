import { useState } from "react";
import { useProcessStore } from "../stores/useProcessStore";
import { ProcessTable } from "../features/process/ProcessTable";
import { PortFinder } from "../features/process/PortFinder";
import { PortWatch } from "../features/process/PortWatch";
import { PageLoading } from "../components/PageLoading";
import { useI18n } from "../i18n/useI18n";

type ActivityTab = "processes" | "ports" | "watch";

export function ProcessPage() {
  const allProcesses = useProcessStore((s) => s.allProcesses);
  const [tab, setTab] = useState<ActivityTab>("processes");
  const { tk, t } = useI18n();

  if (tab === "processes" && allProcesses.length === 0) {
    return (
      <PageLoading
        message={t("Loading process data...")}
        detail={t(
          "Currently inspect active network ports and the processes holding them.",
        )}
      />
    );
  }

  return (
    <div data-testid="page-process">
      <div
        style={{
          display: "grid",
          gap: "10px",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "grid", gap: "6px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>
            {tk("process.page.title")}
          </h2>
          <div
            style={{
              fontSize: "13px",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            {t(
              "Search active processes, inspect ports, and watch specific connections over time.",
            )}
          </div>
        </div>
        <div
          role="tablist"
          aria-label={tk("process.page.title")}
          style={{
            display: "flex",
            gap: "4px",
            background: "var(--bg-secondary)",
            borderRadius: "8px",
            padding: "3px",
          }}
        >
          <PageTab
            id="activity-processes"
            active={tab === "processes"}
            onClick={() => setTab("processes")}
          >
            {tk("process.tab.processes")}
          </PageTab>
          <PageTab
            id="activity-ports"
            active={tab === "ports"}
            onClick={() => setTab("ports")}
          >
            {tk("process.tab.ports")}
          </PageTab>
          <PageTab
            id="activity-watch"
            active={tab === "watch"}
            onClick={() => setTab("watch")}
          >
            {tk("process.tab.watch")}
          </PageTab>
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            lineHeight: 1.6,
          }}
        >
          {tab === "processes"
            ? tk("process.page.tab.processes_help")
            : tab === "ports"
              ? tk("process.page.tab.ports_help")
              : tk("process.page.tab.watch_help")}
        </div>
      </div>

      {tab === "processes" && <ProcessTable processes={allProcesses} />}
      {tab === "ports" && <PortFinder />}
      {tab === "watch" && <PortWatch />}
    </div>
  );
}

function PageTab({
  id,
  active,
  onClick,
  children,
}: {
  id: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      id={id}
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: "6px 16px",
        fontSize: "13px",
        fontWeight: active ? 600 : 400,
        border: "none",
        borderRadius: "6px",
        background: active ? "var(--accent-blue)" : "transparent",
        color: active ? "var(--text-on-accent)" : "var(--text-secondary)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
