import type { CSSProperties } from "react";
import type { TranslationKey } from "@shared/i18n";

export type StorageTab = "overview" | "scan";
export type ScanOutcome =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export function shouldShowCancelledScanMessage(
  scanOutcome: ScanOutcome,
  isScanning: boolean,
) {
  return !isScanning && scanOutcome === "cancelled";
}

export function getScanScopeMessageKey(
  selectedFolder: string | null,
): TranslationKey {
  return selectedFolder ? "disk.scan.scope_selected" : "disk.scan.scope_empty";
}

export const primaryButtonStyle: CSSProperties = {
  padding: "8px 16px",
  fontSize: "13px",
  fontWeight: 500,
  border: "none",
  borderRadius: "var(--radius)",
  background: "var(--accent-blue)",
  color: "var(--text-on-accent)",
  cursor: "pointer",
};

export const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: "transparent",
  border: "1px solid var(--border)",
  color: "var(--text-secondary)",
};

export const dangerButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: "var(--accent-red)",
};
