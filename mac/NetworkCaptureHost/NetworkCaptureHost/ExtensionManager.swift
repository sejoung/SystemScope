import Foundation
import NetworkExtension
import SystemExtensions

/// Manages the bundled NEAppProxyProvider system extension:
/// activation, configuration, start/stop, and receiving flow batches.
///
/// The extension publishes flow batches via `NSDistributedNotificationCenter`
/// (dev-mode) or an App Group shared container (production). For this first
/// implementation we use DistributedNotificationCenter with a well-known name.
final class ExtensionManager: NSObject {
    enum StartResult {
        case success
        case approvalRequired
        case notInstalled
        case failure(Error)
    }

    private let extensionBundleID =
        "com.systemscope.NetworkCaptureHost.NetworkCaptureExtension"
    private var pendingStart: ((StartResult) -> Void)?

    var onFlows: (([BridgeMessage.FlowSummary]) -> Void)?

    override init() {
        super.init()
        DistributedNotificationCenter.default().addObserver(
            self,
            selector: #selector(handleFlowNotification(_:)),
            name: Notification.Name("com.systemscope.networkCapture.flows"),
            object: nil
        )
    }

    func currentStateString() -> String {
        // NETransparentProxyManager state would be checked here. Kept simple.
        return "available"
    }

    func start(completion: @escaping (StartResult) -> Void) {
        pendingStart = completion

        // 1. Activate system extension (first run triggers user approval).
        let req = OSSystemExtensionRequest.activationRequest(
            forExtensionWithIdentifier: extensionBundleID,
            queue: .main
        )
        req.delegate = self
        OSSystemExtensionManager.shared.submitRequest(req)
    }

    func stop(completion: @escaping (Error?) -> Void) {
        NETransparentProxyManager.loadAllFromPreferences { managers, err in
            if let err = err { completion(err); return }
            guard let mgr = managers?.first else { completion(nil); return }
            mgr.isEnabled = false
            mgr.saveToPreferences { err in completion(err) }
        }
    }

    private func configureAndEnable(_ completion: @escaping (StartResult) -> Void) {
        NETransparentProxyManager.loadAllFromPreferences { managers, err in
            if let err = err { completion(.failure(err)); return }

            let mgr = managers?.first ?? NETransparentProxyManager()
            mgr.localizedDescription = "SystemScope Network Capture"

            let proto = NETunnelProviderProtocol()
            proto.providerBundleIdentifier = self.extensionBundleID
            proto.serverAddress = "SystemScope"
            mgr.protocolConfiguration = proto
            mgr.isEnabled = true

            mgr.saveToPreferences { err in
                if let err = err {
                    let ns = err as NSError
                    if ns.domain == NEVPNErrorDomain {
                        completion(.approvalRequired)
                    } else {
                        completion(.failure(err))
                    }
                    return
                }
                mgr.loadFromPreferences { _ in
                    do {
                        try mgr.connection.startVPNTunnel()
                        completion(.success)
                    } catch {
                        completion(.failure(error))
                    }
                }
            }
        }
    }

    @objc private func handleFlowNotification(_ note: Notification) {
        guard
            let userInfo = note.userInfo,
            let payload = userInfo["flows"] as? Data,
            let flows = try? JSONDecoder().decode(
                [BridgeMessage.FlowSummary].self, from: payload
            )
        else { return }
        onFlows?(flows)
    }
}

extension ExtensionManager: OSSystemExtensionRequestDelegate {
    func request(_ request: OSSystemExtensionRequest,
                 actionForReplacingExtension existing: OSSystemExtensionProperties,
                 withExtension ext: OSSystemExtensionProperties) -> OSSystemExtensionRequest.ReplacementAction {
        return .replace
    }

    func requestNeedsUserApproval(_ request: OSSystemExtensionRequest) {
        pendingStart?(.approvalRequired)
        pendingStart = nil
    }

    func request(_ request: OSSystemExtensionRequest,
                 didFinishWithResult result: OSSystemExtensionRequest.Result) {
        guard result == .completed || result == .willCompleteAfterReboot else {
            pendingStart?(.failure(NSError(domain: "NetworkCaptureHost",
                                           code: Int(result.rawValue))))
            pendingStart = nil
            return
        }
        let cb = pendingStart
        pendingStart = nil
        configureAndEnable { res in cb?(res) }
    }

    func request(_ request: OSSystemExtensionRequest, didFailWithError error: Error) {
        let ns = error as NSError
        if ns.domain == OSSystemExtensionErrorDomain,
           ns.code == OSSystemExtensionError.extensionNotFound.rawValue {
            pendingStart?(.notInstalled)
        } else {
            pendingStart?(.failure(error))
        }
        pendingStart = nil
    }
}
