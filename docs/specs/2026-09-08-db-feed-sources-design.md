# DB 데이터 소스 연동과 관리 화면 설계

- 작성일: 2026-09-08
- 상태: 설계 승인됨 (구현 대기)
- 표준: `docs/standards/scene-data-contract.md` §4·§4.1, 피드 선언 `docs/database/domain-feeds.md`

## 1. 배경과 문제

도메인 피드 9개가 선언됐지만 실제 DB에서 값을 가져오는 통로가 없다. 첫 대상은 Oracle `SVEHICLEPDBEXT`(SOLMAX 전장램프 MES, 688 테이블)다. 접속 정보와 피드별 SQL·컬럼 매핑을 코드에 박으면 "어느 DB든 붙는다"는 목적이 깨지므로, 관리 기능(데이터 소스·피드 매핑·실행 상태)이 필요하다.

## 2. 목표 / 비목표

목표
- 서버 전용 설정 파일(`config/hatchery.sources.json`, git 제외)에 데이터 소스와 피드 매핑을 저장하고 관리 화면(`/cinema/admin`)에서 편집한다.
- 서버 피드 러너가 SQL을 실행해 행을 피드 문서로 매핑·검증하고 장면 문서로 변환한다. 브라우저는 `/api/cinema/feed`를 폴링해 저장소에 넣는다.
- `production` 피드를 `IP_PRODUCT_LINE` + `IP_PRODUCT_SMD_PLAN` 기준으로 매핑해 막대 장면에 실데이터를 띄운다.

비목표
- DB 되쓰기, 푸시(WebSocket) 어댑터, `scenes.json` 내보내기 명령, 나머지 피드의 실제 컬럼 매핑(컬럼 정의 이후), 설정의 DB 테이블 저장.

## 3. 설계 결정 요약

| 결정 | 선택 | 근거 |
|---|---|---|
| 드라이버 | `oracledb` 7 thin 모드 | Oracle 클라이언트 설치 불필요, 서버 라우트에서만 사용. |
| 설정 저장 | JSON 파일, 비밀번호 포함(파일은 git 제외), API 응답에서는 마스킹 | MES DB 변경 없이 시작. |
| 매핑 단위 | 피드마다 SQL 하나(+컬렉션별 SQL 선택), 헤더는 첫 행에서, 컬럼 → 계약 필드 매핑표 | 뷰 컬럼명이 계약과 달라도 코드 수정 없이 연결. |
| SQL 안전 | SELECT/WITH로 시작, 세미콜론 금지, 최대 행 수 제한, 읽기 전용 계정 권장 | 관리 화면 입력이 실행되므로 최소 방어. |
| 러너 | 서버 프로세스 내 캐시. 폴링 요청이 오면 주기가 지난 피드만 재실행 | 별도 스케줄러 없이 단순. |
| 접근 제한 | 관리·피드 API는 기존 `rejectExternalRequest`(localhost 전용) | 데모 서버에 로그인이 없다. |

## 4. 상세 설계

### 4.1 설정 모델 — `src/cinema/feedConfig.ts` (순수)

```ts
export interface DataSourceConfig { id: string; name: string; kind: 'oracle'; host: string; port: number; serviceName: string; user: string; password: string }
export interface CollectionMapping { sql?: string; fields: Record<string, string> }        // 계약 필드(id·label·필드·extra) → 컬럼
export interface FeedMappingConfig { feed: string; sourceId: string; enabled: boolean; intervalSeconds: number; sql: string; header: Record<string, string>; collections: Record<string, CollectionMapping> }
export interface HatcheryConfig { sources: DataSourceConfig[]; feeds: FeedMappingConfig[] }
export function parseHatcheryConfig(input: unknown): { ok: true; config } | { ok: false; reason }
export function assertSelectOnly(sql: string): string | undefined            // 위반 사유
export function mappingTemplate(feed: DomainFeed): FeedMappingConfig         // 관리 화면 초기값(필드 → 대문자 컬럼명)
```

### 4.2 행 → 피드 데이터 — `src/cinema/feedMapping.ts` (순수)

`mapRowsToFeedData(feed, mapping, rows: Record<string, Row[]>)` → `{ data, issues: string[] }`. 컬럼값 변환: 숫자 필드는 `Number()`, 문자열은 `String().trim()`, 목록 필드는 JSON 배열 문자열 또는 `,` 구분, extra는 JSON 문자열 파싱. 서술자 검증 실패 행은 버리고 `issues`에 사유. 헤더는 피드 SQL 첫 행.

### 4.3 피드 → 장면 문서 — `src/cinema/feedScenes.ts` (순수)

`feedToSceneDocuments(feedId, data, { source, at })`: production → bars 문서(`unit`, `target`, `selectedId?`, `lines`), environment → wave, process → network, quality → spc, energy → energy(배열 → 고정 키), inspection → product(id → zone). equipment·workOrder·machine은 빈 배열(이관 전).

### 4.4 서버

- `src/server/cinema/hatcheryConfig.ts`: 경로 `HATCHERY_CONFIG_PATH || config/hatchery.sources.json`. `readConfig()`, `writeConfig(config)`, `maskConfig(config)`(password → '', `hasPassword`). 저장 시 비밀번호가 비어 있으면 기존 값 유지.
- `src/server/cinema/oracleSource.ts`: `queryOracle(source, sql, maxRows)`, `testOracleSource(source)`. 연결마다 `getConnection`(풀은 다음 단계).
- `src/server/cinema/feedRunner.ts`: `runFeed(config, feedId, limit?)` → `{ ok, feed, rows, issues, data?, documents, at, error? }`. `feedService.poll()` → 주기 지난 피드 실행 후 `{ documents, feeds: status[], nextInSeconds }`.
- 라우트: `GET/PUT /api/cinema/admin/config`, `POST /api/cinema/admin/sources/test`, `POST /api/cinema/admin/feeds/preview`, `GET /api/cinema/feed`.

### 4.5 브라우저

`src/cinema/feedPolling.ts`: `startFeedPolling(store, { fetch, basePath, onStatus })`. 404/HTML이면 정적 모드로 판단하고 중단. 문서는 `store.replace`. `useFilmPlayback`이 시작·중단하고 `feedStatus`를 노출한다.

### 4.6 관리 화면

`/cinema/admin` → `HatcheryAdmin`(클라이언트). 데이터 소스(목록·편집·연결 테스트), 피드 매핑(피드별 소스·활성·주기·SQL·컬럼 매핑표·미리보기), 실행 상태. HUD 토큰(`--hud-*`)과 기존 폰트 변수만 사용. 서버가 없으면 안내 문구.

## 5. 에러 처리

- SQL 실행 오류·매핑 실패는 피드 상태에 기록되고 이전 캐시 문서를 유지한다. 화면은 마지막 성공 값을 계속 보여준다.
- 설정 파싱 실패 시 빈 설정으로 동작하고 관리 화면에 사유를 표시한다.

## 6. 테스트 전략

순수 모듈(feedConfig·feedMapping·feedScenes)은 단위 테스트, 서버 설정은 임시 경로로 읽기·쓰기·마스킹, 러너·라우트는 `oracleSource`를 mock, 폴링은 fetch mock. 실제 DB 검증은 로컬 설정 파일로 `production` 미리보기와 막대 장면 확인.

## 7. 제외한 대안

- 피드마다 코드에 SQL 고정: 다른 DB에 붙일 때마다 코드 변경.
- DB 테이블에 설정 저장: MES 스키마 변경 필요. 다음 단계 선택지로 남긴다.
