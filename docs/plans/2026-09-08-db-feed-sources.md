# DB 데이터 소스 연동 · 관리 화면 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Oracle(SVEHICLEPDBEXT)에서 피드 SQL을 실행해 장면 문서로 만들고, 관리 화면에서 소스·매핑·상태를 다루며, 막대 장면에 실데이터를 띄운다.

**Architecture:** 순수 모듈(`feedConfig.ts` 설정 모델·검증, `feedMapping.ts` 행→피드 데이터, `feedScenes.ts` 피드→장면 문서) → 서버(`hatcheryConfig.ts` 파일 저장, `oracleSource.ts` 드라이버, `feedRunner.ts` 실행·캐시) → 라우트 4개 → 브라우저 `feedPolling.ts` → 저장소. 관리 화면 `/cinema/admin`.

**Tech Stack:** Next.js 16 route handlers, `oracledb` 7 thin, React 19, Vitest.

**Spec:** `docs/specs/2026-09-08-db-feed-sources-design.md`

## Global Constraints
- 비밀번호는 `config/hatchery.sources.json`에만 있고 git 제외, API 응답은 마스킹, 로그에 남기지 않는다.
- SQL은 SELECT/WITH 시작·세미콜론 금지·행 수 제한. 관리·피드 API는 localhost 전용.
- 화면 지문 무변경. 검증: typecheck·test:unit·build. 커밋은 내 파일만.

### Task 1: 순수 모듈 — 설정·매핑·변환
- Create `src/cinema/feedConfig.ts`, `feedMapping.ts`, `feedScenes.ts`; tests `cinemaFeedConfig.test.ts`, `cinemaFeedMapping.test.ts`, `cinemaFeedScenes.test.ts`; `.gitignore`에 설정 파일, `config/hatchery.sources.example.json`.
- [ ] 테스트 → 구현 → 통과 → 커밋 `feat(cinema): model feed sources, column mappings and feed-to-scene conversion`.

### Task 2: 서버 — 설정 파일·Oracle·러너·라우트
- Create `src/server/cinema/hatcheryConfig.ts`, `oracleSource.ts`, `feedRunner.ts`; routes `src/app/api/cinema/admin/config/route.ts`, `admin/sources/test/route.ts`, `admin/feeds/preview/route.ts`, `feed/route.ts`; tests `cinemaHatcheryConfig.test.ts`(임시 경로), `cinemaFeedRunner.test.ts`(oracle mock), `cinemaFeedRoutes.test.ts`.
- [ ] 테스트 → 구현 → 통과 → 커밋 `feat(cinema): run feed SQL against Oracle sources and serve scene documents`.

### Task 3: 브라우저 폴링 어댑터
- Create `src/cinema/feedPolling.ts`, test `cinemaFeedPolling.test.ts`; Modify `useFilmPlayback.ts`(시작·중단·`feedStatus`).
- [ ] 테스트 → 구현 → 통과 → 커밋 `feat(cinema): poll server feeds into the scene data store`.

### Task 4: 관리 화면
- Create `src/app/cinema/admin/page.tsx`, `src/cinema/admin/HatcheryAdmin.tsx`(+ 하위 컴포넌트), `hatcheryAdmin.module.css`.
- [ ] typecheck·build·수동 확인 → 커밋 `feat(cinema): add the HATCHERY data source admin screen`.

### Task 5: 실 DB 검증 + 문서
- 로컬 설정에 SVEHICLEPDBEXT 등록, production 매핑(IP_PRODUCT_LINE + IP_PRODUCT_SMD_PLAN) 미리보기, 막대 장면 실데이터 확인. 표준 §4.1에 러너·관리 화면 한 줄, `docs/guides/db-feed-setup.md`(가이드) 작성, DESIGN.md 항목.
- [ ] 커밋 `docs: guide for connecting a database to HATCHERY feeds`.

## 완료 기준
- 관리 화면에서 소스 연결 테스트 성공, production 미리보기 성공, 막대 장면이 MES 라인 이름과 수량을 표시, 검증 3종 통과, 배포 성공(Pages는 정적 모드 유지).
