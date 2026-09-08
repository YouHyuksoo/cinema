# HATCHERY 값 변경 명령 어댑터 설계

- 작성일: 2026-09-08
- 상태: 설계 승인됨 (구현 대기)
- 표준: `docs/standards/scene-data-contract.md` §4 "HATCHERY(AI)" 어댑터

## 1. 배경과 문제

HATCHERY 명령 경로는 셋(로컬 파서, OpenAI 텍스트, OpenAI 실시간 음성)인데 동작은 "장면 이동"(`chapter`) 하나뿐이다. 값 변경 통로가 없어 "라인 2 470으로" 같은 말이 화면에 닿지 않는다. 로컬 파서는 서버 API 라우트에서 돌아 저장소 데이터를 볼 수 없고, GitHub Pages에서는 서버가 없어 아예 동작하지 않는다.

## 2. 목표 / 비목표

목표
- 세 경로 모두가 표준의 객체 패치 `{ scene, source: 'hatchery', at, objects }`를 만들고, 재생 훅의 `applySceneObjects`가 적용한다.
- 대상은 저장소의 현재 객체 id·label로 해석한다(정적 JSON으로 바꾼 라인도 말로 지목 가능).
- 정형 문장은 클라이언트에서 API 호출 없이 처리한다(키 없음·Pages에서도 동작).
- 대상: 패치 가능한 4개 장면(막대·환경·공정망·SPC)과 그 필드.

비목표
- 스냅샷 수준 값(막대 목표치 등), 에너지·제품검사(L1), 객체 추가·삭제, 값 보간, 출처 표시 UI.

## 3. 설계 결정 요약

| 결정 | 선택 | 근거 |
|---|---|---|
| 응답 확장 | `JarvisReply.patch?: SceneObjectPatch` | 기존 `chapter`와 공존. 값을 바꾸면 그 장면으로 이동까지. |
| 로컬 해석 위치 | 클라이언트 훅(`useJarvisLocalVoice.ask`) 진입 시 | 저장소 데이터 접근, 서버 불필요. |
| 해석기 | `hatcheryTargets.ts` 순수 함수 | 서버(도구 호출 → 패치 변환)와 클라이언트가 공유. |
| AI 도구 | `set_scene_object_values { scene, objects[{ id, field, value?, values? }] }` | 텍스트(Responses API)와 실시간 세션에 같은 정의. |
| 실시간 처리 | `response.done`에서 즉시 적용, 대화 유지 | 장면 이동과 달리 음성 종료를 기다릴 이유가 없음. |
| 배선 | `HatcheryActions { sceneData(), applySceneObjects() }` 한 객체를 `SignalFilm → JarvisMain → useJarvisVoice → 로컬 훅/실시간 세션`으로 전달 | player 전체를 넘기지 않음. |
| 모호성 | "리플로우"처럼 두 장면에 있는 이름은 필드 별칭으로 가르고, 못 가르면 되묻는 응답 | 잘못된 장면을 바꾸지 않음. |

## 4. 상세 설계

### 4.1 `hatcheryTargets.ts`

```ts
export const HATCHERY_PATCH_SCENES = ['bars', 'wave', 'network', 'spc'] as const;
export type HatcheryPatchScene = typeof HATCHERY_PATCH_SCENES[number];
export const HATCHERY_FIELDS: Record<HatcheryPatchScene, readonly { field: string; aliases: RegExp; label: string; list?: boolean; default?: boolean }[]>
export interface HatcheryActions { sceneData(): FilmSceneData; applySceneObjects(input: unknown): SceneDataResult }
export function hatcheryPatch(scene, objects, at = new Date().toISOString()): SceneObjectPatch
export function hatcheryObjects(data: FilmSceneData, scene): { id: string; label: string; aliases: string[] }[]   // label·code·name 포함
export function resolveHatcheryTarget(data, scene, reference: string): { id, label } | undefined            // id·label·code 대소문자 무시, 공백·하이픈 무시, 번호 지시("라인 2", "존 3", "부분군 18") 지원
export type HatcheryValueCommand = { kind: 'patch'; patch: SceneObjectPatch; reply: string; chapter: FilmId } | { kind: 'clarify'; reply: string }
export function resolveHatcheryValueCommand(input: string, data: FilmSceneData): HatcheryValueCommand | null
export function toolCallToPatch(args: unknown, data: FilmSceneData): { ok: true; patch: SceneObjectPatch } | { ok: false; reason: string }
export const SET_SCENE_OBJECT_VALUES_TOOL   // OpenAI function 정의(텍스트·실시간 공용)
export function hatcheryObjectCatalog(data: FilmSceneData): string   // 지시문용: 장면별 id(label)와 필드 목록
export function describeSceneDataResult(command, result: SceneDataResult): string   // 적용 결과 문장
```

필드 별칭: 막대 `value`(생산량·실적·수량·값, 기본), 환경 `temperature`(온도, 기본)·`humidity`(습도), 공정망 `queue`(대기·대기량, 기본)·`capacityPerHour`(처리능력·처리 능력·용량)·`cycleSeconds`(사이클·택트), SPC `values`(측정값·값, 목록).

`resolveHatcheryValueCommand` 절차: 질문형(`알려|얼마|몇|뭐|\?`)이면 null → 필드 별칭 탐색 → 4개 장면에서 대상 후보 탐색(별칭이 있으면 그 필드를 가진 장면만) → 후보가 두 장면 이상이면 `clarify` → 후보 0이면 null → 대상·별칭 구간을 제외한 숫자 추출(목록 필드는 전부, 아니면 마지막 하나), 숫자 없으면 null → `patch`(`source: 'hatchery'`) + 응답 문장 + `chapter`(장면 id).

### 4.2 클라이언트 훅

- `useJarvisLocalVoice(onChapter, options: { speakReplies?: boolean; actions?: HatcheryActions })`.
- `ask()`: `actions`가 있으면 먼저 `resolveHatcheryValueCommand(message, actions.sceneData())`. `patch`면 `actions.applySceneObjects`로 적용하고 결과 문장을 답으로 쓰며 fetch 하지 않는다(성공 시 `chapter`로 이동). `clarify`면 되묻는 문장을 답으로 쓴다. 그 외에는 기존대로 API 호출. API 응답에 `patch`가 있으면 `parseSceneObjectPatch`로 검증 후 적용하고, 실패하면 사유를 답에 덧붙인다.
- `useJarvisVoice(onChapter, actions?)`: 로컬 훅과 실시간 세션 콜백 `patch: input => actions.applySceneObjects(input)`에 전달.

### 4.3 서버 `openai.ts`

- `answerWithOpenAi`: 요청에 `tools: [SET_SCENE_OBJECT_VALUES_TOOL(응답용 형식)]`, `tool_choice: 'auto'`. 출력의 `function_call`(name `set_scene_object_values`)을 `toolCallToPatch(args, DEFAULT_FILM_SCENE_DATA)`로 변환해 `{ source: 'ai', reply, patch }`로 돌려준다. 문장이 비면 "값을 갱신합니다."를 쓴다. 도구 호출 없으면 기존과 같다.
- `jarvisInstructions()`: 값 변경 규칙 한 줄과 `hatcheryObjectCatalog(DEFAULT_FILM_SCENE_DATA)`를 추가한다.
- `realtimeConfiguration`: `tools`에 같은 도구 추가.

### 4.4 실시간 세션

- `RealtimeCallbacks.patch?(input: unknown): SceneDataResult`.
- `response.done` 루프: `call.name === 'set_scene_object_values'`이면 `toolCallToPatch(JSON.parse(arguments), data?)` — 세션은 저장소를 모르므로 콜백에 원시 args를 넘기지 않고, 세션 생성 시 받은 `sceneData()`로 변환한다. 즉 `RealtimeCallbacks`에 `sceneData?(): FilmSceneData`도 추가한다. 변환·적용 결과를 `function_call_output`으로 보낸다. `pendingChapter`·`stop()`은 건드리지 않는다.

### 4.5 UI 배선

`SignalFilm`: `<JarvisMain camera onChapter actions={{ sceneData: () => player.sceneData, applySceneObjects: player.applySceneObjects }} />`. `JarvisMain`은 `actions`를 `useJarvisVoice(onChapter, actions)`에 넘긴다. `player.sceneData`는 저장소 구독으로 갱신되는 React 상태이므로 최신값이다.

## 5. 에러 처리

- 대상 없음·모호·숫자 없음은 예외 없이 null 또는 `clarify`.
- 적용 결과 `ok: false`면 사유를 그대로 답한다(예: "일치하는 객체가 없습니다: LINE-42"). 장면 이동은 하지 않는다.
- 도구 호출 인자가 잘못되면 `{ ok: false, reason }`을 도구 출력으로 돌려 AI가 다시 말하게 한다.

## 6. 테스트 전략

- `cinemaHatcheryTargets.test.ts`: 대상 해석(id·label·번호·code, 공백·하이픈 무시), 4개 장면 각 필드, 목록 필드, 모호성 clarify, 질문형 null, 숫자 없음 null, `toolCallToPatch` 성공·실패, 카탈로그에 id와 필드 포함.
- `cinemaJarvisVoice.test.ts`(확장): 값 명령이 fetch 없이 `applySceneObjects`를 부르고 답을 말한 뒤 `chapter`로 이동; API 응답의 `patch`가 적용됨.
- `cinemaOpenAi.test.ts`(확장): 요청에 tools 포함; function_call 출력이 `patch`로 변환; 잘못된 인자면 patch 없음.
- `cinemaRealtimeSession.test.ts`(확장): `set_scene_object_values` 호출이 `cb.patch`를 즉시 부르고 `function_call_output`에 결과가 실리며 `stop`·`chapter`는 호출되지 않음.

## 7. 제외한 대안

- 서버 로컬 파서 확장: 저장소를 못 보고 Pages에서 동작하지 않는다.
- 도구 결과를 위한 2차 왕복(텍스트 경로): 비용·지연 대비 이득이 작다. 서버가 확정 문장을 만든다.
