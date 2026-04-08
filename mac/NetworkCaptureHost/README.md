# NetworkCaptureHost (macOS)

macOS 네트워크 캡처용 helper/extension 스켈레톤입니다. 현재는 디렉터리와
브리지 계약 문서만 존재하며, Xcode target은 아직 추가되지 않았습니다. 상위
설계 문서는 [`docs/network-capture-architecture.ko.md`](../../docs/network-capture-architecture.ko.md)
를 참조하세요.

## 구성

```
mac/NetworkCaptureHost/
├─ project.yml                          # XcodeGen spec (generates .xcodeproj)
├─ NetworkCaptureHost/                  # host LSUIElement app
│   ├─ main.swift                       #   entry point + command loop
│   ├─ SocketServer.swift               #   Unix domain socket JSON server
│   ├─ ExtensionManager.swift           #   OSSystemExtension + NETransparentProxyManager
│   ├─ Info.plist
│   └─ NetworkCaptureHost.entitlements
├─ NetworkCaptureExtension/             # NEAppProxyProvider system extension
│   ├─ TransparentProxyProvider.swift   #   flow metadata collector
│   ├─ Info.plist
│   └─ NetworkCaptureExtension.entitlements
└─ Shared/
    └─ FlowMessage.swift                # Codable bridge types (mirrors TS)
```

## 빌드 방법

`.xcodeproj` 는 커밋하지 않고 [XcodeGen](https://github.com/yonaskolb/XcodeGen)
으로 생성합니다.

```bash
brew install xcodegen
cd mac/NetworkCaptureHost
xcodegen generate
open NetworkCaptureHost.xcodeproj
```

Xcode 에서 `NetworkCaptureHost` scheme 을 선택하고 빌드하면 host app 과 embedded
system extension 이 함께 패키징됩니다. 첫 실행 시 시스템 설정 →
"일반 → 로그인 항목 및 확장 프로그램 → 네트워크 확장" 에서 사용자 승인이
필요합니다 (`requiresApproval` 상태).

- **Host app / helper**: Electron main 에서 띄우거나, 사용자가 직접 설치한다. 역할은
  (1) Network Extension 설치·활성화, (2) extension lifecycle 제어,
  (3) Electron main 과의 IPC 브리지.
- **Network Extension target**: `NETransparentProxyProvider` 또는
  `NEAppProxyProvider` 를 우선 검토. 실제 flow metadata 수집을 담당.
- **Shared 모델**: host 와 extension 이 모두 import 하는 Swift 타입. JSON 으로
  직렬화하여 Electron main 으로 전달한다.

## Electron main ↔ Helper bridge

초기 구현은 **Unix domain socket + newline-delimited JSON event stream** 으로
단순하게 시작한다. 필요 시 이후에 XPC 로 강화한다.

- 소켓 경로 (개발 기본값): `~/Library/Application Support/SystemScope/network-capture.sock`
- 인코딩: UTF-8, 메시지당 한 줄 (`\n` 종단)
- 방향: 양방향. Electron main → helper 는 제어 커맨드, helper → Electron main
  은 상태 및 flow 이벤트.

renderer 는 이 소켓과 직접 통신하지 않는다. 반드시 Electron main
(`src/main/services/networkCapture.ts`) 의 orchestrator 를 거친다.

### Electron main → helper (commands)

```jsonc
// 캡처 시작
{ "type": "start", "id": "<uuid>" }

// 캡처 중지
{ "type": "stop",  "id": "<uuid>" }

// 현재 상태 조회
{ "type": "status", "id": "<uuid>" }

// helper 종료 요청
{ "type": "shutdown", "id": "<uuid>" }
```

### helper → Electron main (events)

1. **ack**: command 처리 결과

   ```jsonc
   { "type": "ack", "id": "<uuid>", "ok": true }
   { "type": "ack", "id": "<uuid>", "ok": false, "error": "approval_required" }
   ```

2. **status**: 상태 변경 브로드캐스트

   ```jsonc
   {
     "type": "status",
     "state": "helperNotInstalled"
                | "approvalRequired"
                | "helperDisconnected"
                | "available"
                | "starting"
                | "running"
                | "error",
     "message": "optional human readable string"
   }
   ```

   이 `state` 값은 `src/shared/types/networkCapture.ts` 의
   `NetworkCaptureState` 와 1:1 대응된다 (`unsupported` 는 helper 가 직접 사용하지
   않는다. Electron main 이 non-darwin 환경에서만 사용).

3. **flows**: 새로 관찰된 flow 배치. `NetworkFlowSummary` 와 동일한 필드.

   ```jsonc
   {
     "type": "flows",
     "capturedAt": 1712534000000,
     "flows": [
       {
         "id": "f-...",
         "pid": 915,
         "processName": "Google Chrome",
         "direction": "outbound",
         "protocol": "https",
         "host": "api.github.com",
         "ip": "140.82.121.6",
         "port": 443,
         "startedAt": 1712533999600,
         "endedAt": 1712534000000,
         "durationMs": 400,
         "rxBytes": 18420,
         "txBytes": 2112,
         "status": "closed"
       }
     ]
   }
   ```

   HTTP-like optional 필드 (`requestPath`, `method`, `statusCode`, `mimeType`,
   `initiator`, `scheme`) 는 helper 가 수집 가능한 경우에만 채운다. 1 차
   범위에서는 metadata 만 채우고 본문 inspection 은 수행하지 않는다.

## 스켈레톤 다음 단계

1. Xcode workspace 생성 (host + extension target)
2. entitlement 설정 (`com.apple.developer.networking.networkextension`)
3. Unix socket 서버 구현 (Swift, `Network.framework` 또는 `DispatchIO`)
4. `src/main/services/networkCapture.mac.ts` 에서 소켓 클라이언트로 collector
   구현 교체. mock 경로는 helper 미설치/미연결 시 fallback 으로 유지.
5. packaging 파이프라인 (code signing, notarization) 은 별도 단계에서 처리.

```
brew install xcodegen && cd mac/NetworkCaptureHost && xcodegen generate && open NetworkCaptureHost.xcodeproj
```
