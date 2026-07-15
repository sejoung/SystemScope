import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SaveTimingNote,
  formatUpdateCheckedAt,
  shouldUseSettingsPageCompactLayout,
} from "../../src/renderer/src/pages/SettingsPage";
import { findInvalidThresholdLabels } from '../../src/renderer/src/pages/settings/settingsValidation'

describe("SettingsPage save timing note", () => {
  it("should render the save-required badge copy", () => {
    const markup = renderToStaticMarkup(
      createElement(SaveTimingNote, { text: "Applies after Save All" }),
    );

    expect(markup).toContain("Applies after Save All");
  });

  it("should ignore invalid update timestamps", () => {
    expect(formatUpdateCheckedAt("not-a-date", "en")).toBeNull();
  });

  it("should switch settings page to compact layout below the width threshold", () => {
    expect(shouldUseSettingsPageCompactLayout(720)).toBe(true);
    expect(shouldUseSettingsPageCompactLayout(919)).toBe(true);
    expect(shouldUseSettingsPageCompactLayout(920)).toBe(false);
  });

  it('reports every threshold group whose warning is not below critical', () => {
    const labels = { cpu: 'CPU', disk: 'Disk', memory: 'Memory', gpuMemory: 'GPU' }
    expect(findInvalidThresholdLabels({
      cpuWarning: 90, cpuCritical: 90,
      diskWarning: 91, diskCritical: 90,
      memoryWarning: 80, memoryCritical: 90,
      gpuMemoryWarning: 70, gpuMemoryCritical: 95,
    }, labels)).toEqual(['CPU', 'Disk'])
  })
});
