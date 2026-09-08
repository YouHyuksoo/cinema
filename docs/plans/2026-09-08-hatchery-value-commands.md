# HATCHERY 값 변경 명령 어댑터 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HATCHERY의 세 명령 경로(로컬·OpenAI 텍스트·실시간 음성)가 표준 객체 패치를 만들어 화면 값을 바꾸게 한다.

**Architecture:** `hatcheryTargets.ts`(대상·필드 해석, 도구 정의, 도구 호출 → 패치)를 서버와 클라이언트가 공유한다. 로컬 훅이 먼저 해석해 `HatcheryActions.applySceneObjects`로 적용하고, 서버는 도구 호출을 `JarvisReply.patch`로 돌려주며, 실시간 세션은 `response.done`에서 즉시 적용한다.

**Tech Stack:** TypeScript, Next.js 16, OpenAI Responses/Realtime, Vitest.

**Spec:** `docs/specs/2026-09-08-hatchery-value-commands-design.md`

## Global Constraints
- 패치는 항상 `source: 'hatchery'`, 표준 봉투 준수. id·label은 바꾸지 않는다.
- 대상 4개 장면과 필드는 `HATCHERY_FIELDS`가 단일 출처. 다른 곳에 필드명을 복사하지 않는다.
- 검증: `npm run typecheck`, `npm run test:unit`, `npm run build`. 커밋은 내 파일만 경로 지정.
- 동시 작업: `DESIGN.md`·`JarvisCenterLayout.tsx` 등 Codex dirty 파일은 건드리지 않는다.

---

### Task 1: 해석기 `hatcheryTargets.ts`
- Create `src/cinema/hatcheryTargets.ts`, Test `tests/unit/scenes/cinemaHatcheryTargets.test.ts`. 스펙 §4.1.
- [ ] 테스트 → 실패 확인 → 구현 → 통과 → 커밋 `feat(cinema): resolve HATCHERY value commands into scene object patches`.

### Task 2: 로컬 훅 적용 + `JarvisReply.patch`
- Modify `src/cinema/jarvisCommands.ts`(타입), `src/cinema/useJarvisLocalVoice.ts`. Test `tests/unit/scenes/cinemaJarvisVoice.test.ts` 확장. 스펙 §4.2.
- [ ] 테스트: actions 제공 시 "라인 2 470으로" → fetch 미호출, `applySceneObjects` 호출, 말한 뒤 `onChapter('bars')`; API 응답 `patch` 적용. → 구현 → 커밋 `feat(cinema): apply HATCHERY value commands from the local voice hook`.

### Task 3: 서버 도구 호출 → 패치
- Modify `src/server/cinema/openai.ts`. Test `tests/unit/scenes/cinemaOpenAi.test.ts` 확장. 스펙 §4.3.
- [ ] 테스트: 요청 payload에 `tools[0].name === 'set_scene_object_values'`; function_call 출력 → 응답에 `patch`(`scene:'bars'`, objects[0].id `LINE-02`); 잘못된 scene이면 patch 없음·문장 유지. → 구현 → 커밋 `feat(cinema): expose set_scene_object_values to the OpenAI text assistant`.

### Task 4: 실시간 세션
- Modify `src/cinema/jarvisRealtimeSession.ts`. Test `tests/unit/scenes/cinemaRealtimeSession.test.ts` 확장. 스펙 §4.4.
- [ ] 테스트: `response.done`의 `set_scene_object_values` 호출 → `cb.patch` 즉시 호출, `channel.send`에 `function_call_output` 결과 포함, `cb.chapter`·`stopTrack` 미호출. → 구현 → 커밋 `feat(cinema): apply realtime set_scene_object_values calls without ending the session`.

### Task 5: 배선
- Modify `src/cinema/useJarvisVoice.ts`, `src/cinema/JarvisMain.tsx`, `src/cinema/SignalFilm.tsx`. 스펙 §4.5.
- [ ] typecheck·전체 테스트·build → 커밋 `feat(cinema): wire HATCHERY actions from the film player to the voice hooks`.

### Task 6: 문서
- `docs/standards/scene-data-contract.md` §4 HATCHERY 항목에 도구 이름·필드·로컬 문장 예를 적고 `sources`에 `hatcheryTargets.ts` 추가, `verifiedCommit` 갱신. `DESIGN.md`는 clean일 때만.
- [ ] 커밋 `docs: describe the HATCHERY value command adapter`.

## 완료 기준
- 여섯 Task 커밋, 검증 3종 통과, 라이브 배포 성공.
- 키 없는 환경에서 "라인 2 470으로"가 막대 값을 바꾸고 막대 장면으로 이동한다.
