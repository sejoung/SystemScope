import { describe, expect, it } from "vitest";
import {
  getScanScopeMessageKey,
  shouldShowCancelledScanMessage,
} from "../../src/renderer/src/features/disk/diskAnalysisHelpers";

describe("DiskAnalysisPage helpers", () => {
  it("should keep the cancelled banner only when scanning is stopped after cancel", () => {
    expect(shouldShowCancelledScanMessage("cancelled", false)).toBe(true);
    expect(shouldShowCancelledScanMessage("cancelled", true)).toBe(false);
    expect(shouldShowCancelledScanMessage("completed", false)).toBe(false);
  });

  it("should describe the scan scope based on whether a folder is selected", () => {
    expect(getScanScopeMessageKey(null)).toBe("disk.scan.scope_empty");
    expect(getScanScopeMessageKey("/Users/test/project")).toBe(
      "disk.scan.scope_selected",
    );
  });
});
