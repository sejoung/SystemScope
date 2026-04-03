import { describe, expect, it } from "vitest";
import {
  getCpuUsageTone,
  getCpuUsageToneLabel,
  shouldUseProcessTableCompactLayout,
} from "../../src/renderer/src/features/process/ProcessTable";

describe("ProcessTable helpers", () => {
  it("classifies CPU usage into readable severity groups", () => {
    expect(getCpuUsageTone(10)).toBe("normal");
    expect(getCpuUsageTone(30)).toBe("normal");
    expect(getCpuUsageTone(45)).toBe("medium");
    expect(getCpuUsageTone(80)).toBe("medium");
    expect(getCpuUsageTone(81)).toBe("high");
  });

  it("maps CPU usage groups to localized labels", () => {
    const tk = (key: string) => key;

    expect(getCpuUsageToneLabel("normal", tk)).toBe("process.table.cpu_normal");
    expect(getCpuUsageToneLabel("medium", tk)).toBe("process.table.cpu_medium");
    expect(getCpuUsageToneLabel("high", tk)).toBe("process.table.cpu_high");
  });

  it("switches process table to compact layout below the width threshold", () => {
    expect(shouldUseProcessTableCompactLayout(720)).toBe(true);
    expect(shouldUseProcessTableCompactLayout(979)).toBe(true);
    expect(shouldUseProcessTableCompactLayout(980)).toBe(false);
  });
});
