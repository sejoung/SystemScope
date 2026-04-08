import type { NetworkCaptureCapability, NetworkFlowSummary } from '@shared/types'

export interface NetworkCaptureCollectorStartResult {
  initialFlows: NetworkFlowSummary[]
  message?: string
}

/**
 * Platform-neutral collector interface.
 *
 * An implementation is responsible for:
 *  - reporting what the OS supports via `getCapability`
 *  - starting/stopping the underlying capture source
 *  - pushing flows to the orchestrator via the `onFlows` callback
 *
 * The orchestrator owns the ring buffer, status, and renderer broadcast —
 * collectors never talk to the renderer or BrowserWindow directly.
 */
export interface NetworkCaptureCollector {
  getCapability(): NetworkCaptureCapability
  start(onFlows: (flows: NetworkFlowSummary[]) => void): NetworkCaptureCollectorStartResult
  stop(): void
}
