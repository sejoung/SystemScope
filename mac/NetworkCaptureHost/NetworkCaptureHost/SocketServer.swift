import Foundation

/// Newline-delimited JSON server over a Unix domain socket.
/// Protocol matches `mac/NetworkCaptureHost/README.md`.
final class SocketServer {
    typealias Writer = (Encodable) -> Void

    var onCommand: ((BridgeMessage.Command, _ write: @escaping Writer) -> Void)?

    private let path: String
    private var listenFD: Int32 = -1
    private let queue = DispatchQueue(label: "systemscope.socket.accept")
    private let clientsLock = NSLock()
    private var clients: [Int32] = []

    init(path: String) {
        self.path = path
    }

    func start() throws {
        let dir = (path as NSString).deletingLastPathComponent
        try FileManager.default.createDirectory(
            atPath: dir, withIntermediateDirectories: true
        )
        unlink(path)

        listenFD = socket(AF_UNIX, SOCK_STREAM, 0)
        if listenFD < 0 { throw POSIXError(.EIO) }

        var addr = sockaddr_un()
        addr.sun_family = sa_family_t(AF_UNIX)
        _ = withUnsafeMutablePointer(to: &addr.sun_path) { ptr in
            ptr.withMemoryRebound(to: CChar.self, capacity: 104) { c in
                _ = strncpy(c, path, 103)
            }
        }
        let len = socklen_t(MemoryLayout<sockaddr_un>.size)
        let bindResult = withUnsafePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                Darwin.bind(listenFD, $0, len)
            }
        }
        if bindResult < 0 { throw POSIXError(.EADDRINUSE) }
        if listen(listenFD, 4) < 0 { throw POSIXError(.EIO) }

        queue.async { [weak self] in self?.acceptLoop() }
    }

    private func acceptLoop() {
        while true {
            var caddr = sockaddr()
            var clen = socklen_t(MemoryLayout<sockaddr>.size)
            let cfd = accept(listenFD, &caddr, &clen)
            if cfd < 0 { continue }

            clientsLock.lock()
            clients.append(cfd)
            clientsLock.unlock()

            DispatchQueue.global().async { [weak self] in
                self?.readLoop(fd: cfd)
            }
        }
    }

    private func readLoop(fd: Int32) {
        var buffer = Data()
        let chunk = 4096
        var tmp = [UInt8](repeating: 0, count: chunk)

        while true {
            let n = read(fd, &tmp, chunk)
            if n <= 0 { break }
            buffer.append(tmp, count: n)

            while let nl = buffer.firstIndex(of: 0x0a) {
                let line = buffer.prefix(upTo: nl)
                buffer.removeSubrange(0...nl)
                handleLine(Data(line), fd: fd)
            }
        }

        close(fd)
        clientsLock.lock()
        clients.removeAll { $0 == fd }
        clientsLock.unlock()
    }

    private func handleLine(_ data: Data, fd: Int32) {
        guard let command = try? JSONDecoder().decode(
            BridgeMessage.Command.self, from: data
        ) else { return }

        let writer: Writer = { [weak self] msg in
            self?.send(msg, to: fd)
        }
        onCommand?(command, writer)
    }

    private func send(_ message: Encodable, to fd: Int32) {
        guard var data = try? JSONEncoder().encode(AnyEncodable(message)) else { return }
        data.append(0x0a)
        _ = data.withUnsafeBytes { raw -> Int in
            guard let base = raw.baseAddress else { return 0 }
            return write(fd, base, data.count)
        }
    }

    func broadcast(_ message: Encodable) {
        clientsLock.lock()
        let snapshot = clients
        clientsLock.unlock()
        for fd in snapshot { send(message, to: fd) }
    }
}

private struct AnyEncodable: Encodable {
    let value: Encodable
    init(_ value: Encodable) { self.value = value }
    func encode(to encoder: Encoder) throws { try value.encode(to: encoder) }
}
