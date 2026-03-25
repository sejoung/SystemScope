# SystemScope 코드 리뷰 체크리스트

> 시니어 개발자 관점에서 전체 코드베이스를 리뷰한 결과입니다.
> 리뷰 일자: 2026-03-25

---

## 1. 보안 (Security)

- [ ] **[CRITICAL]** `systemMonitor.ts:127-129` — `bash -c`를 사용한 파이프 명령이 `execFile`의 쉘 인젝션 방어를 우회함. 두 개의 별도 `runExternalCommand` 호출로 분리하고 Node 스트림으로 파이프할 것
- [ ] **[HIGH]** `installedApps.mac.ts:88-98` — `osascript`에 `appPath`를 전달할 때 `.app` 번들 검증 없음. AppleScript 인젝션 위험
- [ ] **[MEDIUM]** `systemMonitor.ts:132` — `JSON.parse(stdout)` 결과에 대한 스키마 검증 없이 `diskutil` 출력을 신뢰
- [ ] **[MEDIUM]** `windowState.ts:18-19` — `JSON.parse(data) as WindowState` 파싱 후 검증 없음. 손상된 파일로 예기치 않은 윈도우 상태 발생 가능
- [ ] **[MEDIUM]** `settingsSchema.ts:70-88` — `validatePartialSettings`가 알 수 없는 키를 거부하지 않음 (prototype pollution 가능성)

---

## 2. 레이스 컨디션 (Race Conditions)

- [ ] **[MEDIUM]** `snapshotStore.ts:46-48, 82-87` — `loadSnapshots()`가 `cachedSnapshots`의 가변 참조를 반환. `saveSnapshot`의 `push`로 인한 동시 접근 문제
- [ ] **[LOW]** `disk.ipc.ts:322-343` — `registeredTrashTargets` TOCTOU: 조회와 삭제 사이에 캐시 무효화 가능
- [ ] **[LOW]** `process.ipc.ts:118-124` — 프로세스 kill 시 PID 재사용 TOCTOU (이름 비교로 완화되었으나 완벽하지 않음)

---

## 3. 메모리 누수 / 리소스 관리 (Memory Leaks / Resource Management)

- [ ] **[MEDIUM]** `jobManager.ts:16-28` — `pending` 상태로 남은 작업이 `jobs` Map에서 정리되지 않음. `cancelAllJobs`도 `running`만 정리
- [ ] **[MEDIUM]** `PortWatch.tsx:176-179` — `monitoring`이 `false`일 때도 `setInterval`이 활성 상태 (no-op 콜백). delay를 `null`로 설정해야 함
- [ ] **[LOW]** `alertManager.ts:8` — `lastFired` Map이 USB 드라이브 mount/unmount 사이클에서 무한 증가
- [ ] **[LOW]** `installedApps.ts:37-39` — `installedAppsCache` 등 캐시가 TTL 없이 무기한 유지

---

## 4. 에러 처리 (Error Handling)

- [ ] **[MEDIUM]** `useDiskStore.ts:80-88, 93-103` — `fetchUserSpace`, `fetchGrowthView` async 메서드에 try/catch 없음. IPC 실패 시 `loading`이 영원히 `true`
- [ ] **[MEDIUM]** `usePortFinderStore.ts:38-59` — `fetchPorts`에 try/catch 없음. 같은 문제
- [ ] **[MEDIUM]** `diskInsights.ts:76-78, 118-120, 195-197` — 다수의 `catch {}` 블록이 에러를 완전히 삼킴. 디버깅 불가
- [ ] **[LOW]** `aboutWindow.ts:60-64` — `loadURL`/`loadFile` 프로미스를 `void`로 무시. 로딩 실패 시 빈 화면
- [ ] **[LOW]** `disk.ipc.ts:70-111` — `win.isDestroyed()` 시 작업 상태가 `running`으로 영원히 남음
- [ ] **[LOW]** `App.tsx:65, 131` — `.catch(() => {})` 패턴으로 초기 설정/폴링 에러 삼킴

---

## 5. 성능 (Performance)

- [ ] **[MEDIUM]** `logging.ts:201` — `appendFileSync`로 모든 IPC 호출마다 메인 스레드 블로킹
- [ ] **[MEDIUM]** `logging.ts:112,120` / `windowState.ts:18,35` / `snapshotStore.ts:55` — 시작 경로에서 동기 파일 I/O
- [ ] **[MEDIUM]** `useI18n.ts` — 매 렌더링마다 새 `{ locale, t, tk }` 객체/함수 참조 생성. `useMemo`로 감싸야 전체 앱 불필요한 리렌더링 방지
- [ ] **[MEDIUM]** `useSystemStore.ts:17-18` — `pushStats`가 매번 배열 스프레드로 새 배열 생성 (1-2초 간격). 링 버퍼 사용 권장
- [ ] **[LOW]** `dockerImages.ts:53-62` — `listDockerImages`에서 이미지/컨테이너 조회를 순차 실행. `Promise.all` 사용 가능
- [ ] **[LOW]** `dockerImages.ts:93-124, 159-190` — Docker 이미지/컨테이너 삭제를 순차 for loop로 실행. 병렬화 가능
- [ ] **[LOW]** `diskInsights.ts:128-138` — `findDuplicates`의 전체 파일 해싱이 순차적. 제한적 병렬 처리 필요
- [ ] **[LOW]** `PortFinder.tsx:88-90, 275-289` — 필터 카운트가 `useMemo` 없이 매 렌더링마다 재계산

---

## 6. 타입 안전성 (Type Safety)

- [ ] **[MEDIUM]** `ipc.ts:15-16` — `AppResult.ok`이 `boolean`으로 정의됨. `{ ok: true; data: T } | { ok: false; error: AppError }` 판별 유니온 타입으로 변경 필요
- [ ] **[MEDIUM]** 다수 파일에서 `JSON.parse(...) as T` 패턴으로 런타임 검증 없이 타입 단언 (`settings.ipc.ts:30`, `dockerImages.ts:350`, `windowState.ts:19`)
- [ ] **[MEDIUM]** IPC 핸들러가 TypeScript 타입에만 의존하고 런타임에 파라미터 일부만 검증 (`process.ipc.ts:70` 등)
- [ ] **[LOW]** `helpers.ts:29` — `invokeWithRequestId`의 `channel` 파라미터가 `string`으로 아무 채널이나 허용. `IPC_CHANNELS` 값으로 제한 필요
- [ ] **[LOW]** `formatBytes.ts:3,7` — 음수 입력 시 `'0 B'` 반환, PB 이상 값에서 `undefined` 단위 발생

---

## 7. 코드 중복 (Code Duplication)

- [ ] **[MEDIUM]** `installedApps.mac.ts:232-248` / `installedApps.windows.ts:365-381` — `dedupeByPath`, `dedupeLeftoverByPath`, `createRelatedDataItem` 함수가 완전 동일하게 중복. 공유 유틸리티로 추출
- [ ] **[MEDIUM]** `systemMonitor.ts:124-151` / `userSpace.ts:107-123` — APFS 컨테이너 정보를 두 가지 방식(JSON vs regex)으로 중복 조회. 통합 필요
- [ ] **[MEDIUM]** Renderer 공통 컴포넌트 중복:
  - `EmptyState`: DockerImages / DockerBuildCache / DockerContainers / DockerVolumes (4곳)
  - `Badge`: DockerImages / DockerContainers / DockerVolumes (3곳)
  - `PageTab`: DiskAnalysisPage / DockerPage / ProcessPage (3곳)
  - `StateBadge`: PortFinder / PortWatch (2곳)
  - 테이블 스타일 상수 (`thStyle`, `tdStyle`, `rowStyle`): 6개 파일에서 반복
- [ ] **[LOW]** `PortFinder.tsx:439` `formatEndpoint` / `portWatchUtils.ts:48` `formatPortAddress` — 거의 동일한 함수
- [ ] **[LOW]** `DockerOverview.tsx:210` — `formatCompactBytes` 별도 정의. 기존 `formatBytes` 유틸과 통합

---

## 8. 접근성 (Accessibility)

- [ ] **[MEDIUM]** `ConfirmDialog.tsx` — focus trap 없음. `aria-modal="true"`이지만 Tab으로 다이얼로그 밖으로 이동 가능. Escape 키 핸들러도 없음
- [ ] **[MEDIUM]** 클릭 가능한 `<div>`에 키보드 지원 없음:
  - `GrowthView.tsx:188-196` — `FolderRow`
  - `YourStorage.tsx:158-169` — 행 클릭
  - `RecentGrowth.tsx:79-89` — 항목 클릭
  - `FileInsights.tsx:397` — 그룹 헤더 클릭
- [ ] **[LOW]** `GaugeChart.tsx` / `TreemapChart.tsx:70` — SVG에 `role="img"`, `aria-label` 없음
- [ ] **[LOW]** `DockerImages.tsx:115` / `DockerContainers.tsx:165` / `DockerVolumes.tsx:119` — "전체 선택" 체크박스에 `aria-label` 없음
- [ ] **[LOW]** `DiskAnalysisPage.tsx:302-346` / `DockerPage` / `ProcessPage` — 탭에 `aria-controls`와 `tabpanel` 역할 누락

---

## 9. 국제화 (i18n)

- [ ] **[MEDIUM]** `portStateStyles.ts` — 툴팁 문자열이 한국어로 하드코딩. i18n 미적용
- [ ] **[LOW]** `DockerContainers.tsx:237,249` — "Stop", "Remove" 버튼 텍스트가 영어 하드코딩
- [ ] **[LOW]** `PortFinder.tsx:188` — `"Scanning..."` 하드코딩
- [ ] **[LOW]** `GrowthView.tsx:10-14` — `PERIOD_LABELS`가 영어 하드코딩 (`'1 Hour'`, `'24 Hours'`, `'7 Days'`)

---

## 10. React 패턴 (React Patterns)

- [ ] **[MEDIUM]** `Toast.tsx:42-67` — `useEffect` 의존성에 `visibleIds` 포함으로 자체 상태 업데이트가 무한 재실행 유발. cleanup에서 타이머 잘못 취소 가능
- [ ] **[LOW]** `DockerImages.tsx:51` / `DockerBuildCache.tsx:39` / `DockerContainers.tsx:53` / `DockerVolumes.tsx:49` / `DockerOverview.tsx:59` — `useEffect` 의존성 배열에 클로저 변수 누락 (`tk`, `showToast` 등)
- [ ] **[LOW]** `QuickScan.tsx:67` — `useMemo` 의존성에 `tk` 누락. 로케일 변경 시 카테고리 라벨 스테일
- [ ] **[LOW]** `PortFinder.tsx:338` — 키 충돌 가능 (peer address/port 미포함)
- [ ] **[LOW]** 여러 컴포넌트에서 인라인 `style={{...}}` 객체가 매 렌더링마다 새로 생성 (RealtimeChart, CpuWidget 등)

---

## 11. 아키텍처 / 설계 (Architecture / Design)

- [ ] **[MEDIUM]** 모듈 레벨 싱글톤 상태가 테스트/라이프사이클 관리를 어렵게 함 (`lastScanResult`, `cachedProcesses`, `thresholds`, `activeAlerts` 등)
- [ ] **[MEDIUM]** Docker 명령에 타임아웃 없음 (`dockerImages.ts:371-373`). 데몬 무응답 시 앱 행업
- [ ] **[LOW]** `i18n.ts:6` — 순환 의존성 회피를 위한 `require()` 사용. DI 또는 이벤트 기반으로 해결 필요
- [ ] **[LOW]** `aboutWindow.ts:81-102` — `readPackageMetadata()`가 매 호출마다 `package.json` 동기 읽기. 캐싱 필요
- [ ] **[LOW]** `growthAnalyzer.ts:197-200` — `restartSnapshotScheduler`가 불필요한 즉시 스냅샷 트리거

---

## 12. 빌드 / 설정 (Build / Config)

- [ ] **[LOW]** `tsconfig.json:12-14` — `declaration`, `declarationMap`, `sourceMap`이 앱(라이브러리 아님)에 불필요한 빌드 아티팩트 생성
- [ ] **[LOW]** `electron.vite.config.ts:10,28,43,47` — `__dirname` 사용. 향후 ESM 마이그레이션 시 호환 불가
- [ ] **[INFO]** `package.json:47` — `react-is`가 직접 의존성으로 등록되어 있으나 직접 import하는 곳이 있는지 확인 필요
- [ ] **[INFO]** `package.json:39` — `engines.node: "24.x"` — Node 22 LTS 사용자 배제

---

## 13. 테스트 (Testing)

### 13-1. 커버리지 부족

- [ ] **[HIGH]** `systemMonitor.ts` — 핵심 시스템 모니터링 서비스 테스트 없음
- [ ] **[HIGH]** `disk.ipc.ts` — 디스크 IPC 핸들러 (폴더 스캔, 대용량 파일, 확장자, 퀵스캔, 사용자 공간, 성장, 중복 파일) 전체 미테스트
- [ ] **[HIGH]** `system.ipc.ts` — 시스템 통계 IPC 레이어 미테스트
- [ ] **[MEDIUM]** `growthAnalyzer.ts`, `quickScan.ts`, `userSpace.ts`, `oldFileFinder.ts` — 서비스 미테스트
- [ ] **[MEDIUM]** `installedApps.mac.ts`, `installedApps.windows.ts` — 플랫폼별 변형 전용 테스트 없음
- [ ] **[MEDIUM]** `processMonitor.test.ts` — `getNetworkPorts`만 테스트. `getTopCpuProcesses`, `getTopMemoryProcesses`, `getAllProcesses` 미테스트

### 13-2. 테스트 품질 문제

- [ ] **[MEDIUM]** `processIpc.test.ts:274` — `process.platform`을 전역 변경. 실패 시 복원 안 됨. `vi.stubGlobal` 또는 try/finally 사용 필요
- [ ] **[MEDIUM]** `initializeRuntimeSettings.test.ts` — 두 번째 테스트 이름이 "malformed settings fallback"이지만 실제로는 정상 설정 테스트
- [ ] **[LOW]** `channels.test.ts` — TypeScript가 이미 보장하는 것을 런타임에 재검증. 행위 커버리지 없음
- [ ] **[LOW]** `externalCommand.test.ts` — 에러 클래스 생성자만 테스트. 실제 `runExternalCommand` 함수 미테스트
- [ ] **[LOW]** `trashService.test.ts:40-42` — `targetPath.includes('a')` 문자열 매칭 mock이 취약
- [ ] **[LOW]** `alertManager.test.ts` — CPU/GPU 임계값 알림 미테스트. 쿨다운 만료 시나리오 누락

### 13-3. 누락된 에지 케이스

- [ ] **[LOW]** `diskAnalyzer.test.ts` — 깊은 중첩 폴더, 확장자 없는 파일, 심링크 미테스트
- [ ] **[LOW]** `snapshotStore.test.ts` — 최대 스냅샷 수 제한(트리밍) 미테스트
- [ ] **[LOW]** `trashService.test.ts` — 빈 입력 배열, 전체 실패 시나리오, 경로 검증 미테스트

---

## 14. 데드 코드 (Dead Code)

- [ ] **[LOW]** `systemSubscriptions.ts:17` — `getSystemSubscriberIds()` 내보내기 되었으나 사용처 없음

---

## 요약 (Summary)

| 심각도 | 개수 | 주요 카테고리 |
|--------|------|--------------|
| CRITICAL/HIGH | 5 | 보안(커맨드 인젝션), 테스트 커버리지 부족 |
| MEDIUM | 30 | 레이스 컨디션, 메모리 누수, 에러 처리, 성능, 타입 안전성, 코드 중복, 접근성 |
| LOW | 38 | 경미한 설계 문제, 누락된 에지 케이스, 빌드 설정, 국제화 |

### 우선순위 Top 10

1. `bash -c` 쉘 인젝션 패턴 제거 (`systemMonitor.ts`)
2. `appendFileSync` 메인 스레드 블로킹 해결 (`logging.ts`)
3. Docker 명령 타임아웃 추가 (`dockerImages.ts`)
4. Store async 메서드 try/catch 추가 (loading 상태 영구 잠금 방지)
5. `AppResult` 판별 유니온 타입으로 리팩터링
6. 핵심 서비스 테스트 추가 (`systemMonitor`, `disk.ipc`, `system.ipc`)
7. PortWatch 폴링 누수 수정
8. Toast `useEffect` 무한 루프 수정
9. 공통 컴포넌트 추출 (`EmptyState`, `Badge`, `PageTab` 등)
10. ConfirmDialog 접근성 개선 (focus trap, Escape 키)
