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
const showMessageBox = vi.hoisted(() => vi.fn());
const getFocusedWindow = vi.hoisted(() => vi.fn());
const getAllWindows = vi.hoisted(() => vi.fn());
const getAppName = vi.hoisted(() => vi.fn());
const getAppPath = vi.hoisted(() => vi.fn());
const runExternalCommand = vi.hoisted(() => vi.fn());
const getProcessNetworkUsage = vi.hoisted(() => vi.fn());
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

vi.mock("../../src/main/services/logging", () => ({
  logErrorAction,
  logWarnAction,
  logInfoAction,
  logProductMetric,
}));

vi.mock("../../src/main/services/processMonitor", () => ({
  getTopCpuProcesses: vi.fn(),
  getTopMemoryProcesses: vi.fn(),
  getAllProcesses: vi.fn(),
  getNetworkPorts,
  getProcessByPid,
}));

vi.mock("../../src/main/services/processNetworkMonitor", () => ({
  getProcessNetworkUsage,
}));

vi.mock("../../src/main/services/externalCommand", () => ({
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
    showMessageBox.mockReset();
    getFocusedWindow.mockReset();
    getAllWindows.mockReset();
    getAppName.mockReset();
    getAppPath.mockReset();
    runExternalCommand.mockReset();
    getProcessNetworkUsage.mockReset();

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
    });
    expect(showMessageBox).toHaveBeenCalled();
    expect(killSpy).toHaveBeenCalledWith(4321, "SIGTERM");
    expect(logInfoAction).toHaveBeenCalled();
    killSpy.mockRestore();
  });

  it("should include PID, command, reason, and warning text in the kill confirmation dialog", async () => {
    const target = {
      pid: 4321,
      name: "node",
      command: "/usr/bin/node server.js",
      cpu: 0,
      memory: 0,
      memoryBytes: 0,
    };
    getProcessByPid.mockResolvedValue(target);
    showMessageBox.mockResolvedValue({ response: 0 });

    const { registerProcessIpc } =
      await import("../../src/main/ipc/process.ipc");
    const { tk } = await import("../../src/main/i18n");
    registerProcessIpc();

    const handler = handlers.get(IPC_CHANNELS.PROCESS_KILL);
    await handler?.({}, { pid: 4321, reason: "Activity > Ports" });

    expect(showMessageBox).toHaveBeenCalledTimes(1);
    const [, dialogOptions] = showMessageBox.mock.calls[0] as [
      unknown,
      { detail: string; message: string },
    ];
    expect(dialogOptions.message).toContain("node");
    expect(dialogOptions.detail).toContain("PID: 4321");
    expect(dialogOptions.detail).toContain("Command: /usr/bin/node server.js");
    expect(dialogOptions.detail).toContain("Reason: Activity > Ports");
    expect(dialogOptions.detail).toContain(tk("main.process.confirm.warning"));
  });

  it("should return cancelled result when user aborts kill", async () => {
    getProcessByPid.mockResolvedValue({
      pid: 4321,
      name: "node",
      command: "/usr/bin/node",
      cpu: 0,
      memory: 0,
      memoryBytes: 0,
    });
    showMessageBox.mockResolvedValue({ response: 0 });
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);

    const { registerProcessIpc } =
      await import("../../src/main/ipc/process.ipc");
    registerProcessIpc();

    const handler = handlers.get(IPC_CHANNELS.PROCESS_KILL);
    expect(handler).toBeTypeOf("function");

    const result = (await handler?.({}, { pid: 4321 })) as {
      ok: boolean;
      data?: { killed: boolean; cancelled: boolean };
    };
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({
      pid: 4321,
      name: "node",
      killed: false,
      cancelled: true,
    });
    expect(killSpy).not.toHaveBeenCalled();
    expect(logInfoAction).toHaveBeenCalled();
    killSpy.mockRestore();
  });

  it("should block protected app processes", async () => {
    getProcessByPid.mockResolvedValue({
      pid: 1234,
      name: "SystemScope Helper",
      command: "/Applications/SystemScope.app/Contents/MacOS/SystemScope",
      cpu: 0,
      memory: 0,
      memoryBytes: 0,
    });

    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);
    const { registerProcessIpc } =
      await import("../../src/main/ipc/process.ipc");
    registerProcessIpc();

    const handler = handlers.get(IPC_CHANNELS.PROCESS_KILL);
    expect(handler).toBeTypeOf("function");

    const result = (await handler?.({}, { pid: 1234 })) as {
      ok: boolean;
      error?: { code: string };
    };
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("PERMISSION_DENIED");
    expect(killSpy).not.toHaveBeenCalled();
    expect(logWarnAction).toHaveBeenCalled();
    killSpy.mockRestore();
  });

  it("should fall back to taskkill on Windows when process.kill returns EPERM", async () => {
    const target = {
      pid: 4321,
      name: "node",
      command: "C:\\node.exe",
      cpu: 0,
      memory: 0,
      memoryBytes: 0,
    };
    getProcessByPid.mockResolvedValue(target);
    showMessageBox.mockResolvedValue({ response: 1 });
    getAppPath.mockImplementation((name: string) => {
      if (name === "exe")
        return "C:\\Program Files\\SystemScope\\SystemScope.exe";
      return "C:\\Temp";
    });

    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32" });
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => {
      const err = new Error("kill EPERM") as Error & { code?: string };
      err.code = "EPERM";
      throw err;
    });
    runExternalCommand.mockResolvedValue({ stdout: "", stderr: "" });

    const { registerProcessIpc } =
      await import("../../src/main/ipc/process.ipc");
    registerProcessIpc();

    const handler = handlers.get(IPC_CHANNELS.PROCESS_KILL);
    const result = (await handler?.({}, { pid: 4321 })) as {
      ok: boolean;
      data?: { killed: boolean };
    };

    expect(result.ok).toBe(true);
    expect(result.data?.killed).toBe(true);
    expect(runExternalCommand).toHaveBeenCalledWith(
      "taskkill",
      ["/PID", "4321", "/T", "/F"],
      {
        windowsHide: true,
      },
    );

    killSpy.mockRestore();
    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  it("PROCESS_GET_NETWORK_USAGE: returns success envelope with snapshot", async () => {
    const { registerProcessIpc } = await import("../../src/main/ipc/process.ipc");
    registerProcessIpc();
    getProcessNetworkUsage.mockResolvedValueOnce({
      supported: true,
      capturedAt: 123,
      intervalSec: 2,
      processes: [
        { pid: 1, name: "a", rxBps: 10, txBps: 20, totalRxBytes: 100, totalTxBytes: 200 },
      ],
    });
    const handler = handlers.get(IPC_CHANNELS.PROCESS_GET_NETWORK_USAGE)!;
    const result = await handler({}) as { ok: boolean; data?: unknown };
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ supported: true, processes: [{ pid: 1 }] });
  });

  it("PROCESS_GET_NETWORK_USAGE: returns failure envelope when collector throws", async () => {
    const { registerProcessIpc } = await import("../../src/main/ipc/process.ipc");
    registerProcessIpc();
    getProcessNetworkUsage.mockRejectedValueOnce(new Error("nettop missing"));
    const handler = handlers.get(IPC_CHANNELS.PROCESS_GET_NETWORK_USAGE)!;
    const result = await handler({}) as { ok: boolean };
    expect(result.ok).toBe(false);
  });
});
