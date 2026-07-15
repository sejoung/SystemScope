import type { CSSProperties } from 'react'
import type { QuickScanFolder, ScanCategory } from '@shared/types'
import type { TranslateFn } from '@shared/i18n'
import { formatBytes } from '../../utils/format'
import { AsyncTaskStatus } from '../../components/ui/AsyncTaskStatus'

export interface QuickScanGroup { category: ScanCategory; label: string; items: QuickScanFolder[]; total: number }

function sizeColor(size: number): string {
  if (size > 5 * 1024 * 1024 * 1024) return 'var(--accent-red)'
  if (size > 1024 * 1024 * 1024) return 'var(--accent-yellow)'
  if (size > 100 * 1024 * 1024) return 'var(--accent-blue)'
  return 'var(--text-secondary)'
}

export function QuickScanResults({ cleanableSize, grouped, onFolderClick, tk, totalSize }: { cleanableSize: number; grouped: QuickScanGroup[]; onFolderClick: (path: string) => void; tk: TranslateFn; totalSize: number }) {
  return (<div>
          <div style={{ marginBottom: "12px" }}>
            <AsyncTaskStatus
              stage="completed"
              taskLabel={tk("disk.section.quick_cleanup")}
              message={tk(
                "Quick scan completed. Review size, safety guidance, and open a folder before deleting anything.",
              )}
            />
          </div>
          <div
            style={{
              marginBottom: "12px",
              fontSize: "12px",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            {tk(
              "Cache folders are usually safer to review first. App data, containers, and SDK folders often need manual verification before cleanup.",
            )}
          </div>
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
                          <span
                            style={{
                              fontSize: "10px",
                              padding: "1px 6px",
                              borderRadius: "4px",
                              background: `${getSafetyTone(folder, tk).color}20`,
                              color: getSafetyTone(folder, tk).color,
                              fontWeight: 700,
                            }}
                          >
                            {getSafetyTone(folder, tk).label}
                          </span>
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
                        <div
                          style={{
                            fontSize: "11px",
                            color: "var(--text-secondary)",
                            marginTop: "4px",
                          }}
                        >
                          {getSafetyTone(folder, tk).note}
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
        </div>)
}

function getSafetyTone(
  folder: QuickScanFolder,
  tk: TranslateFn,
): {
  label: string;
  color: string;
  note: string;
} {
  if (!folder.cleanable) {
    return {
      label: tk("REVIEW FIRST"),
      color: "var(--accent-red)",
      note: tk("Large app data or container folders can break environments if removed blindly."),
    };
  }

  if (folder.category === "packages" || folder.category === "homebrew") {
    return {
      label: tk("USE TOOL CLEANUP"),
      color: "var(--accent-yellow)",
      note: tk("Prefer package-manager cleanup commands before deleting files directly."),
    };
  }

  return {
    label: tk("GENERALLY SAFE"),
    color: "var(--accent-green)",
    note: tk("Usually cache or temporary data, but still review the folder contents before deleting."),
  };
}

const actionBtn: CSSProperties = {
  padding: "4px 10px",
  fontSize: "11px",
  fontWeight: 600,
  border: "none",
  borderRadius: "6px",
  background: "var(--bg-card-hover)",
  color: "var(--text-primary)",
  cursor: "pointer",
};
