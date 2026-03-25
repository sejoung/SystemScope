import {
  test as base,
  _electron,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import path from "path";

type ElectronFixtures = {
  electronApp: ElectronApplication;
  mainWindow: Page;
};

export const test = base.extend<ElectronFixtures>({
  electronApp: [
    async ({}, use) => {
      const app = await _electron.launch({
        args: [path.join(__dirname, "../../../out/main/index.js")],
        env: { ...process.env, NODE_ENV: "test", E2E_LIGHTWEIGHT: "1" },
      });
      await use(app);
      await app.close();
    },
    { timeout: 30_000 },
  ],

  mainWindow: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow({ timeout: 45_000 });
    await window.waitForLoadState("domcontentloaded");
    await window.bringToFront();
    await window.waitForFunction(() => {
      const scopedWindow = window as Window & {
        systemScope?: unknown;
      };
      return Boolean(scopedWindow.systemScope);
    });
    await window.waitForSelector('body[data-e2e-ready="1"]', {
      timeout: 15_000,
    });
    await use(window);
  },
});

export { expect } from "@playwright/test";
