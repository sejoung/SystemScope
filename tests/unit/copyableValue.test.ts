import { beforeEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CopyableValue,
  canExpandCopyableValue,
} from "../../src/renderer/src/components/CopyableValue";
import { useSettingsStore } from "../../src/renderer/src/stores/useSettingsStore";

describe("CopyableValue", () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: "en" });
  });

  it("should require multiline and enough length before showing expand controls", () => {
    expect(canExpandCopyableValue("x".repeat(80), true)).toBe(true);
    expect(canExpandCopyableValue("x".repeat(80), false)).toBe(false);
    expect(canExpandCopyableValue("x".repeat(20), true)).toBe(false);
  });

  it("should render the show full action for long multiline values", () => {
    const markup = renderToStaticMarkup(
      createElement(CopyableValue, { value: "a".repeat(100), multiline: true }),
    );

    expect(markup).toContain("Copy");
    expect(markup).toContain("Show full");
  });

  it("should render the empty fallback when the value is blank", () => {
    const markup = renderToStaticMarkup(
      createElement(CopyableValue, { value: "   " }),
    );

    expect(markup).toContain("-");
    expect(markup).not.toContain("Copy");
  });
});
