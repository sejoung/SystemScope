<p align="center">
  <img src="resources/systemscope_icon.svg" width="128" height="128" alt="SystemScope Icon" />
</p>

<h1 align="center">SystemScope</h1>

<p align="center">
  개발자를 위한 올인원 시스템 모니터링 & 정리 도구<br/>
  CPU, 메모리, GPU, 디스크를 실시간으로 확인하고, 디스크 분석, Docker 정리, 프로세스 관리까지 한 앱에서 처리합니다.
</p>

<p align="center">
  <a href="./README.md">English</a> | <a href="./README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="https://sejoung.github.io/SystemScope/">다운로드 페이지</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue" alt="Platform" />
  <img src="https://img.shields.io/badge/license-Apache%202.0-green" alt="License" />
  <img src="https://img.shields.io/badge/electron-41-blueviolet" alt="Electron" />
  <img src="https://img.shields.io/badge/react-19-61dafb" alt="React" />
  <a href="https://github.com/sejoung/SystemScope/actions/workflows/ci.yml">
    <img src="https://github.com/sejoung/SystemScope/actions/workflows/ci.yml/badge.svg" alt="CI" />
  </a>
  <a href="https://github.com/sejoung/SystemScope/releases">
    <img src="https://img.shields.io/github/v/release/sejoung/SystemScope" alt="Latest Release" />
  </a>
  <a href="https://github.com/sejoung/SystemScope/releases">
    <img src="https://img.shields.io/github/release-date/sejoung/SystemScope" alt="Release Date" />
  </a>
  <a href="https://github.com/sejoung/SystemScope/releases">
    <img src="https://img.shields.io/github/downloads/sejoung/SystemScope/total" alt="Downloads" />
  </a>
</p>

<!-- 스크린샷이 준비되면 아래 주석을 해제하세요
<p align="center">
  <img src="docs/screenshots/dashboard.png" width="800" alt="Dashboard Screenshot" />
</p>
-->

## 주요 기능

- **실시간 모니터링**: CPU, 메모리, GPU, 디스크 사용량과 실시간 차트
- **알림**: 디스크 / 메모리 / GPU 사용률 알림과 임계치 설정
- **디스크 분석**: 폴더 스캔, 트리맵, 대용량 파일, 확장자 분포, 중복 파일 찾기
- **빠른 정리**: 캐시, 로그, 빌드 산출물, 임시 파일 같은 자주 커지는 경로 탐색
- **Docker 관리**: 컨테이너, 이미지, 볼륨, 빌드 캐시 조회 및 정리
- **프로세스 관리**: 프로세스 검색, 조회, 종료
- **포트 도구**: 활성 포트 조회와 특정 포트/IP 모니터링
- **앱 정리**: 설치 앱 제거와 잔여 데이터 정리
- **성장 추세**: 스냅샷 기반 폴더 성장 분석
- **트레이 상주 UX**
- **다크 / 라이트 테마**

상세 동작은 [docs/features.ko.md](docs/features.ko.md)를 참고하세요.

## 화면 구성

| 페이지 | 설명 |
|------|------|
| **Overview** | 실시간 게이지, 차트, 알림, 스토리지 요약, Top Consumers |
| **Storage** | 폴더 스캔, 트리맵, 파일 인사이트, 빠른 정리, 파일 삭제 |
| **Docker** | 컨테이너 / 이미지 / 볼륨 / 빌드 캐시 관리 |
| **Activity** | 프로세스, 포트, 포트 감시 |
| **Applications** | 설치 앱 및 잔여 데이터 정리 |
| **Preferences** | 테마, 알림 임계치, 스냅샷 주기, 데이터/로그 경로 |

## 시작하기

### 요구 사항

- Node.js
- npm
- macOS 또는 Windows

권장 환경:

- Node.js 20+
- Docker 기능 사용 시 `docker` CLI와 Docker Desktop 또는 Docker Engine
- Windows 앱 관리 기능 사용 시 `reg.exe` 사용 가능 환경
- `.nvmrc`로 Node 20 기준을 함께 제공합니다

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

### 외부 의존성과 우아한 실패

일부 기능은 OS 도구 또는 외부 명령에 의존합니다.

- Docker 페이지: `docker` CLI와 실행 중인 Docker daemon 필요
- 디스크 용량 측정: macOS/Linux에서는 `du` 우선, 없으면 재귀 스캔 fallback
- macOS APFS 보정: `diskutil` 우선, 실패 시 기본 파일시스템 정보 fallback
- Windows 앱 목록: `reg query` 사용

가능한 경우 외부 명령이 없어도 앱 전체가 깨지지 않도록 graceful fallback 하도록 구현되어 있습니다.

### 패키징

```bash
npm run dist:mac    # macOS .dmg
npm run dist:win    # Windows .exe
```

## 테스트

```bash
npm test            # unit/integration 테스트
npm run test:watch
npm run test:e2e    # Electron + Playwright E2E
npm run test:e2e:debug
npm run check       # typecheck -> lint -> test -> build
```

E2E 테스트는 앱을 먼저 build한 뒤 Playwright로 실행합니다.

## 릴리즈 플로우

권장 릴리즈 절차:

```bash
npm run release:patch   # 또는 release:minor / release:major
git push origin main
git push origin --tags
```

릴리즈 스크립트는 먼저 전체 로컬 검증을 수행한 뒤 `npm version`으로 버전 커밋과 태그를 생성합니다.
`v*` 태그를 push하면 release workflow가 실행되어 플랫폼별 산출물을 빌드하고 draft GitHub Release를 만듭니다.

## 프로젝트 구조

```text
src/
  main/        Electron 메인 프로세스, IPC, 서비스, 시스템 수집
  preload/     contextBridge 기반 renderer API
  renderer/    React UI, 페이지, 스토어, 컴포넌트
  shared/      IPC 채널, 공용 타입, 상수, 계약
tests/
  unit/        단위 테스트
  integration/ 통합 테스트
  e2e/         Playwright 기반 Electron E2E
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
| 테스트 | Vitest, Playwright |

## 보안 모델

Renderer는 Node API에 직접 접근하지 않습니다.

- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`
- 필요한 IPC API만 `contextBridge`를 통해 노출
- 삭제는 제한된 경로에서만 허용하고 휴지통 이동 기반으로 처리

## 플랫폼 메모

- macOS와 Windows를 모두 지원합니다.
- macOS에서는 APFS, unified memory에 대한 보정을 포함합니다.
- Windows에서는 Quick Scan, 앱 제거, Explorer 열기, 트레이 동작에 대한 별도 처리를 포함합니다.
- 일부 시스템 경로는 안전을 위해 열기만 허용되거나 휴지통 이동만 허용됩니다.

플랫폼별 세부 동작은 [docs/features.ko.md](docs/features.ko.md)를 참고하세요.

## 기여

이슈와 PR을 환영합니다. PR 전에 아래 검증을 통과시키는 것을 권장합니다.

```bash
npm run check
```

## 라이선스

[Apache License 2.0](LICENSE)
