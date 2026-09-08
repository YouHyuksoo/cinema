# 장면 객체 식별자와 막대 장면 데이터 주입 설계

- 작성일: 2026-09-08
- 상태: 설계 승인됨 (구현 대기)

## 1. 배경과 문제

이 프로젝트의 목적은 AI와 데이터로 정보를 역동적으로 표현하는 것이다. 그러려면 화면의 객체 하나하나(막대, 기어, 게이지, 공정 노드)가 실제 값 하나를 표현해야 한다.

현재 코드는 "객체가 값을 그리는 구조"는 갖췄지만 "값을 밖에서 넣어주는 통로"가 대부분 끊겨 있다.

- 막대 장면(`drawBarFilm.ts`)과 파이 장면(`drawPieFilm.ts`)은 `chartData.ts`의 상수 `PRODUCTION_LINES`를 직접 import 한다.
- 선택 막대는 `SELECTED_LINE_INDEX = 3`으로 고정돼 있어 라인이 3개 이하면 깨진다.
- 눈금 최대값이 1000으로 고정돼 있다.
- 객체를 배열 인덱스와 라벨 문자열로만 구분하고, 장면마다 식별자 규칙이 제각각이다(`id`, `key`, `code`, `L1-reflow`, `ZONE 01`).
- 라인 수는 데이터에 따라 2개일 수도 10개일 수도 있는데, 헤더 문구("05 CHANNELS")와 상세 패널이 5개 기준이다.

## 2. 목표 / 비목표

목표

- 모든 장면 객체가 따르는 공통 식별자 규칙과 최소 인터페이스를 정의한다.
- 막대 장면을 첫 적용 대상으로 삼아, 장면 데이터 객체를 외부에서 주입받아 그리게 한다.
- 라인 수 1~20개에서 배치·문구·선택 연출이 깨지지 않게 한다.
- AI 명령·외부 API가 나중에 같은 입구를 쓸 수 있도록 주입 통로(상태 + setter)를 만든다.

비목표 (다음 단계)

- 파이 장면 이관. 파이는 `chartData.ts`가 기본 스냅샷에서 파생한 값을 계속 export 하므로 동작이 바뀌지 않는다.
- AI 응답으로 값을 갱신하는 명령 구조, 외부 데이터 피드.
- 값이 바뀔 때 이전값에서 새값으로 보간하는 애니메이션. 실시간 갱신이 붙을 때 넣는다.
- 기존 장면(에너지·공정망·제품검사 등)의 식별자 통일.

## 3. 설계 결정 요약

| 결정 | 선택 | 근거 |
|---|---|---|
| 식별자 형태 | 도메인 코드 그대로 (예: `LINE-01`, MES 라인 코드) | AI가 참조하기 쉽고, 기준정보와 매핑 테이블 없이 조인된다. 재현 가능하다. |
| UUID 사용 여부 | 자연키가 있는 객체에는 쓰지 않음 | 새로고침마다 바뀌는 ID는 테스트·로그·명령에 쓸 수 없다. 런타임 인스턴스(흐르는 PCB, 알람)에만 허용. |
| 계층형 문자열(`bars.line.01`) | 채택하지 않음 | 같은 라인이 여러 장면에 나오면 id가 장면마다 달라진다. 장면 구분은 데이터 객체 구조(`FilmSceneData.production.lines`)로 표현한다. |
| 데이터 입구 | 장면 데이터 객체 주입 (`FilmSceneData`) | 시연 데이터는 기본값으로 두고, AI·API는 같은 setter를 호출한다. |
| 선택 막대 규칙 | `selectedId` 우선, 없으면 목표 미달 중 달성률 최저, 모두 달성이면 선택 없음 | 데이터가 강조 대상을 지정할 수 있고, 없어도 연출이 의미 있는 대상을 고른다. |
| 지원 라인 수 | 1~20개 | 20개까지 라벨과 숫자가 겹치지 않게 밀도에 따라 글자 크기와 보조 표기를 조정한다. |
| 눈금 최대값 | 값·목표 중 큰 값에 여유를 둔 계산값 | 고정 1000은 값 범위가 바뀌면 막대가 잘리거나 납작해진다. |

## 4. 상세 설계

### 4.1 공통 객체 계층 — `src/cinema/sceneObject.ts`

```ts
export interface SceneObject { id: string; label: string }
export interface MetricObject extends SceneObject { value: number; unit?: string }

/** 빈 id·공백 id·중복 id를 제거한다. 중복은 앞 항목을 남긴다. label이 비면 id를 쓴다. */
export function normalizeSceneObjects<T extends SceneObject>(items: readonly T[]): T[]
export function findSceneObject<T extends SceneObject>(items: readonly T[], id: string | null | undefined): T | undefined
```

규칙

- `id`는 공백을 제거한 비어 있지 않은 문자열이며 같은 목록 안에서 유일하다. 대소문자를 구분한다.
- `id`는 도메인 코드다. 화면 표시용 문자열은 `label`에 둔다.
- 그리기 함수는 정규화된 목록만 받는다. 객체 조회는 항상 `id`로 한다. 배열 인덱스는 배치 계산에만 쓴다.
- 런타임에 생기고 사라지는 개체(추적 장면의 PCB, 알람 이벤트)는 이 인터페이스 대상이 아니다. 필요하면 증가 번호나 UUID를 쓴다.

### 4.2 막대 장면 데이터 모델 — `src/cinema/productionSnapshot.ts`

```ts
export interface ProductionLine extends SceneObject { value: number; color?: string; accent?: boolean }
export interface ProductionSnapshot {
  unit: string;                 // 'EA'
  target: number;               // 라인당 목표
  lines: readonly ProductionLine[];
  selectedId?: string | null;   // 강조할 라인. 없거나 목록에 없으면 규칙으로 선택
}
export const DEFAULT_PRODUCTION_SNAPSHOT: ProductionSnapshot   // 현재 5개 라인 그대로. id는 'LINE-01'…'LINE-05', label은 'LINE 01'…

export interface ProductionSnapshotState {
  lines: ProductionLine[];      // 정규화된 목록
  unit: string; target: number;
  total: number; aggregateTarget: number; aggregateRatio: number; reached: number;
  maximum: number;              // 눈금 최대값
  selectedIndex: number | undefined; selected: ProductionLine | undefined;
}
export function productionSnapshotState(snapshot: ProductionSnapshot): ProductionSnapshotState
export function selectProductionLine(lines, target, selectedId): number | undefined
export function productionScale(lines, target): number
```

- `selectProductionLine`: `selectedId`가 정규화된 목록에 있으면 그 인덱스. 없으면 `value < target`인 라인 중 `value / target`이 가장 낮은 라인. 동률이면 앞 항목. 미달 라인이 없으면 `undefined`.
- `productionScale`: `max(최대 value, target, 1)`에 15% 여유를 두고 자릿수에 맞는 "보기 좋은 값"(1·2·5·10 배수)으로 올림.
- 값이 유한하지 않거나 음수면 0으로 취급한다(기존 `barTelemetryGeometry`의 `positive`와 같은 규칙).
- `target`이 유한하지 않거나 0 이하면 0으로 취급하고, 달성률·미달 판정은 하지 않는다(선택 없음).

`chartData.ts`는 `DEFAULT_PRODUCTION_SNAPSHOT`에서 `PRODUCTION_LINES`, `PRODUCTION_TOTAL`, `PRODUCTION_TARGET`, `SELECTED_LINE_INDEX`를 파생해 계속 export 한다. 파이 장면은 손대지 않는다.

### 4.3 주입 경로 — `src/cinema/filmSceneData.ts`, `drawSignalFilm.ts`, `useFilmPlayback.ts`

```ts
export interface FilmSceneData { production: ProductionSnapshot }
export const DEFAULT_FILM_SCENE_DATA: FilmSceneData
```

- `drawSignalFilm(ctx, width, height, t, fonts, insets, charts, factory, environment, data = DEFAULT_FILM_SCENE_DATA)`: 마지막 인자로 추가한다. `Renderer` 타입에도 `data` 인자를 더하고, `bars` renderer가 `data.production`을 `drawBarFilm`에 넘긴다. 다른 renderer는 무시한다.
- `drawBarFilm(ctx, width, height, t, fonts, presentation, insets, snapshot = DEFAULT_PRODUCTION_SNAPSHOT)`: `chartData.ts` import를 제거하고 `productionSnapshotState(snapshot)` 결과만 읽는다.
- `useFilmPlayback`: `clock.current.sceneData`와 `sceneData` state, `updateSceneData(change: Partial<FilmSceneData>)`를 추가한다. 렌더 루프는 `current.sceneData`를 `drawSignalFilm`에 넘긴다. `SignalFilm.tsx`는 이번에 setter를 호출하지 않는다.

데이터 흐름: `FilmSceneData` → `drawSignalFilm` → `drawBarFilm` → `productionSnapshotState` → `drawBarChart`(정규화된 `lines`를 `BarDatum[]`으로 전달).

### 4.4 가변 개수 연출 — `barTelemetryGeometry.ts`, `drawBarChart.ts`, `drawBarFilm.ts`

- `barTelemetryLayout`이 밀도 값을 계산해 반환한다. `channelScale = clamp(slot / 138, .45, 1)`(138은 5개 기준 슬롯 폭), `compact = slot < 70`.
- `drawBarChart`: 헤더(`T1`, `CH / 01`), 값 텍스트, 라벨 글자 크기에 `channelScale`을 곱한다. `compact`이면 `OUTPUT`, 눈금 점 7개, `% FS`를 그리지 않고 `CH / nn`도 생략해 `T` 번호만 남긴다. 라벨·값의 `maxWidth`는 지금처럼 `slot - 10/12`를 유지한다.
- `drawBarFilm`
  - `activeIndex`는 `state.selectedIndex`를 쓴다. `undefined`면 포커스 구간(9~24.5초)과 우측 상세 패널을 건너뛴다. 요약 세 항목은 항상 그린다.
  - "05 CHANNELS" → `${String(n).padStart(2,'0')} CHANNELS`. "LINES ON TARGET" → `reached / n`.
  - `maxValue`는 `state.maximum`.
  - 라인 0개: `barTelemetryLayout`이 `undefined`를 반환하므로 차트를 그리지 않고 총계 0으로 요약만 그린다.
- 연출 시간(28초)과 포커스 타이밍은 바꾸지 않는다. 등장 stagger는 이미 `min(.25, 3/(n-1))`로 총 3초 안에 끝난다.

## 5. 에러 처리

- 빈 id·중복 id는 정규화 단계에서 조용히 제거한다. 화면은 남은 항목으로 그린다.
- `selectedId`가 목록에 없으면 규칙 선택으로 넘어간다. 오류를 내지 않는다.
- 값·목표가 유한하지 않거나 음수면 0으로 취급한다. 목표가 0이면 달성률과 선택을 계산하지 않는다.
- 라인 0개, 1개, 20개 초과 모두 예외 없이 그린다. 20개 초과는 겹침을 보장하지 않는다.
- `FilmSceneData`의 일부만 갱신해도 나머지는 기본값을 유지한다(`updateSceneData`가 병합).

## 6. 테스트 전략

Vitest 단위 테스트, `tests/unit/scenes/` 아래. 기존 `canvasFixture` 패턴(Proxy 기반 가짜 `CanvasRenderingContext2D`, `cinemaFrameState.test.ts`)을 재사용한다.

- `cinemaSceneObject.test.ts`: 빈 id·공백 id 제거, 중복은 앞 항목 유지, label 비면 id 대체, `findSceneObject`.
- `cinemaProductionSnapshot.test.ts`: 선택 규칙 4가지(selectedId 존재 / 없음→미달 최저 / 목록에 없는 selectedId→규칙 / 모두 달성→undefined), 목표 0일 때 선택 없음, 합계·달성 라인 수, 눈금 계산이 최대값과 목표를 항상 포함하고 보기 좋은 값인지, 기본 스냅샷이 `chartData.ts` 파생값과 일치하는지.
- `cinemaBarTelemetry.test.ts`(확장): 1·2·12·20개에서 `channelScale` 범위와 `compact` 판정, 모든 컬럼이 차트 영역 안에 있는지.
- `cinemaBarFilm.test.ts`: 가짜 canvas로 2개·20개·선택 없음·0개 스냅샷을 그려 예외 없음, 헤더 문구에 실제 개수, 선택 없음일 때 상세 패널 텍스트(`ACTUAL OUTPUT`)가 없음, 주입한 라인 label이 그려짐.
- `cinemaFrameState.test.ts`(확장 또는 별도): `drawSignalFilm`에 `data`를 넘기면 막대 장면 시각(bars 챕터 시작 + 8초)에 주입한 label이 그려지는지.

구현은 테스트 먼저 작성 후 진행한다. 기존 테스트 전체가 통과해야 한다.

## 7. 제외한 대안

- **UUID 부여**: 자연키가 있는 객체에 불필요한 매핑을 만들고 AI가 참조할 수 없다.
- **계층형 전역 문자열 id**: 장면 간 같은 객체의 id가 달라진다. 장면 구분은 데이터 구조로 한다.
- **AI 명령·API 피드까지 한 번에**: 입구가 먼저 있어야 붙일 수 있다. 범위를 나눈다.
- **막대 장면 안에서 상수만 파라미터로 바꾸기**: 식별자와 선택 규칙이 없으면 가변 개수에서 다시 깨진다.
