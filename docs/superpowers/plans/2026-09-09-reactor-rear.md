# Mechanical Reactor Rear Implementation Plan

> **For agentic workers:** Use executing-plans to implement this plan task-by-task. User approved the rear appearance; implement inline without another approval round.

**Goal:** Replace the flat rear cap with a layered mechanical assembly and implement the user's approved approximately 20-second repeated-teasing easter egg.

**Architecture:** A pure rear mesh module builds beveled metal parts in reactor-local coordinates, then shares the existing rotation and projection. A focused Canvas renderer depth-sorts opaque faces. The existing rear-facing branch delegates to it.

**Tech Stack:** TypeScript, Canvas 2D, Vitest, existing Next.js client boundary.

## Approved appearance

Central raised hexagonal shaft, recessed bearing, six staggered armor panels with cooling slots, substantial copper pipes and six fasteners. Gunmetal and silver dominate; small cyan indicators. No glass, wire grid, thin decorative linework, or changes to timing/front appearance.

Scope update requested by user: also extend the sequence to 20 seconds. First shoo with a head shake, retreat and return, land on the top and taunt, shake off, return a third time, delayed red smoldering eye, flee behind, whip around/shoot, recover. Keep ordinary front/voice behavior outside this sequence. Rear geometry and timeline are independent implementation work; integrate and review together.

## Task 1: Geometry and failing tests

- [ ] Add `tests/unit/scenes/cinemaReactorRear.test.ts`: assert six armor/fastener groups, multiple depths, centered hex shaft, finite coordinates, rotation attachment, stable reduced-motion state, far-to-near faces.
- [ ] Run `npm test -- tests/unit/scenes/cinemaReactorRear.test.ts` and observe missing implementation failure.
- [ ] Create `src/cinema/reactorRearGeometry.ts`: semantic rear parts, extruded/beveled polygons and annular wedges; transform with rotateReactorPoint and projectReactor.

## Task 2: Drawing integration

- [ ] Create `src/cinema/components/drawReactorRear.ts`: solid filled faces, material gradients, darker extruded sides, restrained lights; save/restore context.
- [ ] Replace only rear-facing cap block in `src/cinema/components/drawVoiceReactor.ts`; retain existing side/front/eye/spark code.
- [ ] Add draw integration checks for finite coordinates and state restoration.

## Task 3: Verification and handoff

- [ ] Run `npm run typecheck`, relevant ESLint, `npm run test:unit`, `npm run build`; report unrelated failures separately.
- [ ] Use existing browser at port3010: click reactor, wait through tease/hide to aim/impact, capture mechanical rear. Check mobile, return to idle, no new console errors.
- [ ] Update `DESIGN.md` impact map and a short report of evidence/gaps.
- [ ] Preserve unrelated dirty changes; no port/server changes or commit requested.
