# 장면 데이터 런타임 설계 (계약 §4 구현)

- 작성일: 2026-09-08
- 상태: 설계 승인됨 (구현 대기)
- 표준: `docs/standards/scene-data-contract.md`

## 1. 배경과 문제

표준(장면 데이터 계약)은 문서 봉투·객체 패치·객체 규칙·등록부·저장소를 정한다. 현재 코드에는 `filmSceneData.ts`(production 하나)와 `useFilmPlayback.updateSceneData`(호출자 없음)만 있고, 에너지·공정망·제품검사·SPC·환경 5개 장면은 `data` 인자를 받도록 만들어졌지만 디스패처가 인자를 버린다. 상단 8개 지표 카드(`jarvisMainData.ts`)는 import 시점 상수를 읽어 주입 데이터에 반응하지 않는다.

## 2. 목표 / 비목표

목표

- 봉투·패치 타입과 검증, 등록부, 저장소를 구현한다.
- `FilmSceneData`를 6개 키(production, environment, energy, network, product, spc)로 확장하고 디스패처가 6개 장면(막대·환경·에너지·공정망·제품검사·SPC)에 데이터를 넘기게 한다.
- 막대·환경·공정망·SPC 장면에 객체 패치를 적용한다(L2). 에너지·제품검사는 전체 교체만(L1).
- 지표 카드 계산을 저장소 입력 함수로 바꾼다(화면 연결은 다음 단계).
- `useFilmPlayback`이 저장소를 소유하고 `applySceneDocument`, `applySceneObjects`, `updateSceneData`, `sceneProvenance`를 노출한다.

비목표

- 어댑터 4종(폴링·푸시·HATCHERY 도구 호출·정적 JSON) 구현.
- L0 장면 이관, 에너지·제품검사의 L2 이관, 값 변경 보간, 출처 표시 UI.

## 3. 설계 결정 요약

| 결정 | 선택 | 근거 |
|---|---|---|
| 검증 깊이 | 봉투는 엄격, `data`는 등록부의 `normalize`가 구조만 확인 | 장면별 의미 검증은 각 장면의 상태 함수(`analyzeSpc` 등)가 이미 한다. |
| 패치 대상 찾기 | `id` 필드 배열에 대한 공통 도우미 `patchObjectsById` | 막대·환경·공정망·SPC가 같은 규칙을 공유한다. |
| 저장소 형태 | React 밖의 순수 객체 `createSceneDataStore()` + `subscribe` | 렌더 루프(rAF)가 React 상태 없이 읽고, 테스트가 React 없이 돈다. |
| 우선순위 | 도착 순서(마지막 갱신이 이김) | 표준 §4. |
| 환경 장면 데이터 경로 | `createEnvironmentSelection.update(time, data)`에 데이터를 넘긴다 | 환경 장면의 프레임은 선택 세션이 계산하므로 그 경로에 데이터를 실어야 한다. |
| 지표 카드 | `hatcheryMainData(data)`, `hatcheryMetrics(data)` 함수 + 기존 상수는 기본값으로 호출한 결과 | 기존 소비자를 깨지 않고 저장소 입력을 받을 수 있게 한다. |

## 4. 상세 설계

### 4.1 `sceneDataDocument.ts`

```ts
export const SCENE_DATA_VERSION = 1 as const;
export const SCENE_DATA_SOURCES = ['mes', 'push', 'hatchery', 'static', 'demo'] as const;
export type SceneDataSource = typeof SCENE_DATA_SOURCES[number];
export interface SceneDataEnvelope { scene: FilmId; source: SceneDataSource; at: string }
export interface SceneDataDocument<T = unknown> extends SceneDataEnvelope { version: typeof SCENE_DATA_VERSION; data: T }
export type SceneObjectChange = { id: string } & Record<string, unknown>;
export interface SceneObjectPatch extends SceneDataEnvelope { objects: readonly SceneObjectChange[] }
export type SceneDataResult =
  | { ok: true; scene: FilmId; applied: number; ignored: string[] }
  | { ok: false; scene?: string; reason: string };
export function parseSceneDataDocument(input: unknown): { ok: true; document: SceneDataDocument } | { ok: false; reason: string }
export function parseSceneObjectPatch(input: unknown): { ok: true; patch: SceneObjectPatch } | { ok: false; reason: string }
export function patchObjectsById<T extends { id: string }>(items: readonly T[], objects: readonly SceneObjectChange[]): { items: T[]; applied: number; ignored: string[] }
```

- 봉투 검증: `scene`은 `FILM_CHAPTERS`의 id, `version === 1`(문서만), `source`는 목록 중 하나, `at`은 `Date.parse`가 유한한 문자열, `data`는 객체, `objects`는 `id`가 비어 있지 않은 문자열인 객체 배열(빈 배열 거부).
- `patchObjectsById`: `id`·`label`은 덮어쓰지 않는다. 각 change에서 `id`를 제외한 필드만 얕게 병합한다. 없는 id는 `ignored`.

### 4.2 `filmSceneData.ts` 확장

```ts
export interface FilmSceneData {
  production: ProductionSnapshot; environment: ZoneEnvironmentData; energy: EnergyCoreData;
  network: ProcessNetworkData; product: ProductInspectionData; spc: SpcData;
}
export type FilmSceneDataKey = keyof FilmSceneData;
export const DEFAULT_FILM_SCENE_DATA: FilmSceneData
export function mergeFilmSceneData(base, change: Partial<FilmSceneData>): FilmSceneData   // 정의된 키만 덮어씀
```

### 4.3 `sceneDataRegistry.ts`

```ts
export interface SceneDataEntry<K extends FilmSceneDataKey = FilmSceneDataKey> {
  key: K;
  normalize(data: unknown): FilmSceneData[K] | undefined;           // 구조가 맞지 않으면 undefined
  patch?(data: FilmSceneData[K], objects: readonly SceneObjectChange[]): { data: FilmSceneData[K]; applied: number; ignored: string[] };
}
export const SCENE_DATA_REGISTRY: Partial<Record<FilmId, SceneDataEntry>>
export function sceneDataEntry(scene: string): SceneDataEntry | undefined
```

등록: `bars`·`pie` → production(normalize: `unit` 문자열, `target` 숫자, `lines` 배열, 각 항목 `id`·`label` 문자열·`value` 숫자; patch: lines). `wave` → environment(zones 배열, 각 `id`·`name`; patch: zones, `id` 기준). `network` → network(nodes·links 배열; patch: nodes). `spc` → spc(subgroups 배열, 각 `id`·`values` 배열; patch: subgroups). `energy` → energy(power·production·efficiency 객체; patch 없음). `product` → product(measurements 배열; patch 없음).

### 4.4 `sceneDataStore.ts`

```ts
export interface SceneDataProvenance { source: SceneDataSource; at: string }
export function createSceneDataStore(initial: FilmSceneData = DEFAULT_FILM_SCENE_DATA) {
  return {
    get(): FilmSceneData,
    provenance(key: FilmSceneDataKey): SceneDataProvenance | undefined,
    replace(input: unknown): SceneDataResult,     // parse → registry.normalize → 교체 → provenance → notify
    patch(input: unknown): SceneDataResult,       // parse → registry.patch → provenance → notify
    merge(change: Partial<FilmSceneData>, provenance = { source: 'demo', at: now }): void,
    subscribe(listener: (data: FilmSceneData) => void): () => void,
  };
}
```

- `get()`은 항상 같은 객체를 돌려주다가 갱신 시 새 객체로 바꾼다(참조 비교로 변경 감지 가능).
- 실패한 `replace`/`patch`는 저장소를 바꾸지 않고 `notify`하지 않는다.

### 4.5 디스패처·재생 훅·환경 세션

- `drawSignalFilm.ts` renderers: `energy → data.energy`, `network → data.network`, `product → data.product`, `spc → data.spc`, `wave → drawWaveFilm(..., data.environment, environment)`.
- `environmentSelection.ts`: `update(time, data = DEFAULT_ENVIRONMENT_DATA)`가 `zoneEnvironmentState(time, data, selectedId)`를 호출한다. `useEnvironmentSelection.update(time, data?)`도 같은 인자를 전달한다.
- `useFilmPlayback.ts`: `clock.current.sceneData`를 없애고 `const [store] = useState(() => createSceneDataStore())`. 렌더 루프는 `store.get()`을 읽고 `updateEnvironment(localTime | null, store.get().environment)`를 호출한다. `subscribe`로 React `sceneData` 상태를 갱신한다. 반환: `sceneData`, `sceneProvenance(key)`, `applySceneDocument(input)`, `applySceneObjects(input)`, `updateSceneData(change)`(= `store.merge`).

### 4.6 `jarvisMainData.ts`

`hatcheryMainData(data: FilmSceneData)`와 `hatcheryMetrics(data: FilmSceneData)`를 export 하고, 기존 `jarvisMainData`·`jarvisMainMetrics`는 `DEFAULT_FILM_SCENE_DATA`로 호출한 결과로 유지한다. `JarvisMetricKind` 타입은 유지한다.

## 5. 에러 처리

- 봉투 오류·미등록 장면·구조 불일치·패치 미지원은 모두 `{ ok: false, reason }`. 예외 없음.
- 패치에서 없는 id는 `ignored`로 보고하고 나머지는 적용한다. 전부 없는 id면 `ok: false`.
- `merge`는 검증하지 않는다(코드 내부용). 어댑터는 `replace`/`patch`만 쓴다.

## 6. 테스트 전략

- `cinemaSceneDataDocument.test.ts`: 봉투 검증 각 실패 사유, `patchObjectsById`의 id·label 보호와 ignored.
- `cinemaSceneDataRegistry.test.ts`: 6개 키 normalize 성공/실패, bars·wave·network·spc 패치, energy·product 패치 없음.
- `cinemaSceneDataStore.test.ts`: replace/patch 성공 시 get 참조 변경·provenance·subscribe 호출, 실패 시 무변경·무통지, 마지막 갱신 우선, merge.
- `cinemaFilmSceneData.test.ts`(확장): `drawSignalFilm`에 주입한 energy·network·product·spc·environment 값이 각 장면 시각에 그려지는지(가짜 canvas).
- `cinemaEnvironmentSelection.test.ts`(확장): `update(time, data)`가 주입 구역 id를 프레임에 반영.
- `cinemaHatcheryMetrics.test.ts`: `hatcheryMetrics(data)`가 주입 데이터로 카드 값을 바꾸고 기본값 호출은 기존 `jarvisMainMetrics`와 같다.

## 7. 제외한 대안

- Zod 등 스키마 라이브러리 도입: 서버 쪽(`src/server/cinema/openai.ts`)은 이미 Zod를 쓰지만 클라이언트 번들에 추가하지 않고 손 검증으로 충분하다. 장면별 의미 검증은 상태 함수가 담당한다.
- React Context로 저장소 공유: 렌더 루프가 rAF에서 읽으므로 순수 객체 + subscribe가 단순하다.
