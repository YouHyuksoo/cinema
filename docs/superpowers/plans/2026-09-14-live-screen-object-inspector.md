# Live Screen Object Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리 큐브의 `화면` 타일에서 상단 지표 카드 8개의 실시간 데이터 계약, 현재 값, 출처와 안전한 화면 메서드를 조회·실행하는 모달을 제공한다.

**Architecture:** 기존 `ScreenObjectRegistry`를 revision 기반 외부 저장소로 확장하고, 각 지표 카드를 독립 객체로 등록한다. `ScreenObjectInspector`는 body portal에서 레지스트리를 구독하며 데이터는 읽기 전용으로 표시한다. `focus`/`openDetail`은 Inspector를 먼저 닫고 다음 animation frame에 실행하며 실패하면 오류와 함께 다시 연다.

**Tech Stack:** Next.js App Router, React 19, TypeScript, CSS Modules, Vitest

---

### Task 1: 실시간 객체 카탈로그 계약

**Files:**
- Modify: `src/cinema/screenObjectRegistry.ts`
- Modify: `src/cinema/ScreenObjectContext.tsx`
- Test: `tests/unit/scenes/cinemaScreenObjectRegistry.test.ts`

- [ ] 데이터 바인딩·표현 대상·카탈로그 상태 타입을 사용하는 실패 테스트를 추가한다.
- [ ] 등록·해제·`notify()`가 revision과 구독자를 갱신하고 `getRevision()`은 변경 전까지 같은 값을 반환하는 실패 테스트를 추가한다.
- [ ] `ScreenObjectRegistration`의 선택적 `bindings`·`presentation`과 `catalog()`의 호출 시점 state/snapshot/status 평가를 구현한다.
- [ ] `ScreenObjectRegistry`에 `subscribe`, `getRevision`, `notify`를 구현하고 Context에 레지스트리 조회 훅을 추가한다.
- [ ] `npx vitest run tests/unit/scenes/cinemaScreenObjectRegistry.test.ts`를 실행해 통과시킨다.

### Task 2: 상단 지표 카드 8개 자기 등록

**Files:**
- Create: `src/cinema/metricObjectManifest.ts`
- Modify: `src/cinema/JarvisMetricCards.tsx`
- Modify: `src/cinema/JarvisMainHeader.tsx`
- Modify: `src/cinema/JarvisMain.tsx`
- Modify: `src/cinema/SignalFilm.tsx`
- Test: `tests/unit/scenes/cinemaMetricObjectManifest.test.ts`
- Test: `tests/unit/scenes/cinemaMetricStrip.test.ts`

- [ ] 8개 ID, 피드, 장면 키, 상세 연출, 스냅샷 필드가 정확한지 실패 테스트를 작성한다.
- [ ] `metricObjectManifest.ts`에 정적 계약과 피드 상태 정규화 함수를 구현한다.
- [ ] 각 binding의 `feedId`로 `DOMAIN_FEEDS`를 찾고 `feedJsonSchema()` 결과를 카탈로그가 복사 없이 참조하도록 연결한다.
- [ ] 반복되는 `<article>`을 카드 컴포넌트로 추출해 `useScreenObject`로 `metric.<kind>`를 등록한다.
- [ ] 각 객체의 `getState`는 현재 `hatcheryMetrics(data)` 결과를, binding snapshot은 해당 `FilmSceneData` 키를 호출 시점에 반환한다.
- [ ] `focus`는 기존 `JarvisCardFocus` 요청을, `openDetail`은 명세의 `detailChapter`를 실행한다.
- [ ] `SignalFilm`에서 `sceneProvenance`와 `feedStatus`를 전달하고 `sceneData` 또는 `feedStatus`가 변경될 때 registry `notify()`를 호출한다. 값이 바뀌지 않은 렌더에서는 revision을 올리지 않는 테스트를 추가한다.
- [ ] 관련 두 테스트를 함께 실행해 통과시킨다.

### Task 3: 실시간 객체 관리 모달

**Files:**
- Create: `src/cinema/ScreenObjectInspector.tsx`
- Create: `src/cinema/screenObjectInspector.module.css`
- Modify: `src/cinema/SignalFilm.tsx`
- Modify: `src/cinema/useFilmEscapeToHome.ts`
- Test: `tests/unit/scenes/cinemaScreenObjectInspector.test.ts`
- Test: `tests/unit/scenes/cinemaEscapeShortcut.test.ts`

- [ ] 객체 목록, 선택 명세, state, binding, 원본 피드 JSON Schema, 메서드 버튼, 빈 상태를 요구하는 실패 테스트를 작성한다.
- [ ] Node Vitest에서는 ESC·선택·메서드 실행 순서를 순수 함수로 검사하고, portal·dialog·inert·초점 계약은 `readFileSync` 기반 구조 테스트로 고정한다.
- [ ] body 아래 전용 portal root를 생성·제거하고, dialog semantics, 초점 가두기·복원, 메인 `inert`를 포함한 Inspector를 구현한다. 열기 전 main의 inert 여부를 저장해 일반 닫기와 언마운트 때 원래 값으로 복원한다.
- [ ] revision을 `useSyncExternalStore`로 구독하고 revision이 바뀔 때만 `catalog()`를 다시 읽는다.
- [ ] `focus`/`openDetail`을 누르면 실행 대상을 캡처하고 Inspector를 먼저 닫은 뒤 다음 animation frame에 메서드를 실행한다. 이 동작 닫기에서는 큐브로 초점을 복원하지 않는다. 성공하면 결과 화면에 초점을 맡기고, 실패하면 Inspector를 다시 열어 실제 오류를 표시한다.
- [ ] 관리 큐브 `display` 선택으로 열고, 전역 ESC는 열린 Inspector만 먼저 닫도록 `SignalFilm` 상태 우선순위를 연결한다.
- [ ] 관련 두 테스트를 함께 실행해 통과시킨다.

### Task 4: 설계 기록과 검증

**Files:**
- Modify: `DESIGN.md`
- Test: 위 Task의 관련 테스트

- [ ] `DESIGN.md`에 객체 명세, 읽기 전용 경계, 큐브 진입점과 영향 경로를 기록한다.
- [ ] `npm run typecheck`를 실행한다.
- [ ] Task 1~3 관련 테스트를 한 명령으로 실행한다.
- [ ] `git diff --check`와 의도한 파일 diff를 확인한다.
- [ ] 현재 작업 트리의 선행 미커밋 변경과 같은 파일에 섞인 부분은 임의로 커밋하지 않고 결과를 보고한다.
