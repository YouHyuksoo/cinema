# Screen Object Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 화면 객체가 MCP식 메서드를 등록하고 모든 입력 경로가 같은 디스패처를 사용하게 한다.

**Architecture:** 순수 TypeScript 레지스트리와 React 등록 컨텍스트를 추가한다. 기존 `control_screen` key 계약은 객체 호출로 변환해 유지하고, DOM selector 기반 실행을 객체 등록으로 교체한다.

**Tech Stack:** TypeScript, React, Next.js, Vitest

---

### Task 1: Registry contract

**Files:**
- Create: `src/cinema/screenObjectRegistry.ts`
- Test: `tests/unit/scenes/cinemaScreenObjectRegistry.test.ts`

- [x] 등록, 해제, 메서드 실행, 상태 조회, 카탈로그 테스트를 작성한다.
- [x] 최소 레지스트리 구현으로 테스트를 통과시킨다.

### Task 2: React object registration

**Files:**
- Create: `src/cinema/ScreenObjectContext.tsx`
- Modify: `src/cinema/SignalFilm.tsx`
- Modify: `src/cinema/FilmMenuCubeView.tsx`
- Modify: `src/cinema/FilmTurbineMenu.tsx`
- Modify: `src/cinema/JarvisCameraPopup.tsx`
- Modify: `src/cinema/JarvisMain.tsx`
- Modify: `src/cinema/JarvisMetricCards.tsx`
- Modify: `src/cinema/JarvisStream.tsx`
- Modify: `src/cinema/JarvisWave.tsx`
- Modify: `src/cinema/ScannerTeslaEffect.tsx`

- [x] 화면 루트에 레지스트리 provider를 설치한다.
- [x] 스트림, 카드 확대, 스캐너, 리액터가 자기 메서드와 상태를 등록하게 한다.

### Task 3: Legacy command adapter

**Files:**
- Modify: `src/cinema/useScreenCommands.ts`
- Modify: `tests/unit/scenes/cinemaScreenExecution.test.ts`

- [x] 기존 screen key를 객체 메서드로 변환하는 실행 테스트를 추가한다.
- [x] 중앙 DOM selector와 해당 switch 분기를 레지스트리 호출로 교체한다.
- [x] 재생기, 카메라, 장면 컨트롤러를 객체 어댑터로 등록한다.

### Task 4: Documentation and verification

**Files:**
- Modify: `DESIGN.md`
- Modify: `docs/standards/command-map.md`

- [x] 객체 등록과 명령 변환 경로를 문서화한다.
- [x] 관련 Vitest와 `npm run typecheck`를 실행한다.
- [x] 개발 서버가 `http://localhost:3010/cinema`에서 HTTP 200인지 확인한다.
- [ ] 개발 화면에서 카드 확대와 좌·우 스트림 정지·재개 명령을 각각 확인한다.

`npm run build`는 사용자가 요청할 때만 실행한다는 프로젝트 작업 지시에 따라 이번 변경에서는 실행하지 않는다.

