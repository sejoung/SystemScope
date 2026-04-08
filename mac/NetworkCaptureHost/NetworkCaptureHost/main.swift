import Foundation
import NetworkExtension

// Entry point for the NetworkCaptureHost helper app.
//
// Responsibilities:
//  1. Activate / configure the bundled NEAppProxyProvider extension
//  2. Expose a Unix domain socket that Electron main connects to
//  3. Forward flow events from the extension over the socket
//
// The helper is a LSUIElement (no dock icon) app so it can run in the
// background while SystemScope is open.

let socketPath = NSString(
    string: "~/Library/Application Support/SystemScope/network-capture.sock"
).expandingTildeInPath

let manager = ExtensionManager()
let server = SocketServer(path: socketPath)

server.onCommand = { command, write in
    switch command.type {
    case "start":
        manager.start { result in
            switch result {
            case .success:
                write(BridgeMessage.Ack(id: command.id, ok: true))
                write(BridgeMessage.StatusEvent(state: "running",
                                                message: "Extension active"))
            case .approvalRequired:
                write(BridgeMessage.Ack(id: command.id, ok: false,
                                        error: "approval_required"))
                write(BridgeMessage.StatusEvent(state: "approvalRequired"))
            case .notInstalled:
                write(BridgeMessage.Ack(id: command.id, ok: false,
                                        error: "helper_not_installed"))
                write(BridgeMessage.StatusEvent(state: "helperNotInstalled"))
            case .failure(let err):
                write(BridgeMessage.Ack(id: command.id, ok: false,
                                        error: err.localizedDescription))
                write(BridgeMessage.StatusEvent(state: "error",
                                                message: err.localizedDescription))
            }
        }

    case "stop":
        manager.stop { err in
            if let err = err {
                write(BridgeMessage.Ack(id: command.id, ok: false,
                                        error: err.localizedDescription))
            } else {
                write(BridgeMessage.Ack(id: command.id, ok: true))
                write(BridgeMessage.StatusEvent(state: "available"))
            }
        }

    case "status":
        write(BridgeMessage.Ack(id: command.id, ok: true))
        write(BridgeMessage.StatusEvent(state: manager.currentStateString(),
                                        message: nil))

    case "shutdown":
        write(BridgeMessage.Ack(id: command.id, ok: true))
        exit(0)

    default:
        write(BridgeMessage.Ack(id: command.id, ok: false, error: "unknown_command"))
    }
}

// Forward flow batches from the extension (delivered via App Group /
// NSDistributedNotificationCenter) to connected socket clients.
manager.onFlows = { flows in
    let batch = BridgeMessage.FlowBatch(
        capturedAt: Int64(Date().timeIntervalSince1970 * 1000),
        flows: flows
    )
    server.broadcast(batch)
}

do {
    try server.start()
    FileHandle.standardError.write(
        "NetworkCaptureHost listening on \(socketPath)\n".data(using: .utf8)!
    )
} catch {
    FileHandle.standardError.write(
        "Failed to start socket: \(error)\n".data(using: .utf8)!
    )
    exit(1)
}

RunLoop.main.run()
