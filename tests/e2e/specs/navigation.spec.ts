import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/electronApp";

test.describe("사이드바 네비게이션", () => {
  async function clickNav(
    mainWindow: Page,
    pageId: "dashboard" | "disk" | "docker" | "process" | "apps" | "settings",
  ) {
    const target = mainWindow.getByTestId(`nav-${pageId}`);
    await expect(target).toBeVisible({ timeout: 10_000 });
    await expect(target).toBeEnabled();
    await target.click({ noWaitAfter: true });
    await expect(target).toHaveAttribute("aria-current", "page");
  }

  test("Overview 페이지가 표시된다", async ({ mainWindow }) => {
    await expect(
      mainWindow.locator(
        '[data-testid="page-dashboard"], [data-testid="page-loading"]',
      ),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Storage 페이지로 이동한다", async ({ mainWindow }) => {
    await clickNav(mainWindow, "disk");
    await expect(mainWindow.getByTestId("page-disk")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("Docker 페이지로 이동한다", async ({ mainWindow }) => {
    await clickNav(mainWindow, "docker");
    await expect(mainWindow.getByTestId("page-docker")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("Activity 페이지로 이동한다", async ({ mainWindow }) => {
    await clickNav(mainWindow, "process");
    await expect(
      mainWindow.locator(
        '[data-testid="page-process"], [data-testid="page-loading"]',
      ),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Applications 페이지로 이동한다", async ({ mainWindow }) => {
    await clickNav(mainWindow, "apps");
    await expect(mainWindow.getByTestId("page-apps")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("Preferences 페이지로 이동한다", async ({ mainWindow }) => {
    await clickNav(mainWindow, "settings");
    await expect(mainWindow.getByTestId("page-settings")).toBeVisible({
      timeout: 10_000,
    });
  });
});
