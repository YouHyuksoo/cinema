# 장면 데이터 런타임 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 장면 데이터 계약(§4)의 봉투·패치·등록부·저장소를 구현하고, 6개 장면과 지표 카드 계산이 저장소 데이터를 읽게 한다.

**Architecture:** `sceneDataDocument.ts`(봉투·패치 검증, id 패치 도우미) → `sceneDataRegistry.ts`(장면 id → 데이터 키·normalize·patch) → `sceneDataStore.ts`(데이터 + 출처, replace/patch/merge/subscribe) → `useFilmPlayback.ts`(저장소 소유) → `drawSignalFilm.ts`(renderer가 `data[key]`만 받음). 환경 장면은 `environmentSelection.update(time, data)` 경로로 데이터를 받는다. `jarvisMainData.ts`는 저장소 입력 함수로 바뀐다.

**Tech Stack:** TypeScript, Next.js 16, Canvas 2D, Vitest.

**Spec:** `docs/specs/2026-09-08-scene-data-runtime-design.md` (표준: `docs/standards/scene-data-contract.md`)

## Global Constraints

- 봉투: `scene`(등록된 FilmId), `version === 1`(문서만), `source ∈ mes|push|hatchery|static|demo`, `at` ISO 파싱 가능. 위반은 `{ ok:false, reason }`.
- 패치는 `id`·`label`을 덮어쓰지 않는다. 없는 id는 `ignored`, 전부 없으면 실패.
- 마지막 갱신이 이긴다(도착 순서). 실패한 갱신은 저장소를 바꾸지 않고 통지하지 않는다.
- 검증: `npm run typecheck`, `npm run test:unit`, `npm run build`.
- 동시 작업: Codex가 `DESIGN.md`, `SignalFilm.tsx`, `JarvisMain*.tsx`, css, `useJarvisVoice.ts` 등을 미커밋 수정 중. 이 파일들은 건드리지 않는다. 커밋은 내 파일만 경로 지정으로 스테이징한다. DESIGN.md 영향 경로 항목은 clean해진 뒤 별도 커밋으로 추가한다.

---

### Task 1: 봉투·패치 검증 `sceneDataDocument.ts`
- Create `src/cinema/sceneDataDocument.ts`, Test `tests/unit/scenes/cinemaSceneDataDocument.test.ts`.
- 스펙 §4.1의 시그니처 그대로. `FILM_CHAPTERS`로 scene 검증.
- [ ] 테스트: 올바른 문서 통과 / scene 미등록·version≠1·source 불명·at 파싱 불가·data 비객체 각각 거부 / 패치: objects 빈 배열·id 없는 항목 거부 / `patchObjectsById`가 id·label 보호, 없는 id ignored, 원본 불변.
- [ ] 실패 확인 → 구현 → 통과 → 커밋 `feat(cinema): validate scene data documents and object patches`.

### Task 2: `FilmSceneData` 6키 확장 + 등록부 `sceneDataRegistry.ts`
- Modify `src/cinema/filmSceneData.ts`, Create `src/cinema/sceneDataRegistry.ts`, Test `tests/unit/scenes/cinemaSceneDataRegistry.test.ts`.
- 스펙 §4.2·§4.3. normalize는 구조 확인만: 필수 필드 타입·배열 여부·객체 배열의 `id` 문자열. environment는 `id`·`name`, 나머지 id 배열은 `id`·`label`(spc는 `id`·`values`).
- [ ] 테스트: 6개 장면(bars·pie·wave·network·spc·energy·product) normalize 성공, 구조 위반 시 undefined, bars/wave/network/spc patch 적용·ignored, energy/product는 `patch` 미정의, 미등록 장면 undefined.
- [ ] 실패 확인 → 구현 → 통과 → `cinemaFilmSceneData.test.ts`의 merge 테스트가 여전히 통과 → 커밋 `feat(cinema): register scene data keys, normalizers and patchers`.

### Task 3: 저장소 `sceneDataStore.ts`
- Create `src/cinema/sceneDataStore.ts`, Test `tests/unit/scenes/cinemaSceneDataStore.test.ts`.
- 스펙 §4.4.
- [ ] 테스트: replace 성공 시 `get()` 참조가 바뀌고 provenance·subscribe 호출 / 실패 시 참조 유지·미호출 / patch 적용·ignored / 두 원천이 차례로 바꾸면 나중 값 / merge는 provenance `demo` / unsubscribe.
- [ ] 실패 확인 → 구현 → 통과 → 커밋 `feat(cinema): add the scene data store with provenance`.

### Task 4: 디스패처·환경 세션·재생 훅 연결
- Modify `src/cinema/drawSignalFilm.ts`(renderers 5개), `src/cinema/environmentSelection.ts`, `src/cinema/useEnvironmentSelection.ts`, `src/cinema/useFilmPlayback.ts`. Test: `tests/unit/scenes/cinemaFilmSceneData.test.ts` 확장, `tests/unit/scenes/cinemaEnvironmentSelection.test.ts` 확장.
- 스펙 §4.5.
- [ ] 테스트: `drawSignalFilm`에 energy(name 'INJECTED ENERGY')·network(node label '주입 노드')·product(name '주입 제품')·spc(name '주입 외경')·environment(zone id 'ZONE 77') 문서를 넣고 각 장면 시각에 해당 문자열이 그려짐. `createEnvironmentSelection().update(8, data)`의 프레임에 'ZONE 77' 포함.
- [ ] 실패 확인 → 구현 → 전체 단위 테스트·typecheck → 커밋 `feat(cinema): route scene data into six scenes and own it in the playback store`.

### Task 5: 지표 카드 계산 함수화 `jarvisMainData.ts`
- Modify `src/cinema/jarvisMainData.ts`, Test `tests/unit/scenes/cinemaHatcheryMetrics.test.ts`.
- 스펙 §4.6. `hatcheryMainData(data)`, `hatcheryMetrics(data)`, `HATCHERY_METRIC_KINDS`. 기존 export와 `JarvisMetricKind` 유지.
- [ ] 테스트: 기본값 호출 결과가 `jarvisMainMetrics`와 deep-equal / energy production 값을 바꾼 데이터로 호출하면 production 카드 value가 바뀜 / 환경 구역 2개로 바꾸면 온도 카드 note가 '2개 구역'.
- [ ] 실패 확인 → 구현 → 전체 단위 테스트·typecheck·build → 커밋 `refactor(cinema): derive HATCHERY main metrics from scene data`.

### Task 6: 표준 문서 검증 스탬프
- `docs/standards/scene-data-contract.md`의 `verifiedCommit`을 Task 5 커밋 sha로 갱신하고 커밋 `docs: stamp scene data contract`.

## 완료 기준
- Task 1~6 커밋, `npm run typecheck`·`npm run test:unit`·`npm run build` 통과.
- 6개 장면이 주입 문서로 그려지고, 저장소 replace/patch가 표준대로 동작한다.
