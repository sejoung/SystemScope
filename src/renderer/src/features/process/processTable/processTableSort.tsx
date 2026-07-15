import type { CpuUsageTone } from './ProcessTable.styles'
import type { TranslateFn } from '@shared/i18n'
import { thStyle } from './ProcessTable.styles'

export type SortField = 'cpu' | 'memory' | 'name' | 'pid'
export type SortDir = 'asc' | 'desc'

export function getCpuUsageTone(cpu: number): CpuUsageTone {
  if (cpu > 80) return "high";
  if (cpu > 30) return "medium";
  return "normal";
}

export function getCpuUsageToneLabel(
  tone: CpuUsageTone,
  tk: (
    key:
      | "process.table.cpu_high"
      | "process.table.cpu_medium"
      | "process.table.cpu_normal",
    params?: Record<string, string | number>,
  ) => string,
) {
  switch (tone) {
    case "high":
      return tk("process.table.cpu_high");
    case "medium":
      return tk("process.table.cpu_medium");
    default:
      return tk("process.table.cpu_normal");
  }
}

export function getProcessSortSummary(
  sortField: SortField,
  sortDir: SortDir,
  tk: TranslateFn,
) {
  if (sortField === "cpu") {
    return {
      label:
        sortDir === "desc"
          ? tk("Sorted by CPU usage, highest first")
          : tk("Sorted by CPU usage, lowest first"),
      reason: tk(
        "Default order starts with CPU-heavy processes so sudden load is easier to spot.",
      ),
    };
  }

  if (sortField === "memory") {
    return {
      label:
        sortDir === "desc"
          ? tk("Sorted by memory usage, highest first")
          : tk("Sorted by memory usage, lowest first"),
      reason: tk(
        "Memory sort helps compare which processes occupy the most space right now.",
      ),
    };
  }

  if (sortField === "pid") {
    return {
      label:
        sortDir === "desc"
          ? tk("Sorted by PID, highest first")
          : tk("Sorted by PID, lowest first"),
      reason: tk(
        "PID order is useful when you already know the target process number.",
      ),
    };
  }

  return {
    label:
      sortDir === "desc"
        ? tk("Sorted by name, Z to A")
        : tk("Sorted by name, A to Z"),
    reason: tk(
      "Name order is useful when you already know the process name you want to inspect.",
    ),
  };
}

export function SortHeader({
  field,
  current,
  onClick,
  ariaSort,
  align,
  children,
}: {
  field: SortField;
  current: SortField;
  onClick: (field: SortField) => void;
  ariaSort: React.AriaAttributes["aria-sort"];
  align?: string;
  children: React.ReactNode;
}) {
  const isActive = current === field;
  return (
    <div
      role="columnheader"
      aria-sort={ariaSort}
      style={{
        ...thStyle,
        textAlign: (align as React.CSSProperties["textAlign"]) ?? "left",
        cursor: "pointer",
        color: isActive ? "var(--text-primary)" : "var(--text-muted)",
        userSelect: "none",
      }}
    >
      <button
        type="button"
        onClick={() => onClick(field)}
        style={{
          border: "none",
          background: "transparent",
          color: "inherit",
          cursor: "pointer",
          font: "inherit",
          padding: 0,
          width: "100%",
          textAlign: (align as React.CSSProperties["textAlign"]) ?? "left",
        }}
      >
        {children}
      </button>
    </div>
  );
}

// ─── Styles ───
