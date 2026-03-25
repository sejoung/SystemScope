import { useState, useMemo } from "react";
import { Accordion } from "../../components/Accordion";
import { formatBytes } from "../../utils/format";
import type { ScanCategory, QuickScanFolder } from "@shared/types";
import { useI18n } from "../../i18n/useI18n";
import { StatusMessage } from "../../components/StatusMessage";

const CATEGORY_ORDER: ScanCategory[] = [
  "system",
  "homebrew",
  "devtools",
  "packages",
  "containers",
  "browsers",
];

function sizeColor(size: number): string {
  if (size > 5 * 1024 * 1024 * 1024) return "var(--accent-red)";
  if (size > 1 * 1024 * 1024 * 1024) return "var(--accent-yellow)";
  if (size > 100 * 1024 * 1024) return "var(--accent-blue)";
  return "var(--text-secondary)";
}

interface QuickScanProps {
  onFolderClick: (path: string) => void;
}

export function QuickScan({ onFolderClick }: QuickScanProps) {
  const { tk } = useI18n();
  const [results, setResults] = useState<QuickScanFolder[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    const res = await window.systemScope.quickScan();
    if (res.ok && res.data) {
      setResults(res.data as QuickScanFolder[]);
    } else {
      setResults([]);
      setError(res.error?.message ?? tk("disk.quick_cleanup.scan_failed"));
    }
    setScanning(false);
    setScanned(true);
  };

  const totalSize = results.reduce((acc, r) => acc + r.size, 0);
  const cleanableSize = results
    .filter((r) => r.cleanable)
    .reduce((acc, r) => acc + r.size, 0);

  // Group by category, preserve order, only categories that have results
  const grouped = useMemo(() => {
    return CATEGORY_ORDER.map((cat) => ({
      category: cat,
      label: tk(`disk.quick_cleanup.category.${cat}` as const),
      items: results
        .filter((r) => r.category === cat)
        .sort((a, b) => b.size - a.size),
      total: results
        .filter((r) => r.category === cat)
        .reduce((acc, r) => acc + r.size, 0),
    })).filter((g) => g.items.length > 0);
  }, [results]);

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
          onClick={() => {
            handleScan();
          }}
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
        <StatusMessage message={tk("common.scanning")} />
      ) : !scanned ? (
        <StatusMessage message={tk("disk.quick_cleanup.description")} />
      ) : error ? (
        <StatusMessage tone="error" message={error} />
      ) : grouped.length === 0 ? (
        <StatusMessage message={tk("disk.quick_cleanup.empty")} />
      ) : (
        <div>
          {/* Summary */}
          <div
            style={{
              display: "flex",
              gap: "20px",
              marginBottom: "16px",
              padding: "10px 14px",
              background: "var(--bg-primary)",
              borderRadius: "var(--radius)",
              fontSize: "13px",
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>
              {tk("disk.quick_cleanup.total")}:{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {formatBytes(totalSize)}
              </strong>
            </span>
            <span style={{ color: "var(--text-muted)" }}>
              {tk("disk.quick_cleanup.cleanable")}:{" "}
              <strong style={{ color: "var(--accent-green)" }}>
                {formatBytes(cleanableSize)}
              </strong>
            </span>
          </div>

          {/* Folder list grouped by category */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            {grouped.map((group) => (
              <div key={group.category}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "6px",
                    padding: "0 4px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {group.label}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      fontFamily: "monospace",
                    }}
                  >
                    {formatBytes(group.total)}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  {group.items.map((folder) => (
                    <div
                      key={folder.path}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "10px 12px",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                        background: "var(--bg-primary)",
                        textAlign: "left",
                        width: "100%",
                      }}
                    >
                      {/* Size */}
                      <div
                        style={{
                          width: "60px",
                          textAlign: "right",
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            fontFamily: "monospace",
                            color: sizeColor(folder.size),
                          }}
                        >
                          {formatBytes(folder.size)}
                        </span>
                      </div>

                      {/* Bar visual */}
                      <div style={{ width: "60px", flexShrink: 0 }}>
                        <div
                          style={{
                            height: "6px",
                            borderRadius: "3px",
                            background: "var(--border)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${Math.min((folder.size / (totalSize || 1)) * 100, 100)}%`,
                              background: sizeColor(folder.size),
                              borderRadius: "3px",
                              minWidth: folder.size > 0 ? "2px" : "0",
                            }}
                          />
                        </div>
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "var(--text-primary)",
                            }}
                          >
                            {folder.name}
                          </span>
                          {folder.cleanable && (
                            <span
                              style={{
                                fontSize: "10px",
                                padding: "1px 6px",
                                borderRadius: "4px",
                                background: "var(--success-soft)",
                                color: "var(--accent-green)",
                                fontWeight: 600,
                              }}
                            >
                              {tk("disk.quick_cleanup.cleanable_label")}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "var(--text-muted)",
                            marginTop: "2px",
                          }}
                        >
                          {folder.description}
                        </div>
                      </div>

                      {/* Actions */}
                      <div
                        style={{ display: "flex", gap: "4px", flexShrink: 0 }}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.systemScope.showInFolder(folder.path);
                          }}
                          title={tk("disk.quick_cleanup.open_title")}
                          style={actionBtn}
                        >
                          {tk("common.open")}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onFolderClick(folder.path);
                          }}
                          title={tk("disk.quick_cleanup.scan_title")}
                          style={{
                            ...actionBtn,
                            background: "var(--accent-blue)",
                            color: "var(--text-on-accent)",
                          }}
                        >
                          {tk("common.scan")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Accordion>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "8px 20px",
  fontSize: "13px",
  fontWeight: 600,
  border: "none",
  borderRadius: "var(--radius)",
  background: "var(--accent-cyan)",
  color: "var(--text-on-accent)",
  cursor: "pointer",
};

const actionBtn: React.CSSProperties = {
  padding: "4px 10px",
  fontSize: "11px",
  fontWeight: 600,
  border: "none",
  borderRadius: "6px",
  background: "var(--bg-card-hover)",
  color: "var(--text-primary)",
  cursor: "pointer",
};
