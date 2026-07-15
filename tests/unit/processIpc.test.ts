import { beforeEach, describe, expect, it, vi } from "vitest";
import { IPC_CHANNELS } from "../../src/shared/contracts/channels";

const handlers = vi.hoisted(
  () => new Map<string, (...args: unknown[]) => unknown>(),
);
const logErrorAction = vi.hoisted(() => vi.fn());
const logWarnAction = vi.hoisted(() => vi.fn());
const logInfoAction = vi.hoisted(() => vi.fn());
const logProductMetric = vi.hoisted(() => vi.fn());
const getNetworkPorts = vi.hoisted(() => vi.fn());
const getProcessByPid = vi.hoisted(() => vi.fn());
const getProcessDescendants = vi.hoisted(() => vi.fn());
const showMessageBox = vi.hoisted(() => vi.fn());
const getFocusedWindow = vi.hoisted(() => vi.fn());
const getAllWindows = vi.hoisted(() => vi.fn());
const getAppName = vi.hoisted(() => vi.fn());
const getAppPath = vi.hoisted(() => vi.fn());
const runExternalCommand = vi.hoisted(() => vi.fn());
const getProcessNetworkUsage = vi.hoisted(() => vi.fn());
const resolveHostnames = vi.hoisted(() => vi.fn());
vi.mock("../../src/main/services/process/dnsResolver", () => ({
  resolveHostnames,
}));
const resolveCountries = vi.hoisted(() => vi.fn());
vi.mock("../../src/main/services/process/geoIpResolver", () => ({
  resolveCountries,
}));
vi.mock("electron", () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler);
    },
  },
  dialog: {
    showMessageBox,
  },
  BrowserWindow: {
    getFocusedWindow,
    getAllWindows,
  },
  app: {
    getName: getAppName,
    getPath: getAppPath,
  },
}));

vi.mock("../../src/main/services/core/logging", () => ({
  logErrorAction,
  logWarnAction,
  logInfoAction,
  logProductMetric,
}));

vi.mock("../../src/main/services/process/processMonitor", () => ({
  getTopCpuProcesses: vi.fn(),
  getTopMemoryProcesses: vi.fn(),
  getAllProcesses: vi.fn(),
  getNetworkPorts,
  getProcessByPid,
  getProcessDescendants,
}));

vi.mock("../../src/main/services/process/processNetworkMonitor", () => ({
  getProcessNetworkUsage,
}));

vi.mock("../../src/main/services/core/externalCommand", () => ({
  runExternalCommand,
}));

describe("registerProcessIpc", () => {
  beforeEach(() => {
      vi.resetModules();
      handlers.clear();
      logErrorAction.mockReset();
      logWarnAction.mockReset();
      logInfoAction.mockReset();
      logProductMetric.mockReset();
      getNetworkPorts.mockReset();
      getProcessByPid.mockReset();
      getProcessDescendants.mockReset();
      getProcessDescendants.mockResolvedValue([]);
      showMessageBox.mockReset();
      getFocusedWindow.mockReset();
      getAllWindows.mockReset();
      getAppName.mockReset();
      getAppPath.mockReset();
      runExternalCommand.mockReset();
      getProcessNetworkUsage.mockReset();
      resolveHostnames.mockReset();
      resolveCountries.mockReset();

      getFocusedWindow.mockReturnValue(null);
      getAllWindows.mockReturnValue([]);
      getAppName.mockReturnValue("SystemScope");
      getAppPath.mockImplementation((name: string) => {
        if (name === "exe")
          return "/Applications/SystemScope.app/Contents/MacOS/SystemScope";
        return "/tmp";
      });
    });

  it("should return ports through PROCESS_GET_PORTS", async () => {
      getNetworkPorts.mockResolvedValue([
        { localPort: "3000", localPortNum: 3000 },
      ]);

      const { registerProcessIpc } =
        await import("../../src/main/ipc/process.ipc");
      registerProcessIpc();

      const handler = handlers.get(IPC_CHANNELS.PROCESS_GET_PORTS);
      expect(handler).toBeTypeOf("function");

      const result = (await handler?.({}, undefined)) as {
        ok: boolean;
        data?: unknown[];
      };
      expect(result.ok).toBe(true);
      expect(result.data).toEqual([{ localPort: "3000", localPortNum: 3000 }]);
    });

  it("should return failure when getNetworkPorts throws", async () => {
      getNetworkPorts.mockRejectedValue(new Error("boom"));

      const { registerProcessIpc } =
        await import("../../src/main/ipc/process.ipc");
      registerProcessIpc();

      const handler = handlers.get(IPC_CHANNELS.PROCESS_GET_PORTS);
      expect(handler).toBeTypeOf("function");

      const result = (await handler?.({}, undefined)) as {
        ok: boolean;
        error?: { code: string };
      };
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("UNKNOWN_ERROR");
      expect(logErrorAction).toHaveBeenCalled();
    });

  it("should kill a process after confirmation", async () => {
      const target = {
        pid: 4321,
        name: "node",
        command: "/usr/bin/node",
        cpu: 0,
        memory: 0,
        memoryBytes: 0,
      };
      getProcessByPid.mockResolvedValue(target);
      showMessageBox.mockResolvedValue({ response: 1 });
      const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);

      const { registerProcessIpc } =
        await import("../../src/main/ipc/process.ipc");
      registerProcessIpc();

      const handler = handlers.get(IPC_CHANNELS.PROCESS_KILL);
      expect(handler).toBeTypeOf("function");

      const result = (await handler?.(
        {},
        { pid: 4321, reason: "Activity > Processes" },
      )) as { ok: boolean; data?: { killed: boolean; cancelled: boolean } };
      expect(result.ok).toBe(true);
      expect(result.data).toEqual({
        pid: 4321,
        name: "node",
        killed: true,
        cancelled: false,
        killedPids: [4321],
      });
      expect(showMessageBox).toHaveBeenCalled();
      expect(killSpy).toHaveBeenCalledWith(4321, "SIGKILL");
      expect(logInfoAction).toHaveBeenCalled();
      killSpy.mockRestore();
    });

  it("should kill the whole process tree when tree=true (Unix)", async () => {
      const target = {
        pid: 1000,
        name: "npm",
        command: "npm run dev",
        cpu: 0,
        memory: 0,
        memoryBytes: 0,
      };
      const descendants = [
        { pid: 1001, name: "node", command: "node vite", cpu: 0, memory: 0, memoryBytes: 0 },
        { pid: 1002, name: "esbuild", command: "esbuild", cpu: 0, memory: 0, memoryBytes: 0 },
      ];
      getProcessByPid.mockResolvedValue(target);
      getProcessDescendants.mockResolvedValue(descendants);
      showMessageBox.mockResolvedValue({ response: 1 });
      const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);

      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "darwin" });

      const { registerProcessIpc } =
        await import("../../src/main/ipc/process.ipc");
      registerProcessIpc();

      const handler = handlers.get(IPC_CHANNELS.PROCESS_KILL);
      const result = (await handler?.(
        {},
        { pid: 1000, tree: true },
      )) as { ok: boolean; data?: { killedPids: number[] } };

      expect(result.ok).toBe(true);
      expect(result.data?.killedPids).toEqual([1000, 1001, 1002]);
      // descendants killed deepest-first, then root
      expect(killSpy.mock.calls).toEqual([
        [1002, "SIGKILL"],
        [1001, "SIGKILL"],
        [1000, "SIGKILL"],
      ]);

      killSpy.mockRestore();
      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

  it("should use taskkill /T /F for tree kill on Windows", async () => {
      const target = {
        pid: 2000,
        name: "node.exe",
        command: "C:\\node.exe",
        cpu: 0,
        memory: 0,
        memoryBytes: 0,
      };
      getProcessByPid.mockResolvedValue(target);
      getProcessDescendants.mockResolvedValue([
        { pid: 2001, name: "child.exe", command: "C:\\child.exe", cpu: 0, memory: 0, memoryBytes: 0 },
      ]);
      showMessageBox.mockResolvedValue({ response: 1 });
      runExternalCommand.mockResolvedValue({ stdout: "", stderr: "" });
      const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);

      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });

      const { registerProcessIpc } =
        await import("../../src/main/ipc/process.ipc");
      registerProcessIpc();

      const handler = handlers.get(IPC_CHANNELS.PROCESS_KILL);
      const result = (await handler?.({}, { pid: 2000, tree: true })) as {
        ok: boolean;
        data?: { killedPids: number[] };
      };

      expect(result.ok).toBe(true);
      expect(result.data?.killedPids).toEqual([2000, 2001]);
      expect(killSpy).not.toHaveBeenCalled();
      expect(runExternalCommand).toHaveBeenCalledWith(
        "taskkill",
        ["/PID", "2000", "/T", "/F"],
        { windowsHide: true },
      );

      killSpy.mockRestore();
      Object.defineProperty(process, "platform", { value: originalPlatform });
    });
})
