# 자동 업데이트 구현 계획

## 현재 상황

- 배포 채널: GitHub Releases
- 코드 서명: 없음
- 패키징: electron-builder (macOS .dmg / Windows NSIS)

## 제약 사항

| OS | 코드 서명 없이 자동 업데이트 | 비고 |
|---|---|---|
| macOS | 불가 | Apple 코드 서명 + 노타리제이션 필수 |
| Windows | 가능하지만 SmartScreen 경고 | EV 코드 서명 권장 |

## Phase 1: 수동 업데이트 알림 (코드 서명 없이 가능)

GitHub Releases API로 새 버전을 감지하고 앱 내 알림으로 안내한다.

### 구현 항목

#### Main 프로세스

- [ ] `src/main/services/updateChecker.ts` 생성
  - GitHub API `GET /repos/sejoung/SystemScope/releases/latest` 호출
  - 응답의 `tag_name`과 현재 `app.getVersion()` 비교
  - semver 비교 로직 (major.minor.patch)
  - 네트워크 실패 시 무시 (silent fail)
  - 체크 주기: 앱 시작 시 1회 + 이후 6시간마다

- [ ] IPC 채널 추가
  - `update:check` — 수동 체크 트리거
  - `update:getStatus` — 현재 업데이트 상태 조회
  - `event:updateAvailable` — 새 버전 발견 시 렌더러에 push

- [ ] 응답 타입 정의 (`shared/types/update.ts`)
  ```typescript
  interface UpdateInfo {
    currentVersion: string
    latestVersion: string
    hasUpdate: boolean
    releaseUrl: string      // GitHub Releases 페이지 URL
    releaseNotes: string    // 릴리즈 노트 (markdown)
    publishedAt: string     // 릴리즈 날짜
  }
  ```

#### Preload

- [ ] `checkForUpdate()` — 수동 체크
- [ ] `getUpdateStatus()` — 상태 조회
- [ ] `onUpdateAvailable(callback)` — 이벤트 리스너

#### Renderer

- [ ] `useUpdateStore.ts` — Zustand 스토어
  - `updateInfo: UpdateInfo | null`
  - `checking: boolean`
  - `dismissed: boolean`

- [ ] 업데이트 알림 UI (2개 위치)
  - **Dashboard 상단 배너**: "새 버전 v1.2.0이 있습니다 [Download] [Dismiss]"
  - **Settings 페이지 섹션**: 현재 버전, 최신 버전, 체크 버튼, 릴리즈 노트

- [ ] Download 버튼 클릭 시
  - `shell.openExternal(releaseUrl)` — main에서 URL 검증 후 브라우저 열기
  - 가이드라인 6.3: GitHub URL만 허용 (화이트리스트)

#### 가이드라인 준수 사항

- [ ] 외부 URL은 main에서 검증 후 열기 (6.3)
  - `https://github.com/sejoung/SystemScope/releases` 패턴만 허용
- [ ] 네트워크 실패를 기본 시나리오로 처리 (3.3)
- [ ] 사용자용 메시지와 개발자 로그 분리 (7.2)

### 테스트

- [ ] 버전 비교 로직 단위 테스트 (semver)
- [ ] GitHub API 응답 파싱 테스트
- [ ] 네트워크 실패 시 graceful 처리 테스트

---

## Phase 2: 자동 업데이트 (코드 서명 확보 후)

코드 서명을 확보하면 electron-updater로 전환한다.

### 선행 조건

- [ ] Apple Developer Program 가입 ($99/년)
- [ ] macOS 코드 서명 인증서 발급 (Developer ID Application)
- [ ] macOS 노타리제이션 설정
- [ ] Windows 코드 서명 인증서 확보 (선택)

### 구현 항목

- [ ] `electron-updater` 설치
- [ ] `package.json` build 설정에 publish 추가
  ```json
  "publish": {
    "provider": "github",
    "owner": "sejoung",
    "repo": "SystemScope"
  }
  ```
- [ ] electron-builder 코드 서명 설정
  ```json
  "mac": {
    "identity": "Developer ID Application: ...",
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "notarize": true
  }
  ```
- [ ] `updateChecker.ts`를 electron-updater 기반으로 교체
  - `autoUpdater.checkForUpdates()`
  - `autoUpdater.on('update-available', ...)`
  - `autoUpdater.on('download-progress', ...)`
  - `autoUpdater.on('update-downloaded', ...)`
- [ ] 업데이트 UX 개선
  - 다운로드 진행률 표시
  - "지금 재시작" / "나중에" 선택
  - 앱 종료 시 자동 설치
- [ ] CI/CD 파이프라인
  - GitHub Actions에서 빌드 + 서명 + 노타리제이션 + Release 발행
  - macOS: `CSC_LINK`, `CSC_KEY_PASSWORD` 시크릿
  - `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` 시크릿

### 테스트

- [ ] 패키징된 앱에서 업데이트 플로우 smoke 테스트
- [ ] 다운로드 중단/재시도 테스트
- [ ] 롤백 시나리오 확인

---

## Phase 3: CI/CD 자동 배포

- [ ] GitHub Actions 워크플로우 (`release.yml`)
  - `v*` 태그 push 시 자동 빌드
  - macOS (arm64 + x64) 빌드
  - Windows (x64) 빌드
  - GitHub Release 자동 생성 + 아티팩트 업로드
- [ ] 버전 관리
  - `npm version patch/minor/major` → 태그 push → 자동 빌드/배포

---

## 요약

| Phase | 코드 서명 | 방식 | 예상 난이도 |
|-------|----------|------|------------|
| 1 | 불필요 | GitHub API → 앱 내 알림 → 브라우저 다운로드 | 낮음 |
| 2 | 필수 | electron-updater → 앱 내 자동 다운로드/설치 | 중간 |
| 3 | 필수 | GitHub Actions → 자동 빌드/배포 | 중간 |
