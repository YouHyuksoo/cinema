---
sources:
  - src/cinema/sceneDataDocument.ts
  - src/cinema/sceneDataRegistry.ts
  - src/cinema/sceneDataStore.ts
  - src/cinema/filmSceneData.ts
  - src/cinema/sceneObject.ts
  - src/cinema/drawSignalFilm.ts
  - src/cinema/useFilmPlayback.ts
verifiedCommit: be30b41
---

# 장면 데이터 계약 (Scene Data Contract)

HATCHERY의 모든 화면(장면)은 이 계약에 따라 데이터를 받고, 받은 데이터로 객체 하나하나를 동적으로 그린다. 데이터가 어디서 오든(MES 폴링, 설비 푸시, HATCHERY 음성·텍스트 명령, 정적 JSON) 화면에 닿는 형식은 하나다.

## 규칙

### 1. 문서 봉투 — 전체 교체

장면 데이터는 아래 봉투로 전달한다. `data`의 내용은 장면마다 다르고(§3), 봉투는 모든 장면이 같다.

```json
{
  "scene": "bars",
  "version": 1,
  "source": "mes",
  "at": "2026-09-08T14:00:00+09:00",
  "data": { "unit": "EA", "target": 800, "lines": [ { "id": "SMT-01", "label": "SMT 1", "value": 860 } ] }
}
```

- `scene`: 챕터 id(`filmProgram.ts`의 `FilmId`). 등록되지 않은 장면은 거부한다.
- `version`: 계약 버전. 현재 `1`. 다른 값은 거부한다.
- `source`: `mes` | `push` | `hatchery` | `static` | `demo` 중 하나.
- `at`: ISO 8601 시각 문자열. 파싱되지 않으면 거부한다.
- `data`: 장면별 스키마. 등록부의 `normalize`를 통과하지 못하면 거부한다.
- 전체 교체 문서는 장면의 객체 목록을 통째로 바꾼다. **객체 추가·삭제는 전체 교체로만 한다.**

### 2. 객체 패치 — 부분 갱신

이미 있는 객체의 값만 바꿀 때는 패치를 보낸다.

```json
{ "scene": "bars", "source": "hatchery", "at": "2026-09-08T14:00:05+09:00",
  "objects": [ { "id": "SMT-01", "value": 900 }, { "id": "SMT-02", "value": 640 } ] }
```

- 각 항목은 `id`로 객체를 찾아 **지정한 필드만** 덮어쓴다. `id`와 `label`은 패치로 바꿀 수 없다.
- 없는 `id`는 무시하고 결과의 `ignored`에 보고한다. 하나라도 적용되면 성공이다.
- 패치를 지원하지 않는 장면(§5 등급 L1)은 `ok: false`와 사유를 돌려준다.

### 3. 객체 규칙 — 모든 장면 공통

- 그려지는 객체는 **배열**이고, 각 항목은 `id`(도메인 코드, 목록 안에서 유일, 대소문자 구분), `label`(표시명), 선택적 `code`(외부 시스템 코드)를 가진다. 규칙의 근거와 정규화 동작은 `sceneObject.ts`가 정의한다.
- `id`는 MES 라인 코드·설비 코드·구역 코드 같은 **자연키를 그대로** 쓴다. UUID와 `bars.line.01` 같은 계층형 문자열은 쓰지 않는다. 런타임에 생기고 사라지는 개체(흐르는 PCB, 알람)에만 증가 번호나 UUID를 허용한다.
- 고정 키 Record(예: `{ power: …, production: …, efficiency: … }`)는 객체 목록이 아니다. `[{ id: 'power', … }, …]` 배열로 옮긴다.
- 값은 **숫자와 단위**로 넘긴다. `'96.4'`, `'목표 대비 −3.6%'`처럼 포맷된 문자열은 데이터가 아니라 장면이 파생한다.
- 장면은 **개수에 의존하지 않는다.** 배치는 `items.length`로 계산한다. 좌표나 타이밍을 개수에 박아야 하는 장면은 이 문서의 등급표에 "최대 N개, 초과분 표시 안 함"을 명시하고 초과분은 조용히 생략한다.
- **시간은 연출에만 쓴다.** 값을 `Math.sin(time)`으로 흉내내는 것은 데이터가 없을 때의 시연 모드로만 허용하고, 문서가 들어오면 그 값을 쓴다.
- 잘못된 데이터는 예외를 던지지 않는다. 장면의 상태 함수는 `{ valid: false, reason }`을 돌려주고 장면은 "데이터 없음" 화면을 그린다(`spcStatistics.ts`의 `analyzeSpc` 패턴).
- 장면의 파생 계산은 `<scene>State(time, data)` 한 함수에 모은다. 그리기 함수는 그 결과만 읽는다.

### 4. 런타임 — 등록부와 저장소

- **등록부** `sceneDataRegistry.ts`: 장면 id마다 `{ key, normalize, patch? }`를 등록한다. `key`는 `FilmSceneData`의 필드명이고, 여러 장면이 한 키를 공유할 수 있다(막대·파이 → `production`).
- **저장소** `sceneDataStore.ts`: 모든 장면 데이터와 장면별 출처(`source`, `at`)를 들고 `replace(document)`, `patch(patch)`, `merge(change)`, `subscribe(listener)`를 제공한다. 우선순위는 **마지막 갱신이 이긴다**(도착 순서, `at` 비교 없음).
- **디스패처** `drawSignalFilm.ts`: renderer는 `data[registry[scene].key]`만 받는다. 상수를 직접 import 해서 그리는 renderer는 등급 L0이다.
- **원천 어댑터**는 문서나 패치를 만들어 `replace`/`patch`를 호출하는 것만 한다. 그리기 코드나 등록부를 알지 못한다.
  - MES 폴링: 주기마다 장면별 전체 교체 문서.
  - 설비/센서 푸시: 객체 패치.
  - HATCHERY(AI): 도구 호출 결과를 객체 패치로 변환. `source: 'hatchery'`.
  - 정적 JSON: `public/cinema/data/<scene>.json`에 전체 교체 문서를 두고 시작 시 읽는다. `source: 'static'`.
- 화면은 장면별 마지막 `source`·`at`을 표시할 수 있어야 한다(출처 표시).

### 5. 장면 적합성 등급

| 등급 | 뜻 |
|---|---|
| L0 | 주입 불가. 상수를 직접 import 하거나 값을 시간으로 흉내낸다. |
| L1 | 전체 교체 문서를 받아 그리지만 객체 규칙(§3) 일부를 어긴다. 패치 불가. |
| L2 | 객체 규칙을 지키고 개수에 의존하지 않는다. 패치 가능. |
| L3 | L2 + 출처 표시 + 값 변경 시 이전값→새값 보간. |

현재 등급과 목표 (2026-09-08 기준):

| scene | 현재 | 목표 | 데이터 키 | 이관 시 손대는 파일 | 비고 |
|---|---|---|---|---|---|
| bars | L2 | L3 | production | drawBarFilm.ts, productionSnapshot.ts | 기준 구현 |
| pie | L0 | L2 | production | drawPieFilm.ts, chartData.ts | 같은 스냅샷을 읽도록 이관 |
| wave | L2 | L3 | environment | zoneEnvironment.ts, environmentLayout.ts | 최대 10구역, 초과분 생략 |
| network | L2 | L3 | network | processNetwork.ts, drawProcessNetworkFilm.ts | 노드 `position`은 데이터 소유. `index===2` 특수 처리 제거 필요 |
| spc | L2 | L3 | spc | spcData.ts, spcScene.ts | 통계는 개수 무관, 연출 타이밍은 40초 고정 |
| energy | L1 | L2 | energy | energyCore.ts, drawEnergyCoreFilm.ts | 고정 키 Record → 배열, 최대 3채널 |
| product | L1 | L2 | product | productInspection.ts, drawProductInspectionFilm.ts | `zone` 유니언 → `id`, 최대 3영역 |
| corners | L0 | L2 | (신규) summary | cornerSequence.ts, drawCornerFilm.ts | 포맷 문자열 → 숫자, 최대 4항목 |
| unfold | L0 | L2 | (신규) summary | unfoldMetrics.ts, metricMorphGeometry.ts | corners와 같은 요약 데이터 공유, 최대 4항목 |
| energy·corners·unfold 요약 카드 | L0 | L2 | 저장소 파생 | jarvisMainData.ts | import 시 상수 → 저장소 입력 함수 |
| visor / visorPan | L0 | L1 | (신규) factory | smtFactory.ts, visorTelemetry.ts | 설비 40대 배치는 데이터 소유, 온도 값 주입 |
| trace | L0 | L1 | (신규) workOrder | workOrderTrace.ts | 워크오더·불량 목록 주입, 흐름 연출은 시간 |
| console | L0 | L1 | (신규) console | drawConsoleFilm.ts | 문자열 줄 → `{ id, label, value, unit, warning }` |
| scan | L0 | L1 | (신규) equipment | drawScanFilm.ts | 설비 12대 x좌표 → 개수 기반 배치 |
| gears | L0 | L1 | (신규) gears | drawGearTrain.ts | 3개 지표 값 주입 |
| machine | L0 | L1 | (신규) machine | raceCar.ts | 계통 5개 값 주입 |

장면 이관은 장면마다 별도 스펙·계획으로 진행한다. 이관이 끝나면 이 표의 등급을 갱신한다.

## 근거

- 원천이 넷(MES 폴링, 설비 푸시, HATCHERY, 정적 JSON)이고 앞으로 더 늘 수 있다. 화면 쪽 형식이 하나여야 어댑터만 추가하면 된다.
- 객체마다 안정된 `id`가 있어야 값 갱신의 주소, 프레임 간 보간, 선택·강조 상태를 붙일 수 있다. 자연키를 쓰면 MES 기준정보와 매핑 테이블 없이 조인되고 AI가 그대로 참조할 수 있다.
- 포맷 문자열을 데이터로 받으면 단위·소수점·언어를 원천마다 맞춰야 한다. 숫자만 받으면 장면이 일관되게 파생한다.
- 마지막 갱신이 이기는 규칙은 단순하고 예측 가능하다. 출처와 시각을 함께 보관하면 화면에서 "누가 언제 바꿨는지"를 보여 줄 수 있어 충돌을 규칙으로 막을 필요가 없다.

## 예시

올바른 예 — 라인 2개로 교체:

```json
{ "scene": "bars", "version": 1, "source": "static", "at": "2026-09-08T09:00:00+09:00",
  "data": { "unit": "EA", "target": 500, "lines": [
    { "id": "SMT-A", "label": "SMT A", "value": 420 }, { "id": "SMT-B", "label": "SMT B", "value": 510 } ] } }
```

올바른 예 — HATCHERY가 한 라인만 갱신:

```json
{ "scene": "bars", "source": "hatchery", "at": "2026-09-08T09:00:10+09:00",
  "objects": [ { "id": "SMT-A", "value": 470 } ] }
```

위반 예:

- `{ "scene": "bars", "data": { "lines": [ { "label": "SMT A", "value": "420 EA" } ] } }` — `id` 없음, 값이 문자열, `version`·`source`·`at` 없음.
- `{ "scene": "energy", "objects": [ { "id": "power", "value": 90 } ] }` — energy는 L1이라 패치 불가. 전체 교체 문서로 보낸다.
- renderer가 `DEFAULT_PROCESS_DATA`를 직접 import 해 그린다 — L0. `data.network`를 받아야 한다.
