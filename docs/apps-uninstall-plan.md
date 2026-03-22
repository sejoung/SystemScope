# 설치 앱 삭제 / 제거 기능 구현 계획

## 목표

SystemScope에 macOS 앱 삭제와 Windows 설치 프로그램 제거 기능을 추가한다.

- macOS: `.app` 번들을 찾아 휴지통으로 이동
- Windows: 설치된 프로그램 목록을 보여주고 제거 명령 또는 시스템 설정 화면으로 연결
- 기존 `Storage`의 파일 정리 기능과 구분되는 별도 경험 제공

이 기능은 "파일 삭제"가 아니라 "설치 앱 관리"에 가깝다. 따라서 UI, IPC, 권한 모델도 별도로 설계해야 한다.

---

## 범위

### 포함

- macOS `/Applications`, `~/Applications` 앱 목록 조회
- macOS `.app` 휴지통 이동
- Windows 설치 프로그램 목록 조회
- Windows 설치 위치 열기
- Windows `Apps & Features` 또는 제거 설정 화면 열기
- 앱/프로그램 제거 전 확인 다이얼로그
- 보호 항목 차단
- 제거 후 목록 새로고침

### 제외

- macOS 앱별 설정/캐시/지원 파일까지 포함한 완전 제거
- Windows 서드파티 제거기별 고급 인자 튜닝
- 다중 단계 제거 마법사 제어
- Microsoft Store 앱 제거

---

## Phase 1

안전한 범위부터 구현한다.

### macOS

- 앱 목록 조회
- `.app` 휴지통 이동
- 설치 위치 열기

### Windows

- 설치 프로그램 목록 조회
- 설치 위치 열기
- 시스템 제거 화면 열기

이 단계에서는 Windows에서 실제 제거 명령 실행보다 "목록 + 시스템 제거 진입"을 먼저 제공하는 것이 안전하다.

---

## Phase 2

Windows 실제 제거를 지원한다.

- `UninstallString` 실행
- `QuietUninstallString` 보조 활용
- MSI / EXE 제거기 분기
- 권한 상승과 실패 처리

이 단계는 예외 처리가 많고 운영 리스크가 커서 별도 검증이 필요하다.

---

## UX 방향

새 메뉴 또는 새 탭으로 분리한다.

권장안:

- 사이드바에 `Apps` 추가
- 또는 `Storage` 하위 탭으로 `Installed Apps` 추가

권장하는 정보:

- 이름
- 버전
- 퍼블리셔
- 설치 위치
- 제거 가능 여부
- 보호 항목 여부

권장 액션:

- `Open`
- `Move to Trash` (macOS)
- `Uninstall` (Windows)
- `Open System Settings`

---

## 데이터 모델

공통 타입 예시:

```ts
export interface InstalledApp {
  id: string
  name: string
  version?: string
  publisher?: string
  installLocation?: string
  launchPath?: string
  uninstallCommand?: string
  quietUninstallCommand?: string
  platform: 'mac' | 'windows'
  uninstallKind: 'trash_app' | 'uninstall_command' | 'open_settings'
  protected: boolean
}
```

권장 추가 응답 타입:

```ts
export interface AppRemovalResult {
  id: string
  name: string
  started: boolean
  completed: boolean
  cancelled: boolean
  message?: string
}
```

---

## 프로젝트 구조

추가 대상:

```text
src/
  main/
    ipc/
      apps.ipc.ts
    services/
      installedApps.ts
  renderer/
    src/
      pages/
        AppsPage.tsx
      stores/
        useAppsStore.ts
  shared/
    contracts/
      channels.ts
    types/
      apps.ts
```

---

## IPC 설계

권장 채널:

- `apps:listInstalled`
- `apps:uninstall`
- `apps:openInFolder`
- `apps:openSystemSettings`

Preload 노출 예시:

- `listInstalledApps()`
- `uninstallApp(appId: string)`
- `openInstalledAppLocation(path: string)`
- `openUninstallSettings()`

---

## macOS 구현 계획

### 목록 조회

대상 경로:

- `/Applications`
- `~/Applications`

필터:

- `.app` 번들만 수집

수집 정보:

- 앱 이름
- 번들 경로
- 번들 ID
- 버전

메타데이터는 `Info.plist`에서 읽거나 번들명으로 fallback 한다.

### 삭제

삭제 방식:

- `.app` 번들을 휴지통 이동

권장 처리:

- 실행 중인지 확인
- 시스템 앱 또는 보호 앱 차단
- 삭제 전 확인 다이얼로그 표시

예외:

- 현재 실행 중인 앱
- `/System/Applications` 등 보호 경로
- 현재 앱 자신

### 로그

- 조회된 앱 수
- 휴지통 이동 성공/실패
- 보호 항목 차단

---

## Windows 구현 계획

### 목록 조회

레지스트리 대상:

- `HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall`
- `HKLM\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall`
- `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall`

수집 정보:

- `DisplayName`
- `DisplayVersion`
- `Publisher`
- `InstallLocation`
- `UninstallString`
- `QuietUninstallString`

필터:

- `DisplayName` 없는 항목 제외
- 시스템 구성 요소나 보호 항목 제외 또는 비활성화

### Phase 1 액션

- 설치 위치 열기
- 시스템 제거 화면 열기

예시:

- `ms-settings:appsfeatures`
- 또는 제어판 제거 화면

### Phase 2 제거

제거 방식:

- `UninstallString` 실행
- MSI는 `msiexec /x ...`
- EXE는 vendor uninstall command 실행

주의:

- UAC 권한 상승 필요 가능성
- 제거 프로세스가 비동기로 오래 걸릴 수 있음
- 앱에서 "제거 완료"보다 "제거 프로세스 시작" 기준으로 응답하는 편이 안전

---

## 보호 정책

반드시 차단해야 할 항목:

- 현재 실행 중인 SystemScope
- macOS 시스템 기본 앱
- Windows 핵심 시스템 구성 요소
- 제거 명령이 비어 있거나 신뢰할 수 없는 항목

권장 정책:

- `protected: true`로 내려서 UI에서 비활성화
- 차단 이유를 사용자에게 표시

---

## UI 계획

### 목록 화면

- 검색창
- 제거 가능/보호됨 필터
- 이름 정렬
- 버전 정렬

### 상세 액션

- `Open`
- `Move to Trash`
- `Uninstall`
- `Open System Settings`

### 상태 처리

- 제거 요청 중 로딩 표시
- 성공 시 목록 새로고침
- 실패 시 토스트
- 취소 시 무음 처리

---

## 안전 기준

- renderer에서 직접 파일 삭제 금지
- renderer에서 직접 명령 실행 금지
- main에서 경로/명령 검증
- 확인 다이얼로그 필수
- 실패를 기본 시나리오로 처리
- 사용자 메시지와 개발자 로그 분리

특히 Windows 제거 명령은 문자열 그대로 실행하지 말고, 파싱/검증 가능한 형태로 다뤄야 한다.

---

## 테스트 계획

### Unit

- macOS `.app` 탐색
- `Info.plist` 파싱
- Windows uninstall entry 파싱
- 보호 항목 판별
- 제거 명령 검증

### Integration

- `apps:listInstalled`
- `apps:uninstall` 입력 검증
- macOS 삭제 성공/실패
- Windows 설정 열기
- Windows 제거 명령 시작

### Renderer

- 검색/필터 동작
- 보호 항목 비활성화
- 제거 후 목록 갱신

---

## 권장 구현 순서

1. `shared/types/apps.ts` 추가
2. `channels.ts`에 apps 채널 추가
3. `installedApps.ts` 생성
4. macOS 앱 목록 조회 구현
5. macOS 휴지통 이동 구현
6. Windows 프로그램 목록 조회 구현
7. Windows 제거 설정 화면 열기 구현
8. `apps.ipc.ts` 연결
9. preload API 추가
10. `AppsPage.tsx` 및 store 추가
11. 테스트 보강
12. README 반영

---

## 권장 출시 순서

### 1차 출시

- macOS 앱 목록 + 휴지통 이동
- Windows 목록 조회 + 설정 열기

### 2차 출시

- Windows 실제 제거 실행
- 보호 규칙 고도화
- 제거 결과 UX 개선

---

## 요약

추천 접근은 아래와 같다.

- macOS는 `.app` 번들 휴지통 이동부터 구현
- Windows는 목록 조회와 설정 진입부터 구현
- 실제 Windows 제거는 다음 단계로 분리

이 순서가 가장 안전하고, 현재 SystemScope 구조에도 자연스럽게 들어간다.
