import { beforeEach, describe, expect, it, vi } from "vitest";

const showMessageBox = vi.hoisted(() => vi.fn());
const trashItem = vi.hoisted(() => vi.fn());
const getPath = vi.hoisted(() => vi.fn());
const stat = vi.hoisted(() => vi.fn());
const getDirSize = vi.hoisted(() => vi.fn());

vi.mock("electron", () => ({
  dialog: {
    showMessageBox,
  },
  shell: {
    trashItem,
  },
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => ({ id: 1, isDestroyed: () => false })),
    getAllWindows: vi.fn(() => [{ id: 1, isDestroyed: () => false }]),
  },
  app: {
    getPath,
  },
}));

vi.mock("fs/promises", () => ({
  default: {
    stat,
  },
  stat,
}));

vi.mock("../../src/main/utils/getDirSize", () => ({
  getDirSize,
}));

describe("trashService", () => {
  beforeEach(() => {
    showMessageBox.mockReset();
    trashItem.mockReset();
    getPath.mockReset();
    stat.mockReset();
    getDirSize.mockReset();

    getPath.mockReturnValue("/Users/test");
    showMessageBox.mockResolvedValue({ response: 1 });
    stat.mockImplementation(async (targetPath: string) => ({
      size: targetPath.includes("a") ? 100 : 200,
      isDirectory: () => false,
    }));
    getDirSize.mockResolvedValue(4096);
  });

  it("returns exact trashed paths when some items fail", async () => {
    trashItem.mockImplementation(async (targetPath: string) => {
      if (targetPath.endsWith("b.log")) {
        throw new Error("permission denied");
      }
    });

    const { trashItemsWithConfirm } =
      await import("../../src/main/services/trashService");
    const result = await trashItemsWithConfirm(
      ["/Users/test/a.log", "/Users/test/b.log", "/Users/test/c.log"],
      "test",
    );

    expect(result.successCount).toBe(2);
    expect(result.failCount).toBe(1);
    expect(result.trashedPaths).toEqual([
      "/Users/test/a.log",
      "/Users/test/c.log",
    ]);
    expect(result.errors).toHaveLength(1);
  });

  it("returns empty trashed paths when user cancels", async () => {
    showMessageBox.mockResolvedValue({ response: 0 });

    const { trashItemsWithConfirm } =
      await import("../../src/main/services/trashService");
    const result = await trashItemsWithConfirm(["/Users/test/a.log"], "test");

    expect(result.successCount).toBe(0);
    expect(result.failCount).toBe(0);
    expect(result.trashedPaths).toEqual([]);
  });

  it("uses measured directory size for folders in the confirmation payload", async () => {
    stat.mockImplementation(async () => ({
      size: 128,
      isDirectory: () => true,
    }));

    const { trashItemsWithConfirm } =
      await import("../../src/main/services/trashService");
    await trashItemsWithConfirm(["/Users/test/folder"], "test");

    expect(getDirSize).toHaveBeenCalledWith("/Users/test/folder");
    expect(showMessageBox).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        detail: expect.stringContaining("4 KB"),
      }),
    );
  });
});
