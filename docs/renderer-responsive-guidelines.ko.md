# Renderer Responsive Implementation Guide

Renderer의 최소 폭 대응은 화면별 임시 분기보다 공통 규칙을 우선합니다. 이 문서는 `src/renderer/src`에서 반응형 레이아웃을 추가하거나 수정할 때 따를 기준을 정리합니다.

## 목적

- 좁은 폭에서 정보 우선순위를 유지한다.
- 화면별 임계값과 레이아웃 규칙을 공통화한다.
- 새 탭이나 리스트 화면이 기존 패턴을 재사용하게 만든다.

## 기준 파일

- breakpoint 상수와 공통 판별 함수: [src/renderer/src/hooks/useResponsiveLayout.ts](/Users/beni/SystemScope/src/renderer/src/hooks/useResponsiveLayout.ts)
- 폭 감지 훅: [src/renderer/src/hooks/useContainerWidth.ts](/Users/beni/SystemScope/src/renderer/src/hooks/useContainerWidth.ts)
- 공통 compact UI 조각: [src/renderer/src/components/CompactPrimitives.tsx](/Users/beni/SystemScope/src/renderer/src/components/CompactPrimitives.tsx)

## 기본 원칙

1. viewport가 아니라 컨테이너 폭 기준으로 반응형을 처리한다.
2. 좁아졌을 때는 컬럼 수를 유지하려 하지 말고 카드형으로 전환한다.
3. 제목과 핵심 상태를 1순위로 두고, 메타 정보는 아래로 내린다.
4. 액션 버튼은 우측 밀집 배치보다 하단 action row를 우선한다.
5. 경로, command, bundle id처럼 긴 문자열은 별도 block이나 mono row로 분리한다.
6. `StatusMessage` 같은 상단 안내 블록과 실제 목록 사이에는 여백을 둔다.

## 공통 breakpoint 사용

새 임계값이 필요하면 화면 내부 상수로 만들지 말고 `RESPONSIVE_WIDTH`에 추가합니다.

현재 기준값:

| Key | Threshold | Used for |
|------|-----------|----------|
| `installedAppsCompact` | `980` | Installed Apps compact card layout |
| `leftoverAppsCompact` | `1080` | Leftover Data compact card layout |
| `registryAppsCompact` | `1040` | Registry Cleanup compact card layout |
| `listeningPortsCompact` | `1120` | Port Finder compact card layout |
| `processTableCompact` | `980` | Processes compact card layout |
| `portWatchCompact` | `960` | Port Watch compact layout |
| `dockerPageCompact` | `980` | Docker page tabs and list screens compact layout |
| `settingsPageCompact` | `920` | Settings page header and save bar compact layout |

```ts
import { isCompactWidth, RESPONSIVE_WIDTH } from "../../hooks/useResponsiveLayout";

export function shouldUseExampleCompactLayout(width: number): boolean {
  return isCompactWidth(width, RESPONSIVE_WIDTH.exampleCompact);
}
```

권장 방식:

- `shouldUseXCompactLayout(width)` 형태의 helper를 export 한다.
- 페이지 컴포넌트도 예외 없이 같은 방식으로 helper를 export 한다.
- threshold 비교는 직접 `width < 960`처럼 쓰지 않는다.
- 테스트는 helper 기준으로 고정한다.

페이지 레벨 예시:

```ts
export function shouldUseSettingsPageCompactLayout(width: number): boolean {
  return isCompactWidth(width, RESPONSIVE_WIDTH.settingsPageCompact);
}
```

## 구현 패턴

### 1. 컨테이너 폭 측정

```tsx
const [containerRef, containerWidth] = useContainerWidth(1200);
const compactLayout = shouldUseExampleCompactLayout(containerWidth);

return <section ref={containerRef}>...</section>;
```

규칙:

- 기본 폭은 현재 화면의 일반적인 데스크톱 폭에 맞춘다.
- `compactLayout`은 렌더 분기, 컨트롤 wrap, 입력 width 조정에만 사용한다.

### 2. 리스트 화면 전환

넓은 폭:

- table 또는 grid 유지
- 비교 가능한 컬럼 정보 유지

좁은 폭:

- 카드형 list로 전환
- 이름, 상태, 핵심 수치 먼저 노출
- 보조 메타는 2열 또는 1열 grid로 아래 배치
- 액션은 카드 하단에 모은다

권장 순서:

1. title row
2. 상태 badge / 핵심 metric
3. 메타 grid
4. 긴 문자열 block
5. action row

### 2-1. 공통 compact primitives 우선 사용

다음 구조가 2개 이상 화면에서 반복되면 로컬 style 재작성보다 `CompactPrimitives`를 먼저 사용합니다.

- `compactListStyle`
- `compactCardStyle`
- `compactCardHeaderStyle`
- `compactMetaGridStyle`
- `compactActionsStyle`
- `compactStatusSpacingStyle`
- `CompactMetaItem`

규칙:

- `compact meta` 카드 구조는 `CompactMetaItem`으로 우선 통일한다.
- `StatusMessage` 아래 간격은 `compactStatusSpacingStyle`로 맞춘다.
- bulk selection bar, meta grid, action row가 기존 패턴과 같으면 공통 primitive를 그대로 쓴다.
- 2개 이상 화면에서 같은 compact 구조가 반복되면 공통화 검토가 아니라 공통화 우선으로 본다.

### 3. 컨트롤 영역 정리

최소 폭에서는 필터, segmented control, 검색 input이 한 줄 유지에 집착하지 않아야 합니다.

- `flexWrap: "wrap"` 허용
- compact일 때 input은 `minWidth: "100%"` 또는 `flex: "1 1 100%"`
- segmented control은 폭 부족 시 다음 줄로 이동 가능하게 둔다

## 화면별 적용 예시

- Apps
  - `Installed`, `Leftover Data`, `Registry Cleanup`은 table/row형에서 카드형으로 전환
- Activity
  - `Port Finder`, `Port Watch`, `Processes`는 좁은 폭에서 메타 중심 카드형으로 전환
- Docker
  - `Containers`, `Images`, `Volumes`는 좁은 폭에서 관리용 table 대신 카드형으로 전환
  - 탭 strip은 wrap 가능해야 하고, status badge와 destructive action은 상단에서 바로 식별 가능해야 한다
- Settings
  - 페이지 헤더, threshold 입력, path row, sticky save bar는 최소 폭에서 세로 재배치가 가능해야 한다

참고 구현:

- [src/renderer/src/features/apps/InstalledApps.tsx](/Users/beni/SystemScope/src/renderer/src/features/apps/InstalledApps.tsx)
- [src/renderer/src/features/apps/LeftoverApps.tsx](/Users/beni/SystemScope/src/renderer/src/features/apps/LeftoverApps.tsx)
- [src/renderer/src/features/apps/RegistryApps.tsx](/Users/beni/SystemScope/src/renderer/src/features/apps/RegistryApps.tsx)
- [src/renderer/src/features/process/ListeningPorts.tsx](/Users/beni/SystemScope/src/renderer/src/features/process/ListeningPorts.tsx)
- [src/renderer/src/features/process/PortWatch.tsx](/Users/beni/SystemScope/src/renderer/src/features/process/PortWatch.tsx)
- [src/renderer/src/features/process/ProcessTable.tsx](/Users/beni/SystemScope/src/renderer/src/features/process/ProcessTable.tsx)
- [src/renderer/src/features/docker/DockerContainers.tsx](/Users/beni/SystemScope/src/renderer/src/features/docker/DockerContainers.tsx)
- [src/renderer/src/features/disk/DockerImages.tsx](/Users/beni/SystemScope/src/renderer/src/features/disk/DockerImages.tsx)
- [src/renderer/src/features/docker/DockerVolumes.tsx](/Users/beni/SystemScope/src/renderer/src/features/docker/DockerVolumes.tsx)
- [src/renderer/src/pages/SettingsPage.tsx](/Users/beni/SystemScope/src/renderer/src/pages/SettingsPage.tsx)
- [src/renderer/src/pages/DockerPage.tsx](/Users/beni/SystemScope/src/renderer/src/pages/DockerPage.tsx)

## 스타일 규칙

- compact 전용 style object는 파일 하단에 모은다.
- `compactCardStyle`, `compactMetaGridStyle`, `compactActionsStyle`처럼 의미 기반 이름을 쓴다.
- 이미 존재하는 카드 패턴이 있으면 복사보다 명명 규칙과 구조를 맞춘다.
- 공용으로 뺀 구조는 각 파일에서 다시 같은 이름으로 재정의하지 않는다.
- 불필요한 animation이나 복잡한 조건부 스타일보다 정보 위계 정리에 집중한다.

## 텍스트 / i18n 규칙

Renderer 작업 중 텍스트를 추가하거나 수정할 때는 번역 규칙도 함께 지켜야 합니다.

파일 구조:

- `en.ts` — **단일 소스**. 구조화 키 → 영어 문구를 정의하고 `TranslationKey` 타입을 export 한다.
- `ko.ts` — `Record<TranslationKey, string>` 타입으로 선언되어, en.ts의 키를 빠짐없이 구현해야 컴파일된다.
- `index.ts` — 두 locale 파일을 합쳐 Map을 만들고 `translate()` 함수를 제공한다.

> `keys.ts`는 더 이상 사용하지 않는다. 구조화 키와 타입은 모두 `en.ts`에서 관리한다.

기본 원칙:

1. 새 번역 호출은 항상 `tk(...)`를 사용한다.
2. 새 `t(...)`, `translateLiteral(...)`, `translateKey(...)` 사용을 추가하지 않는다.
3. helper나 component prop으로 번역 함수를 전달할 때는 `TranslateFn`을 사용한다.
4. 문구를 추가할 때는 아래 2개 파일을 같은 변경에서 함께 수정한다.
   - `src/shared/i18n/locales/en.ts` — 구조화 키와 영어 문구
   - `src/shared/i18n/locales/ko.ts` — 같은 키에 한국어 문구
5. 문구 의미가 바뀌지 않았다면 key 이름은 바꾸지 않는다.
6. ko.ts에 키가 누락되면 TypeScript 컴파일 에러가 발생한다. en.ts에 키를 추가하면 반드시 ko.ts에도 추가한다.

권장 key 규칙:

- `settings.updates.check`처럼 기능 단위 dot-notation prefix를 사용한다.
- 재사용되는 버튼, 에러 메시지, empty state, 안내 문구는 explicit key를 우선한다.
- 키에 `{}`, `"`, `?`, `:`, `()`, `%`, `—` 같은 특수문자가 들어가서는 안 된다. interpolation(`{variable}`)은 값(value)에만 사용한다.
- 키는 반드시 `section.name` 형식의 구조화된 키여야 한다. 영어 문장을 키로 쓰지 않는다.

타입 규칙:

- `TranslationKey`는 `en.ts`에서 `keyof typeof EN_MESSAGES`로 자동 생성된다.
- 공용 helper/component prop의 번역 함수 타입은 `@shared/i18n`의 `TranslateFn`을 사용한다.
- key-only 값이 정말 필요한 경우에만 `TranslationKey`를 직접 쓴다.
- helper가 key와 일반 문자열을 모두 처리한다면 `TranslateFn`을 사용한다.

새 문자열 추가 절차:

1. `src/shared/i18n/locales/en.ts`에 구조화 키와 영어 문구를 추가한다.
2. `src/shared/i18n/locales/ko.ts`에 같은 키로 한국어 문구를 추가한다.
3. 호출부에서는 `tk("your.new.key")`를 사용한다.
4. 마지막에 `npm run check`를 실행한다.

피해야 할 패턴:

- locale 파일 하나만 수정하는 방식 (ko.ts 누락 시 컴파일 에러)
- 중복 key 추가
- locale 파일 객체 구조를 깨뜨리는 편집
- `TranslateFn` 대신 ad-hoc 함수 시그니처를 다시 선언하는 방식
- key 전용/리터럴 전용 wrapper를 다시 분리하는 방식
- 별도 `keys.ts` 파일을 다시 만드는 방식 (en.ts가 단일 소스)
- 키에 영어 문장이나 특수문자를 사용하는 방식 (예: `"Do you want to delete {count} items?"` 대신 `"dialog.confirmDelete"` 사용)

## 테스트 규칙

반응형 동작은 helper 함수 기준으로 테스트합니다.

예시:

```ts
expect(shouldUseExampleCompactLayout(959)).toBe(true);
expect(shouldUseExampleCompactLayout(960)).toBe(false);
```

현재 예시 테스트:

- [tests/unit/appsPage.test.ts](/Users/beni/SystemScope/tests/unit/appsPage.test.ts)
- [tests/unit/listeningPorts.test.ts](/Users/beni/SystemScope/tests/unit/listeningPorts.test.ts)
- [tests/unit/processTable.test.ts](/Users/beni/SystemScope/tests/unit/processTable.test.ts)
- [tests/unit/portWatchLayout.test.ts](/Users/beni/SystemScope/tests/unit/portWatchLayout.test.ts)
- [tests/unit/dockerLayout.test.ts](/Users/beni/SystemScope/tests/unit/dockerLayout.test.ts)
- [tests/unit/settingsPage.test.ts](/Users/beni/SystemScope/tests/unit/settingsPage.test.ts)

## 새 화면 추가 체크리스트

- `useContainerWidth`를 붙였는가
- `RESPONSIVE_WIDTH`에 threshold를 정의했는가
- `shouldUseXCompactLayout` helper를 export 했는가
- 공통 `CompactPrimitives`로 대체 가능한 부분을 먼저 확인했는가
- 좁은 폭에서 카드형 또는 재배치 레이아웃이 있는가
- 상단 안내 메시지와 본문 사이 여백이 있는가
- 긴 문자열이 레이아웃을 깨지 않는가
- threshold helper 테스트가 있는가

## 피해야 할 패턴

- 컴포넌트 내부에 매직 넘버 threshold를 직접 쓰는 방식
- 좁은 폭에서도 테이블 컬럼 수를 그대로 유지하는 방식
- 핵심 정보와 보조 정보를 같은 시각 강도로 나열하는 방식
- 상태 메시지 카드와 첫 번째 데이터 카드가 바로 붙는 구조
- 한 화면 안에서만 통하는 ad-hoc 스타일 이름
- 공통 primitive로 해결 가능한 구조를 다시 로컬 복사하는 방식
