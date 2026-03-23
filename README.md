<p align="center">
  <img src="resources/systemscope_icon.svg" width="128" height="128" alt="SystemScope Icon" />
</p>

<h1 align="center">SystemScope</h1>

<p align="center">
  개발자를 위한 올인원 시스템 모니터링 & 정리 도구<br/>
  CPU, 메모리, GPU, 디스크를 실시간으로 확인하고 — 디스크 분석, Docker 정리, 프로세스 관리까지 한 앱에서.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue" alt="Platform" />
  <img src="https://img.shields.io/badge/license-Apache%202.0-green" alt="License" />
  <img src="https://img.shields.io/badge/electron-41-blueviolet" alt="Electron" />
  <img src="https://img.shields.io/badge/react-19-61dafb" alt="React" />
</p>

<!-- 스크린샷이 준비되면 아래 주석을 해제하세요
<p align="center">
  <img src="docs/screenshots/dashboard.png" width="800" alt="Dashboard Screenshot" />
</p>
-->

## 주요 기능

- **실시간 모니터링** — CPU, 메모리, GPU, 디스크 사용량을 1초 간격으로 갱신하고 실시간 차트로 표시
- **알림** — 디스크/메모리/GPU 사용률이 임계치를 넘으면 경고 알림 (임계치 커스터마이징 가능)
- **디스크 분석** — 폴더 스캔, 트리맵 시각화, 대용량 파일 탐색, 확장자별 분포, 중복 파일 찾기
- **빠른 정리** — 캐시, 로그, 빌드 산출물 등 자주 커지는 경로를 자동 탐색하고 휴지통으로 정리
- **Docker 관리** — 컨테이너, 이미지, 볼륨, 빌드 캐시를 한눈에 보고 정리
- **프로세스 관리** — 전체 프로세스 목록 검색/정렬, 프로세스 종료
- **포트 모니터링** — 네트워크 포트 조회 + 특정 포트/IP 실시간 감시
- **앱 관리** — 설치된 앱 제거, 잔여 데이터 탐색 및 정리
- **성장 추세** — 스냅샷 기반으로 홈 폴더 용량 변화를 1시간/24시간/7일 단위로 추적
- **트레이 상주** — 창을 닫아도 메뉴바/시스템 트레이에서 빠르게 복원
- **다크 / 라이트 테마** 지원

> 각 기능의 상세 동작은 [docs/features.md](docs/features.md)를 참고하세요.

## 화면 구성

| 페이지 | 설명 |
|--------|------|
| **Overview** | 실시간 게이지, 차트, 알림, 스토리지 요약, Top Consumers |
| **Storage** | 폴더 스캔 & 트리맵, 파일 인사이트, 빠른 정리, 파일 삭제 |
| **Docker** | 컨테이너 / 이미지 / 볼륨 / 빌드 캐시 관리 |
| **Activity** | 프로세스 목록, 포트 조회, 포트 실시간 감시 |
| **Apps** | 설치 앱 관리, 잔여 데이터 정리 |
| **Preferences** | 테마, 알림 임계치, 스냅샷 주기, 데이터/로그 경로 |

## 시작하기

### 요구 사항

- Node.js
- npm
- macOS 또는 Windows

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 모드
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 프리뷰
npm run preview
```

### 패키징

```bash
npm run dist:mac    # macOS .dmg
npm run dist:win    # Windows .exe
```

## 테스트

```bash
npm test            # 테스트 실행
npm run test:watch  # 감시 모드
npm run check       # typecheck → lint → test → build 전체 검증
```

## 프로젝트 구조

```text
src/
  main/       Electron 메인 프로세스, IPC, 시스템 수집, 서비스
  preload/    contextBridge 기반 renderer API 노출
  renderer/   React UI, 페이지, 스토어, 컴포넌트
  shared/     IPC 채널, 공용 타입, 상수
tests/
  unit/       단위 테스트
```

## 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | Electron 41, React 19 |
| 언어 | TypeScript |
| 빌드 | Vite / electron-vite |
| 상태 관리 | Zustand |
| 차트 | Recharts |
| 시스템 정보 | systeminformation |
| 설정 저장 | electron-store |
| 테스트 | Vitest |

## 보안 모델

Renderer는 Node API에 직접 접근하지 않습니다.

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`
- preload의 `contextBridge`를 통해 필요한 IPC API만 노출
- 파일 삭제는 홈 디렉토리 하위만 허용하며 휴지통으로만 이동

## 기여

이슈와 PR을 환영합니다. 기여 전에 아래 명령으로 전체 검증을 통과하는지 확인해주세요.

```bash
npm run check
```

## 라이선스

[Apache License 2.0](LICENSE)
