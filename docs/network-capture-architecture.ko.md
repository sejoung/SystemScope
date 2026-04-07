# Network Capture Architecture for macOS

이 문서는 SystemScope에 macOS용 네트워크 캡처 기능을 추가하는 현실적인 구현 방안을 정리합니다. 목표는 Electron 앱을 유지한 채, 1차로 macOS에서 동작하는 네트워크 모니터링 기능을 만들고 이후 Windows로 확장할 수 있는 구조를 잡는 것입니다.

## 목적

- Electron 앱을 유지하면서 macOS 네트워크 캡처 기능을 추가한다.
- 1차 구현은 “Chrome DevTools처럼 보기 좋은 네트워크 모니터링”에 필요한 메타데이터 수집을 목표로 한다.
- 이후 Windows 구현으로 확장할 수 있도록 UI, IPC, 저장 포맷을 플랫폼 중립적으로 설계한다.

## 먼저 결정할 것

이 기능은 크게 두 단계로 나뉩니다.

### 1. 메타데이터 캡처

수집 대상:

- 프로세스 / 앱 이름
- 원격 호스트 / IP
- 포트
- 프로토콜 TCP/UDP
- 시작 시각 / 종료 시각
- 송수신 바이트
- 연결 지속 시간
- DNS 질의 여부

장점:

- 구현이 더 현실적이다.
- HTTPS 본문 복호화가 필요 없다.
- DevTools 같은 “연결 흐름” UI를 만드는 데 충분하다.

### 2. HTTP 상세 캡처

수집 대상 추가:

- URL
- Method
- Status
- Headers
- Body preview

주의:

- HTTPS 상세 캡처는 사실상 로컬 프록시 + 인증서(MITM) 문제가 따라온다.
- 보안/설치/UX 부담이 커진다.

권장:

- macOS 1차는 메타데이터 캡처부터 간다.
- HTTP 상세는 2차 기능으로 분리한다.

## Tauri 대신 Electron을 유지하는 이유

이 기능의 난이도는 웹뷰 프레임워크가 아니라 macOS 네이티브 쪽에 있습니다.

- `Network Extension`
- entitlement
- helper / extension packaging
- Electron main과 네이티브 프로세스 간 통신

이 문제는 Tauri로 옮겨도 그대로 남습니다. 현재 SystemScope는 이미 아래 경로가 갖춰져 있어서 Electron 유지가 더 낫습니다.

- IPC 계약: [src/shared/contracts/systemScope.ts](/Users/sejoungkim/SystemScope/src/shared/contracts/systemScope.ts)
- preload bridge: [src/preload/createIpcApi.ts](/Users/sejoungkim/SystemScope/src/preload/createIpcApi.ts)
- main IPC handlers: [src/main/ipc](/Users/sejoungkim/SystemScope/src/main/ipc)

## 권장 아키텍처

```text
Renderer
  -> preload
  -> Electron IPC
  -> main process networkCapture service
  -> macOS helper bridge
  -> Network Extension / local capture engine
```

### 계층별 책임

#### 1. Renderer

역할:

- request list
- detail pane
- filter / search
- waterfall / timeline
- session start / stop / clear

원칙:

- Renderer는 OS 세부사항을 모른다.
- macOS/Windows 차이는 capability 값으로만 받는다.

#### 2. Electron preload / IPC

역할:

- 캡처 제어 API 노출
- 상태 조회
- 최근 flow/event 스트림 구독

추가 대상:

- [src/shared/contracts/channels.ts](/Users/sejoungkim/SystemScope/src/shared/contracts/channels.ts)
- [src/shared/contracts/systemScope.ts](/Users/sejoungkim/SystemScope/src/shared/contracts/systemScope.ts)
- [src/preload/createIpcApi.ts](/Users/sejoungkim/SystemScope/src/preload/createIpcApi.ts)
- [src/main/ipc/networkCapture.ipc.ts](/Users/sejoungkim/SystemScope/src/main/ipc/networkCapture.ipc.ts)

#### 3. Electron main service

새 파일 권장:

- [src/main/services/networkCapture.ts](/Users/sejoungkim/SystemScope/src/main/services/networkCapture.ts)

역할:

- helper 프로세스 제어
- 상태 머신 관리
- 이벤트 버퍼 관리
- 최근 N개 flow 저장
- renderer로 push 전달
- capability 감지

이 레이어는 UI 친화적인 공용 모델을 유지해야 합니다.

#### 4. macOS helper

권장 신규 디렉터리:

- `mac/NetworkCaptureHost/`

구성:

- macOS host app 또는 launch helper
- Network Extension target
- shared model

역할:

- Network Extension 설치/활성화
- extension lifecycle 제어
- Electron main과 IPC/XPC/Unix socket 통신

#### 5. Network Extension

후보는 3가지입니다.

### A. Content Filter (`NEFilterDataProvider`)

장점:

- flow 관찰 관점엔 자연스럽다.

단점:

- 일반 배포 앱 경로로는 제약이 크다.
- supervised device 관련 제약이 있어 개인용 mac 앱에 바로 맞지 않을 수 있다.

판단:

- PoC용으론 볼 수 있지만, 일반 배포 제품의 1순위로는 비추천.

### B. Transparent Proxy / App Proxy

장점:

- flow 메타데이터 수집과 사용자 공간 처리에 현실적이다.
- 1차 목표인 연결 모니터링에 더 가깝다.

단점:

- 구현 난이도는 여전히 높다.
- HTTP 본문 분석까지 가려면 별도 프록시 처리 설계가 필요하다.

판단:

- macOS 1차 권장안.

### C. Packet Tunnel

장점:

- 가장 강력하다.

단점:

- VPN/터널 제품에 가까워진다.
- 구현 범위와 UX 부담이 커진다.

판단:

- 1차엔 과하다.

## macOS 1차 권장안

### 선택

- `Transparent Proxy` 또는 `App Proxy` 계열을 우선 검토
- 목표는 `flow metadata capture`

### 왜 이 선택이 맞는가

- 현재 앱의 [processNetworkMonitor.ts](/Users/sejoungkim/SystemScope/src/main/services/processNetworkMonitor.ts) 는 `nettop` 기반 추정치입니다.
- 여기서 바로 HTTPS 본문까지 해석하려 하면 범위가 너무 커집니다.
- 먼저 “어떤 프로세스가 어디와 얼마나 통신하는가”를 안정적으로 보여주는 것이 제품 가치가 큽니다.

## 데이터 모델 권장

새 타입 파일 권장:

- `src/shared/types/networkCapture.ts`

핵심 타입:

```ts
export interface NetworkCaptureCapability {
  supported: boolean
  platform: 'mac' | 'win' | 'linux'
  mode: 'none' | 'metadata' | 'http_proxy'
  requiresInstall: boolean
  requiresApproval: boolean
  canInspectBodies: boolean
}

export interface NetworkFlowSummary {
  id: string
  pid: number | null
  processName: string | null
  direction: 'outbound' | 'inbound'
  protocol: 'tcp' | 'udp' | 'dns' | 'http' | 'https' | 'ws' | 'other'
  host: string | null
  ip: string | null
  port: number | null
  startedAt: number
  endedAt: number | null
  durationMs: number | null
  rxBytes: number
  txBytes: number
  status: 'open' | 'closed' | 'failed'
}

export interface HttpTransaction {
  flowId: string
  url: string
  method: string
  statusCode: number | null
  requestHeaders?: Record<string, string>
  responseHeaders?: Record<string, string>
  startedAt: number
  endedAt: number | null
}
```

원칙:

- 1차는 `NetworkFlowSummary` 중심
- `HttpTransaction`은 optional
- UI는 `NetworkFlowSummary[]`만으로도 먼저 완성 가능

## IPC 설계

권장 채널:

- `NETWORK_CAPTURE_GET_CAPABILITY`
- `NETWORK_CAPTURE_GET_STATUS`
- `NETWORK_CAPTURE_START`
- `NETWORK_CAPTURE_STOP`
- `NETWORK_CAPTURE_CLEAR`
- `NETWORK_CAPTURE_LIST_RECENT`
- `EVENT_NETWORK_CAPTURE_UPDATE`

`SystemScopeApi`에 추가할 함수 예:

```ts
getNetworkCaptureCapability(): Promise<AppResult<NetworkCaptureCapability>>
getNetworkCaptureStatus(): Promise<AppResult<NetworkCaptureStatus>>
startNetworkCapture(): Promise<AppResult<boolean>>
stopNetworkCapture(): Promise<AppResult<boolean>>
clearNetworkCapture(): Promise<AppResult<boolean>>
listRecentNetworkFlows(limit?: number): Promise<AppResult<NetworkFlowSummary[]>>
onNetworkCaptureUpdate(callback: (data: unknown) => void): () => void
```

## 메인 프로세스 서비스 설계

권장 책임:

1. helper availability 확인
2. extension 설치/연결 상태 확인
3. capture on/off 제어
4. 최근 flow ring buffer 관리
5. renderer 구독자 broadcast
6. fallback 상태 제공

상태 예:

```ts
type NetworkCaptureStatus =
  | { state: 'unsupported' }
  | { state: 'available'; running: false }
  | { state: 'starting' }
  | { state: 'running'; flowCount: number }
  | { state: 'error'; message: string }
```

## Helper와 Electron main 통신

후보:

- Unix domain socket
- localhost loopback HTTP
- XPC bridge

권장 순서:

1. 개발 초기: localhost loopback 또는 Unix socket
2. 제품 단계: XPC 또는 더 엄격한 로컬 IPC

판단:

- Electron과 helper 사이만 보면 Unix socket이 단순하고 구현 난이도가 적절하다.
- extension과 host 사이까지 포함하면 XPC가 더 macOS답지만 초기 진입 비용이 크다.

## UI 제안

### 1차 UI 위치

가장 자연스러운 위치:

- `DevTools` 탭 내부 새 섹션
또는
- `Activity` 아래 별도 `Network Capture`

권장:

- 1차는 `DevTools` 탭에 넣는다.
- 현재 `Port Finder`, `Port Watch`, `Processes`와는 성격이 다르기 때문이다.

### 화면 구성

#### 상단 제어 바

- Start / Stop
- Clear
- 상태 배지
- 총 flow 수
- 검색
- 프로세스 필터

#### 좌측 메인 리스트

- 시간
- 프로세스
- 호스트
- 프로토콜
- 송수신량
- duration
- 상태

#### 우측 detail pane

- flow 기본 정보
- DNS / TCP / TLS metadata
- HTTP 정보가 있으면 request/response

#### 최소폭 대응

- 좁은 폭에서는 detail pane을 drawer 또는 stacked card로 전환
- 리스트 우선, detail 후순위

## 기존 코드와의 관계

[processNetworkMonitor.ts](/Users/sejoungkim/SystemScope/src/main/services/processNetworkMonitor.ts) 는 그대로 유지하는 편이 좋습니다.

이유:

- 기존 `Activity` / `Dashboard`가 쓰는 lightweight usage monitor와
- 새 네트워크 캡처 기능은 목적이 다릅니다.

권장 분리:

- 기존 `getNetworkUsage()`는 유지
- 새 `networkCapture` 기능은 별도 IPC와 별도 탭으로 제공

즉, 새 기능이 기존 네트워크 사용량 기능을 바로 대체하지 않게 합니다.

## 패키징 / 배포 이슈

이 기능은 코드보다 서명/entitlement/배포 준비가 더 어렵습니다.

필요 항목:

- Apple Developer 계정
- Network Extension entitlement
- macOS code signing
- helper / extension bundle 포함
- 배포용 notarization 점검

현재 `electron-builder` 설정은 일반 Electron 앱 기준입니다.

- [package.json](/Users/sejoungkim/SystemScope/package.json)

즉, mac helper와 extension을 포함하는 빌드 파이프라인을 별도 추가해야 합니다.

권장:

- 1차는 로컬 개발용/manual packaging으로 검증
- 2차에 `electron-builder` 통합

## Windows 확장 전략

Renderer / IPC / shared types는 그대로 유지하고 collector만 교체합니다.

구조:

- `src/main/services/networkCapture.ts` 공용 오케스트레이터
- `src/main/services/networkCapture.mac.ts`
- `src/main/services/networkCapture.win.ts`

Windows 후보:

- WFP 기반 helper
- WinDivert/Npcap 기반 capture

원칙:

- UI는 platform-neutral
- `capability.mode`와 `supported features`만 플랫폼별로 다르게 노출

## 단계별 구현 순서

### Phase 0. 설계 정리

- shared types 추가
- IPC contract 추가
- renderer mock data로 UI 먼저 구축

### Phase 1. mac skeleton

- `networkCapture` main service 추가
- IPC handler 추가
- UI 기본 화면 추가
- 아직 실제 helper 없이 mock capability/state 반환

### Phase 2. mac helper PoC

- `mac/NetworkCaptureHost/` 생성
- host + extension 최소 프로젝트 생성
- Electron main과 helper 간 IPC 연결
- flow metadata 1건 이상 수집 확인

### Phase 3. live list integration

- recent flows streaming
- ring buffer / filtering / detail pane
- start/stop/clear 제어 연결

### Phase 4. packaging

- signing
- entitlements
- local install flow
- 오류 메시지/권한 안내 정리

### Phase 5. Windows

- 같은 타입/IPC 유지
- collector만 Windows 구현으로 추가

## 구현 시 피해야 할 것

- 처음부터 HTTP body 캡처까지 욕심내는 것
- 기존 `processNetworkMonitor`를 바로 갈아엎는 것
- Renderer가 macOS-specific 상태를 직접 해석하게 두는 것
- Content Filter 제약을 검증하지 않고 제품 방향을 확정하는 것
- helper 없이 Electron main에서 모든 걸 하려는 것

## 이 레포 기준 추천 파일 추가 목록

- `docs/network-capture-architecture.ko.md`
- `src/shared/types/networkCapture.ts`
- `src/main/services/networkCapture.ts`
- `src/main/ipc/networkCapture.ipc.ts`
- `src/renderer/src/features/devtools/NetworkCapturePanel.tsx`
- `src/renderer/src/stores/useNetworkCaptureStore.ts`

mac 전용 프로젝트:

- `mac/NetworkCaptureHost/`
- `mac/NetworkCaptureHost/NetworkCaptureHost.xcodeproj`

## 최종 권장안

1. Electron은 유지한다.
2. macOS 1차는 `flow metadata capture`만 구현한다.
3. `Content Filter`보다 `transparent proxy / app proxy` 계열을 우선 검토한다.
4. 기존 `getNetworkUsage()`와는 별도 기능으로 설계한다.
5. UI/IPC/타입을 먼저 플랫폼 중립적으로 만든 뒤 mac helper를 붙인다.

## 참고

Apple 문서:

- `NETunnelProvider`: https://developer.apple.com/documentation/networkextension/netunnelprovider?language=objc
- `NEFilterManager`: https://developer.apple.com/documentation/networkextension/nefiltermanager?language=objc
- `NEFilterDataProvider`: https://developer.apple.com/documentation/networkextension/nefilterdataprovider

주의:

- `NEFilter*` 계열의 일반 배포 가능 범위와 supervised 제약은 Apple 정책 변경 가능성이 있으므로 실제 착수 전 다시 확인해야 합니다.
- 위 판단 중 `Content Filter` 배포 제약에 대한 부분은 Apple 문서와 일반적인 macOS 제품 제약을 바탕으로 한 구현 판단입니다.
