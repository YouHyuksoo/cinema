# Theme Card Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split theme-related controls from the main screen's scene-settings card into an independent theme card.

**Architecture:** Extract explicit theme and scene control groups from `FilmControls`. Render both groups together in the existing dock/dialog, while `JarvisMain` receives two slots and wraps them in separate left-stream cards.

**Tech Stack:** React 19, TypeScript, CSS Modules, Vitest server-render markup tests

---

### Task 1: Lock the card contract with tests

**Files:**
- Modify: `tests/unit/scenes/cinemaStreamRoles.test.ts`

- [ ] Add failing assertions for one `THEME / 테마` card followed by one `SCENE / 연출 설정` card.
- [ ] Assert the theme card contains color, central background, screen texture, and intensity, while the scene card contains camera, menu layout, playback, and conditional presentation controls.
- [ ] Run `npx vitest run tests/unit/scenes/cinemaStreamRoles.test.ts` and confirm it fails because the theme card does not exist.

### Task 2: Split the reusable controls

**Files:**
- Modify: `src/cinema/FilmControls.tsx`

- [ ] Extract exported `FilmThemeSettings` for color, central background, texture, and intensity.
- [ ] Extract exported `FilmSceneSettings` for camera, menu layout, machine/chart presentation, and playback controls.
- [ ] Keep `FilmControls` as the composition of both exports so `FilmDock` and `FilmSettingsDialog` retain all settings.

### Task 3: Render separate stream cards

**Files:**
- Modify: `src/cinema/JarvisMain.tsx`
- Modify: `src/cinema/SignalFilm.tsx`
- Modify: `tests/unit/scenes/cinemaStreamRoles.test.ts`

- [ ] Replace the single settings slot with `themeSettings` and `sceneSettings` slots.
- [ ] Render `THEME / 테마` first with `aria-label="테마 설정"`, then `SCENE / 연출 설정` with `aria-label="연출 설정"`.
- [ ] Pass the extracted control groups from `SignalFilm` and run the focused markup test.

### Task 4: Documentation and verification

**Files:**
- Modify: `DESIGN.md`
- Modify if needed: `src/cinema/jarvisStream.module.css`

- [ ] Update the main settings rule with the two-card ownership and ordering.
- [ ] Run `npm run typecheck`, `npm run test:unit`, and `npm run build`.
- [ ] Check the development screen at desktop and mobile widths for card order, folding, and independent stream scrolling.
- [ ] Commit source, tests, and docs as `refactor(cinema): split theme settings card`.
