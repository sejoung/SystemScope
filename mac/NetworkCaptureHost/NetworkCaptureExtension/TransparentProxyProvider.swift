import Foundation
import NetworkExtension

/// NEAppProxyProvider that observes TCP/UDP flows from user apps and emits
/// metadata batches to the host via NSDistributedNotificationCenter.
///
/// For the first iteration we only capture flow *metadata* (process, host,
/// port, byte counts) — no payload inspection. The provider immediately
/// closes each flow after recording it, so traffic falls back to the system
/// networking stack. This preserves the app's normal connectivity while still
/// letting us enumerate connections.
final class TransparentProxyProvider: NEAppProxyProvider {
    private let flushQueue = DispatchQueue(label: "systemscope.ext.flush")
    private var pending: [BridgeMessage.FlowSummary] = []
    private var flushTimer: DispatchSourceTimer?

    override func startProxy(
        options: [String: Any]? = nil,
        completionHandler: @escaping (Error?) -> Void
    ) {
        let timer = DispatchSource.makeTimerSource(queue: flushQueue)
        timer.schedule(deadline: .now() + 1, repeating: 1.0)
        timer.setEventHandler { [weak self] in self?.flush() }
        timer.resume()
        flushTimer = timer
        completionHandler(nil)
    }

    override func stopProxy(
        with reason: NEProviderStopReason,
        completionHandler: @escaping () -> Void
    ) {
        flushTimer?.cancel()
        flushTimer = nil
        flush()
        completionHandler()
    }

    override func handleNewFlow(_ flow: NEAppProxyFlow) -> Bool {
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        let meta = flow.metaData
        let sourceAppID = meta.sourceAppSigningIdentifier

        var host: String? = nil
        var port: Int? = nil
        var proto = "tcp"

        if let tcp = flow as? NEAppProxyTCPFlow {
            // remoteHostname is a colon-joined "host:port" string on modern SDKs.
            if let remote = tcp.remoteHostname {
                let parts = remote.split(separator: ":")
                if parts.count >= 2 {
                    host = parts.dropLast().joined(separator: ":")
                    port = Int(parts.last!)
                } else {
                    host = remote
                }
            }
            proto = "tcp"
        } else if flow is NEAppProxyUDPFlow {
            proto = "udp"
        }

        let summary = BridgeMessage.FlowSummary(
            id: UUID().uuidString,
            pid: nil,
            processName: sourceAppID,
            direction: "outbound",
            protocol: proto,
            host: host,
            ip: host,
            port: port,
            startedAt: now,
            endedAt: now,
            durationMs: 0,
            rxBytes: 0,
            txBytes: 0,
            status: "closed"
        )

        flushQueue.async { [weak self] in
            self?.pending.append(summary)
        }

        // Do not take ownership of the flow — let the OS route it normally.
        return false
    }

    private func flush() {
        guard !pending.isEmpty else { return }
        let batch = pending
        pending.removeAll(keepingCapacity: true)

        guard let data = try? JSONEncoder().encode(batch) else { return }
        DistributedNotificationCenter.default().postNotificationName(
            Notification.Name("com.systemscope.networkCapture.flows"),
            object: nil,
            userInfo: ["flows": data],
            deliverImmediately: true
        )
    }
}
