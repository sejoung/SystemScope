import { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared/contracts/channels'
import type {
  NetworkCaptureCapability,
  NetworkCaptureStatus,
  NetworkCaptureUpdate,
  NetworkFlowSummary
} from '@shared/types'

const MAX_RECENT_FLOW_COUNT = 200
const MOCK_CAPTURE_APPEND_INTERVAL_MS = 3_000

let status: NetworkCaptureStatus = createInitialStatus()
let recentFlows: NetworkFlowSummary[] = []
let mockCaptureTimer: ReturnType<typeof setInterval> | null = null

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

function createMockFlows(capturedAt: number): NetworkFlowSummary[] {
  return [
    {
      id: `flow-${capturedAt}-1`,
      pid: 915,
      processName: 'Google Chrome',
      direction: 'outbound',
      protocol: 'https',
      host: 'api.github.com',
      ip: '140.82.121.6',
      port: 443,
      startedAt: capturedAt - 3200,
      endedAt: capturedAt - 2800,
      durationMs: 400,
      rxBytes: 18_420,
      txBytes: 2_112,
      status: 'closed',
      requestPath: '/repos/openai/openai-node/releases?per_page=20',
      method: 'GET',
      statusCode: 200,
      mimeType: 'application/json',
      initiator: 'fetch',
      scheme: 'https'
    },
    {
      id: `flow-${capturedAt}-2`,
      pid: 1084,
      processName: 'node',
      direction: 'outbound',
      protocol: 'http',
      host: 'registry.npmjs.org',
      ip: '104.16.26.34',
      port: 443,
      startedAt: capturedAt - 1800,
      endedAt: null,
      durationMs: null,
      rxBytes: 9_612,
      txBytes: 1_842,
      status: 'open',
      requestPath: '/-/npm/v1/security/advisories/bulk',
      method: 'POST',
      statusCode: 101,
      mimeType: 'application/json',
      initiator: 'script',
      scheme: 'https'
    },
    {
      id: `flow-${capturedAt}-3`,
      pid: 553,
      processName: 'Cursor',
      direction: 'outbound',
      protocol: 'dns',
      host: 'openai.com',
      ip: null,
      port: 53,
      startedAt: capturedAt - 900,
      endedAt: capturedAt - 860,
      durationMs: 40,
      rxBytes: 148,
      txBytes: 96,
      status: 'closed',
      requestPath: 'openai.com A',
      method: 'QUERY',
      statusCode: 0,
      mimeType: 'application/dns-message',
      initiator: 'resolver',
      scheme: 'dns'
    },
    {
      id: `flow-${capturedAt}-4`,
      pid: 915,
      processName: 'Google Chrome',
      direction: 'outbound',
      protocol: 'https',
      host: 'fonts.gstatic.com',
      ip: '142.250.207.99',
      port: 443,
      startedAt: capturedAt - 2750,
      endedAt: capturedAt - 2510,
      durationMs: 240,
      rxBytes: 42_180,
      txBytes: 1_064,
      status: 'closed',
      requestPath: '/s/inter/v20/UcCO3FwrK3iLTcviYw.ttf',
      method: 'GET',
      statusCode: 200,
      mimeType: 'font/ttf',
      initiator: 'stylesheet',
      scheme: 'https'
    },
    {
      id: `flow-${capturedAt}-5`,
      pid: 1201,
      processName: 'Slack',
      direction: 'outbound',
      protocol: 'ws',
      host: 'wss-primary.slack.com',
      ip: '3.221.32.10',
      port: 443,
      startedAt: capturedAt - 4100,
      endedAt: null,
      durationMs: null,
      rxBytes: 126_400,
      txBytes: 14_840,
      status: 'open',
      requestPath: '/websocket/abc123/connect',
      method: 'GET',
      statusCode: 101,
      mimeType: 'application/websocket',
      initiator: 'script',
      scheme: 'wss'
    },
    {
      id: `flow-${capturedAt}-6`,
      pid: 553,
      processName: 'Cursor',
      direction: 'outbound',
      protocol: 'https',
      host: 'api.openai.com',
      ip: '13.107.246.70',
      port: 443,
      startedAt: capturedAt - 1320,
      endedAt: capturedAt - 910,
      durationMs: 410,
      rxBytes: 6_940,
      txBytes: 2_420,
      status: 'failed',
      requestPath: '/v1/responses',
      method: 'POST',
      statusCode: 502,
      mimeType: 'application/json',
      initiator: 'fetch',
      scheme: 'https'
    },
    {
      id: `flow-${capturedAt}-7`,
      pid: 915,
      processName: 'Google Chrome',
      direction: 'outbound',
      protocol: 'https',
      host: 'www.youtube.com',
      ip: '142.250.199.206',
      port: 443,
      startedAt: capturedAt - 2240,
      endedAt: capturedAt - 2070,
      durationMs: 170,
      rxBytes: 84_300,
      txBytes: 880,
      status: 'closed',
      requestPath: '/youtubei/v1/player?prettyPrint=false',
      method: 'POST',
      statusCode: 200,
      mimeType: 'application/json',
      initiator: 'fetch',
      scheme: 'https'
    },
    {
      id: `flow-${capturedAt}-8`,
      pid: 915,
      processName: 'Google Chrome',
      direction: 'outbound',
      protocol: 'https',
      host: 'cdn.discordapp.com',
      ip: '162.159.128.233',
      port: 443,
      startedAt: capturedAt - 1980,
      endedAt: capturedAt - 1770,
      durationMs: 210,
      rxBytes: 128_400,
      txBytes: 640,
      status: 'closed',
      requestPath: '/attachments/12345/67890/screenshot.png',
      method: 'GET',
      statusCode: 200,
      mimeType: 'image/png',
      initiator: 'img',
      scheme: 'https'
    },
    {
      id: `flow-${capturedAt}-9`,
      pid: 1084,
      processName: 'node',
      direction: 'outbound',
      protocol: 'https',
      host: 'api.stripe.com',
      ip: '34.202.203.47',
      port: 443,
      startedAt: capturedAt - 1540,
      endedAt: capturedAt - 1210,
      durationMs: 330,
      rxBytes: 1_942,
      txBytes: 1_208,
      status: 'failed',
      requestPath: '/v1/payment_intents',
      method: 'POST',
      statusCode: 401,
      mimeType: 'application/json',
      initiator: 'fetch',
      scheme: 'https'
    },
    {
      id: `flow-${capturedAt}-10`,
      pid: 553,
      processName: 'Cursor',
      direction: 'outbound',
      protocol: 'https',
      host: 'updates.cursor.com',
      ip: '104.18.18.9',
      port: 443,
      startedAt: capturedAt - 860,
      endedAt: capturedAt - 700,
      durationMs: 160,
      rxBytes: 5_482,
      txBytes: 560,
      status: 'closed',
      requestPath: '/api/releases/stable/darwin-arm64/latest',
      method: 'GET',
      statusCode: 304,
      mimeType: 'application/json',
      initiator: 'script',
      scheme: 'https'
    },
  ]
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

function createMockFlowBatch(capturedAt: number): NetworkFlowSummary[] {
  const candidates = createMockFlows(capturedAt)
  const start = Math.floor(Math.random() * candidates.length)
  return [candidates[start], candidates[(start + 1) % candidates.length]]
}

function startMockCaptureFeed(): void {
  if (mockCaptureTimer) return

  mockCaptureTimer = setInterval(() => {
    if (!status.running) return
    pushNetworkCaptureFlows(createMockFlowBatch(Date.now()))
  }, MOCK_CAPTURE_APPEND_INTERVAL_MS)
}

function stopMockCaptureFeed(): void {
  if (!mockCaptureTimer) return
  clearInterval(mockCaptureTimer)
  mockCaptureTimer = null
}

export function getNetworkCaptureCapability(): NetworkCaptureCapability {
  if (process.platform === 'darwin') {
    return {
      supported: true,
      platform: 'mac',
      mode: 'metadata',
      requiresInstall: true,
      requiresApproval: true,
      canInspectBodies: false
    }
  }

  if (process.platform === 'win32') {
    return {
      supported: false,
      platform: 'win',
      mode: 'none',
      requiresInstall: false,
      requiresApproval: false,
      canInspectBodies: false
    }
  }

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
  const capability = getNetworkCaptureCapability()
  if (!capability.supported) {
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
  status = {
    state: 'running',
    running: true,
    flowCount: recentFlows.length,
    lastUpdatedAt: capturedAt,
    message: 'Mock network capture session started. Connect the macOS helper to replace this data.'
  }

  if (recentFlows.length === 0) {
    recentFlows = createMockFlows(capturedAt)
    status.flowCount = recentFlows.length
  }

  startMockCaptureFeed()
  broadcastUpdate()
  return true
}

export function stopNetworkCapture(): boolean {
  if (status.state === 'unsupported') return false

  status = {
    state: 'available',
    running: false,
    flowCount: recentFlows.length,
    lastUpdatedAt: Date.now(),
    message: 'Network capture session stopped.'
  }
  stopMockCaptureFeed()
  broadcastUpdate()
  return true
}

export function clearNetworkCapture(): boolean {
  recentFlows = []
  status = {
    ...status,
    flowCount: 0,
    lastUpdatedAt: Date.now(),
    message: status.state === 'unsupported'
      ? status.message
      : 'Recent network flows cleared.'
  }
  broadcastUpdate()
  return true
}

export function pushNetworkCaptureFlows(flows: NetworkFlowSummary[]): void {
  if (flows.length === 0) return

  recentFlows = [...flows, ...recentFlows].slice(0, MAX_RECENT_FLOW_COUNT)
  status = {
    ...status,
    flowCount: recentFlows.length,
    lastUpdatedAt: Date.now()
  }
  broadcastUpdate()
}

export function __resetNetworkCaptureForTests(): void {
  stopMockCaptureFeed()
  status = createInitialStatus()
  recentFlows = []
}
