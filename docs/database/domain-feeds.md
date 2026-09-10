---
sources:
  - src/cinema/domainFeeds.ts
  - src/cinema/sceneFields.ts
  - src/cinema/productionLineFields.ts
verifiedCommit: ac3956a
---

# 도메인 피드 — DB가 보내야 하는 기대값

이 문서는 `src/cinema/domainFeeds.ts`에서 생성된다(`npm run docs:feeds`). 손으로 고치지 말고 선언을 고친다. 시연 데이터 구조를 기준으로 선언했으며 실제 MES 컬럼은 피드별로 매핑한다.

피드 문서 봉투는 `{ feed, version: 1, source, at, data }`이고 `data`의 스키마는 `public/cinema/data/schemas/<feed>.schema.json`, 예시는 같은 폴더의 `<feed>.example.json`이다. 모든 객체는 `id`(도메인 코드, 자연키)와 `label`(표시 이름)을 가진다.

## 피드 요약

| 피드 | 이름 | 갱신 | 상태 | 컬렉션 | 소비 장면 |
| --- | --- | --- | --- | --- | --- |
| `production` | 라인 생산 실적 | 보통 폴링 (10~30초 폴링) | 연결됨 | `lines` | bars, pie, corners, unfold |
| `equipment` | 설비 마스터 · 상태 | 빠른 폴링 (5~10초 폴링 또는 상태 변경 푸시) | 이관 예정 | `stations` | visor, visorPan, scan, gears, console, cctv |
| `process` | 공정 처리능력 · 대기 | 보통 폴링 (10~30초 폴링) | 일부 연결 | `nodes`, `links` | network, corners, unfold |
| `environment` | 환경 구역 온습도 | 빠른 폴링 (30~60초 폴링 또는 센서 푸시) | 연결됨 | `zones` | wave |
| `quality` | 품질 SPC 측정 | 이벤트 (부분군 완성 시 이벤트, 또는 1~5분 폴링) | 일부 연결 | `subgroups` | spc, corners, unfold |
| `energy` | 에너지 사용 | 빠른 폴링 (5~30초 폴링) | 일부 연결 | `readings` | energy |
| `workOrder` | 워크오더 · 불량 | 이벤트 (워크오더 생성·완료와 검사 판정 이벤트) | 이관 예정 | `defects` | trace |
| `inspection` | 제품 내부 검사 | 이벤트 (검사 완료 이벤트) | 일부 연결 | `measurements` | product |
| `machine` | 설비 계통 진단(예시 장면) | 빠른 폴링 (5~10초 폴링) | 이관 예정 | `systems` | machine |

## 라인 생산 실적 — `production`

막대·파이가 읽는다. 코너·펼침의 생산 달성·잔여와 상단 지표 카드도 이 피드에서 파생될 예정이다.

- 갱신: 보통 폴링 · 10~30초 폴링
- 상태: 연결됨
- 스키마: `public/cinema/data/schemas/production.schema.json` · 예시: `production.example.json`

### 헤더

| 컬럼 | 종류 | 단위 | 범위 | 필수 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `unit` | 문자열 |  |  | 필수 | 수량 단위 — 예: EA |
| `target` | 숫자 |  | 0~ | 필수 | 라인당 목표 |
| `selectedId` | 문자열 |  |  | 선택 | 강조 라인 id — 없으면 목표 미달 중 달성률 최저 라인을 강조 |

### 생산 라인 — `lines[]` (객체 타입 `productionLine`)

| 컬럼 | 종류 | 단위 | 범위 | 필수 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `id` | 문자열 |  |  | 필수 | 도메인 코드(자연키), 목록 안에서 유일 |
| `label` | 문자열 |  |  | 필수 | 표시 이름 |
| `value` | 숫자 |  | 0~ | 필수 | 생산량 (패치 가능) |
| `color` | 구조 |  |  | 선택 | 표시 색 (JSON Schema 참조) |
| `accent` | 구조 |  |  | 선택 | 강조 표시 (JSON Schema 참조) |

## 설비 마스터 · 상태 — `equipment`

바이저 3D(라인 5개 × 설비 8대), 바이저 평면(리플로우 냉각), 설비 스캔, 기어, 정보 콘솔이 같은 설비 목록과 온도·냉각 값을 읽도록 이관한다. 배치 좌표는 화면이 순서(line·order)로 계산한다.

- 갱신: 빠른 폴링 · 5~10초 폴링 또는 상태 변경 푸시
- 상태: 이관 예정
- 스키마: `public/cinema/data/schemas/equipment.schema.json` · 예시: `equipment.example.json`

### 헤더

| 컬럼 | 종류 | 단위 | 범위 | 필수 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `lines` | 숫자 |  | 1~ | 필수 | 라인 수 |

### 설비 — `stations[]` (객체 타입 `station`)

| 컬럼 | 종류 | 단위 | 범위 | 필수 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `id` | 문자열 |  |  | 필수 | 도메인 코드(자연키), 목록 안에서 유일 |
| `label` | 문자열 |  |  | 필수 | 표시 이름 |
| `english` | 문자열 |  |  | 선택 | 영문 이름 |
| `line` | 숫자 |  | 1~ | 필수 | 라인 번호 |
| `order` | 숫자 |  | 1~ | 필수 | 공정 순서 |
| `kind` | 문자열 |  |  | 선택 | 설비 종류 — transport \| production \| quality \| thermal |
| `status` | 문자열 |  |  | 선택 | 가동 상태 — running \| idle \| alarm \| maintenance |
| `temperature` | 숫자 | °C |  | 선택 | 공정 온도 (패치 가능) |
| `fan` | 숫자 | % | 0~100 | 선택 | 냉각 팬 (패치 가능) |

## 공정 처리능력 · 대기 — `process`

공정망이 읽는다. 코너·펼침의 사이클 타임과 상단 지표의 병목도 파생 예정.

- 갱신: 보통 폴링 · 10~30초 폴링
- 상태: 일부 연결
- 스키마: `public/cinema/data/schemas/process.schema.json` · 예시: `process.example.json`

### 헤더

| 컬럼 | 종류 | 단위 | 범위 | 필수 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `title` | 문자열 |  |  | 필수 | 공정망 이름 |
| `demandPerHour` | 숫자 |  | 0~ | 필수 | 시간당 수요 |

### 공정 — `nodes[]` (객체 타입 `processNode`)

| 컬럼 | 종류 | 단위 | 범위 | 필수 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `id` | 문자열 |  |  | 필수 | 도메인 코드(자연키), 목록 안에서 유일 |
| `label` | 문자열 |  |  | 필수 | 표시 이름 |
| `code` | 문자열 |  |  | 필수 | 공정 코드 |
| `queue` | 숫자 | 개 | 0~ | 필수 | 대기량 (패치 가능) |
| `capacityPerHour` | 숫자 | 개/시 | 0~ | 필수 | 처리능력 (패치 가능) |
| `cycleSeconds` | 숫자 | 초 | 0~ | 필수 | 사이클 (패치 가능) |
| `position` | 구조 |  |  | 필수 | 3D 위치 — 화면 배치용 좌표. 없으면 순서로 배치할 예정 (JSON Schema 참조) |
| `recovery` | 구조 |  |  | 선택 | 회복 시나리오 값 (JSON Schema 참조) |

### 공정 연결 — `links[]` (객체 타입 `processLink`)

| 컬럼 | 종류 | 단위 | 범위 | 필수 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `id` | 문자열 |  |  | 필수 | 도메인 코드(자연키), 목록 안에서 유일 |
| `label` | 문자열 |  |  | 필수 | 표시 이름 |
| `from` | 문자열 |  |  | 필수 | 출발 공정 id |
| `to` | 문자열 |  |  | 필수 | 도착 공정 id |
| `bend` | 숫자 |  |  | 선택 | 곡선 정도 |

## 환경 구역 온습도 — `environment`

온습도 장면이 읽는다. 최대 10구역까지 표시하고 초과분은 생략한다. 상단 지표의 평균·이탈도 파생.

- 갱신: 빠른 폴링 · 30~60초 폴링 또는 센서 푸시
- 상태: 연결됨
- 스키마: `public/cinema/data/schemas/environment.schema.json` · 예시: `environment.example.json`

### 헤더

| 컬럼 | 종류 | 단위 | 범위 | 필수 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `title` | 문자열 |  |  | 필수 | 화면 제목 |
| `historyEnd` | 숫자 |  |  | 선택 | 이력 마지막 시각(epoch ms) |

### 구역 — `zones[]` (객체 타입 `zone`)

| 컬럼 | 종류 | 단위 | 범위 | 필수 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `id` | 문자열 |  |  | 필수 | 도메인 코드(자연키), 목록 안에서 유일 |
| `label` | 문자열 |  |  | 필수 | 표시 이름 |
| `name` | 문자열 |  |  | 필수 | 구역 이름 |
| `temperature` | 숫자 | °C |  | 필수 | 온도 (패치 가능) |
| `humidity` | 숫자 | % | 0~100 | 필수 | 습도 (패치 가능) |
| `temperatureRange` | 구조 |  |  | 필수 | 온도 관리 범위 (JSON Schema 참조) |
| `humidityRange` | 구조 |  |  | 필수 | 습도 관리 범위 (JSON Schema 참조) |
| `temperatureHistory` | 구조 |  |  | 선택 | 24시간 온도 이력 (JSON Schema 참조) |

## 품질 SPC 측정 — `quality`

SPC 장면이 읽는다(부분군 수·크기 무관). 코너·펼침의 양품률과 상단 지표의 이탈 수도 파생 예정.

- 갱신: 이벤트 · 부분군 완성 시 이벤트, 또는 1~5분 폴링
- 상태: 일부 연결
- 스키마: `public/cinema/data/schemas/quality.schema.json` · 예시: `quality.example.json`

### 헤더

| 컬럼 | 종류 | 단위 | 범위 | 필수 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `name` | 문자열 |  |  | 필수 | 측정 항목 |
| `unit` | 문자열 |  |  | 필수 | 단위 |
| `nominal` | 숫자 |  |  | 필수 | 공칭값 |
| `lsl` | 숫자 |  |  | 필수 | 규격 하한 |
| `usl` | 숫자 |  |  | 필수 | 규격 상한 |
| `cpkTarget` | 숫자 |  | 0~ | 필수 | Cpk 목표 |

### 부분군 — `subgroups[]` (객체 타입 `spcSubgroup`)

| 컬럼 | 종류 | 단위 | 범위 | 필수 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `id` | 문자열 |  |  | 필수 | 도메인 코드(자연키), 목록 안에서 유일 |
| `label` | 문자열 |  |  | 필수 | 표시 이름 |
| `values` | 숫자 목록 |  |  | 필수 | 측정값 (패치 가능) |

## 에너지 사용 — `energy`

지금 화면은 power·production·efficiency 고정 키 구조(L1)를 받는다. 이 피드는 id가 power | production | efficiency인 배열이며 이관 시 화면이 배열을 읽도록 바꾼다.

- 갱신: 빠른 폴링 · 5~30초 폴링
- 상태: 일부 연결
- 스키마: `public/cinema/data/schemas/energy.schema.json` · 예시: `energy.example.json`

### 헤더

| 컬럼 | 종류 | 단위 | 범위 | 필수 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `name` | 문자열 |  |  | 필수 | 설비/라인 이름 |

### 에너지 지표 — `readings[]` (객체 타입 `energyReading`)

| 컬럼 | 종류 | 단위 | 범위 | 필수 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `id` | 문자열 |  |  | 필수 | 도메인 코드(자연키), 목록 안에서 유일 |
| `label` | 문자열 |  |  | 필수 | 표시 이름 |
| `value` | 숫자 |  | 0~ | 필수 | 현재 값 (패치 가능) |
| `capacity` | 숫자 |  | 0~ | 필수 | 용량·목표 |
| `unit` | 문자열 |  |  | 필수 | 단위 |

## 워크오더 · 불량 — `workOrder`

변화 추적 장면이 워크오더와 불량 목록을 읽도록 이관한다. PCB 이동 연출은 시간으로 계산한다. 설비 순서는 equipment 피드를 따른다.

- 갱신: 이벤트 · 워크오더 생성·완료와 검사 판정 이벤트
- 상태: 이관 예정
- 스키마: `public/cinema/data/schemas/workOrder.schema.json` · 예시: `workOrder.example.json`

### 헤더

| 컬럼 | 종류 | 단위 | 범위 | 필수 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `orderId` | 문자열 |  |  | 필수 | 워크오더 번호 |
| `product` | 문자열 |  |  | 필수 | 제품 |
| `line` | 문자열 |  |  | 필수 | 라인 |
| `quantity` | 숫자 |  | 1~ | 필수 | 지시 수량 |

### 불량 판정 — `defects[]` (객체 타입 `defect`)

| 컬럼 | 종류 | 단위 | 범위 | 필수 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `id` | 문자열 |  |  | 필수 | 도메인 코드(자연키), 목록 안에서 유일 |
| `label` | 문자열 |  |  | 필수 | 표시 이름 |
| `serial` | 숫자 |  | 1~ | 필수 | 개체 일련번호 |
| `equipmentId` | 문자열 |  |  | 필수 | 판정 설비 id |
| `label` | 문자열 |  |  | 필수 | 불량 유형 |

## 제품 내부 검사 — `inspection`

지금 화면은 zone 유니언(shaft | bearing | winding)으로 부위를 찾는다(L1). 이 피드의 id가 그 역할을 맡도록 이관한다. 최대 3부위.

- 갱신: 이벤트 · 검사 완료 이벤트
- 상태: 일부 연결
- 스키마: `public/cinema/data/schemas/inspection.schema.json` · 예시: `inspection.example.json`

### 헤더

| 컬럼 | 종류 | 단위 | 범위 | 필수 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `name` | 문자열 |  |  | 필수 | 제품 이름 |
| `serial` | 문자열 |  |  | 필수 | 제품 시리얼 |

### 측정 부위 — `measurements[]` (객체 타입 `measurement`)

| 컬럼 | 종류 | 단위 | 범위 | 필수 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `id` | 문자열 |  |  | 필수 | 도메인 코드(자연키), 목록 안에서 유일 |
| `label` | 문자열 |  |  | 필수 | 표시 이름 |
| `nominal` | 숫자 |  |  | 필수 | 공칭값 |
| `actual` | 숫자 |  |  | 필수 | 실측값 |
| `tolerance` | 숫자 |  | 0~ | 필수 | 허용 공차 |
| `unit` | 문자열 |  |  | 필수 | 단위 |
| `decimals` | 숫자 |  | 0~ | 필수 | 표시 소수 자릿수 |

## 설비 계통 진단(예시 장면) — `machine`

투명 설비 분석 장면의 계통 값(배터리·냉각수·유량·엔진·배기·압력·하중)을 읽도록 이관한다. 브레이크·서스펜션 4개 값은 id에 위치를 붙인다(brake-fl 등).

- 갱신: 빠른 폴링 · 5~10초 폴링
- 상태: 이관 예정
- 스키마: `public/cinema/data/schemas/machine.schema.json` · 예시: `machine.example.json`

### 헤더

| 컬럼 | 종류 | 단위 | 범위 | 필수 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `name` | 문자열 |  |  | 필수 | 설비 이름 |

### 계통 값 — `systems[]` (객체 타입 `systemReading`)

| 컬럼 | 종류 | 단위 | 범위 | 필수 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `id` | 문자열 |  |  | 필수 | 도메인 코드(자연키), 목록 안에서 유일 |
| `label` | 문자열 |  |  | 필수 | 표시 이름 |
| `value` | 숫자 |  |  | 필수 | 값 (패치 가능) |
| `unit` | 문자열 |  |  | 선택 | 단위 |

