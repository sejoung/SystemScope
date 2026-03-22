<p align="center">
  <img src="resources/systemscope_icon.svg" width="128" height="128" alt="SystemScope Icon" />
</p>

<h1 align="center">SystemScope</h1>

<p align="center">개발자를 위한 Electron 기반 시스템 모니터링 데스크톱 앱입니다.<br/>CPU, 메모리, GPU, 디스크 사용량을 실시간으로 확인하고, 폴더 스캔과 빠른 정리 후보 탐색까지 한 앱에서 제공합니다.</p>

## 화면 구성

- `Overview`: 실시간 시스템 상태, 알림, Live Usage 차트, Home Storage, Storage Growth, Top Resource Consumers
- `Storage`: 3개 탭으로 구성
  - `Overview`: Home Storage + Storage Growth
  - `Scan`: 폴더 스캔, Folder Map, File Insights (File Types / Largest), Recent Growth
  - `Cleanup`: Quick Cleanup + File Cleanup (Largest / Old Files / Duplicates — 삭제 기능 포함)
- `Docker`: 독립 메뉴, 5개 탭으로 구성
  - `Overview`: 정리 우선순위 요약, stopped containers / in-use images / dangling images 요약
  - `Containers`: 실행 중 컨테이너 중지, 종료된 컨테이너 삭제
  - `Images`: 사용 중/미사용 이미지 조회 및 삭제
  - `Volumes`: 미사용 볼륨 조회 및 삭제
  - `Build Cache`: reclaimable build cache 조회 및 prune
- `Activity`: 3개 탭으로 구성
  - `Processes`: 전체 프로세스 목록, 검색/필터, 컬럼 정렬
  - `Ports`: 네트워크 포트 조회, Local/Remote 범위 검색, 상태별 필터
  - `Watch`: 포트/IP 실시간 모니터링, 연결 상태 변화 감지, History 로그
- `Preferences`: 테마, 알림 임계치, 스냅샷 주기, 앱 데이터/로그 경로 관리

## 주요 기능

### 1. 실시간 시스템 모니터링

- CPU 사용률, 코어별 부하, 모델, 클럭 표시
- 메모리 전체/사용/가용량과 실제 메모리 압박도 표시
- GPU 사용 가능 여부, 메모리 사용량, 온도 표시
- 디스크 사용량 표시
- 1초 간격 실시간 시스템 업데이트
- 최근 히스토리를 기반으로 한 실시간 차트 표시

### 2. 알림 시스템

- 디스크, 메모리, GPU 메모리 사용률 기반 경고/치명 알림
- 경고와 치명 임계치 개별 설정 가능
- 설정값은 저장되며 앱 재시작 후에도 유지
- 알림 중복 폭주를 막기 위한 cooldown 적용

기본 임계치:

- Disk warning: `80%`
- Disk critical: `90%`
- Memory warning: `80%`
- Memory critical: `90%`
- GPU memory warning: `80%`
- GPU memory critical: `90%`

### 3. 디스크 분석

- 임의 폴더 선택 후 비동기 스캔
- 스캔 진행 상태와 취소 지원
- 폴더 트리맵 시각화
- 대용량 파일 상위 목록 제공
- 확장자별 용량 분포 분석
- 스캔 결과 요약
  - 총 용량
  - 파일 수
  - 폴더 수
  - 소요 시간

현재 폴더 스캔 특성:

- 최대 깊이: `5`
- 배치 동시성: `50`
- 심볼릭 링크는 재귀 탐색에서 제외
- 접근 불가 파일/폴더는 건너뜀

### 4. 빠른 정리 후보 탐색

자주 커지는 경로를 미리 정의해 빠르게 용량을 확인합니다.

macOS 예시:

- `~/Library/Caches`
- `~/Library/Logs`
- `~/Downloads`
- `~/.Trash`
- Homebrew cache / logs / cellar
- Xcode DerivedData / Archives / CoreSimulator
- npm / yarn / pnpm / pip / Cargo / Gradle / Maven 캐시
- Docker / OrbStack 데이터
- Chrome / Safari 캐시

Windows 예시:

- Temp
- Downloads
- Recycle Bin
- Windows Update cache
- Crash dumps
- Chrome / Edge cache
- npm / yarn / pnpm / pip / NuGet / Cargo / Gradle / Maven 캐시
- Docker 데이터
- VS Code extensions

각 항목은 다음 속성을 포함합니다.

- 경로
- 설명
- 추정 크기
- 카테고리
- 정리 가능 여부
- 선택 항목을 휴지통으로 이동하는 정리 액션

### 5. Docker 정리

`Docker` 메뉴에서 Docker 자원을 파일 정리와 분리해 관리할 수 있습니다.

- `Overview`: 컨테이너와 이미지 상태를 함께 보고 권장 정리 순서 안내
- `Containers`: running container 중지 + stopped container 정리
- `Images`: unused / dangling image 정리
- `Volumes`: unused volume 정리
- `Build Cache`: reclaimable builder cache prune

- `docker image ls`, `docker ps -a` 기반 자원 조회
- `docker volume ls`, `docker system df` 기반 볼륨/캐시 조회
- Repository, Tag, Size, Created, Status 표시
- 상태 구분: `in use`, `unused`, `dangling`
- 컨테이너 상태 구분: `running`, `stopped`
- 이미지 삭제 전에 먼저 정리해야 할 stopped container를 별도 탭에서 확인 가능
- running container는 `Stop` 후 삭제 가능
- 사용 중인 이미지는 삭제 버튼 비활성화
- 실행 중인 컨테이너는 삭제 버튼 비활성화
- 사용 중인 볼륨은 삭제 버튼 비활성화
- 개별 삭제 / 다중 선택 삭제
- 삭제 전 확인 다이얼로그 표시
- Docker 미설치 상태와 Docker daemon 미실행 상태를 구분해 안내

### 6. Growth View (폴더 성장 추세)

홈 디렉토리 주요 폴더의 용량 변화를 스냅샷 기반으로 추적합니다.

- 스냅샷 방식: 주기적으로 폴더 크기를 JSON 파일에 기록하고, 과거 스냅샷과 현재를 비교하여 실제 증감량 계산
- 기간 선택: 1시간 / 24시간 / 7일
- "가장 빠르게 커지는 폴더 TOP 5" 수평 바 차트
- 전체 폴더 증가량 + 증가율(%) 목록
- 대시보드와 디스크 페이지 모두에서 동일 데이터 표시 (Zustand 캐싱)
- 앱 시작 시 자동 분석

스냅샷 설정:

- 저장 위치: `userData/snapshots/growth.json`
- 기본 주기: 60분 (Settings에서 15분/30분/1시간/2시간/6시간 변경 가능)
- 최대 보관: 168개
- 앱 시작 시 즉시 1회 + 이후 설정된 주기마다 자동 기록
- 깨진 JSON 파일이 감지되면 백업 후 새 파일로 복구
- 동일한 내용의 연속 스냅샷은 중복 저장하지 않음

### 7. 최근 급성장 폴더 (폴더 스캔 결과 내)

스캔한 폴더 내에서 최근 N일(1/3/7/14/30일) 동안 추가되거나 수정된 파일을 기준으로 급격히 커진 폴더를 찾습니다.

- 파일 `mtime` 기준으로 최근 변경 파일 크기 집계
- 폴더별 그룹핑
- 기간 선택 가능 (1일 ~ 30일)
- 클릭 시 Finder / Explorer에서 열기

### 8. 중복 파일 찾기

스캔한 폴더 내 중복 파일을 탐색합니다. 현재는 `Storage > File Insights > Duplicates` 탭에서 제공합니다.

- 1단계: 파일 크기로 후보 그룹핑 (빠른 필터)
- 2단계: 같은 크기 파일의 head+tail 샘플 해시로 추가 축소
- 3단계: 최종 후보만 전체 해시로 확정
- 100KB 이상 파일 대상, 최대 50그룹
- 각 중복 그룹의 낭비 용량 합계 표시
- 접기/펼치기로 중복 파일 경로 확인, 각 파일에 Open 버튼

### 9. 사용자 공간 요약

홈 디렉터리 기준 주요 폴더의 용량을 한눈에 보여줍니다.

macOS 예시:

- Documents
- Downloads
- Desktop
- Pictures
- Movies
- Music
- Developer
- Library
- Trash

Windows 예시:

- Documents
- Downloads
- Desktop
- Pictures
- Videos
- Music
- AppData

### 10. 프로세스 모니터링 (Activity > Processes)

- 전체 프로세스 목록 (CPU 또는 메모리 사용량 > 0)
- 이름, PID, command 경로 실시간 검색/필터링
- PID / Name / CPU% / Memory 컬럼 클릭으로 정렬 (오름/내림차순)
- CPU 사용률 색상 구분 (30% 이상 노랑, 80% 이상 빨강)
- 검색 시 command 경로 자동 표시
- Sticky 헤더 (스크롤해도 컬럼 고정)
- 프로세스 종료 기능 (`Kill`)과 종료 전 확인 다이얼로그
- 앱 자체 프로세스와 보호 대상 프로세스는 종료 차단
- 대시보드에서는 Top Resource Consumers (CPU Top 3 + Memory Top 3 + GPU 상태 통합)
- App 레벨 글로벌 폴링 (2초 간격) — 페이지 전환 시 끊김 없이 즉시 표시

### 11. 포트 찾기 (Activity > Ports)

현재 사용 중인 네트워크 포트와 점유 프로세스를 조회합니다.

- 전체 포트 목록 조회 (`systeminformation.networkConnections`)
- 검색 범위 선택: Local / Remote / All
- 상태별 필터: All / Listening / Established / Other
- 검색어와 상태 필터 연동 — 검색 결과 기준으로 상태 카운트 갱신
- TCP 전체 상태 지원 (LISTEN, ESTABLISHED, SYN_SENT, FIN_WAIT, CLOSE_WAIT 등)
- 상태별 색상 뱃지 + hover 시 한글 설명 툴팁
- 조회 결과 Zustand 캐싱 — 탭 전환 시 유지
- 포트를 점유한 PID 기준 프로세스 종료 (`Kill PID`) 지원

### 12. 포트 모니터링 (Activity > Watch)

특정 포트/IP를 등록하고 연결 상태 변화를 실시간으로 감시합니다.

- 패턴 등록: 포트 번호 (`3000`), IP (`34.149`), IP:Port (`192.168.1.1:443`)
- 등록 시 검색 범위 선택: Local / Remote / All
- 폴링 주기 선택: 1초 / 2초 / 5초 / 10초 / 30초
- Watch별 독립 관리:
  - 상태별 카운트 (L:Listen, E:Established, O:Other)
  - 카운트 클릭으로 상태 필터링
  - 상세 테이블 접기/펼치기
  - 대량 연결 시 100건 제한 + "+N more" 표시
- 상태 변화 감지 → Toast 알림 + History 로그 기록
- Pause / Resume 지원
- 전체 상태 Zustand 캐싱 — 탭 전환 시 유지

### 13. 트레이 아이콘

- macOS 메뉴바 / Windows 시스템 트레이에 상주
- 창을 닫아도 트레이에서 다시 열기 가능
- macOS: Template Image로 다크/라이트 모드 자동 대응
- macOS: 고정 폭 CPU meter title로 메뉴바 흔들림 최소화
- Windows: 좌클릭으로 바로 창 열기
- Windows: CPU 사용률 단계에 따라 트레이 아이콘 동적 갱신
- 트레이 메뉴: Show SystemScope / Quit

### 14. 시스템 연동

- 폴더 선택 다이얼로그
- Finder / Explorer에서 경로 열기
- 앱 데이터 폴더 열기 (userData 하위만 허용)
- 로그 폴더 열기 (userData/logs 하위)
- 홈 디렉터리 하위 파일을 확인 후 휴지통으로 이동
- 창 크기, 위치, 최대화 상태 저장

### 15. UI 패턴

- 아코디언: Live Usage, Home Storage, Storage Growth, Quick Cleanup, Folder Map, File Insights, Recent Growth 등 주요 섹션 접기/펼치기 지원
  - 접힌 상태에서도 헤더의 액션 버튼으로 바로 실행 가능
  - 실행 완료 시 자동으로 열리며 뱃지로 요약 표시
- 시스템 모니터링, 프로세스 폴링, 알림 리스너는 App 레벨에서 글로벌 관리 — 어떤 페이지에 있든 백그라운드 갱신
- Storage, Docker, Activity 페이지는 탭 구조 (Overview/Scan/Cleanup, Overview/Containers/Images/Volumes/Build Cache, Processes/Ports/Watch)
- 사용자 공간, Growth View, 프로세스, Port Finder, Port Watch 데이터는 Zustand 스토어에 캐싱 — 탭/페이지 전환 시 즉시 표시, 재호출 없음
- 사용자가 Rescan / Refresh 버튼으로 원할 때만 수동 갱신
- 다크 / 라이트 테마 지원
- 라이트 테마에서도 차트, 사이드바, 경고/성공 배지 대비를 별도로 조정
- 페이지 및 주요 섹션 렌더 실패 시 Error Boundary로 전체 앱 대신 해당 영역만 보호

### 16. 설정

- `Preferences > Appearance`: Dark / Light 테마 선택
- `Preferences > Alerts`: Disk / Memory / GPU 각각 Warning / Critical 설정
- `Preferences > Snapshots`: 15분 / 30분 / 1시간 / 2시간 / 6시간 선택
- `Preferences > App Data`: 저장 경로 확인 및 Finder / Explorer에서 바로 열기
- `Preferences > Logs`: 로그 폴더 확인 및 Finder / Explorer에서 바로 열기
- 로그 파일 저장 위치: `userData/logs`
- 로그 파일 형식: `systemscope-YYYY-MM-DD.log`
- 로그 레코드 형식: `[scope]` + message + metadata
- 로그 보관 기간: 최근 10일 자동 유지
- 하단 `Save All` 버튼으로 테마, 알림 임계치, 스냅샷 주기를 함께 저장

## macOS 동작 보정

macOS에서는 일반적인 `used` 값만 보면 실제보다 메모리와 디스크가 더 꽉 찬 것처럼 보일 수 있어 일부 보정을 넣었습니다.

- 메모리 사용률은 `used / total` 대신 `(total - available) / total` 기준으로 계산
- APFS 루트 볼륨은 `diskutil` 정보를 사용해 컨테이너 크기와 가용 공간을 반영
- 디스크 알림은 가능하면 APFS purgeable 영향을 줄인 `realUsage` 기준으로 판단
- Apple Silicon (M1/M2/M3) GPU는 통합 메모리로 별도 사용률 모니터링 불가 — 모델명과 안내 메시지 표시

## 프로젝트 구조

```text
src/
  main/       Electron main process, IPC, 시스템 수집, 디스크/알림 서비스
  preload/    contextBridge 기반 renderer API 노출
  renderer/   React UI, 페이지, 스토어, 차트 컴포넌트
  shared/     IPC 채널, 공용 타입, 상수
tests/
  unit/         Vitest 단위 테스트
  integration/  Vitest 통합 흐름 테스트
```

## 기술 스택

- Electron
- React 19
- TypeScript
- Vite / electron-vite
- Zustand
- Recharts
- `systeminformation`
- `electron-store`
- Vitest

## 보안 모델

Renderer는 Node API에 직접 접근하지 않습니다.

- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`
- preload의 `contextBridge`를 통해 필요한 IPC API만 노출
- 외부 경로 열기 전 존재 여부 확인

## 시작하기

### 요구 사항

- Node.js
- npm
- macOS 또는 Windows 권장

참고:

- 코드상 Linux 일부 경로는 동작할 수 있지만, 빠른 스캔 대상과 사용자 공간 구성은 macOS/Windows 기준으로 더 구체화되어 있습니다.

### 설치

```bash
npm install
```

### 개발 실행

```bash
npm run dev
```

### 프로덕션 빌드

```bash
npm run build
```

### 프리뷰 실행

```bash
npm run preview
```

## 테스트

```bash
npm test
```

정적 검사:

```bash
npm run lint
```

포함 범위:

- `tests/unit`: 함수/모듈 단위 검증
- `tests/integration`: 앱 부팅, 설정 저장/검증, 디스크 스캔, 실시간 모니터링, 성장 분석 등 모듈 연결 흐름 검증
- Docker 이미지/컨테이너/볼륨/build cache 조회·정리와 프로세스 종료 같은 외부 시스템 연동은 주로 unit test에서 IPC/서비스 경계를 검증

감시 모드:

```bash
npm run test:watch
```

## 사용 가능한 스크립트

- `npm run dev`: 개발 모드 실행
- `npm run build`: Electron main, preload, renderer 빌드
- `npm run preview`: 빌드 결과 프리뷰
- `npm run pack`: 빌드 + 패키징 (설치 파일 없이 앱 폴더만, 테스트용)
- `npm run dist`: 빌드 + 패키징 + 설치 파일 생성 (.dmg / .exe)
- `npm run dist:mac`: macOS만 빌드
- `npm run dist:win`: Windows만 빌드
- `npm test`: Vitest 실행
- `npm run test:watch`: Vitest watch 모드
- `npm run lint`: ESLint 실행
- `npm run format`: Prettier 실행

## 현재 구현 범위

이미 구현됨:

- 실시간 시스템 메트릭 수집 (CPU / Memory / GPU / Disk)
- 알림 임계치 저장 및 적용
- 테마 저장 및 재시작 후 복원 (Dark / Light)
- 폴더 스캔 / 취소 / 결과 시각화 (Treemap, Large Files, Extensions)
- 빠른 정리 후보 분석 (Quick Scan)
- 사용자 공간 요약 (Your Storage, Zustand 캐싱)
- Growth View — 스냅샷 기반 폴더 성장 추세 분석
- 스냅샷 파일 손상 자동 복구 + 연속 중복 스냅샷 방지
- 최근 급성장 폴더 탐색 (스캔 결과 내)
- 중복 파일 찾기 (3단계 해시: 크기 → 샘플 → 전체)
- 오래된 파일 탐색 (File Insights > Old Files)
- File Insights 항목 휴지통 이동 + 확인 다이얼로그
- 전체 프로세스 목록 + 검색/필터/정렬 (Activity > Processes)
- Top Resource Consumers — CPU/Memory/GPU 통합 위젯 (Overview 대시보드)
- Port Finder — 포트 조회, Local/Remote 범위 검색, 상태 필터 연동 (Activity > Ports)
- Port Watch — 포트/IP 실시간 모니터링, 상태 변화 감지, History (Activity > Watch)
- Docker Cleanup — Overview / Containers / Images / Volumes / Build Cache 메뉴 분리
- Docker Containers — running container 중지 + stopped container 정리 후 image cleanup 흐름 지원
- Docker Images — in-use / unused / dangling 상태 기반 정리
- Docker Volumes — unused volume 정리
- Docker Build Cache — reclaimable cache 확인 및 prune
- Storage 탭 구조 (Overview / Scan / Cleanup)
- Activity 탭 구조 (Processes / Ports / Watch)
- App 레벨 글로벌 폴링 — 페이지/탭 전환 시 끊김 없음
- Port Finder / Port Watch 상태 Zustand 캐싱 — 탭 전환 시 유지
- Apple Silicon GPU 통합 메모리 안내
- Vitest 단위 테스트 + 통합 흐름 테스트
- 트레이 아이콘 상주 + 창 숨기기/복원
- 앱 아이콘 (macOS .icns / Windows .ico)
- 아코디언 UI 전체 적용 + 헤더 액션 버튼
- 스냅샷 주기 설정 (Settings)
- 데이터 저장 경로 확인 + 열기 (Settings)
- 로그 폴더 확인 + 열기 (Settings)
- Electron 파일 로그 기록 + Renderer 렌더 실패 로그 수집
- 날짜별 로그 파일 분리 (`systemscope-YYYY-MM-DD.log`)
- 로그 포맷 통일 (`[scope]` + message + metadata)
- 로그 보관 기간 10일 자동 정리
- 패키징 스크립트 (pack / dist / dist:mac / dist:win)

아직 포함되지 않음:

- 자동 업데이트 (구현 계획: `docs/auto-update-plan.md`)
- 휴지통이 아닌 영구 삭제

## 라이선스

Apache License 2.0
