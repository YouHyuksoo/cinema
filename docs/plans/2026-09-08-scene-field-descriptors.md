# 필드 서술자 · 막대 라인 객체 타입 모듈 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 객체의 기대 포맷을 필드 서술자 한 곳에 선언하고, 막대 라인을 첫 객체 타입 모듈로 묶되 화면은 한 픽셀도 바꾸지 않는다.

**Architecture:** `sceneField.ts`(서술자 형식·검증·포맷) → `productionLineObject.ts`(막대 라인 타입: 서술자 + normalize·describe·layout·draw·drawAll) → `sceneFields.ts`(4개 장면 필드 선언) → `sceneDataRegistry.ts`·`hatcheryTargets.ts`가 서술자에서 파생. 리팩터링 전에 그리기 호출 지문을 스냅샷으로 고정한다.

**Tech Stack:** TypeScript, Canvas 2D, Vitest 스냅샷, node:crypto.

**Spec:** `docs/specs/2026-09-08-scene-field-descriptors-design.md`

## Global Constraints
- 막대 장면의 그리기 호출 지문(`cinemaBarFilmFingerprint.test.ts`)은 Task 0 이후 절대 바뀌면 안 된다.
- 서술자가 필드 사실의 단일 출처. 필드명·단위·범위를 다른 곳에 복사하지 않는다.
- 검증: `npm run typecheck`, `npm run test:unit`, `npm run build`. 커밋은 내 파일만 경로 지정. Codex dirty 파일(`DESIGN.md`, `JarvisCenterLayout.tsx` 등) 금지.

---

### Task 0: 렌더링 지문 고정
- Create `tests/unit/support/recordingCanvas.ts`, `tests/unit/scenes/cinemaBarFilmFingerprint.test.ts`.
- [ ] 테스트 작성 → 실행해 스냅샷 생성(`__snapshots__`) → 두 번째 실행 통과 확인 → 커밋 `test(cinema): pin the bar scene draw-call fingerprint`.

### Task 1: `sceneField.ts`
- Create `src/cinema/sceneField.ts`, Test `tests/unit/scenes/cinemaSceneField.test.ts`. 스펙 §4.1.
- [ ] 테스트 → 실패 → 구현 → 통과 → 커밋 `feat(cinema): add scene field descriptors with validation and formatting`.

### Task 2: `productionLineObject.ts` + `sceneFields.ts`
- Create `src/cinema/productionLineObject.ts`, `src/cinema/sceneFields.ts`; Modify `src/cinema/drawBarFilm.ts`(`drawAll` 호출). Test `tests/unit/scenes/cinemaProductionLineObject.test.ts`. 스펙 §4.2·§4.3.
- [ ] 테스트 → 구현 → 지문 테스트 포함 전체 통과 → 커밋 `feat(cinema): bundle the production line as the first scene object type`.

### Task 3: 파생 — 등록부·HATCHERY
- Modify `src/cinema/sceneDataRegistry.ts`, `src/cinema/hatcheryTargets.ts`. Test 확장: `cinemaSceneDataRegistry.test.ts`, `cinemaHatcheryTargets.test.ts`, `cinemaSceneDataStore.test.ts`(잘못된 종류 패치 거부). 스펙 §4.4.
- [ ] 테스트 → 구현 → 전체 통과·typecheck·build → 커밋 `refactor(cinema): derive patch validation and HATCHERY fields from scene field descriptors`.

### Task 4: 문서
- `docs/standards/scene-data-contract.md` §3에 "필드 서술자"·"객체 타입 모듈" 절 추가, `sources`에 새 파일, `verifiedCommit` 갱신. `DESIGN.md`는 clean일 때만.
- [ ] 커밋 `docs: add field descriptors and object type modules to the scene data contract`.

## 완료 기준
- Task 0~4 커밋, 검증 3종 통과, 지문 스냅샷 무변경, 배포 성공.
