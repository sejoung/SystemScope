import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SaveTimingNote } from "../../src/renderer/src/pages/SettingsPage";

describe("SettingsPage save timing note", () => {
  it("should render the save-required badge copy", () => {
    const markup = renderToStaticMarkup(
      createElement(SaveTimingNote, { text: "Applies after Save All" }),
    );

    expect(markup).toContain("Applies after Save All");
  });
});
