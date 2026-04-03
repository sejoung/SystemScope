import { describe, expect, it } from "vitest";
import {
  getConfidenceColor,
  getConfidenceLabel,
} from "../../src/renderer/src/features/apps/appsShared";
import { shouldUseInstalledAppsCompactLayout } from "../../src/renderer/src/features/apps/InstalledApps";
import { shouldUseLeftoverAppsCompactLayout } from "../../src/renderer/src/features/apps/LeftoverApps";
import { shouldUseRegistryAppsCompactLayout } from "../../src/renderer/src/features/apps/RegistryApps";

describe("AppsPage helpers", () => {
  it("maps confidence levels to localized labels", () => {
    const tk = (
      key:
        | "apps.confidence.high"
        | "apps.confidence.medium"
        | "apps.confidence.low",
    ) => key;

    expect(getConfidenceLabel("high", tk)).toBe("apps.confidence.high");
    expect(getConfidenceLabel("medium", tk)).toBe("apps.confidence.medium");
    expect(getConfidenceLabel("low", tk)).toBe("apps.confidence.low");
  });

  it("maps confidence levels to consistent badge colors", () => {
    expect(getConfidenceColor("high")).toBe("var(--accent-green)");
    expect(getConfidenceColor("medium")).toBe("var(--accent-yellow)");
    expect(getConfidenceColor("low")).toBe("var(--accent-red)");
  });

  it("switches installed apps to compact layout below the width threshold", () => {
    expect(shouldUseInstalledAppsCompactLayout(720)).toBe(true);
    expect(shouldUseInstalledAppsCompactLayout(979)).toBe(true);
    expect(shouldUseInstalledAppsCompactLayout(980)).toBe(false);
    expect(shouldUseInstalledAppsCompactLayout(1200)).toBe(false);
  });

  it("switches leftover apps to compact layout below the width threshold", () => {
    expect(shouldUseLeftoverAppsCompactLayout(900)).toBe(true);
    expect(shouldUseLeftoverAppsCompactLayout(1079)).toBe(true);
    expect(shouldUseLeftoverAppsCompactLayout(1080)).toBe(false);
  });

  it("switches registry apps to compact layout below the width threshold", () => {
    expect(shouldUseRegistryAppsCompactLayout(900)).toBe(true);
    expect(shouldUseRegistryAppsCompactLayout(1039)).toBe(true);
    expect(shouldUseRegistryAppsCompactLayout(1040)).toBe(false);
  });
});
