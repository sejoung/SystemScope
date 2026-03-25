import { test, expect } from "../fixtures/electronApp";

test.describe("사이드바 네비게이션", () => {
  test("모든 페이지 탐색", async ({ mainWindow }) => {
    const clickNav = async (
      pageId: "dashboard" | "disk" | "docker" | "process" | "apps" | "settings",
    ) => {
      await mainWindow
        .getByTestId(`nav-${pageId}`)
        .click({ noWaitAfter: true });
    };

    // Overview (기본 페이지)
    await expect(
      mainWindow.locator('.dashboard-grid-3, [data-testid="page-loading"]'),
    ).toBeVisible({ timeout: 15_000 });

    // Storage
    await clickNav("disk");
    await expect(
      mainWindow.locator("button", { hasText: "Scan" }).first(),
    ).toBeVisible();

    // Docker
    await clickNav("docker");
    await expect(mainWindow.locator("h2", { hasText: "Docker" })).toBeVisible();

    // Activity
    await clickNav("process");
    await expect(
      mainWindow.locator(
        'h2:has-text("Activity"), [data-testid="page-loading"]',
      ),
    ).toBeVisible({ timeout: 15_000 });

    // Applications
    await clickNav("apps");
    await expect(
      mainWindow.locator("button", { hasText: "Installed" }).first(),
    ).toBeVisible();

    // Preferences
    await clickNav("settings");
    await expect(mainWindow.locator("text=Appearance")).toBeVisible();

    // Overview 복귀
    await clickNav("dashboard");
    await expect(
      mainWindow.locator('.dashboard-grid-3, [data-testid="page-loading"]'),
    ).toBeVisible({ timeout: 15_000 });
  });
});
