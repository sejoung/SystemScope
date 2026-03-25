# SystemScope Senior Code Review Checklist

검토 일시: 2026-03-25

## 검토 범위

- Electron main / preload / renderer 전체 구조
- IPC 경계, 외부 명령 실행, 파일 삭제/열기, 실시간 폴링, 로깅, 설정 동기화
- 실행 검증: `npm run typecheck`, `npm run lint`, `npm test`

## 현재 상태 요약

- 타입체크 통과
- 린트 통과
- 테스트 통과: 39 files, 156 tests
- 즉시 깨지는 치명적 결함은 보이지 않음
- 다만 운영 중 성능 저하, 장애 은닉, 타입 드리프트로 이어질 수 있는 구조적 이슈가 있음

## P1. 우선 수정

- [x] 프로세스 조회 캐시를 "TTL 캐시"가 아니라 "in-flight dedupe + TTL 캐시"로 바꿀 것  
  근거: `src/renderer/src/App.tsx:160`, `src/main/services/processMonitor.ts:9`  
  현재는 `Promise.all()`로 `getAllProcesses`, `getTopCpuProcesses`, `getTopMemoryProcesses`를 동시에 호출하고, `getCachedProcesses()`는 진행 중 요청을 공유하지 않습니다. 캐시가 비어 있는 순간에는 `si.processes()`가 3번 병렬 호출될 수 있어 polling 비용이 불필요하게 커집니다.

- [x] `processMonitor`의 정렬 로직이 캐시 원본 배열을 직접 mutate하지 않도록 수정할 것  
  근거: `src/main/services/processMonitor.ts:20`, `src/main/services/processMonitor.ts:28`, `src/main/services/processMonitor.ts:36`  
  `data.list.sort(...)`가 공유 캐시를 직접 바꾸고 있어, 호출 순서에 따라 내부 상태가 흔들립니다. `toSorted()` 또는 복사 후 정렬로 바꾸는 편이 안전합니다.

## P2. 높은 우선순위

- [x] renderer 초기화/조회 실패를 전부 삼키지 말고, 사용자 피드백 또는 로깅을 남길 것  
  근거: `src/renderer/src/App.tsx:62`, `src/renderer/src/App.tsx:169`, `src/renderer/src/pages/SettingsPage.tsx:52`, `src/renderer/src/pages/AboutPage.tsx:19`  
  현재 여러 `catch(() => {})`가 실패를 완전히 숨깁니다. 설정 로드 실패, 정보 패널 공백, 프로세스 목록 미갱신이 발생해도 원인 파악이 어렵습니다. 최소한 toast, fallback UI, `logRendererError` 중 하나는 있어야 합니다.

- [x] settings IPC 계약을 `Record<string, unknown>`에서 명시적 타입으로 승격할 것  
  근거: `src/shared/contracts/systemScope.ts:118`, `src/renderer/src/App.tsx:68`, `src/renderer/src/pages/SettingsPage.tsx:57`, `src/renderer/src/pages/AboutPage.tsx:22`  
  현재 반환 타입이 느슨해서 renderer 쪽에서 반복 캐스팅과 수동 검증을 합니다. 설정 스키마가 바뀌면 컴파일 타임에 못 잡고 런타임 드리프트가 생깁니다. `AppSettings` 기반 DTO를 공유 계약으로 노출하는 편이 맞습니다.

- [x] 설정/소개 페이지의 부트스트랩 로직을 공통 훅 또는 store bootstrap으로 통합할 것  
  근거: `src/renderer/src/App.tsx:62`, `src/renderer/src/pages/SettingsPage.tsx:52`, `src/renderer/src/pages/AboutPage.tsx:19`  
  같은 설정 로딩 로직이 여러 군데 중복되어 있고 각자 캐스팅/예외처리를 다르게 합니다. 유지보수 시 한쪽만 수정되는 drift 위험이 큽니다.

## P3. 중간 우선순위

- [x] `Promise.race` 타임아웃에 대한 정리(cleanup) 로직을 넣을 것  
  근거: `src/main/services/growthAnalyzer.ts:54`, `src/main/services/growthAnalyzer.ts:187`  
  타임아웃 핸들을 해제하지 않아 스냅샷 작업이 빨리 끝나도 타이머는 만료 시점까지 남습니다. 장시간 실행 시 불필요한 타이머 누적과 shutdown 타이밍 노이즈를 만들 수 있습니다.

- [x] access log를 synchronous file I/O에서 비동기/버퍼링 방식으로 전환할 것  
  근거: `src/main/services/logging.ts:193`  
  `appendFileSync`는 main process를 직접 막습니다. 지금은 트래픽이 낮아도 액션 로그가 늘어날수록 IPC 응답성과 UI 체감에 영향을 줄 수 있습니다.

- [x] tray 갱신 시 메뉴를 매번 재생성하지 말고 변경이 있을 때만 갱신할 것  
  근거: `src/main/app/tray.ts:45`, `src/main/app/tray.ts:95`, `src/main/app/tray.ts:101`  
  2초마다 CPU 툴팁 갱신과 함께 전체 메뉴를 다시 만드는 구조입니다. update 상태가 바뀔 때만 메뉴를 다시 만들고, 평소에는 title/tooltip만 바꾸는 편이 낫습니다.

## P4. 낮은 우선순위

- [ ] 휴지통 확인 다이얼로그에서 디렉터리 크기 계산 방식을 명확히 할 것  
  근거: `src/main/services/trashService.ts:28`, `src/main/services/trashService.ts:40`  
  현재 `fs.stat()` 크기를 사용하므로 폴더는 실제 사용량과 크게 다를 수 있습니다. 사용자가 보는 삭제 예상 용량이 부정확해질 수 있습니다.

- [ ] 스타일/포맷 일관성을 정리할 것  
  근거: `src/preload/index.ts:1`, `src/preload/createIpcApi.ts:1`, `src/renderer/src/pages/SettingsPage.tsx:1`  
  싱글/더블 쿼트, 세미콜론 사용 여부가 섞여 있습니다. 기능 결함은 아니지만 코드베이스 일관성과 리뷰 비용에 영향을 줍니다.

## 권장 작업 순서

1. 프로세스 조회 in-flight dedupe 추가
2. renderer 예외 처리 표준화
3. settings shared contract 타입 고정
4. growth/logging/tray 성능성 개선
5. UX/스타일 정리

## 리뷰 메모

- 테스트 커버리지는 준수한 편입니다.
- 다만 이번 리뷰에서 잡힌 항목은 "테스트로 안 깨지지만 실제 운영에서 비용이 커지는 코드"에 가깝습니다.
- 다음 리뷰 사이클에서는 IPC contract test와 renderer bootstrap failure test를 추가하는 것을 권장합니다.
