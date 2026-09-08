# 도메인 피드 선언과 계약 문서 자동 생성 설계

- 작성일: 2026-09-08
- 상태: 설계 승인됨 (구현 대기)
- 표준: `docs/standards/scene-data-contract.md` §4 (이 설계로 "도메인 피드" 절 추가)

## 1. 배경과 문제

목적은 어느 DB든 기대값을 던지면 16개 장면이 그대로 연출되는 것이다. 장면 16개가 쓰는 원천을 뜯어보면 8~9개 도메인으로 겹치는데(라인 실적, 설비, 공정, 환경, 품질, 에너지, 워크오더, 제품검사, 설비 계통), 지금은 장면 6개만 데이터를 받고 나머지 7개는 모델이 없다. DB 담당자에게 "무엇을 보내면 되는지"를 보여 줄 문서도 없다. 사용자는 시연 데이터를 기준으로 먼저 선언하고 실제 컬럼은 나중에 정의하겠다고 했다.

## 2. 목표 / 비목표

목표
- 도메인 피드 9개를 시연 데이터 구조 그대로 **서술자로 선언**한다(`domainFeeds.ts`): 헤더 필드, 객체 타입(컬렉션 이름·필드·중첩 구조), 갱신 주기, 소비 장면, 현재 상태(live/partial/planned).
- 선언에서 **JSON Schema**와 **예시 문서**를 자동 생성해 `public/cinema/data/schemas/`에 두고, DB 담당자용 **컬럼 표**를 `docs/database/domain-feeds.md`로 생성한다. 골든 파일 테스트가 선언과 생성물의 동기화를 강제한다.
- 이미 데이터를 받는 6개 장면의 기본 데이터가 각 피드 서술자를 통과함을 테스트로 보장한다.

비목표
- 장면 이관(피드 단위로 다음 계획), 서버 피드 라우트, 피드→장면 문서 변환기(선언에 `scenes`만 적어 둔다).

## 3. 설계 결정 요약

| 결정 | 선택 | 근거 |
|---|---|---|
| 선언 단위 | 피드 = 헤더 필드 + 객체 타입들(컬렉션명) | DB 뷰 하나가 피드 하나에 대응한다. |
| 중첩 구조 | 서술자로 못 적는 키(좌표·범위·이력)는 `extra`에 JSON Schema 조각으로 | 서술자는 스칼라/숫자 목록만 다룬다. |
| 문서 생성 | TS 함수 + 골든 파일 테스트(`FEED_DOCS_UPDATE=1`로 재생성) | 새 도구 없이 선언과 산출물이 어긋나면 테스트가 잡는다. |
| 선택 필드 | `SceneFieldDescriptor.optional` 추가 | 헤더·객체의 선택 컬럼을 표현. |

## 4. 상세 설계

### 4.1 `domainFeeds.ts`

```ts
export interface DomainObjectType { type: string; collection: string; label: string; fields: readonly SceneFieldDescriptor[]; extra?: Record<string, { label: string; schema: Record<string, unknown>; optional?: boolean }> }
export interface DomainFeed { feed: string; label: string; refresh: 'realtime'|'fast'|'normal'|'event'|'static'; refreshHint: string;
  header: readonly SceneFieldDescriptor[]; objects: readonly DomainObjectType[]; scenes: readonly FilmId[]; status: 'live'|'partial'|'planned'; note: string;
  example(data: FilmSceneData): Record<string, unknown> }
export const DOMAIN_FEEDS: readonly DomainFeed[]
export function feedJsonSchema(feed): Record<string, unknown>      // data 객체의 JSON Schema draft-07
export function feedsMarkdown(): string                             // docs/database/domain-feeds.md 본문
```

피드: `production`(lines), `equipment`(stations), `process`(nodes, links), `environment`(zones), `quality`(subgroups), `energy`(readings), `workOrder`(defects), `inspection`(measurements), `machine`(systems). 각 객체는 `id`·`label`을 항상 가진다. 기존 장면 필드(`SCENE_FIELDS`)는 그대로 참조한다.

### 4.2 생성물

- `public/cinema/data/schemas/<feed>.schema.json`, `public/cinema/data/schemas/<feed>.example.json`
- `docs/database/domain-feeds.md`(살아있는 문서, sources: `domainFeeds.ts`) — 피드 요약표와 피드별 컬럼표.
- `package.json`에 `docs:feeds` 스크립트(`FEED_DOCS_UPDATE=1 vitest run tests/unit/scenes/cinemaDomainFeeds.test.ts`).

## 5. 에러 처리

- 골든 파일 불일치는 테스트 실패로 드러나며 재생성 명령을 메시지에 적는다.
- 기본 데이터가 서술자를 어기면 테스트 실패(선언 오류 또는 데이터 오류).

## 6. 테스트 전략

`cinemaDomainFeeds.test.ts`: 피드 9개 존재·컬렉션명 유일·장면 16개가 최소 한 피드에 속함; live/partial 피드의 기본 데이터가 헤더·객체 서술자를 통과; 스키마에 required·범위 반영; 골든 파일 일치.

## 7. 제외한 대안

- 장면별 뷰: 라인 하나가 바뀌면 여러 뷰를 고쳐야 한다. 피드 단위가 DB와 유기적이다.
- Zod/JSON Schema 라이브러리: 서술자에서 직접 생성하는 편이 단일 출처를 지킨다.
