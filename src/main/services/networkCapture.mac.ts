import * as net from 'node:net'
import * as os from 'node:os'
import * as path from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  NetworkCaptureCapability,
  NetworkFlowSummary
} from '@shared/types'
import type { NetworkCaptureCollector } from './networkCapture.types'

const HELPER_SOCKET_PATH = path.join(
  os.homedir(),
  'Library/Application Support/SystemScope/network-capture.sock'
)
const HELPER_CONNECT_TIMEOUT_MS = 500
const MOCK_CAPTURE_APPEND_INTERVAL_MS = 3_000

// ---------------------------------------------------------------------------
// Mock fallback — used when the NetworkCaptureHost helper is not running yet.
// ---------------------------------------------------------------------------

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
    }
  ]
}

function createMockFlowBatch(capturedAt: number): NetworkFlowSummary[] {
  const candidates = createMockFlows(capturedAt)
  const start = Math.floor(Math.random() * candidates.length)
  return [candidates[start], candidates[(start + 1) % candidates.length]]
}

// ---------------------------------------------------------------------------
// Real helper bridge — Unix socket + newline-delimited JSON.
// See mac/NetworkCaptureHost/README.md for the protocol.
// ---------------------------------------------------------------------------

interface HelperHandle {
  socket: net.Socket
  stop: () => void
}

function tryConnectHelper(
  onFlows: (flows: NetworkFlowSummary[]) => void
): Promise<HelperHandle | null> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ path: HELPER_SOCKET_PATH })
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(null)
    }, HELPER_CONNECT_TIMEOUT_MS)

    socket.once('error', () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(null)
    })

    socket.once('connect', () => {
      if (settled) return
      settled = true
      clearTimeout(timer)

      let buffer = ''
      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf8')
        let nl = buffer.indexOf('\n')
        while (nl >= 0) {
          const line = buffer.slice(0, nl)
          buffer = buffer.slice(nl + 1)
          nl = buffer.indexOf('\n')
          if (!line.trim()) continue
          try {
            const msg = JSON.parse(line)
            if (msg.type === 'flows' && Array.isArray(msg.flows)) {
              onFlows(msg.flows as NetworkFlowSummary[])
            }
          } catch {
            // ignore malformed line
          }
        }
      })

      // send start command
      socket.write(JSON.stringify({ type: 'start', id: randomUUID() }) + '\n')

      resolve({
        socket,
        stop: () => {
          try {
            socket.write(JSON.stringify({ type: 'stop', id: randomUUID() }) + '\n')
          } catch {
            // ignore
          }
          socket.destroy()
        }
      })
    })
  })
}

// ---------------------------------------------------------------------------
// Collector
// ---------------------------------------------------------------------------

export function createMacNetworkCaptureCollector(): NetworkCaptureCollector {
  let mockTimer: ReturnType<typeof setInterval> | null = null
  let helper: HelperHandle | null = null

  function stopMock(): void {
    if (mockTimer) {
      clearInterval(mockTimer)
      mockTimer = null
    }
  }

  return {
    getCapability(): NetworkCaptureCapability {
      return {
        supported: true,
        platform: 'mac',
        mode: 'metadata',
        requiresInstall: true,
        requiresApproval: true,
        canInspectBodies: false
      }
    },

    start(onFlows) {
      const capturedAt = Date.now()

      // Fire-and-forget helper connect: if it succeeds, subsequent batches
      // stream directly from the helper and the mock timer is stopped.
      void tryConnectHelper(onFlows).then((connected) => {
        if (!connected) return
        helper = connected
        stopMock()
      })

      // Until the helper responds we show mock flows so the UI stays alive.
      if (mockTimer) clearInterval(mockTimer)
      mockTimer = setInterval(() => {
        if (helper) return
        onFlows(createMockFlowBatch(Date.now()))
      }, MOCK_CAPTURE_APPEND_INTERVAL_MS)

      return {
        initialFlows: createMockFlows(capturedAt),
        message:
          'Network capture session started. Connecting to NetworkCaptureHost helper…'
      }
    },

    stop() {
      stopMock()
      if (helper) {
        helper.stop()
        helper = null
      }
    }
  }
}
