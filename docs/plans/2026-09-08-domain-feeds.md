# 도메인 피드 선언 · 계약 문서 자동 생성 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시연 데이터 구조를 기준으로 도메인 피드 9개를 서술자로 선언하고, JSON Schema·예시·컬럼 표를 자동 생성해 DB 담당자가 무엇을 보내면 되는지 알 수 있게 한다.

**Architecture:** `domainFeeds.ts`(선언 + 스키마/마크다운 생성 함수) → 골든 파일 테스트가 `public/cinema/data/schemas/*.json`과 `docs/database/domain-feeds.md`를 검증·재생성. `sceneField.ts`에 `optional` 추가.

**Tech Stack:** TypeScript, Vitest(골든 파일), JSON Schema draft-07.

**Spec:** `docs/specs/2026-09-08-domain-feeds-design.md`

## Global Constraints
- 기존 `SCENE_FIELDS`·`PRODUCTION_LINE_FIELDS`를 참조하고 복사하지 않는다.
- 화면 코드 무변경(지문 테스트 유지). 검증: typecheck·test:unit·build. 커밋은 내 파일만.

### Task 1: `optional` 서술자 + `domainFeeds.ts` + 테스트
- Modify `src/cinema/sceneField.ts`(optional), Create `src/cinema/domainFeeds.ts`, `tests/unit/scenes/cinemaDomainFeeds.test.ts`, `package.json` 스크립트 `docs:feeds`.
- [ ] 테스트 작성 → `FEED_DOCS_UPDATE=1`로 생성물 생성 → 일반 실행 통과 → 커밋 `feat(cinema): declare domain feeds and generate their contract schemas`.

### Task 2: 문서
- 표준 §4에 "도메인 피드" 절과 `docs/database/domain-feeds.md` 링크, `sources`에 `domainFeeds.ts`, 스탬프. `docs/database/domain-feeds.md`는 생성물이며 frontmatter의 `verifiedCommit`도 생성 시 스탬프.
- [ ] 커밋 `docs: describe domain feeds in the scene data contract`.

## 완료 기준
- 피드 9개 스키마·예시·컬럼표가 생성·커밋되고 골든 테스트 통과, 배포 성공.
