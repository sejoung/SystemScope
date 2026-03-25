import { test, expect } from "../fixtures/electronApp";

test.describe("사이드바 네비게이션", () => {
  test("모든 페이지 탐색", async ({ mainWindow }) => {
    const clickNav = async (
      pageId: "dashboard" | "disk" | "docker" | "process" | "apps" | "settings",
    ) => {
      const target = mainWindow.getByTestId(`nav-${pageId}`);
      await target.click({ noWaitAfter: true });
      await expect(target).toHaveAttribute("aria-current", "page");
    };

    // Overview (기본 페이지)
    await expect(mainWindow.getByTestId("page-dashboard")).toBeVisible({
      timeout: 15_000,
    });

    // Storage
    await clickNav("disk");
    await expect(mainWindow.getByTestId("page-disk")).toBeVisible();

    // Docker
    await clickNav("docker");
    await expect(mainWindow.getByTestId("page-docker")).toBeVisible();

    // Activity
    await clickNav("process");
    await expect(
      mainWindow.locator(
        '[data-testid="page-process"], [data-testid="page-loading"]',
      ),
    ).toBeVisible({ timeout: 15_000 });

    // Applications
    await clickNav("apps");
    await expect(mainWindow.getByTestId("page-apps")).toBeVisible();

    // Preferences
    await clickNav("settings");
    await expect(mainWindow.getByTestId("page-settings")).toBeVisible();

    // Overview 복귀
    await clickNav("dashboard");
    await expect(mainWindow.getByTestId("page-dashboard")).toBeVisible({
      timeout: 15_000,
    });
  });
});
