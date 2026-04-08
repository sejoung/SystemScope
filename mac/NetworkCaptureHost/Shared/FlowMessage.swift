import Foundation

/// Event stream messages exchanged between the helper host and Electron main.
/// Mirrors `src/shared/types/networkCapture.ts` — keep both sides in sync.
public enum BridgeMessage {
    // MARK: commands (Electron main → host)
    public struct Command: Codable {
        public let type: String   // "start" | "stop" | "status" | "shutdown"
        public let id: String
    }

    // MARK: events (host → Electron main)
    public struct Ack: Codable {
        public let type: String   // "ack"
        public let id: String
        public let ok: Bool
        public let error: String?

        public init(id: String, ok: Bool, error: String? = nil) {
            self.type = "ack"
            self.id = id
            self.ok = ok
            self.error = error
        }
    }

    public struct StatusEvent: Codable {
        public let type: String   // "status"
        public let state: String  // see NetworkCaptureState in TS
        public let message: String?

        public init(state: String, message: String? = nil) {
            self.type = "status"
            self.state = state
            self.message = message
        }
    }

    public struct FlowBatch: Codable {
        public let type: String   // "flows"
        public let capturedAt: Int64
        public let flows: [FlowSummary]

        public init(capturedAt: Int64, flows: [FlowSummary]) {
            self.type = "flows"
            self.capturedAt = capturedAt
            self.flows = flows
        }
    }

    public struct FlowSummary: Codable, Sendable {
        public let id: String
        public let pid: Int?
        public let processName: String?
        public let direction: String  // "outbound" | "inbound"
        public let `protocol`: String // tcp | udp | dns | http | https | ws | other
        public let host: String?
        public let ip: String?
        public let port: Int?
        public let startedAt: Int64
        public let endedAt: Int64?
        public let durationMs: Int64?
        public let rxBytes: Int
        public let txBytes: Int
        public let status: String     // open | closed | failed
    }
}
