import { describe, expect, it } from "vitest";
import { formatEndpoint } from "../../src/renderer/src/features/process/PortFinder";

describe("PortFinder helpers", () => {
  it("formats remote endpoint values with stable fallbacks", () => {
    expect(formatEndpoint("127.0.0.1", "3000")).toBe("127.0.0.1:3000");
    expect(formatEndpoint("127.0.0.1", "0")).toBe("127.0.0.1");
    expect(formatEndpoint("", "443")).toBe(":443");
    expect(formatEndpoint("*", "*")).toBe("-");
  });
});
