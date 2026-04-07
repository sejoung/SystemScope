import { describe, expect, it } from "vitest";
import { shouldUseShellCompactLayout } from "../../src/renderer/src/components/Layout";
import { shouldUseDashboardSingleColumnLayout } from "../../src/renderer/src/pages/DashboardPage";

describe("Layout responsive helpers", () => {
  it("switches the app shell to stacked layout below the width threshold", () => {
    expect(shouldUseShellCompactLayout(720)).toBe(true);
    expect(shouldUseShellCompactLayout(759)).toBe(true);
    expect(shouldUseShellCompactLayout(760)).toBe(false);
  });

  it("switches the dashboard to a single column below the width threshold", () => {
    expect(shouldUseDashboardSingleColumnLayout(720)).toBe(true);
    expect(shouldUseDashboardSingleColumnLayout(899)).toBe(true);
    expect(shouldUseDashboardSingleColumnLayout(900)).toBe(false);
  });
});
