# SystemScope 기능 구현 로드맵

이 문서는 현재 SystemScope의 구조와 구현 상태를 기준으로, 앞으로 추가하면 제품 가치가 가장 크게 올라가는 기능을 우선순위와 단계별로 정리한 구현 로드맵입니다.

기준:

- 현재 강점: 실시간 모니터링, 디스크 분석, Docker 정리, 프로세스/포트 관리, 앱 정리
- 현재 한계: 장기 히스토리 부족, 원인 진단 자동화 부족, 정리 작업 자동화 부족, 리포트/공유 흐름 부족
- 설계 원칙: 기존 `main/preload/renderer/shared` 구조와 IPC 패턴, Zustand 스토어, job manager를 재사용

## 1. 제품 방향

SystemScope는 단순 모니터링 앱보다 "개발자용 시스템 진단 및 정리 워크벤치"로 가는 편이 맞습니다.

핵심 방향:

1. 현재 상태를 보여준다
2. 왜 문제가 생겼는지 설명한다
3. 무엇을 정리해야 하는지 제안한다
4. 반복 작업을 자동화한다
5. 결과를 기록하고 공유할 수 있게 한다

## 2. 우선순위 원칙

우선순위는 아래 기준으로 정합니다.

1. 기존 데이터와 구조를 재사용할 수 있는가
2. 사용자 체감 가치가 큰가
3. 여러 후속 기능의 기반이 되는가
4. macOS/Windows 양쪽에서 무리 없이 동작하는가
5. 안전하게 출시할 수 있는가

## 3. 단계별 로드맵 개요

| 단계 | 목표 | 핵심 결과 |
|------|------|------|
| Phase 1 | 관측 강화 | 장기 시스템 히스토리, 이벤트 타임라인 |
| Phase 2 | 진단 강화 | 병목 원인 분석, 액션 추천 |
| Phase 3 | 정리 자동화 | 규칙 기반 정리 제안, 예약 실행 |
| Phase 4 | 운영/공유 강화 | 진단 리포트, 세션 저장, 비교 분석 |
| Phase 5 | 고도화 | 플러그인성 확장, 사용자 맞춤 워크플로우 |

## 4. Phase 1: 관측 강화

### 4.1 System Health Timeline

목적:

- 현재 앱의 가장 큰 빈칸인 "과거 상태 추적"을 메운다
- 추후 진단 엔진과 리포트 기능의 기반 데이터를 만든다

사용자 가치:

- "어제 왜 느렸는지"를 확인 가능
- 특정 시간대의 CPU/메모리/디스크 병목 추적 가능
- 알림 발생 시점을 맥락과 함께 확인 가능

구현 범위:

- CPU, 메모리, 디스크 사용률 장기 저장
- 디스크 I/O, 네트워크 throughput 저장
- 24시간 / 7일 / 30일 보기
- 알림 발생 이벤트를 타임라인에 겹쳐 표시
- 시점 클릭 시 당시 상위 프로세스 요약 표시

기술 설계:

- `src/main/services/metricsStore.ts` 추가
- 스냅샷 저장 방식은 `snapshotStore.ts` 패턴 재사용
- 설정에 저장 주기, 보관 기간 추가
- IPC 추가:
  - `getHealthTimeline(range)`
  - `getHealthPointDetail(timestamp)`
- 렌더러 스토어 추가:
  - `useTimelineStore`
- 새 페이지 추가:
  - `TimelinePage`

수용 기준:

- 최근 7일 데이터 조회 가능
- 데이터 누락/손상 시 앱이 중단되지 않음
- 타임라인 렌더링이 대량 포인트에서 버벅이지 않음

### 4.2 Event History

목적:

- 시스템 데이터와 사용자 액션을 같이 기록해 원인 파악을 쉽게 만든다

구현 범위:

- 알림 발생/해제
- 디스크 파일 삭제
- Docker 정리 액션
- 앱 제거 액션
- 설정 변경 로그

기술 설계:

- `src/shared/types/event.ts`
- `src/main/services/eventStore.ts`
- action 실행 지점에서 이벤트 기록
- 타임라인과 대시보드에 최근 이벤트 카드 노출

수용 기준:

- 액션 직후 이벤트가 기록됨
- 실패 액션도 실패 사유와 함께 기록됨

## 5. Phase 2: 진단 강화

### 5.1 Diagnosis Advisor

목적:

- 단순 수치 나열에서 벗어나 "무슨 문제가 있는지"를 앱이 설명한다

사용자 가치:

- 초보자도 병목 원인을 빠르게 이해 가능
- 다음 행동으로 바로 이어지는 UX 제공

진단 규칙 예시:

- 메모리 사용률 높음 + swap 증가 -> 메모리 압박
- CPU 장시간 고점 유지 + 동일 프로세스 반복 상위 -> runaway process
- 디스크 busy 높음 + recent growth 큼 -> 저장소 병목
- 여유 공간 부족 + Docker reclaim 가능 용량 큼 -> Docker 정리 권장
- Downloads/캐시/로그 폴더 급증 -> 정리 후보 강조

구현 범위:

- 대시보드 상단 진단 카드
- 심각도별 진단 목록
- 각 진단마다 근거 데이터 표시
- 관련 페이지로 이동하는 quick action 버튼

기술 설계:

- `src/main/services/diagnosisAdvisor.ts`
- 입력 데이터:
  - 실시간 시스템 통계
  - 프로세스 snapshot
  - disk quick scan
  - growth view
  - event history
- IPC 추가:
  - `getDiagnosisSummary()`
- 렌더러:
  - `DiagnosisCard`, `DiagnosisList`

수용 기준:

- 최소 8개 규칙 제공
- 진단 결과는 규칙 기반 deterministic 동작
- 근거 없는 추천은 노출하지 않음

### 5.2 Alert Intelligence

목적:

- 현재 threshold 기반 단순 알림을 문맥형 알림으로 확장한다

구현 범위:

- 반복 알림 묶기
- "5분 이상 지속" 같은 지속시간 기반 알림
- "최근 24시간 동일 경고 N회" 같은 패턴 기반 알림
- 알림 상세에서 원인 후보/추천 액션 연결

기술 설계:

- `alertManager.ts` 확장
- 활성 알림과 별도로 히스토리 분석 계층 추가
- 설정에 지속시간/패턴 알림 옵션 추가

## 6. Phase 3: 정리 자동화

### 6.1 Cleanup Rules

목적:

- 수동 정리 앱에서 반자동 유지보수 도구로 확장한다

핵심 아이디어:

- 삭제를 즉시 자동화하지 말고, 우선 "예약 스캔 + 승인 대기함"부터 제공

초기 규칙 후보:

- Downloads 30일 이상 미사용 파일
- Xcode DerivedData/Archives 오래된 항목
- npm/pnpm/yarn cache 과대 사용
- Docker stopped containers 누적
- 오래된 로그/임시 파일

구현 범위:

- Settings에 Automation 섹션 추가
- 규칙별 활성화/비활성화
- 마지막 실행 시간, 예상 회수 용량 표시
- 실행 전 승인 화면 제공
- 결과 로그 저장

기술 설계:

- `src/shared/types/automation.ts`
- `src/main/services/cleanupRules.ts`
- `src/main/services/automationRunner.ts`
- 설정 스키마 확장:
  - `automationEnabled`
  - `cleanupRules`
  - `automationSchedule`
- 기존 `jobManager.ts` 재사용

수용 기준:

- 자동 실행 전에 항상 preview 가능
- 위험 경로는 자동 삭제 금지
- 규칙 실패 시 나머지 규칙 실행에 영향 최소화

### 6.2 Cleanup Inbox

목적:

- 정리 추천 결과를 한곳에 모아 사용자가 검토 후 처리할 수 있게 한다

구현 범위:

- 추천 항목 목록
- reclaimable space 기준 정렬
- 안전도/근거/카테고리 표시
- 일괄 승인 또는 개별 제외

렌더러 설계:

- 새 페이지 또는 Storage/Cleanup 하위 탭
- `CleanupInbox` 컴포넌트
- `useCleanupInboxStore`

## 7. Phase 4: 운영/공유 강화

### 7.1 Diagnostic Report Export

목적:

- 문제 상황을 저장하고 외부에 공유할 수 있게 한다

사용자 가치:

- GitHub issue 작성 시 첨부 가능
- 개인 성능 이력 보관 가능
- 팀 내 동일 환경 비교 가능

구현 범위:

- Markdown / JSON 내보내기
- 포함 항목 선택:
  - 시스템 요약
  - 최근 히스토리
  - 활성 알림
  - 상위 프로세스
  - 디스크 정리 후보
  - Docker reclaim 가능 용량
- 민감 경로 마스킹 옵션

기술 설계:

- `src/main/services/reportBuilder.ts`
- IPC:
  - `buildDiagnosticReport(options)`
  - `saveDiagnosticReport(options)`

수용 기준:

- 리포트 생성 실패 시 사용자 데이터 손상 없음
- Markdown이 사람이 읽기 쉬운 형태로 출력됨

### 7.2 Session Snapshot

목적:

- 특정 시점의 상태를 저장해 나중에 비교할 수 있게 한다

구현 범위:

- "현재 상태 저장" 버튼
- 저장 항목:
  - 시스템 요약
  - 상위 프로세스
  - 주요 디스크 상태
  - 알림
  - Docker 상태
- 저장한 세션끼리 diff 보기

기술 설계:

- `src/main/services/sessionSnapshotStore.ts`
- 타임라인 데이터와 별도 저장

## 8. Phase 5: 고도화

### 8.1 Workspace Profiles

목적:

- 개발 환경별로 모니터링/정리 정책을 분리한다

예시:

- Mobile 개발 프로필
- Backend 개발 프로필
- Docker-heavy 작업 프로필
- Low-power 노트북 프로필

구현 범위:

- 프로필별 알림 임계치
- 프로필별 정리 규칙
- 프로필별 대시보드 위젯 구성

### 8.2 Extensible Integrations

목적:

- 개발자 중심 도구로서 외부 생태계와 연결한다

후보:

- Homebrew 상태 점검
- VS Code 캐시/확장 분석
- Xcode/Android Studio 빌드 산출물 분석
- Node/Python/Rust toolchain cache 분석

원칙:

- 코어 앱은 유지
- 도구별 분석은 서비스 모듈 단위로 분리

## 9. 공통 선행 과제

기능 추가 전에 아래 기반 작업이 필요합니다.

### 9.1 데이터 계층 정비

- 장기 저장용 store 추상화
- JSON 손상 복구 공통화
- retention 정책 공통화
- 이벤트/메트릭 파일 버전 관리

### 9.2 IPC 계약 확장 방식 정리

- read-only 조회 IPC와 destructive action IPC 분리
- 장기적으로 IPC 응답 포맷 표준화
- 새 타입 추가 시 `shared/types`와 validator 동반 작성

### 9.3 설정 구조 확장

현재 설정은 비교적 단순합니다. 아래 필드 확장이 예상됩니다.

- `history`
- `automation`
- `reporting`
- `diagnostics`
- `profiles`

권장:

- `settingsSchema.ts`를 섹션 단위 sanitize/validate 구조로 재편

### 9.4 테스트 전략 확장

- 메트릭 저장소 단위 테스트
- 진단 규칙 단위 테스트
- 자동화 규칙 dry-run 테스트
- 주요 페이지 E2E:
  - Timeline 로딩
  - Diagnosis 카드 표시
  - Cleanup Inbox 승인 플로우
  - Report export 플로우

## 10. 추천 구현 순서

가장 현실적인 구현 순서는 아래와 같습니다.

1. System Health Timeline
2. Event History
3. Diagnosis Advisor
4. Alert Intelligence
5. Cleanup Rules
6. Cleanup Inbox
7. Diagnostic Report Export
8. Session Snapshot
9. Workspace Profiles
10. Extensible Integrations

이 순서를 추천하는 이유:

- Timeline과 Event History가 나와야 진단과 리포트가 강해짐
- Diagnosis가 나와야 자동화의 기준이 생김
- Cleanup Rules는 안전장치와 이력 계층이 먼저 있어야 출시 리스크가 낮음

## 11. 릴리즈 단위 제안

### v1.3

- Timeline MVP
- Event History MVP

### v1.4

- Diagnosis Advisor MVP
- Alert Intelligence 1차

### v1.5

- Cleanup Rules MVP
- Cleanup Inbox

### v1.6

- Diagnostic Report Export
- Session Snapshot

### v1.7+

- Profiles
- Tool-specific integrations

## 12. 리스크와 대응

### 저장 데이터 증가

- 대응: downsampling, retention, 압축 없는 단순 JSON 유지, 오래된 데이터 자동 삭제

### 플랫폼별 편차

- 대응: core metric 우선, 플랫폼별 기능은 capability flag로 노출 제어

### 자동화 기능의 안전성

- 대응: preview-first, trash-first, 보호 경로 정책, 확인 다이얼로그 유지

### UI 복잡도 증가

- 대응: 새 기능을 모두 최상위 페이지로 만들지 말고, Timeline/Automation처럼 명확한 축만 페이지로 분리

## 13. 결론

SystemScope는 현재도 유용한 도구지만, 다음 도약 지점은 "보여주는 앱"에서 "설명하고 정리까지 이끄는 앱"으로 가는 것입니다.

가장 먼저 구현할 기능은 `System Health Timeline`과 `Event History`입니다. 이 둘이 들어오면 진단, 자동화, 리포트 기능이 모두 일관된 기반 위에서 확장됩니다.
