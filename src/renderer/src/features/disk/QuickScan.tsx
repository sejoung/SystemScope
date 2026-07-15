import { useMemo, type CSSProperties } from "react";
import { Accordion } from "../../components/ui/Accordion";
import { formatBytes } from "../../utils/format";
import type { ScanCategory, QuickScanFolder } from "@shared/types";
import { useI18n } from "../../i18n/useI18n";
import { StatusMessage } from "../../components/ui/StatusMessage";
import { AsyncTaskStatus } from "../../components/ui/AsyncTaskStatus";
import { QuickScanResults, type QuickScanGroup } from "./QuickScanResults";

const CATEGORY_ORDER: ScanCategory[] = [
  "system",
  "homebrew",
  "devtools",
  "packages",
  "containers",
  "browsers",
];

interface QuickScanState {
  results: QuickScanFolder[];
  scanning: boolean;
  scanned: boolean;
  error: string | null;
}

interface QuickScanProps {
  onFolderClick: (path: string) => void;
  state: QuickScanState;
  onScan: () => void;
}

export function QuickScan({ onFolderClick, state, onScan }: QuickScanProps) {
  const { tk } = useI18n();
  const { results, scanning, scanned, error } = state;

  const { totalSize, cleanableSize, grouped } = useMemo(() => {
    const groups = new Map<ScanCategory, QuickScanFolder[]>();
    let nextTotalSize = 0;
    let nextCleanableSize = 0;

    for (const result of results) {
      nextTotalSize += result.size;
      if (result.cleanable) {
        nextCleanableSize += result.size;
      }

      const items = groups.get(result.category) ?? [];
      items.push(result);
      groups.set(result.category, items);
    }

    const nextGrouped = CATEGORY_ORDER.map((category): QuickScanGroup | null => {
      const items = groups.get(category);
      if (!items || items.length === 0) {
        return null;
      }

      const sortedItems = items.slice().sort((a, b) => b.size - a.size);
      return {
        category,
        label: tk(`disk.quick_cleanup.category.${category}` as const),
        items: sortedItems,
        total: sortedItems.reduce((acc, item) => acc + item.size, 0),
      };
    }).filter((group): group is NonNullable<typeof group> => group !== null);

    return {
      totalSize: nextTotalSize,
      cleanableSize: nextCleanableSize,
      grouped: nextGrouped,
    };
  }, [results, tk]);

  return (
    <Accordion
      title={tk("disk.section.quick_cleanup")}
      badge={
        scanned
          ? tk("disk.quick_cleanup.badge", { size: formatBytes(cleanableSize) })
          : undefined
      }
      badgeColor="var(--accent-green)"
      forceOpen={scanned}
      actions={
        <button
          type="button"
          onClick={onScan}
          disabled={scanning}
          style={btnStyle}
        >
          {scanning
            ? tk("common.scanning")
            : scanned
              ? tk("common.rescan")
              : tk("disk.quick_cleanup.scan_action")}
        </button>
      }
    >
      {scanning ? (
        <AsyncTaskStatus
          stage="started"
          taskLabel={tk("disk.section.quick_cleanup")}
          message={tk(
            "Quick scan started. Reviewing common cleanup locations now.",
          )}
        />
      ) : !scanned ? (
        <StatusMessage message={tk("disk.quick_cleanup.description")} />
      ) : error ? (
        <AsyncTaskStatus
          stage="failed"
          taskLabel={tk("disk.section.quick_cleanup")}
          message={error}
        />
      ) : grouped.length === 0 ? (
        <>
          <div style={{ marginBottom: "12px" }}>
            <AsyncTaskStatus
              stage="completed"
              taskLabel={tk("disk.section.quick_cleanup")}
              message={tk("disk.quick_cleanup.empty")}
            />
          </div>
          <StatusMessage message={tk("disk.quick_cleanup.empty")} />
        </>
      ) : (
        <QuickScanResults cleanableSize={cleanableSize} grouped={grouped} onFolderClick={onFolderClick} tk={tk} totalSize={totalSize} />
      )}
    </Accordion>
  );
}

const btnStyle: CSSProperties = {
  padding: "8px 20px",
  fontSize: "13px",
  fontWeight: 600,
  border: "none",
  borderRadius: "var(--radius)",
  background: "var(--accent-cyan)",
  color: "var(--text-on-accent)",
  cursor: "pointer",
};
