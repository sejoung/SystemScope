import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SaveTimingNote,
  formatUpdateCheckedAt,
  shouldUseSettingsPageCompactLayout,
} from "../../src/renderer/src/pages/SettingsPage";

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
});
