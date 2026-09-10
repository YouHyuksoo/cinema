# HATCHERY 진입 연출(에어록 문 + 큐브) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** /cinema 첫 진입 시 닫힌 에어록 문 앞에서 큐브가 섞였다 풀리고, HUD 준비가 끝나면 문이 좌우로 열리며 큐브가 도킹 자리로 날아가는 세션당 1회 연출.

**Architecture:** 순수 상태 기계(`hatcheryIntro.ts`)와 비행 함수(`cubeIntroFlight.ts`)가 시간·입력만 받아 상태를 내고, `HatcheryIntro.tsx`가 문 오버레이를 그리며 루트 `data-hatchery-intro` 속성으로 큐브를 지휘하고 `hatchery-intro-cube` 이벤트로 큐브의 완료를 받는다. page.tsx에 형제로 마운트해 공유 파일을 피한다.

**Tech Stack:** Next 16 / React 19 / CSS Modules / vitest(node, 전역 스텁) / Playwright 헤드리스 스크린샷.

**Spec:** `docs/specs/2026-09-11-hatchery-intro-airlock-design.md`

## Global Constraints

- 이미지 파일 금지, CSS/SVG로만 그린다. 글래스모피즘·보라 그라데이션 금지.
- 세션 플래그 키 `hatchery.intro.v1`(sessionStorage). 루트 속성 `data-hatchery-intro` 값 `stage | return | snap`. 이벤트 `hatchery-intro-cube` detail `solved | docked`.
- 오버레이 z-index 8, 활성 중 큐브 레이어 z-index 9(큐브 레이어 기본 4~6, 메인 1, 도크 3).
- Codex가 `FilmMenuCubeView.tsx`·`filmMenuCube.module.css`를 미커밋 편집 중. Task 5는 `git status --short src/cinema/FilmMenuCubeView.tsx`가 깨끗해진 뒤 파일을 다시 읽고 진행한다.
- 커밋은 별도 인덱스 스크립트(`scratchpad/commit_scoped.sh`)로 내 파일만. 메시지 끝에 세션 attribution.

---

### Task 1: 상태 기계 `hatcheryIntro.ts`

**Files:**
- Create: `src/cinema/hatcheryIntro.ts`
- Test: `tests/unit/scenes/cinemaHatcheryIntro.test.ts`

**Interfaces:**
- Produces:
  - `INTRO_SESSION_KEY = 'hatchery.intro.v1'`, `INTRO_TIMING = { holdMs: 800, doorMs: 1100, returnDelayMs: 400, cubeTimeoutMs: 9000 }`
  - `shouldPlayIntro(storage: Pick<Storage,'getItem'|'setItem'> | null, reducedMotion: boolean): boolean` — 재생 여부. 재생하든 안 하든 플래그를 기록(저장 실패는 무시).
  - `type IntroPhase = 'closed' | 'opening' | 'done'`
  - `type IntroCubeCue = 'stage' | 'return' | 'snap' | null`
  - `createIntroTimeline(now: number)` → `{ solved(now), ready(now), docked(now), skip(now), at(now): IntroFrame }`
  - `interface IntroFrame { phase: IntroPhase; door: number; cube: IntroCubeCue; skipped: boolean }` — `door`는 0(닫힘)~1(열림).

- [ ] **Step 1: 실패하는 테스트**

```ts
import { describe, expect, it } from 'vitest';
import { createIntroTimeline, INTRO_SESSION_KEY, INTRO_TIMING, shouldPlayIntro } from '@/cinema/hatcheryIntro';

const memoryStorage = () => { const map = new Map<string, string>(); return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); }, map }; };

describe('intro session gate', () => {
  it('plays once per session and records the flag when it starts', () => {
    const storage = memoryStorage();
    expect(shouldPlayIntro(storage, false)).toBe(true);
    expect(storage.map.get(INTRO_SESSION_KEY)).toBe('1');
    expect(shouldPlayIntro(storage, false)).toBe(false);
  });
  it('skips under reduced motion but still marks the session', () => {
    const storage = memoryStorage();
    expect(shouldPlayIntro(storage, true)).toBe(false);
    expect(storage.map.get(INTRO_SESSION_KEY)).toBe('1');
  });
  it('plays when storage is unavailable or throws', () => {
    expect(shouldPlayIntro(null, false)).toBe(true);
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(shouldPlayIntro(broken, false)).toBe(true);
  });
});

describe('intro timeline', () => {
  it('stays closed with the cube staged until both the cube and the HUD are ready', () => {
    const intro = createIntroTimeline(1000);
    expect(intro.at(1000)).toEqual({ phase: 'closed', door: 0, cube: 'stage', skipped: false });
    intro.solved(6900);
    expect(intro.at(7000).phase).toBe('closed');
    intro.ready(7200);
    expect(intro.at(7200)).toMatchObject({ phase: 'opening', door: 0, cube: 'stage' });
  });
  it('opens over doorMs, sends the cube home after returnDelayMs, and finishes when docked', () => {
    const intro = createIntroTimeline(0);
    intro.ready(0); intro.solved(5900);
    expect(intro.at(5900 + INTRO_TIMING.doorMs / 2).door).toBeCloseTo(.5, 5);
    expect(intro.at(5900 + INTRO_TIMING.returnDelayMs - 1).cube).toBe('stage');
    expect(intro.at(5900 + INTRO_TIMING.returnDelayMs).cube).toBe('return');
    expect(intro.at(5900 + INTRO_TIMING.doorMs + 10)).toMatchObject({ phase: 'opening', door: 1 });
    intro.docked(8000);
    expect(intro.at(8000)).toEqual({ phase: 'done', door: 1, cube: null, skipped: false });
  });
  it('skip opens at once and snaps the cube', () => {
    const intro = createIntroTimeline(0);
    intro.skip(2000);
    expect(intro.at(2000)).toMatchObject({ phase: 'opening', door: 0, cube: 'snap', skipped: true });
    expect(intro.at(2000 + INTRO_TIMING.doorMs).door).toBe(1);
    intro.docked(2300);
    expect(intro.at(2300 + INTRO_TIMING.doorMs).phase).toBe('done');
  });
  it('does not wait forever for a cube that never reports', () => {
    const intro = createIntroTimeline(0);
    intro.ready(100);
    expect(intro.at(INTRO_TIMING.cubeTimeoutMs - 1).phase).toBe('closed');
    expect(intro.at(INTRO_TIMING.cubeTimeoutMs).phase).toBe('opening');
    expect(intro.at(INTRO_TIMING.cubeTimeoutMs + INTRO_TIMING.doorMs).phase).toBe('done');
  });
  it('is deterministic for the same clock', () => {
    const a = createIntroTimeline(0), b = createIntroTimeline(0);
    for (const intro of [a, b]) { intro.ready(0); intro.solved(5900); }
    expect(a.at(6400)).toEqual(b.at(6400));
  });
});
```

- [ ] **Step 2: RED 확인** — `npx vitest run tests/unit/scenes/cinemaHatcheryIntro.test.ts` → import 실패.

- [ ] **Step 3: 구현**

```ts
/** Session gate and state machine for the airlock intro; no DOM, driven by a caller-supplied clock. */
export const INTRO_SESSION_KEY = 'hatchery.intro.v1';
export const INTRO_TIMING = { holdMs: 800, doorMs: 1100, returnDelayMs: 400, cubeTimeoutMs: 9000 } as const;

export type IntroPhase = 'closed' | 'opening' | 'done';
export type IntroCubeCue = 'stage' | 'return' | 'snap' | null;
export interface IntroFrame { phase: IntroPhase; door: number; cube: IntroCubeCue; skipped: boolean }

/** Once per tab session; reduced motion never plays. The flag is written as the intro starts so a reload mid-intro does not replay. */
export function shouldPlayIntro(storage: Pick<Storage, 'getItem' | 'setItem'> | null, reducedMotion: boolean) {
  let seen = false;
  try { seen = storage?.getItem(INTRO_SESSION_KEY) === '1'; } catch { seen = false; }
  try { storage?.setItem(INTRO_SESSION_KEY, '1'); } catch { /* private mode: play once for this document */ }
  return !seen && !reducedMotion;
}

const ease = (t: number) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function createIntroTimeline(start: number) {
  let solvedAt: number | null = null, readyAt: number | null = null, dockedAt: number | null = null, skippedAt: number | null = null;
  const openingAt = (now: number) => {
    if (skippedAt !== null) return skippedAt;
    if (solvedAt !== null && readyAt !== null) return Math.max(solvedAt, readyAt);
    if (readyAt !== null && now - start >= INTRO_TIMING.cubeTimeoutMs) return start + INTRO_TIMING.cubeTimeoutMs;
    return null;
  };
  return {
    solved(now: number) { solvedAt ??= now; },
    ready(now: number) { readyAt ??= now; },
    docked(now: number) { dockedAt ??= now; },
    skip(now: number) { skippedAt ??= now; },
    at(now: number): IntroFrame {
      const skipped = skippedAt !== null;
      const opened = openingAt(now);
      if (opened === null || now < opened) return { phase: 'closed', door: 0, cube: 'stage', skipped };
      const door = ease(Math.max(0, Math.min(1, (now - opened) / INTRO_TIMING.doorMs)));
      const timedOut = solvedAt === null && !skipped;
      const cubeHome = dockedAt !== null || timedOut;
      if (door >= 1 && cubeHome) return { phase: 'done', door: 1, cube: null, skipped };
      const cube: IntroCubeCue = cubeHome ? null : skipped ? 'snap' : now - opened >= INTRO_TIMING.returnDelayMs ? 'return' : 'stage';
      return { phase: 'opening', door, cube, skipped };
    },
  };
}
```

- [ ] **Step 4: GREEN 확인** 후 커밋 `feat(cinema): add the airlock intro timeline`.

---

### Task 2: 비행 함수 `cubeIntroFlight.ts`

**Files:**
- Create: `src/cinema/cubeIntroFlight.ts`
- Test: `tests/unit/scenes/cinemaCubeIntroFlight.test.ts`

**Interfaces:**
- Produces: `CUBE_INTRO_SCALE = 1.6`, `CUBE_INTRO_FLIGHT_MS = 1200`, `CUBE_INTRO_SNAP_MS = 300`, `cubeIntroFlight(elapsed: number, from: Point, to: Point, mode: 'return' | 'snap'): { x: number; y: number; scale: number; bank: number; yaw: number; done: boolean }`.

- [ ] **Step 1: 실패하는 테스트**

```ts
import { describe, expect, it } from 'vitest';
import { CUBE_INTRO_FLIGHT_MS, CUBE_INTRO_SCALE, CUBE_INTRO_SNAP_MS, cubeIntroFlight } from '@/cinema/cubeIntroFlight';

const from = { x: 700, y: 400 }, to = { x: 120, y: 80 };
describe('cube intro flight', () => {
  it('starts on stage at intro scale and lands exactly on the dock at scale 1', () => {
    expect(cubeIntroFlight(0, from, to, 'return')).toMatchObject({ x: 700, y: 400, scale: CUBE_INTRO_SCALE, bank: 0, yaw: 0, done: false });
    const end = cubeIntroFlight(CUBE_INTRO_FLIGHT_MS, from, to, 'return');
    expect(end).toMatchObject({ x: 120, y: 80, scale: 1, bank: 0, yaw: 0, done: true });
  });
  it('arcs upward and banks within eight degrees mid-flight', () => {
    const mid = cubeIntroFlight(CUBE_INTRO_FLIGHT_MS / 2, from, to, 'return');
    expect(mid.y).toBeLessThan((from.y + to.y) / 2);
    expect(Math.abs(mid.bank)).toBeLessThanOrEqual(8);
    expect(Math.abs(mid.bank)).toBeGreaterThan(2);
    expect(mid.scale).toBeGreaterThan(1); expect(mid.scale).toBeLessThan(CUBE_INTRO_SCALE);
  });
  it('snaps straight home in 300 ms', () => {
    expect(cubeIntroFlight(CUBE_INTRO_SNAP_MS / 2, from, to, 'snap')).toMatchObject({ bank: 0, yaw: 0, done: false });
    expect(cubeIntroFlight(CUBE_INTRO_SNAP_MS, from, to, 'snap')).toMatchObject({ x: 120, y: 80, scale: 1, done: true });
  });
  it('clamps bad input to the endpoints', () => {
    expect(cubeIntroFlight(-5, from, to, 'return').done).toBe(false);
    expect(cubeIntroFlight(Number.NaN, from, to, 'return')).toMatchObject({ x: 700, y: 400 });
    expect(cubeIntroFlight(1e9, from, to, 'return')).toMatchObject({ x: 120, y: 80, done: true });
  });
});
```

- [ ] **Step 2: RED 확인**

- [ ] **Step 3: 구현**

```ts
import type { Point } from './filmMenuCube';

export const CUBE_INTRO_SCALE = 1.6;
export const CUBE_INTRO_FLIGHT_MS = 1200;
export const CUBE_INTRO_SNAP_MS = 300;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Stage-to-dock flight: a shallow arc that shrinks to dock size and banks into the turn; `snap` is a straight, fast hop. */
export function cubeIntroFlight(elapsed: number, from: Point, to: Point, mode: 'return' | 'snap') {
  const duration = mode === 'snap' ? CUBE_INTRO_SNAP_MS : CUBE_INTRO_FLIGHT_MS;
  const t = Number.isFinite(elapsed) ? Math.max(0, Math.min(1, elapsed / duration)) : 0;
  const p = smooth(t), lift = mode === 'snap' ? 0 : Math.sin(Math.PI * p) * 60;
  return {
    x: from.x + (to.x - from.x) * p,
    y: from.y + (to.y - from.y) * p - lift,
    scale: CUBE_INTRO_SCALE + (1 - CUBE_INTRO_SCALE) * p,
    bank: mode === 'snap' ? 0 : -8 * Math.sin(Math.PI * p),
    yaw: mode === 'snap' ? 0 : 24 * Math.sin(Math.PI * p),
    done: t >= 1,
  };
}
```

- [ ] **Step 4: GREEN 확인** 후 커밋 `feat(cinema): add the cube intro flight`.

---

### Task 3: 문 오버레이 `HatcheryIntro.tsx`

**Files:**
- Create: `src/cinema/HatcheryIntro.tsx`, `src/cinema/hatcheryIntro.module.css`
- Modify: `src/app/cinema/page.tsx`
- Test: `tests/unit/scenes/cinemaHatcheryIntroMarkup.test.ts`

**Interfaces:**
- Consumes: Task 1 전부, `createFrameLoop`/`watchReducedMotion` (`filmMotion.ts`).
- Produces: `HatcheryIntro()` 컴포넌트(props 없음). 루트 속성 `data-hatchery-intro`, 이벤트 리스너 `hatchery-intro-cube`.

- [ ] **Step 1: 실패하는 마크업 테스트**

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HatcheryIntroDoors } from '@/cinema/HatcheryIntro';

describe('airlock door markup', () => {
  it('renders two sliding panels with a hazard seam, four lock lamps, stencils and a skip control', () => {
    const html = renderToStaticMarkup(createElement(HatcheryIntroDoors, { door: 0, skipped: false, onSkip() {} }));
    expect(html).toContain('role="dialog"'); expect(html).toContain('aria-label="HATCHERY 시작"');
    expect((html.match(/data-airlock-panel="(left|right)"/g) ?? []).length).toBe(2);
    expect((html.match(/data-airlock-lamp/g) ?? []).length).toBe(4);
    expect(html).toContain('HATCHERY'); expect(html).toContain('AIRLOCK 01');
    expect(html).toContain('건너뛰기');
    expect(html).toContain('style="--door:0"');
  });
  it('uses no images and no glass or purple gradients', () => {
    const css = readFileSync('src/cinema/hatcheryIntro.module.css', 'utf8');
    expect(css).not.toMatch(/url\(/); expect(css).not.toMatch(/backdrop-filter/); expect(css).not.toMatch(/#[89a-f][0-9a-f]?[0-9a-f]?[0-9a-f]?ff\b|purple|violet/i);
    expect(css).toContain('--door');
  });
  it('is mounted beside the film on the cinema page', () => {
    const page = readFileSync('src/app/cinema/page.tsx', 'utf8');
    expect(page).toContain("import { HatcheryIntro } from '@/cinema/HatcheryIntro';");
    expect(page).toContain('<HatcheryIntro />');
  });
});
```

- [ ] **Step 2: RED 확인**

- [ ] **Step 3: 컴포넌트 구현**

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { createIntroTimeline, shouldPlayIntro, type IntroFrame } from './hatcheryIntro';
import { createFrameLoop, watchReducedMotion } from './filmMotion';
import styles from './hatcheryIntro.module.css';

const INTRO_ATTRIBUTE = 'hatcheryIntro';
const CUBE_EVENT = 'hatchery-intro-cube';

/** Pure presentation: two panels, seam, lamps, stencils; `door` 0..1 drives the slide through a CSS variable. */
export function HatcheryIntroDoors({ door, skipped, onSkip }: { door: number; skipped: boolean; onSkip: () => void }) {
  const lamps = ['top-left', 'bottom-left', 'top-right', 'bottom-right'];
  return <div className={styles.airlock} role="dialog" aria-label="HATCHERY 시작" data-door-open={door >= 1} data-skipped={skipped}
    style={{ '--door': door } as React.CSSProperties}>
    <div className={styles.panel} data-airlock-panel="left"><span className={styles.stencil}>HATCHERY</span><i className={styles.rivets} /><i className={styles.hazard} /></div>
    <div className={styles.panel} data-airlock-panel="right"><span className={styles.stencil}>AIRLOCK 01</span><i className={styles.rivets} /><i className={styles.hazard} /></div>
    <div className={styles.rails} aria-hidden="true"><i /><i /></div>
    {lamps.map(lamp => <i key={lamp} className={styles.lamp} data-airlock-lamp={lamp} aria-hidden="true" />)}
    <button type="button" className={styles.skip} onClick={onSkip}>건너뛰기</button>
  </div>;
}

export function HatcheryIntro() {
  const [frame, setFrame] = useState<IntroFrame | null>(null);
  const timeline = useRef<ReturnType<typeof createIntroTimeline> | null>(null);
  useEffect(() => {
    const motion = watchReducedMotion();
    let storage: Storage | null = null;
    try { storage = window.sessionStorage; } catch { storage = null; }
    if (!shouldPlayIntro(storage, motion.reduced)) { motion.stop(); return; }
    const intro = createIntroTimeline(performance.now()); timeline.current = intro;
    const root = document.documentElement;
    let lastCue: string | null = null, published: IntroFrame | null = null;
    const apply = (next: IntroFrame) => {
      const cue = next.cube ?? '';
      if (cue !== lastCue) { lastCue = cue; if (cue) root.dataset[INTRO_ATTRIBUTE] = cue; else delete root.dataset[INTRO_ATTRIBUTE]; }
      if (!published || published.phase !== next.phase || published.door !== next.door || published.skipped !== next.skipped) { published = next; setFrame(next); }
    };
    // HUD readiness: fonts, the film main element, then one painted frame.
    const readiness = document.fonts.ready.then(() => new Promise<void>(resolve => {
      const check = () => document.querySelector('main[data-film-theme]') ? requestAnimationFrame(() => resolve()) : setTimeout(check, 50);
      check();
    }));
    void readiness.then(() => intro.ready(performance.now()));
    const onCube = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail === 'solved') intro.solved(performance.now());
      if (detail === 'docked') intro.docked(performance.now());
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') intro.skip(performance.now()); };
    document.addEventListener(CUBE_EVENT, onCube); document.addEventListener('keydown', onKey);
    const loop = createFrameLoop(now => {
      const next = intro.at(now); apply(next);
      if (next.phase === 'done') loop.stop();
    });
    apply(intro.at(performance.now())); loop.start();
    return () => {
      loop.stop(); motion.stop(); delete root.dataset[INTRO_ATTRIBUTE];
      document.removeEventListener(CUBE_EVENT, onCube); document.removeEventListener('keydown', onKey);
    };
  }, []);
  if (!frame || frame.phase === 'done') return null;
  return <HatcheryIntroDoors door={frame.door} skipped={frame.skipped} onSkip={() => timeline.current?.skip(performance.now())} />;
}
```

`inert`: `useEffect`에서 `frame`이 있고 phase !== 'done'인 동안 `document.querySelector('main[data-film-theme]')?.setAttribute('inert','')`, 끝나면 제거. 초점: 마운트 시 skip 버튼에 `focus({ preventScroll: true })`, 언마운트 시 `document.body.focus()` 대신 이전 activeElement 복원.

- [ ] **Step 4: CSS 구현** (`hatcheryIntro.module.css`)

```css
.airlock { position: fixed; inset: 0; z-index: 8; overflow: hidden; --door: 0; --seam: color-mix(in srgb, #ffb347 78%, transparent); --lamp: #ffb347; }
.airlock[data-door-open="true"] { pointer-events: none; }
:global(:root[data-hatchery-intro]) :global([data-cube-layer]) { z-index: 9 !important; }
.panel { position: absolute; top: 0; bottom: 0; width: 50%; background:
    repeating-linear-gradient(0deg, transparent 0 3px, rgba(255,255,255,.025) 3px 4px),
    linear-gradient(180deg, #1c2a33, #101a21 48%, #0b1218);
  box-shadow: inset 0 0 0 1px rgba(95,227,255,.18), inset 0 0 60px rgba(0,0,0,.55);
  transition: none; }
.panel[data-airlock-panel="left"] { left: 0; transform: translate3d(calc(var(--door) * -100%), 0, 0); clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 calc(100% - 24px), 0 24px); }
.panel[data-airlock-panel="right"] { right: 0; transform: translate3d(calc(var(--door) * 100%), 0, 0); }
.panel::before { content: ''; position: absolute; inset: 18px; border: 1px solid rgba(95,227,255,.22); clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px); }
.panel::after { content: ''; position: absolute; top: 0; bottom: 0; width: 3px; background: linear-gradient(180deg, transparent, #5fe3ff 20%, #5fe3ff 80%, transparent); opacity: .85; }
.panel[data-airlock-panel="left"]::after { left: 0; } .panel[data-airlock-panel="right"]::after { right: 0; }
.hazard { position: absolute; top: 0; bottom: 0; width: 24px; background: repeating-linear-gradient(135deg, var(--seam) 0 14px, #141d24 14px 28px); opacity: .9; }
.panel[data-airlock-panel="left"] .hazard { right: 0; } .panel[data-airlock-panel="right"] .hazard { left: 0; }
.rivets { position: absolute; inset: 34px 48px; background-image: radial-gradient(circle, rgba(200,220,228,.55) 0 1.5px, transparent 2px); background-size: 100% 25%; background-repeat: repeat-y; opacity: .5; }
.stencil { position: absolute; bottom: 12%; font: 700 clamp(28px, 6vw, 88px)/1 var(--font-display), sans-serif; letter-spacing: .18em; color: rgba(95,227,255,.22); text-transform: uppercase; }
.panel[data-airlock-panel="left"] .stencil { right: 48px; } .panel[data-airlock-panel="right"] .stencil { left: 48px; }
.rails { position: absolute; inset: 0; z-index: -1; background: linear-gradient(180deg, #05090c, #07111a); }
.rails i { position: absolute; left: 6%; right: 6%; height: 10px; background: linear-gradient(90deg, #2a3b47, #55707f, #2a3b47); box-shadow: 0 0 8px rgba(95,227,255,.25); }
.rails i:first-child { top: 22%; } .rails i:last-child { bottom: 22%; }
.lamp { position: absolute; width: 10px; height: 10px; border-radius: 50%; background: var(--lamp); box-shadow: 0 0 10px var(--lamp); animation: lampPulse 1.2s ease-in-out infinite; }
.lamp[data-airlock-lamp="top-left"] { top: 10%; left: calc(50% - 40px); } .lamp[data-airlock-lamp="bottom-left"] { bottom: 10%; left: calc(50% - 40px); }
.lamp[data-airlock-lamp="top-right"] { top: 10%; right: calc(50% - 40px); } .lamp[data-airlock-lamp="bottom-right"] { bottom: 10%; right: calc(50% - 40px); }
.airlock[data-door-open="true"] .lamp, .airlock:where([style*="--door:0."]) .lamp { --lamp: #5fe3ff; animation: none; }
.skip { position: absolute; inset: 0; width: 100%; height: 100%; background: transparent; border: 0; color: transparent; cursor: pointer; font-size: 0; }
.skip:focus-visible { outline: 2px solid #5fe3ff; outline-offset: -6px; }
@keyframes lampPulse { 50% { opacity: .45; } }
@media (prefers-reduced-motion: reduce) { .lamp { animation: none; } }
```

잠금등 색 전환은 `data-door-open` 대신 컴포넌트에서 `data-unlocked={door > 0}` 속성을 내고 CSS는 `.airlock[data-unlocked="true"] .lamp { --lamp: #5fe3ff; animation: none; }`로 단순화한다(위의 `:where([style*=...])` 줄은 쓰지 않는다).

- [ ] **Step 5: page.tsx**

```tsx
import { SignalFilm } from '@/cinema/SignalFilm';
import { HatcheryIntro } from '@/cinema/HatcheryIntro';

export default function CinemaPage() {
  return <>
    <SignalFilm />
    <HatcheryIntro />
  </>;
}
```

- [ ] **Step 6: GREEN, tsc, lint** 후 브라우저 확인: 헤드리스 스크린샷(0.5초: 닫힘, 큐브 없이도 9초 뒤 타임아웃 개방). 커밋 `feat(cinema): add the airlock intro overlay`.

---

### Task 4: 문서

- [ ] DESIGN.md `## 메인 화면` 상단에 진입 연출 규칙 1개 항목(타임라인·신호 계약·건너뛰기·동작 줄이기·영향 경로·검증). Codex가 DESIGN.md를 편집 중이면 커밋 뒤로 미룬다.

---

### Task 5: 큐브 연결 (`FilmMenuCubeView.tsx`) — Codex 커밋 뒤

**전제:** `git status --short src/cinema/FilmMenuCubeView.tsx src/cinema/filmMenuCube.module.css`가 비어 있어야 한다. 파일을 다시 읽고 아래 계약을 그 구조에 맞춰 적용한다.

**계약:**
- 마운트 시와 루트 속성 변화 시(`MutationObserver`로 `documentElement`의 `data-hatchery-intro` 감시) 큐 값을 읽는다.
- `stage`: `center`를 뷰포트 중앙으로, 본체 배율을 `CUBE_INTRO_SCALE`로 두고 부유·쇼케이스·감전을 끈다. 등장 후 `INTRO_TIMING.holdMs` 뒤 `startMix()`(기존 8수 섞기) → 기존 solve 단계가 끝나 `phase === 'idle'`이 되는 순간 `document.dispatchEvent(new CustomEvent('hatchery-intro-cube', { detail: 'solved' }))`를 한 번 보낸다.
- `return` | `snap`: `cubeIntroFlight(elapsed, stageCenter, dockCenter, mode)`로 위치·배율·뱅크·요를 적용(`measure()`로 최신 도킹 중심 사용). `done`이면 `measure(); draw();`로 평상시 복귀하고 `detail: 'docked'`를 보낸다.
- 속성이 사라지면 즉시 평상시로 복귀한다(오버레이 언마운트 안전망).
- 소스 계약 테스트 `cinemaHatcheryIntroCube.test.ts`: `hatchery-intro-cube` 두 detail 문자열, `cubeIntroFlight(` 호출, `dataset.hatcheryIntro` 읽기, MutationObserver 존재.

- [ ] **Step 1: 소스 계약 테스트(RED)** → **Step 2: 구현** → **Step 3: 전체 테스트·tsc·lint** → **Step 4: Playwright 3장(닫힘·열리는 중·완료)과 세션 재진입 시 미재생 확인** → **Step 5: 커밋** `feat(cinema): stage the cube in the airlock intro`.

---

## Self-Review

- 스펙 커버: 세션 1회(Task 1), 문 좌우 슬라이딩·디자인(Task 3), 건너뛰기(Task 1·3), 동작 줄이기(Task 1), 준비 대기(Task 1·3), 큐브 무대·섞기·풀기·비행(Task 2·5), 타임아웃(Task 1), 접근성(Task 3), 문서(Task 4), 검증(각 Task). 누락 없음.
- 이름 일치: `shouldPlayIntro`, `createIntroTimeline`, `IntroFrame`, `INTRO_TIMING`, `cubeIntroFlight`, `CUBE_INTRO_SCALE`, `HatcheryIntroDoors`, `HatcheryIntro`, 이벤트 `hatchery-intro-cube`, 속성 `data-hatchery-intro`.
