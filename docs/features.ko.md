# SystemScope 상세 기능 문서

<p>
  <a href="./features.md">English</a> | <a href="./features.ko.md">한국어</a>
</p>

## 1. 실시간 시스템 모니터링

- CPU 사용률, 코어별 부하, 모델, 클럭 표시
- 메모리 전체/사용/가용량과 실제 메모리 압박도 표시
- GPU 사용 가능 여부, 메모리 사용량, 온도 표시
- 디스크 사용량 표시
- 1초 간격 실시간 시스템 업데이트
- 최근 히스토리를 기반으로 한 실시간 차트 표시

## 2. 알림 시스템

- 디스크, 메모리, GPU 메모리 사용률 기반 경고/치명 알림
- 경고와 치명 임계치 개별 설정 가능
- 설정값은 저장되며 앱 재시작 후에도 유지
- 알림 중복 폭주를 막기 위한 cooldown 적용

기본 임계치:

| 항목 | Warning | Critical |
|------|---------|----------|
| Disk | 80% | 90% |
| Memory | 80% | 90% |
| GPU Memory | 80% | 90% |

## 3. 디스크 분석

- 임의 폴더 선택 후 비동기 스캔
- 스캔 진행 상태와 취소 지원
- 폴더 트리맵 시각화
- 대용량 파일 상위 목록 제공
- 확장자별 용량 분포 분석
- 스캔 결과 요약 (총 용량, 파일 수, 폴더 수, 소요 시간)

폴더 스캔 특성:

- 최대 깊이: `5`
- 배치 동시성: `50`
- 심볼릭 링크는 재귀 탐색에서 제외
- 접근 불가 파일/폴더는 건너뜀

## 4. 빠른 정리 후보 탐색

자주 커지는 경로를 미리 정의해 빠르게 용량을 확인합니다.

**macOS 대상:**

- `~/Library/Caches`, `~/Library/Logs`, `~/Downloads`, `~/.Trash`
- Homebrew cache / logs / cellar
- Xcode DerivedData / Archives / CoreSimulator
- npm / yarn / pnpm / pip / Cargo / Gradle / Maven / CocoaPods / Composer 캐시
- Docker / OrbStack 데이터
- Chrome / Safari 캐시

**Windows 대상:**

- Temp, Downloads, Recycle Bin, Windows Update cache, Crash dumps
- Chrome / Edge cache
- npm / yarn / pnpm / pip / NuGet / Cargo / Gradle / Maven 캐시
- Docker 데이터, VS Code extensions

각 항목은 경로, 설명, 추정 크기, 카테고리, 정리 가능 여부를 포함하며 선택 항목을 휴지통으로 이동할 수 있습니다.

참고:

- 경로 열기는 보안상 앱이 허용한 루트 범위에서만 동작합니다.
- Windows에서는 `Temp`, `Recycle Bin`, `Windows Update cache` 같은 시스템 경로도 Explorer에서 열 수 있도록 별도 허용 경로를 적용합니다.
- 크기 측정은 빠른 시스템 명령을 우선 사용하고, 불가능하면 JS 재귀 스캔으로 fallback 합니다.

## 5. Docker 정리

`Docker` 메뉴에서 Docker 자원을 파일 정리와 분리해 관리할 수 있습니다.

- **Overview**: 컨테이너와 이미지 상태를 함께 보고 권장 정리 순서 안내
- **Containers**: running container 중지 + stopped container 정리
- **Images**: unused / dangling image 정리
- **Volumes**: unused volume 정리
- **Build Cache**: reclaimable builder cache prune

세부 동작:

- `docker image ls`, `docker ps -a`, `docker volume ls`, `docker system df` 기반 조회
- Repository, Tag, Size, Created, Status 표시
- 상태 구분: `in use`, `unused`, `dangling` / `running`, `stopped`
- 사용 중인 자원은 삭제 버튼 비활성화
- 개별 삭제 / 다중 선택 삭제 + 확인 다이얼로그
- Docker 미설치 상태와 daemon 미실행 상태를 구분해 안내
- Docker CLI가 없거나 daemon에 연결할 수 없으면 사용자 메시지를 유지한 채 안전하게 실패

## 6. Growth View (폴더 성장 추세)

홈 디렉토리 주요 폴더의 용량 변화를 스냅샷 기반으로 추적합니다.

- 스냅샷 방식: 주기적으로 폴더 크기를 JSON 파일에 기록하고, 과거 스냅샷과 비교하여 실제 증감량 계산
- 기간 선택: 1시간 / 24시간 / 7일
- "가장 빠르게 커지는 폴더 TOP 5" 수평 바 차트
- 전체 폴더 증가량 + 증가율(%) 목록

스냅샷 설정:

- 저장 위치: `userData/snapshots/growth.json`
- 기본 주기: 60분 (Settings에서 15분~6시간 변경 가능)
- 최대 보관: 168개
- 깨진 JSON 파일 자동 복구, 연속 중복 스냅샷 방지

## 7. 최근 급성장 폴더

스캔한 폴더 내에서 최근 N일(1~30일) 동안 추가/수정된 파일 기준으로 급격히 커진 폴더를 찾습니다.

- 파일 `mtime` 기준 최근 변경 파일 크기 집계
- 폴더별 그룹핑, 기간 선택 가능
- 클릭 시 Finder / Explorer에서 열기

## 8. 중복 파일 찾기

스캔 폴더 내 중복 파일을 3단계로 탐색합니다.

1. 파일 크기로 후보 그룹핑 (빠른 필터)
2. 같은 크기 파일의 head+tail 샘플 해시로 추가 축소
3. 최종 후보만 전체 해시로 확정

- 100KB 이상 파일 대상, 최대 50그룹
- 각 중복 그룹의 낭비 용량 합계 표시

### 삭제 후 상태 동기화

- 파일 삭제 성공 시 목록에서 즉시 제거
- 스캔 캐시 무효화 + 백그라운드 재스캔으로 통계 자동 갱신

## 9. 사용자 공간 요약

홈 디렉터리 기준 주요 폴더(Documents, Downloads, Desktop 등)의 용량을 한눈에 보여줍니다.

- macOS/Linux: `du` 우선, 실패 시 fallback
- Windows: 시스템 드라이브 기준 파일시스템 용량을 우선 계산
- 접근 불가 경로는 건너뜀

## 10. 프로세스 모니터링

- 전체 프로세스 목록 (CPU 또는 메모리 사용량 > 0)
- 이름, PID, command 경로 실시간 검색/필터링
- PID / Name / CPU% / Memory 컬럼 정렬
- 프로세스 종료 기능 + 보호 대상 프로세스 종료 차단
- 대시보드에서 Top Resource Consumers (CPU/Memory/GPU 통합)

## 11. 포트 찾기

현재 사용 중인 네트워크 포트와 점유 프로세스를 조회합니다.

- 검색 범위 선택: Local / Remote / All
- 상태별 필터: All / Listening / Established / Other
- TCP 전체 상태 지원, 상태별 색상 뱃지
- 포트 점유 PID 기준 프로세스 종료 지원
- Windows 경로(`.exe`)와 macOS 앱 번들(`.app`)을 표시 이름으로 정규화

## 12. 포트 모니터링

특정 포트/IP를 등록하고 연결 상태 변화를 실시간으로 감시합니다.

- 패턴: 포트 번호, IP, IP:Port
- 폴링 주기: 1초 ~ 30초 선택
- 상태 변화 감지 시 Toast 알림 + History 로그
- Pause / Resume 지원

## 13. 트레이 아이콘

- macOS 메뉴바 / Windows 시스템 트레이에 상주
- 창을 닫아도 트레이에서 다시 열기 가능
- macOS: Template Image 다크/라이트 자동 대응, 고정 폭 CPU meter
- Windows: CPU 사용률 단계별 아이콘 동적 갱신

## 14. 앱 관리

- **Installed**: 설치 앱 조회, 앱 제거, 앱별 Related Data 후보 조회 및 정리
- **Leftover Data**: 설치 앱과 연결되지 않는 잔여 데이터 후보, confidence/reason/risk 기반 안내

## 15. 종료 처리

- Graceful shutdown 오케스트레이터 (job 취소 → interval 정리 → 스냅샷 대기 → tray 정리)
- `SIGINT`, `SIGTERM`, `uncaughtException`, `unhandledRejection` 대응
- 종료 중 renderer에 전역 오버레이 표시

## 16. 설정

- **Appearance**: Dark / Light 테마
- **Alerts**: Disk / Memory / GPU 각각 Warning / Critical 임계치
- **Snapshots**: 15분 ~ 6시간 주기 선택
- **App Data / Logs**: 저장 경로 확인 및 Finder / Explorer에서 열기
- 로그: `userData/logs/systemscope-YYYY-MM-DD.log`, 10일 자동 보관

## 테스트

- Unit / Integration: Vitest
- E2E: Playwright 기반 Electron 실행
- 주요 IPC 경로, Docker 상태 분기, 외부 명령 fallback, 앱 관리 흐름을 테스트로 커버

## macOS 동작 보정

macOS에서는 실제보다 메모리와 디스크가 더 꽉 찬 것처럼 보일 수 있어 보정을 적용합니다.

- 메모리 사용률: `(total - available) / total` 기준
- APFS 루트 볼륨: `diskutil` 정보로 컨테이너 크기와 가용 공간 반영
- 디스크 알림: purgeable 영향을 줄인 `realUsage` 기준
- Apple Silicon GPU: 통합 메모리로 별도 모니터링 불가 — 모델명과 안내 표시
