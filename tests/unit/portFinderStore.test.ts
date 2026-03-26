import { describe, expect, it } from "vitest";
import { usePortFinderStore } from "../../src/renderer/src/stores/usePortFinderStore";

describe("usePortFinderStore", () => {
  it("defaults the port finder search scope to local", () => {
    expect(usePortFinderStore.getState().searchScope).toBe("local");
  });
});
