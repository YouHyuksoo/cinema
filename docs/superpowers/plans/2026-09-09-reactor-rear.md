# Mechanical Reactor Rear Implementation Plan

> **For agentic workers:** Use executing-plans to implement this plan task-by-task. User approved the rear appearance; implement inline without another approval round.

**Goal:** Replace the flat rear cap with a layered mechanical assembly and implement the user's approved approximately 20-second repeated-teasing easter egg.

**Architecture:** A pure rear mesh module builds beveled metal parts in reactor-local coordinates, then shares the existing rotation and projection. A focused Canvas renderer depth-sorts opaque faces. The existing rear-facing branch delegates to it.

**Tech Stack:** TypeScript, Canvas 2D, Vitest, existing Next.js client boundary.

## Approved appearance

Central raised hexagonal shaft, recessed bearing, six staggered armor panels with cooling slots, substantial copper pipes and six fasteners. Gunmetal and silver dominate; small cyan indicators. No glass, wire grid, thin decorative linework, or changes to the ordinary front appearance.

Scope update requested by user: also extend the sequence to 20 seconds. First shoo with a head shake, retreat and return, land on the top and taunt, shake off, return a third time, delayed red smoldering eye, flee behind, whip around/shoot, recover. Keep ordinary front/voice behavior outside this sequence. Rear geometry and timeline are independent implementation work; integrate and review together.

## Task 1: Geometry and failing tests

- [x] Add `tests/unit/scenes/cinemaReactorRear.test.ts`: assert six armor/fastener groups, multiple depths, centered hex shaft, finite coordinates, rotation attachment, stable reduced-motion state, far-to-near faces.
- [x] Run `npm test -- tests/unit/scenes/cinemaReactorRear.test.ts` and observe missing implementation failure.
- [x] Create `src/cinema/reactorRearGeometry.ts`: semantic rear parts, extruded/beveled polygons and annular wedges; transform with rotateReactorPoint and projectReactor.

## Task 2: Drawing integration

- [x] Create `src/cinema/components/drawReactorRear.ts`: solid filled faces with lit materials, darker extruded sides, restrained lights; save/restore context.
- [x] Replace rear-facing cap block in `src/cinema/components/drawVoiceReactor.ts`; add front-facing rear prepass for protruding silhouette, retain ordinary front/voice behavior.
- [x] Add draw integration checks for finite coordinates, state restoration and rear axis visibility across the 90-degree turn.
- [x] Extend timeline/flight to 20 seconds with TDD, add perched attachment and eye heat; verify continuous takeoff and delayed anger.

## Task 3: Verification and handoff

- [x] Run `npm run typecheck`, relevant ESLint, `npm run test:unit`, `npm run build`: all pass, 762 tests.
- [x] Use existing browser at port3010: complete 20-second sequence on desktop and mobile, capture mechanical rear, return to idle, no console errors.
- [x] Update `DESIGN.md` impact map and `docs/reports/2026-09-09-reactor-easter-egg.md` evidence/gaps. Spec and code-quality reviews approved.
- [x] Preserve unrelated dirty changes; no port/server changes or commit requested.
