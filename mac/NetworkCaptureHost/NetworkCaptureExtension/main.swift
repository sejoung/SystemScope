import Foundation
import NetworkExtension

// Entry point for the NEAppProxyProvider system extension.
// `startSystemExtensionMode()` loads the principal NEProviderClass declared
// in Info.plist (`TransparentProxyProvider`) and hands control to it.
autoreleasepool {
    NEProvider.startSystemExtensionMode()
}

dispatchMain()
