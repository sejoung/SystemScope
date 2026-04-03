import { describe, expect, it } from "vitest";
import { shouldUsePortWatchCompactLayout } from "../../src/renderer/src/features/process/PortWatch";

describe("PortWatch layout helpers", () => {
  it("switches port watch to compact layout below the width threshold", () => {
    expect(shouldUsePortWatchCompactLayout(720)).toBe(true);
    expect(shouldUsePortWatchCompactLayout(959)).toBe(true);
    expect(shouldUsePortWatchCompactLayout(960)).toBe(false);
  });
});
