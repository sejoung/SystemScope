import { test, expect, _electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'path'

test.describe.serial('사이드바 네비게이션', () => {
  let electronApp: ElectronApplication
  let mainWindow: Page

  test.beforeAll(async () => {
    electronApp = await _electron.launch({
      args: [path.join(__dirname, '../../../out/main/index.js')],
      env: { ...process.env, NODE_ENV: 'test', E2E_LIGHTWEIGHT: '1' }
    })

    mainWindow = await electronApp.firstWindow({ timeout: 45_000 })
    await mainWindow.waitForLoadState('domcontentloaded')
    await mainWindow.bringToFront()
    await mainWindow.waitForFunction(() => {
      const scopedWindow = window as Window & { systemScope?: unknown }
      return Boolean(scopedWindow.systemScope)
    })
    await mainWindow.waitForSelector('body[data-e2e-ready="1"]', {
      timeout: 15_000
    })
  })

  test.afterAll(async () => {
    await electronApp.close()
  })

  async function clickNav(
    pageId: "dashboard" | "disk" | "docker" | "process" | "apps" | "settings",
  ) {
    const target = mainWindow.getByTestId(`nav-${pageId}`);
    await expect(target).toBeVisible({ timeout: 10_000 });
    await expect(target).toBeEnabled();
    await target.click({ noWaitAfter: true });
    await expect(target).toHaveAttribute("aria-current", "page");
  }

  test("Overview 페이지가 표시된다", async () => {
    await expect(
      mainWindow.locator(
        '[data-testid="page-dashboard"], [data-testid="page-loading"]',
      ),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Storage 페이지로 이동한다", async () => {
    await clickNav("disk");
    await expect(mainWindow.getByTestId("page-disk")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("Docker 페이지로 이동한다", async () => {
    await clickNav("docker");
    await expect(mainWindow.getByTestId("page-docker")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("Activity 페이지로 이동한다", async () => {
    await clickNav("process");
    await expect(
      mainWindow.locator(
        '[data-testid="page-process"], [data-testid="page-loading"]',
      ),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Applications 페이지로 이동한다", async () => {
    await clickNav("apps");
    await expect(mainWindow.getByTestId("page-apps")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("Preferences 페이지로 이동한다", async () => {
    await clickNav("settings");
    await expect(mainWindow.getByTestId("page-settings")).toBeVisible({
      timeout: 10_000,
    });
  });
});
