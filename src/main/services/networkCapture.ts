import { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import type {
  NetworkCaptureCapability,
  NetworkCaptureStatus,
  NetworkCaptureUpdate,
  NetworkFlowSummary
} from '@shared/types'
import type { NetworkCaptureCollector } from './networkCapture.types'
import { createMacNetworkCaptureCollector } from './networkCapture.mac'

const MAX_RECENT_FLOW_COUNT = 200

let status: NetworkCaptureStatus = createInitialStatus()
let recentFlows: NetworkFlowSummary[] = []
let collector: NetworkCaptureCollector | null = selectCollector()

function selectCollector(): NetworkCaptureCollector | null {
  if (process.platform === 'darwin') return createMacNetworkCaptureCollector()
  // Windows / Linux collectors are not implemented yet; orchestrator reports
  // `unsupported` capability and swallows start/stop calls.
  return null
}

function detectPlatform(): NetworkCaptureCapability['platform'] {
  if (process.platform === 'darwin') return 'mac'
  if (process.platform === 'win32') return 'win'
  return 'linux'
}

function createInitialStatus(): NetworkCaptureStatus {
  const supported = process.platform === 'darwin'
  return {
    state: supported ? 'available' : 'unsupported',
    running: false,
    flowCount: 0,
    lastUpdatedAt: null,
    message: supported
      ? 'Network capture helper is not connected yet.'
      : 'Network capture is not supported on this platform yet.'
  }
}

function broadcastUpdate(): void {
  const payload: NetworkCaptureUpdate = {
    status,
    recentFlows
  }

  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.EVENT_NETWORK_CAPTURE_UPDATE, payload)
    }
  }
}

export function getNetworkCaptureCapability(): NetworkCaptureCapability {
  if (collector) return collector.getCapability()

  return {
    supported: false,
    platform: detectPlatform(),
    mode: 'none',
    requiresInstall: false,
    requiresApproval: false,
    canInspectBodies: false
  }
}

export function getNetworkCaptureStatus(): NetworkCaptureStatus {
  return status
}

export function listRecentNetworkFlows(limit: number = 50): NetworkFlowSummary[] {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 50
  return recentFlows.slice(0, safeLimit)
}

export function startNetworkCapture(): boolean {
  if (!collector) {
    status = {
      state: 'unsupported',
      running: false,
      flowCount: 0,
      lastUpdatedAt: Date.now(),
      message: 'Network capture is not supported on this platform yet.'
    }
    broadcastUpdate()
    return false
  }

  const capturedAt = Date.now()
  const result = collector.start((flows) => pushNetworkCaptureFlows(flows))

  if (recentFlows.length === 0 && result.initialFlows.length > 0) {
    recentFlows = result.initialFlows.slice(0, MAX_RECENT_FLOW_COUNT)
  }

  status = {
    state: 'running',
    running: true,
    flowCount: recentFlows.length,
    lastUpdatedAt: capturedAt,
    message: result.message ?? 'Network capture session started.'
  }

  broadcastUpdate()
  return true
}

export function stopNetworkCapture(): boolean {
  if (status.state === 'unsupported') return false

  collector?.stop()

  status = {
    state: 'available',
    running: false,
    flowCount: recentFlows.length,
    lastUpdatedAt: Date.now(),
    message: 'Network capture session stopped.'
  }
  broadcastUpdate()
  return true
}

export function clearNetworkCapture(): boolean {
  recentFlows = []
  status = {
    ...status,
    flowCount: 0,
    lastUpdatedAt: Date.now(),
    message:
      status.state === 'unsupported' ? status.message : 'Recent network flows cleared.'
  }
  broadcastUpdate()
  return true
}

export function pushNetworkCaptureFlows(flows: NetworkFlowSummary[]): void {
  if (flows.length === 0) return
  if (!status.running) return

  recentFlows = [...flows, ...recentFlows].slice(0, MAX_RECENT_FLOW_COUNT)
  status = {
    ...status,
    flowCount: recentFlows.length,
    lastUpdatedAt: Date.now()
  }
  broadcastUpdate()
}

export function __resetNetworkCaptureForTests(): void {
  collector?.stop()
  collector = selectCollector()
  status = createInitialStatus()
  recentFlows = []
}
