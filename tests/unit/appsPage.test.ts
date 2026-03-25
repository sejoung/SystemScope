import { describe, expect, it } from "vitest";
import {
  getConfidenceColor,
  getConfidenceLabel,
} from "../../src/renderer/src/pages/AppsPage";

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
});
