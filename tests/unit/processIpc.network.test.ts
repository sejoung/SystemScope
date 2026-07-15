import { beforeEach, describe, expect, it, vi } from "vitest";
import { IPC_CHANNELS } from "../../src/shared/contracts/channels";

const handlers = vi.hoisted(
  () => new Map<string, (...args: unknown[]) => unknown>(),
);
const logErrorAction = vi.hoisted(() => vi.fn());
const logWarnAction = vi.hoisted(() => vi.fn());
const logInfoAction = vi.hoisted(() => vi.fn());
const logDebug = vi.hoisted(() => vi.fn());
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
  logDebug,
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
      logDebug.mockReset();
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

  it("PROCESS_RESOLVE_HOSTNAMES: validates input as string array", async () => {
      const { registerProcessIpc } = await import("../../src/main/ipc/process.ipc");
      registerProcessIpc();
      const handler = handlers.get(IPC_CHANNELS.PROCESS_RESOLVE_HOSTNAMES)!;
      const result = await handler({}, "not-an-array") as { ok: boolean };
      expect(result.ok).toBe(false);
      expect(resolveHostnames).not.toHaveBeenCalled();
    });

  it("PROCESS_RESOLVE_HOSTNAMES: returns success envelope with map", async () => {
      const { registerProcessIpc } = await import("../../src/main/ipc/process.ipc");
      registerProcessIpc();
      resolveHostnames.mockResolvedValueOnce({ "1.2.3.4": "host.example" });
      const handler = handlers.get(IPC_CHANNELS.PROCESS_RESOLVE_HOSTNAMES)!;
      const result = await handler({}, ["1.2.3.4"]) as { ok: boolean; data?: unknown };
      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ "1.2.3.4": "host.example" });
    });

  it("PROCESS_RESOLVE_HOSTNAMES: returns failure when service throws", async () => {
      const { registerProcessIpc } = await import("../../src/main/ipc/process.ipc");
      registerProcessIpc();
      resolveHostnames.mockRejectedValueOnce(new Error("dns down"));
      const handler = handlers.get(IPC_CHANNELS.PROCESS_RESOLVE_HOSTNAMES)!;
      const result = await handler({}, ["1.2.3.4"]) as { ok: boolean };
      expect(result.ok).toBe(false);
    });

  it("PROCESS_RESOLVE_COUNTRIES: validates input as string array", async () => {
      const { registerProcessIpc } = await import("../../src/main/ipc/process.ipc");
      registerProcessIpc();
      const handler = handlers.get(IPC_CHANNELS.PROCESS_RESOLVE_COUNTRIES)!;
      const result = await handler({}, "nope") as { ok: boolean };
      expect(result.ok).toBe(false);
      expect(resolveCountries).not.toHaveBeenCalled();
    });

  it("PROCESS_RESOLVE_COUNTRIES: returns success envelope", async () => {
      const { registerProcessIpc } = await import("../../src/main/ipc/process.ipc");
      registerProcessIpc();
      resolveCountries.mockResolvedValueOnce({ "8.8.8.8": "US" });
      const handler = handlers.get(IPC_CHANNELS.PROCESS_RESOLVE_COUNTRIES)!;
      const result = await handler({}, ["8.8.8.8"]) as { ok: boolean; data?: unknown };
      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ "8.8.8.8": "US" });
    });

  it("PROCESS_RESOLVE_COUNTRIES: returns failure when service throws", async () => {
      const { registerProcessIpc } = await import("../../src/main/ipc/process.ipc");
      registerProcessIpc();
      resolveCountries.mockRejectedValueOnce(new Error("db missing"));
      const handler = handlers.get(IPC_CHANNELS.PROCESS_RESOLVE_COUNTRIES)!;
      const result = await handler({}, ["8.8.8.8"]) as { ok: boolean };
      expect(result.ok).toBe(false);
    });
})
