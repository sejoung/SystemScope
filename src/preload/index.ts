import { contextBridge } from "electron";
import { createE2EMockApi } from "./createE2EMockApi";
import { createIpcApi } from "./createIpcApi";

const api =
  process.env.E2E_LIGHTWEIGHT === "1" ? createE2EMockApi() : createIpcApi();

contextBridge.exposeInMainWorld("systemScope", api);

export type { SystemScopeApi } from "@shared/contracts/systemScope";
