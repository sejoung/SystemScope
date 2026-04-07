# Network Capture Implementation Guide

SystemScope의 네트워크 캡처 기능은 Electron 앱을 유지한 채, 별도 macOS 네이티브 계층을 추가하는 방식으로 구현합니다. 이 문서는 `Network Extension` 기반 macOS 1차 구현과 이후 Windows 확장을 위해 따라야 할 기준을 정리합니다.

## 목적

- Electron 앱을 유지하면서 macOS 네트워크 캡처 기능을 추가한다.
- 1차 구현은 DevTools형 네트워크 모니터링에 필요한 메타데이터 수집을 목표로 한다.
- UI, IPC, 저장 포맷은 플랫폼 중립적으로 설계해 이후 Windows 구현으로 확장한다.

## 기준 파일

- IPC 계약: [src/shared/contracts/systemScope.ts](/Users/sejoungkim/SystemScope/src/shared/contracts/systemScope.ts)
- preload bridge: [src/preload/createIpcApi.ts](/Users/sejoungkim/SystemScope/src/preload/createIpcApi.ts)
- main IPC 등록점: [src/main/ipc/index.ts](/Users/sejoungkim/SystemScope/src/main/ipc/index.ts)
- 기존 네트워크 usage 수집: [src/main/services/processNetworkMonitor.ts](/Users/sejoungkim/SystemScope/src/main/services/processNetworkMonitor.ts)
- 배포 설정: [package.json](/Users/sejoungkim/SystemScope/package.json)

새 구현의 권장 파일:

- `src/shared/types/networkCapture.ts`
- `src/main/services/networkCapture.ts`
- `src/main/ipc/networkCapture.ipc.ts`
- `src/renderer/src/features/devtools/NetworkCapturePanel.tsx`
- `src/renderer/src/stores/useNetworkCaptureStore.ts`
- `mac/NetworkCaptureHost/`

## 현재 구현 상태

아래 표는 현재 레포 기준으로 이미 구현된 항목과 아직 남은 항목을 정리한 것입니다.

| 영역 | 상태 | 비고 |
|------|------|------|
| 공통 타입 `networkCapture.ts` | 완료 | capability, status, recent flow, mock HTTP-like 필드 포함 |
| IPC 채널 추가 | 완료 | `NETWORK_CAPTURE_*`, `EVENT_NETWORK_CAPTURE_UPDATE` |
| preload API 노출 | 완료 | `SystemScopeApi`와 `createIpcApi` 반영 |
| main IPC handler | 완료 | [src/main/ipc/networkCapture.ipc.ts](/Users/sejoungkim/SystemScope/src/main/ipc/networkCapture.ipc.ts) |
| main mock service | 완료 | [src/main/services/networkCapture.ts](/Users/sejoungkim/SystemScope/src/main/services/networkCapture.ts) |
| mock recent flow 누적 | 완료 | recording 중 주기적으로 mock flow append |
| DevTools `Network` 탭 | 완료 | [src/renderer/src/pages/DevToolsPage.tsx](/Users/sejoungkim/SystemScope/src/renderer/src/pages/DevToolsPage.tsx) |
| DevTools형 네트워크 UI | 완료 | table, waterfall, detail tabs, fixed detail pane |
| 검색 / 타입 필터 | 완료 | search, protocol filter, only active |
| `Preserve log` 동작 | 완료 | 끄면 새 recording 시작 시 기존 로그 비움 |
| `Headers` / `Cookies` / `Payload` / `Response` / `Timing` 탭 | 완료 | mock 데이터 기반 |
| 실제 mac helper 연결 | 미구현 | helper/Xcode target 없음 |
| `networkCapture.mac.ts` 분리 | 미구현 | 현재는 main mock service 단일 파일 |
| helper-메인 IPC | 미구현 | Unix socket / XPC 아직 없음 |
| 실제 `Network Extension` capture | 미구현 | mock only |
| Windows collector | 미구현 | capability만 placeholder 수준 |
| HTTPS body inspection | 미구현 | 문서상 2차 범위 |

현재 구현 파일:

- [src/shared/types/networkCapture.ts](/Users/sejoungkim/SystemScope/src/shared/types/networkCapture.ts)
- [src/shared/contracts/systemScope.ts](/Users/sejoungkim/SystemScope/src/shared/contracts/systemScope.ts)
- [src/shared/contracts/channels.ts](/Users/sejoungkim/SystemScope/src/shared/contracts/channels.ts)
- [src/preload/createIpcApi.ts](/Users/sejoungkim/SystemScope/src/preload/createIpcApi.ts)
- [src/main/services/networkCapture.ts](/Users/sejoungkim/SystemScope/src/main/services/networkCapture.ts)
- [src/main/ipc/networkCapture.ipc.ts](/Users/sejoungkim/SystemScope/src/main/ipc/networkCapture.ipc.ts)
- [src/renderer/src/stores/useNetworkCaptureStore.ts](/Users/sejoungkim/SystemScope/src/renderer/src/stores/useNetworkCaptureStore.ts)
- [src/renderer/src/features/devtools/NetworkCapturePanel.tsx](/Users/sejoungkim/SystemScope/src/renderer/src/features/devtools/NetworkCapturePanel.tsx)
- [src/renderer/src/pages/DevToolsPage.tsx](/Users/sejoungkim/SystemScope/src/renderer/src/pages/DevToolsPage.tsx)

## 기본 원칙

1. 이 기능 때문에 Electron에서 Tauri로 옮기지 않는다.
2. macOS 1차는 HTTP body 분석보다 flow 메타데이터 수집을 우선한다.
3. 기존 `getNetworkUsage()` 경로를 바로 대체하지 않고 별도 기능으로 분리한다.
4. Renderer는 OS 세부사항을 모르고 capability와 상태만 받는다.
5. macOS helper, Electron main, Renderer는 역할을 명확히 나눈다.
6. Windows 구현은 UI 재작성 없이 collector만 교체할 수 있어야 한다.

## 구현 범위

### 1차 목표

수집 대상:

- 프로세스 / 앱 이름
- 원격 호스트 / IP
- 포트
- 프로토콜
- 시작 / 종료 시각
- 송수신 바이트
- 연결 지속 시간
- DNS 질의 여부

이 범위면 “어떤 프로세스가 어디와 얼마나 통신하는가”를 보여주는 DevTools형 리스트 UI를 만들 수 있습니다.

### 2차 목표

추가 대상:

- URL
- Method
- Status
- Request / Response headers
- Body preview

주의:

- HTTPS 상세 캡처는 로컬 프록시와 인증서(MITM) 문제가 뒤따른다.
- 보안과 UX 부담이 커지므로 1차 범위에 포함하지 않는다.

## Electron 유지 원칙

이 기능의 난이도는 프론트엔드 셸이 아니라 아래 항목에서 결정됩니다.

- `Network Extension`
- entitlement
- helper / extension packaging
- Electron main과 native helper 간 통신

즉, Tauri로 옮겨도 핵심 난이도는 그대로입니다. 현재 레포는 이미 Electron IPC 구조가 잘 잡혀 있으므로, 새 기능은 그 위에 올리는 편이 맞습니다.

## 권장 아키텍처

```text
Renderer
  -> preload
  -> Electron IPC
  -> main process networkCapture service
  -> macOS helper bridge
  -> Network Extension / local capture engine
```

규칙:

- Renderer는 flow 목록과 상세 뷰만 담당한다.
- main service는 helper lifecycle과 버퍼를 관리한다.
- helper는 Network Extension과 통신한다.
- Network Extension은 실제 캡처를 담당한다.

## macOS 구현 선택

후보는 3가지입니다.

### A. Content Filter (`NEFilterDataProvider`)

장점:

- flow 관찰 개념에는 잘 맞는다.

단점:

- 일반 배포 앱 기준으로 제약이 크다.
- supervised device 관련 제약 검토가 필요하다.

판단:

- PoC 후보는 되지만 1차 제품 경로의 우선순위는 낮다.

### B. Transparent Proxy / App Proxy

장점:

- flow 메타데이터 수집에 현실적이다.
- 1차 목표에 가장 가깝다.

단점:

- 구현 난이도는 여전히 높다.
- HTTP 상세 분석까지 가려면 프록시 설계를 더 해야 한다.

판단:

- macOS 1차 권장안.

### C. Packet Tunnel

장점:

- 가장 강력하다.

단점:

- VPN 제품에 가까워진다.
- 구현 범위와 UX 부담이 과하다.

판단:

- 1차 범위에는 과하다.

## macOS 1차 권장 방식

- `Transparent Proxy` 또는 `App Proxy` 계열을 우선 검토한다.
- 목표는 `flow metadata capture`다.
- 기존 [processNetworkMonitor.ts](/Users/sejoungkim/SystemScope/src/main/services/processNetworkMonitor.ts) 의 `nettop` 기반 usage 추정과는 별도 기능으로 둔다.

권장 이유:

- 현재 앱은 프로세스별 usage 수집 경로는 이미 있다.
- 여기서 바로 DevTools급 HTTP inspector로 점프하면 범위가 너무 커진다.
- 먼저 연결 흐름을 안정적으로 보여주는 것이 제품 가치가 크다.

## 역할 분리

### 1. Renderer

역할:

- flow list
- detail pane
- filter / search
- waterfall / timeline
- start / stop / clear 제어

규칙:

- Renderer는 `macOS-specific` 상태를 직접 해석하지 않는다.
- capability와 status만 보고 화면을 분기한다.

### 2. preload / IPC

역할:

- 캡처 제어 API 노출
- 상태 조회
- 최근 flow 목록 요청
- 실시간 업데이트 구독

추가 대상:

- [src/shared/contracts/channels.ts](/Users/sejoungkim/SystemScope/src/shared/contracts/channels.ts)
- [src/shared/contracts/systemScope.ts](/Users/sejoungkim/SystemScope/src/shared/contracts/systemScope.ts)
- [src/preload/createIpcApi.ts](/Users/sejoungkim/SystemScope/src/preload/createIpcApi.ts)
- [src/main/ipc/networkCapture.ipc.ts](/Users/sejoungkim/SystemScope/src/main/ipc/networkCapture.ipc.ts)

### 3. Electron main service

권장 파일:

- `src/main/services/networkCapture.ts`

역할:

- helper 프로세스 제어
- capability 감지
- 상태 머신 관리
- 최근 flow ring buffer 관리
- renderer broadcast

현재 상태:

- mock service까지 구현됨
- 실제 helper lifecycle 제어는 아직 없음
- 다음 단계에서 `networkCapture.mac.ts`와 공용 orchestrator 분리가 필요함

### 4. macOS helper

권장 디렉터리:

- `mac/NetworkCaptureHost/`

구성:

- host app 또는 helper
- Network Extension target
- shared model

역할:

- extension 설치 / 활성화
- extension lifecycle 제어
- Electron main과 IPC/XPC/Unix socket 통신

## IPC 설계

권장 채널:

- `NETWORK_CAPTURE_GET_CAPABILITY`
- `NETWORK_CAPTURE_GET_STATUS`
- `NETWORK_CAPTURE_START`
- `NETWORK_CAPTURE_STOP`
- `NETWORK_CAPTURE_CLEAR`
- `NETWORK_CAPTURE_LIST_RECENT`
- `EVENT_NETWORK_CAPTURE_UPDATE`

`SystemScopeApi` 권장 함수:

```ts
getNetworkCaptureCapability(): Promise<AppResult<NetworkCaptureCapability>>
getNetworkCaptureStatus(): Promise<AppResult<NetworkCaptureStatus>>
startNetworkCapture(): Promise<AppResult<boolean>>
stopNetworkCapture(): Promise<AppResult<boolean>>
clearNetworkCapture(): Promise<AppResult<boolean>>
listRecentNetworkFlows(limit?: number): Promise<AppResult<NetworkFlowSummary[]>>
onNetworkCaptureUpdate(callback: (data: unknown) => void): () => void
```

규칙:

- 기존 `getNetworkUsage()`에 옵션을 덧붙이지 않는다.
- 새 기능은 별도 채널과 별도 타입으로 분리한다.
- 실시간 업데이트는 polling보다 push 이벤트를 우선한다.

## 공통 데이터 모델

권장 파일:

- `src/shared/types/networkCapture.ts`

예시:

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
```

규칙:

- 1차는 `NetworkFlowSummary` 중심으로 설계한다.
- HTTP 상세 타입은 optional로 둔다.
- 저장/전송 포맷은 platform-neutral이어야 한다.

현재 상태:

- `NetworkFlowSummary`는 이미 mock HTTP-like 필드까지 포함해 확장됨
- 현재 추가된 optional 필드:
  - `requestPath`
  - `method`
  - `statusCode`
  - `mimeType`
  - `initiator`
  - `scheme`
- 실제 helper 연결 시에도 가능한 한 이 필드 구조를 유지한다

## Helper 통신 방식

후보:

- Unix domain socket
- localhost loopback HTTP
- XPC bridge

권장 순서:

1. 개발 초기: Unix socket 또는 loopback 기반으로 단순하게 시작
2. 제품 단계: 필요시 XPC로 강화

원칙:

- Electron main과 helper 사이의 프로토콜은 JSON event stream으로 단순하게 유지한다.
- renderer는 helper와 직접 통신하지 않는다.

## UI 적용 예시

권장 위치:

- `DevTools` 탭 내부 새 섹션

이유:

- `Port Finder`, `Port Watch`, `Processes`와 성격이 다르다.
- 네트워크 캡처는 개발자용 세션 분석 기능에 더 가깝다.

권장 구조:

1. 상단 control bar
2. 좌측 flow list
3. 우측 detail pane
4. 최소 폭에서는 detail pane을 stacked card 또는 drawer로 전환

상단 control bar 권장 항목:

- Start / Stop
- Clear
- 상태 배지
- 총 flow 수
- 검색
- 프로세스 필터

현재 상태:

- `DevTools` 내 `Network` 탭으로 구현 완료
- 현재 UI는 다음을 포함함:
  - Record / Clear
  - Preserve log
  - Only active
  - search
  - protocol filter
  - request table
  - segmented waterfall
  - fixed detail pane
  - Headers / Cookies / Payload / Response / Timing tabs

남은 UI 작업:

- 상단 summary bar를 더 축약하거나 숨김 가능하게 조정
- request row grouping / sort 개선
- initiator, domain, mime type 기준 추가 필터
- 선택 row 고정 및 keyboard navigation

## 패키징 / 배포 규칙

이 기능은 코드보다 아래 항목 검증이 더 중요합니다.

- Apple Developer 계정
- Network Extension entitlement
- code signing
- helper / extension bundle 포함
- notarization

현재 [package.json](/Users/sejoungkim/SystemScope/package.json) 의 `electron-builder` 설정은 일반 Electron 앱 기준입니다. 따라서 mac helper와 extension을 포함하는 빌드 파이프라인을 별도로 추가해야 합니다.

권장 방식:

- 1차는 로컬 개발용 manual packaging으로 검증
- 2차에 `electron-builder` 통합

## Windows 확장 규칙

구조:

- `src/main/services/networkCapture.ts` 공용 오케스트레이터
- `src/main/services/networkCapture.mac.ts`
- `src/main/services/networkCapture.win.ts`

원칙:

- Renderer / IPC / shared types는 유지한다.
- Windows 구현은 collector만 교체한다.
- 플랫폼 차이는 capability와 status에서만 노출한다.

## 단계별 구현 순서

### Phase 0. 계약 먼저 만들기

- shared types 추가
- IPC 채널 추가
- preload API 추가
- renderer mock UI 추가

상태:

- 완료

### Phase 1. Electron skeleton

- `networkCapture` main service 추가
- `networkCapture.ipc.ts` 추가
- mock capability / status / recent flows 반환

상태:

- 완료

### Phase 2. mac helper PoC

- `mac/NetworkCaptureHost/` 생성
- host + extension 최소 프로젝트 구성
- Electron main과 helper 연결
- flow metadata 1건 이상 수집 확인

상태:

- 미착수

다음 구현 우선순위:

1. `src/main/services/networkCapture.mac.ts` 추가
2. `src/main/services/networkCapture.ts`를 공용 orchestrator로 축소
3. mac capability/status를 mock이 아닌 platform service로 위임
4. `mac/NetworkCaptureHost/README.md` 또는 skeleton 디렉터리 생성

### Phase 3. live integration

- start / stop / clear 연결
- recent flows streaming 연결
- detail pane 연결

상태:

- mock 기준으로는 완료
- 실제 mac helper 연동 기준으로는 미착수

### Phase 4. packaging

- signing
- entitlements
- install / approval flow
- 오류 메시지 정리

상태:

- 미착수

### Phase 5. Windows

- 공통 타입과 IPC 유지
- Windows collector 구현 추가

상태:

- 미착수

## 바로 다음 개발 순서

현재 코드베이스 기준으로 바로 이어서 작업할 순서는 아래가 맞습니다.

1. `networkCapture.mac.ts` 추가
   - mock service 로직과 mac 전용 service 로직을 분리한다.
2. 공용 orchestrator 정리
   - `src/main/services/networkCapture.ts`는 platform dispatch와 buffer 관리만 담당하게 줄인다.
3. mac helper skeleton 추가
   - `mac/NetworkCaptureHost/`
   - 최소 README와 target 구조 문서화
4. helper bridge 계약 추가
   - Unix socket 또는 loopback JSON event stream 포맷 정의
5. renderer capability 상태 확장
   - `helperNotInstalled`, `approvalRequired`, `helperDisconnected` 같은 단계적 상태 추가

지금 시점의 권장 착수 파일:

- `src/main/services/networkCapture.mac.ts`
- `src/main/services/networkCapture.ts`
- `mac/NetworkCaptureHost/README.md`
- `src/shared/types/networkCapture.ts` 상태 enum 보강

## 새 기능 추가 체크리스트

- 새 기능이 기존 `getNetworkUsage()`를 침범하지 않는가
- `SystemScopeApi`에 별도 채널과 함수가 정의됐는가
- shared type이 platform-neutral인가
- helper와 renderer가 직접 연결되지 않았는가
- capability / status / recent flow가 분리됐는가
- mac helper 없이도 mock UI 개발이 가능한가
- packaging 단계가 기능 구현과 분리됐는가
- Windows collector로 확장 가능한 구조인가

## 피해야 할 패턴

- 이 기능 때문에 Tauri로 전환하는 것
- 첫 단계부터 HTTPS body 캡처까지 포함하는 것
- 기존 `processNetworkMonitor`를 즉시 대체하는 것
- Renderer가 macOS-specific 상태를 직접 해석하는 것
- helper 없이 Electron main만으로 모든 캡처를 처리하려는 것
- Content Filter 제약 검증 없이 제품 방향을 고정하는 것

## 참고

Apple 문서:

- `NETunnelProvider`: https://developer.apple.com/documentation/networkextension/netunnelprovider?language=objc
- `NEFilterManager`: https://developer.apple.com/documentation/networkextension/nefiltermanager?language=objc
- `NEFilterDataProvider`: https://developer.apple.com/documentation/networkextension/nefilterdataprovider

주의:

- `NEFilter*` 계열의 일반 배포 가능 범위와 supervised 제약은 실제 착수 시점에 다시 확인해야 한다.
- 위 문서의 `Content Filter` 관련 판단은 Apple 문서와 일반적인 macOS 제품 제약을 바탕으로 한 구현 판단이다.
