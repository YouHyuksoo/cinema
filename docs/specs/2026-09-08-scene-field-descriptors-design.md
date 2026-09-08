# 필드 서술자와 객체 타입 모듈 설계 (막대 라인 첫 적용)

- 작성일: 2026-09-08
- 상태: 설계 승인됨 (구현 대기)
- 표준: `docs/standards/scene-data-contract.md` §3 (이 설계로 "필드 서술자"·"객체 타입 모듈" 절을 추가)

## 1. 배경과 문제

목적은 "어느 DB든 계약대로 기대값을 던지면 지금 연출이 그대로 나오는 것"이다. 그러려면 객체마다 **기대 포맷**(종류·단위·범위·소수점·목록 길이·패치 가능 여부)이 한 곳에 선언돼 있어야 한다. 지금은 같은 사실이 TypeScript 타입, 등록부 `normalize`, `HATCHERY_FIELDS`, 장면 상태 함수 네 곳에 흩어져 있다. 또 객체 패치는 필드 종류를 검사하지 않아 `{ id: 'LINE-02', value: 'abc' }`가 그대로 저장된다.

## 2. 목표 / 비목표

목표
- 필드 서술자 한 형식을 정의하고, 패치 가능한 4개 장면(막대·환경·공정망·SPC)의 필드를 서술자로 선언한다.
- 등록부의 패치 검증, HATCHERY 필드 표, 도구 스키마, 응답 단위, 값 포맷이 서술자에서 파생된다.
- 막대 라인을 첫 **객체 타입 모듈**로 묶는다: 서술자 + normalize + describe + layout + draw. 화면은 바뀌지 않는다.
- 리팩터링 전후 그리기 호출이 동일함을 지문(fingerprint) 테스트로 고정한다.

비목표
- 다른 장면의 객체 타입 모듈(이후 장면별 계획), 파일 이동(기존 `barTelemetryGeometry.ts`·`drawTelemetryBar.ts`·`drawBarChart.ts`는 자리를 유지하고 모듈이 조합한다), 값 보간, 클릭 판정(막대 장면에는 아직 상호작용이 없다).

## 3. 설계 결정 요약

| 결정 | 선택 | 근거 |
|---|---|---|
| 서술자 위치 | `sceneField.ts`(형식)와 각 객체 타입 모듈/장면 필드 파일(선언) | 형식은 하나, 선언은 객체 타입 옆에. |
| 형식 vs 데이터 | 단위·범위·소수점은 서술자, 목표치·관리범위는 데이터 | 객체마다 다른 값은 문서가 든다. |
| 객체 타입 모듈 | 속성(서술자)과 메서드(normalize·describe·layout·draw)를 가진 **타입별 모듈**, 인스턴스는 문서 | 매 프레임 `시간+데이터→화면` 구조와 테스트 방식을 유지. |
| 렌더링 이동 | 기존 함수를 모듈이 조합(`layout: barTelemetryLayout`, `draw: drawTelemetryBar`, `drawAll: drawBarChart`) | 화면 무변경을 보장하며 첫 단계 diff를 최소화. |
| 동일성 보장 | 기록형 캔버스로 그리기 호출을 전부 잡아 SHA-1 지문을 스냅샷에 고정 | 픽셀 없이도 호출 순서·좌표·색이 같음을 검사. |

## 4. 상세 설계

### 4.1 `sceneField.ts`

```ts
export type SceneFieldKind = 'number' | 'number[]' | 'text';
export interface SceneFieldDescriptor {
  field: string; label: string; kind: SceneFieldKind;
  unit?: string; min?: number; max?: number; decimals?: number; length?: number;   // number[]의 고정 길이
  patchable?: boolean; aliases?: RegExp; default?: boolean;                        // HATCHERY 명령 해석용
}
export function validateSceneField(descriptor, value: unknown): { ok: true; value: unknown } | { ok: false; reason: string }
export function formatSceneField(descriptor, value: unknown): string          // decimals·unit 적용, 목록은 ', ' 연결
export function validateSceneObjectFields(descriptors, raw: Record<string, unknown>): { ok: true } | { ok: false; reason }
```

- `number`: 유한 숫자, `min`/`max` 범위. `number[]`: 유한 숫자 배열, `length`가 있으면 길이 일치. `text`: 비어 있지 않은 문자열.
- `validateSceneObjectFields`: 서술자에 있는 필드만 검사한다(id·label은 `sceneObject.ts` 담당). 서술자에 없는 키는 허용(장면 고유 부가 필드).

### 4.2 `productionLineObject.ts` — 첫 객체 타입 모듈

```ts
export const PRODUCTION_LINE_FIELDS: readonly SceneFieldDescriptor[] = [
  { field: 'value', label: '생산량', kind: 'number', min: 0, decimals: 0, patchable: true, aliases: /생산량|실적|수량|값/, default: true },
];
export const productionLineObject = {
  type: 'productionLine' as const,
  fields: PRODUCTION_LINE_FIELDS,
  normalize(raw: unknown): ProductionLine | undefined,        // id·label 문자열 + 서술자 검증(+ color 문자열·accent 불리언 선택)
  describe(line: ProductionLine, unit: string): string,       // "LINE 02 생산량 470 EA"
  layout: barTelemetryLayout,                                  // 라인 목록 + 프레임 → 배치
  draw: drawTelemetryBar,                                      // 라인 하나
  drawAll: drawBarChart,                                       // 라인 전체(헤더·라벨·포커스 포함)
};
```

- `productionSnapshotState`·`drawBarFilm`은 그대로이며 `drawBarFilm`이 `drawBarChart` 대신 `productionLineObject.drawAll`을 호출한다. 단위는 스냅샷 데이터(`unit`)에서 오므로 서술자에는 두지 않는다.

### 4.3 장면 필드 선언 — `sceneFields.ts`

```ts
export const SCENE_FIELDS: Record<HatcheryPatchScene, readonly SceneFieldDescriptor[]> = {
  bars: PRODUCTION_LINE_FIELDS,
  wave: [{ field: 'temperature', label: '온도', kind: 'number', unit: '°C', decimals: 1, patchable: true, aliases: /온도/, default: true },
         { field: 'humidity', label: '습도', kind: 'number', unit: '%', min: 0, max: 100, decimals: 0, patchable: true, aliases: /습도/ }],
  network: [{ field: 'queue', label: '대기량', kind: 'number', unit: '개', min: 0, decimals: 0, patchable: true, aliases: /대기량|대기/, default: true },
            { field: 'capacityPerHour', label: '처리능력', kind: 'number', unit: '개/시', min: 0, decimals: 0, patchable: true, aliases: /처리\s*능력|용량/ },
            { field: 'cycleSeconds', label: '사이클', kind: 'number', unit: '초', min: 0, decimals: 1, patchable: true, aliases: /사이클|택트/ }],
  spc: [{ field: 'values', label: '측정값', kind: 'number[]', patchable: true, aliases: /측정값|값/, default: true }],
};
```

### 4.4 파생

- `hatcheryTargets.ts`: `HATCHERY_FIELDS`를 `SCENE_FIELDS`에서 만든다(`patchable`인 것만). `HatcheryField` 타입은 `SceneFieldDescriptor`의 별칭. 응답 문장의 단위는 서술자 `unit`, 없으면 데이터 단위(막대·SPC).
- `sceneDataRegistry.ts`: 각 등록 항목의 `patch`가 변경 객체를 `validateSceneObjectFields(SCENE_FIELDS[scene], change)`로 검사한다. 서술자에 있는 필드 중 종류가 틀리면 그 객체는 `ignored`가 아니라 **거부**(`ok: false`, 사유)한다. 서술자에 없는 필드를 담은 패치도 거부한다(패치는 선언된 필드만 바꾼다).
- `SET_SCENE_OBJECT_VALUES_TOOL`의 필드 enum과 `hatcheryObjectCatalog`의 필드 설명(단위·범위)도 서술자에서 나온다.

### 4.5 동일성 지문 테스트

- `tests/unit/support/recordingCanvas.ts`: 모든 메서드 호출 `[이름, ...인자]`와 속성 대입 `['set', 이름, 값]`을 기록한다. 숫자는 소수 3자리로 반올림, 그라디언트는 `gradient#n`으로 치환하고 `addColorStop`도 기록한다. `fingerprint()`는 기록의 JSON을 SHA-1로 요약한다.
- `tests/unit/scenes/cinemaBarFilmFingerprint.test.ts`: 기본 스냅샷 t ∈ {1.5, 8, 12.5, 14, 20, 26}, 2개 라인 t ∈ {8, 14}, 12개 라인 t = 8, 2D 표현 t = 8 — 각 지문과 호출 수를 `toMatchSnapshot()`으로 고정한다. **리팩터링 전에 커밋**하고, 리팩터링 후 그대로 통과해야 한다.

## 5. 에러 처리

- 서술자 검증 실패는 `{ ok: false, reason }`. 예외 없음.
- 패치의 필드 오류는 패치 전체를 거부한다(부분 적용 없음). 없는 id는 지금처럼 `ignored`.
- 기본 데이터는 모두 서술자를 통과해야 한다(테스트로 보장).

## 6. 테스트 전략

- `cinemaSceneField.test.ts`: 종류별 검증(범위·길이·문자열), 포맷(소수점·단위·목록), 객체 필드 검증이 선언 외 키를 무시.
- `cinemaProductionLineObject.test.ts`: normalize 성공/실패, describe, `fields`가 `SCENE_FIELDS.bars`와 동일, `drawAll`이 `drawBarChart`와 같은 함수.
- `cinemaSceneDataRegistry.test.ts`(확장): 종류가 틀린 패치·선언되지 않은 필드 패치 거부, 정상 패치 통과.
- `cinemaHatcheryTargets.test.ts`(확장): `HATCHERY_FIELDS`가 `SCENE_FIELDS`의 patchable 필드와 일치, 카탈로그에 단위 포함.
- `cinemaBarFilmFingerprint.test.ts`: 위 4.5.

## 7. 제외한 대안

- 클래스 인스턴스(객체가 상태와 draw를 소유): 탐색·되감기·순수 함수 테스트와 충돌한다.
- 파일 물리 이동: 화면 무변경 보장을 먼저 세운 뒤 다음 단계에서 한다.
