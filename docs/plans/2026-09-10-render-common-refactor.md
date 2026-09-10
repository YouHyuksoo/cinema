# 렌더 공통화 리팩터 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 흩어진 렌즈 원근 투영과 RAF 루프 보일러플레이트를 공용 모듈 두 개로 모으고, DESIGN.md를 영역별로 재편한다. 화면 픽셀은 바뀌지 않는다.

**Architecture:** `src/cinema/filmLens.ts`(pitch→yaw→roll 렌즈 투영 커널)와 `src/cinema/filmMotion.ts`(프레임 루프·감소 동작·가시성·DPR 헬퍼)를 추가하고 기존 호출부가 이를 쓰도록 바꾼다. 투영은 인라인 스냅샷 골든 테스트와 장면 지문 스냅샷으로 비트 동일성을 고정한다.

**Tech Stack:** Next 16 / React 19 / TypeScript / vitest 5 (`environment: node`, 전역 스텁으로 DOM 흉내).

**Spec:** `docs/specs/2026-09-10-render-common-refactor-design.md`

## Global Constraints

- 시각 변경 금지. `tests/unit/scenes/__snapshots__/cinemaFilmFingerprint.test.ts.snap`은 갱신하지 않는다(`vitest run` 기본, `-u` 금지).
- Codex CLI가 같은 작업 트리에서 동시에 작업한다. 편집 전 `git status --short`로 다른 에이전트의 dirty 파일을 확인하고, 내가 만들지 않은 dirty 파일은 건드리지 않는다.
- 커밋은 공유 인덱스를 쓰지 않고 별도 인덱스 스크립트(아래 "커밋 절차")로 내 파일만 경로 지정해 만든다. `git add -A` 금지.
- 새 파일 이름은 `film*` 접두어(장면 공용 유틸 관례), 테스트는 `tests/unit/scenes/cinema*.test.ts`.
- 훅 대신 effect 내부용 비-훅 헬퍼를 쓴다(스펙 §2).
- 커밋 메시지 끝에 세션 attribution 두 줄을 붙인다.

## 커밋 절차 (모든 Task 공통)

스크립트 `C:\Users\hsyou\AppData\Local\Temp\claude\C--Project-cinema\c4257401-7ced-4a3c-87f6-caf9cc6ae6b7\scratchpad\commit_scoped.sh`:

```bash
#!/usr/bin/env bash
# usage: commit_scoped.sh <message-file> <file>...
set -e
cd /c/Project/cinema
msgfile="$1"; shift
start=$(git rev-parse HEAD)
scratch="$(dirname "$0")"
export GIT_INDEX_FILE="$scratch/index.$$"
rm -f "$GIT_INDEX_FILE"
git read-tree HEAD
git add -- "$@"
tree=$(git write-tree)
unset GIT_INDEX_FILE
rm -f "$scratch/index.$$"
[ "$(git rev-parse HEAD)" = "$start" ] || { echo "HEAD moved during commit; retry" >&2; exit 1; }
commit=$(git commit-tree "$tree" -p "$start" -F "$msgfile")
git update-ref refs/heads/main "$commit" "$start"
git reset -q HEAD -- "$@"
git log --oneline -1
```

메시지 파일 예시(`$scratch/msg.txt`):

```
refactor(cinema): share the lens projection kernel

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01V2R6oi9hNuPvRv7mkEvpbF
```

실행: `bash "$scratch/commit_scoped.sh" "$scratch/msg.txt" src/cinema/filmLens.ts ...`

---

### Task 1: 렌즈 투영 골든 고정 + `filmLens.ts`

**Files:**
- Create: `src/cinema/filmLens.ts`
- Modify: `src/cinema/cornerCoreGeometry.ts:4-33`
- Modify: `src/cinema/cornerProjection.ts:4,22-52`
- Modify: `src/cinema/voiceReactorGeometry.ts:6-13`
- Modify: `src/cinema/cubeReactorFlight.ts:5-8`
- Modify: `src/cinema/filmFocus.ts:8,16-23`
- Test: `tests/unit/scenes/cinemaFilmLens.test.ts`

**Interfaces:**
- Produces: `lensScale(lens: number, depth: number): number`; `createLensProjection(pose: LensPose): (x: number, y: number, z?: number) => LensPoint`; `LensPoint = { x; y; depth }`; `LensPose = { lens; yaw?; pitch?; roll?; depth?; originX?; originY?; centerX?; centerY? }`.

- [ ] **Step 1: 리팩터 전 골든 값을 인라인 스냅샷으로 캡처하는 테스트 작성**

`tests/unit/scenes/cinemaFilmLens.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createCoreProjection } from '@/cinema/cornerCoreGeometry';
import { cornerReadingProjection } from '@/cinema/cornerProjection';
import { cornerSequenceState } from '@/cinema/cornerSequence';
import { projectReactor } from '@/cinema/voiceReactorGeometry';
import { cubeReactorFlight } from '@/cinema/cubeReactorFlight';
import { focusProjection } from '@/cinema/filmFocus';

/** Values captured before the lens kernel was shared; the refactor must reproduce them bit for bit. */
describe('lens projection keeps the pre-refactor pixels', () => {
  it('corner finale core', () => {
    const projection = createCoreProjection(5);
    expect([projection.point(120, -60, 10), projection.ring(1, 190, 22), projection.ring(4.2, 190, -18)]).toMatchInlineSnapshot();
  });
  it('corner reading planes', () => {
    const readings = cornerSequenceState(36).items;
    expect(readings.map(reading => cornerReadingProjection(reading).point(120, -60, 10))).toMatchInlineSnapshot();
    expect(cornerReadingProjection(cornerSequenceState(6.5).items[0]).point(-150, 90)).toMatchInlineSnapshot();
  });
  it('voice reactor', () => {
    expect([projectReactor({ x: 40, y: 30, z: 20 }), projectReactor({ x: -80, y: 12, z: -40 }, .31), projectReactor({ x: 0, y: 0, z: 0 }, Number.NaN)]).toMatchInlineSnapshot();
  });
  it('cube reactor flight', () => {
    expect(cubeReactorFlight(3000, { x: 100, y: 80 }, { x: 400, y: 300, radius: 60 })!.projected).toMatchInlineSnapshot();
    expect(cubeReactorFlight(600, { x: 100, y: 80 }, { x: 400, y: 300, radius: 60 })!.projected).toMatchInlineSnapshot();
  });
  it('focus projection', () => {
    expect([focusProjection({ x: 955, y: 385, focus: .6, depth: 85, lift: 10 }), focusProjection({ x: 640, y: 360, focus: 1, depth: -2000 })]).toMatchInlineSnapshot();
  });
});
```

- [ ] **Step 2: 한 번 실행해 인라인 스냅샷을 채우고, 채워졌는지 확인**

Run: `npx vitest run tests/unit/scenes/cinemaFilmLens.test.ts`
Expected: 5 passed, 파일 안 `toMatchInlineSnapshot()` 괄호에 실제 숫자 객체가 기록됨. `grep -c "toMatchInlineSnapshot(\`" tests/unit/scenes/cinemaFilmLens.test.ts` → 7.

- [ ] **Step 3: 커널 자체의 실패하는 테스트 추가**

같은 파일 상단 import에 `import { createLensProjection, lensScale } from '@/cinema/filmLens';`를 더하고 아래 describe를 추가:

```ts
describe('lens projection kernel', () => {
  it('scales by lens / (lens + depth)', () => {
    expect(lensScale(800, 0)).toBe(1);
    expect(lensScale(800, 800)).toBe(.5);
    expect(lensScale(800, -400)).toBe(2);
  });
  it('is the identity on the screen plane', () => {
    const project = createLensProjection({ lens: 800, centerX: 640, centerY: 360 });
    expect(project(100, -50)).toEqual({ x: 740, y: 310, depth: 0 });
  });
  it('shrinks toward the centre behind the plane and grows in front', () => {
    const project = createLensProjection({ lens: 800, centerX: 640, centerY: 360 });
    expect(project(100, 0, 800)).toEqual({ x: 690, y: 360, depth: 800 });
    expect(project(100, 0, -400)).toEqual({ x: 840, y: 360, depth: -400 });
  });
  it('applies pitch about x, then yaw about y, then roll about z', () => {
    const half = Math.PI / 2;
    const pitched = createLensProjection({ lens: 1e9, pitch: half })(0, 10, 0);
    expect(pitched.depth).toBeCloseTo(10); expect(pitched.y).toBeCloseTo(0);
    const yawed = createLensProjection({ lens: 1e9, yaw: half })(10, 0, 0);
    expect(yawed.depth).toBeCloseTo(-10); expect(yawed.x).toBeCloseTo(0);
    const rolled = createLensProjection({ lens: 1e9, roll: half })(10, 0, 0);
    expect(rolled.x).toBeCloseTo(0); expect(rolled.y).toBeCloseTo(10); expect(rolled.depth).toBe(0);
  });
  it('offsets the plane by depth and origin before perspective', () => {
    const project = createLensProjection({ lens: 800, depth: 800, originX: 100, originY: -20, centerX: 640, centerY: 360 });
    expect(project(0, 0)).toEqual({ x: 690, y: 350, depth: 800 });
  });
});
```

- [ ] **Step 4: 실패 확인**

Run: `npx vitest run tests/unit/scenes/cinemaFilmLens.test.ts`
Expected: FAIL, "Failed to resolve import "@/cinema/filmLens"".

- [ ] **Step 5: `src/cinema/filmLens.ts` 작성**

```ts
/**
 * Screen-anchored lens projection shared by the corner planes, the corner finale core and the
 * voice reactor. Rotation order is fixed: pitch (about x), then yaw (about y), then roll (about z);
 * apparent size is `lens / (lens + depth)`. Object-local holograms use `createHoloProjection`
 * (yaw first) and free cameras use `InspectionCamera`; see DESIGN.md "렌더링 구조".
 */
export interface LensPoint { x: number; y: number; depth: number }
export interface LensPose {
  lens: number; yaw?: number; pitch?: number; roll?: number;
  /** Forward offset of the whole plane; positive is farther from the viewer. */
  depth?: number;
  /** Plane origin in lens units, applied after rotation and before perspective. */
  originX?: number; originY?: number;
  /** Screen point the lens looks through. */
  centerX?: number; centerY?: number;
}

/** Apparent scale of a point `depth` units behind the screen plane. */
export const lensScale = (lens: number, depth: number) => lens / (lens + depth);

/** The operation order below is load-bearing: callers pin bit-identical output in cinemaFilmLens.test.ts. */
export function createLensProjection({ lens, yaw = 0, pitch = 0, roll = 0, depth = 0,
  originX = 0, originY = 0, centerX = 0, centerY = 0 }: LensPose) {
  const cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch), sinPitch = Math.sin(pitch);
  const cosRoll = Math.cos(roll), sinRoll = Math.sin(roll);
  return (x: number, y: number, z = 0): LensPoint => {
    const tiltedY = y * cosPitch - z * sinPitch;
    const tiltedZ = y * sinPitch + z * cosPitch;
    const rotatedX = x * cosYaw + tiltedZ * sinYaw;
    const rotatedZ = -x * sinYaw + tiltedZ * cosYaw;
    const rolledX = rotatedX * cosRoll - tiltedY * sinRoll;
    const rolledY = rotatedX * sinRoll + tiltedY * cosRoll;
    const pointDepth = depth + rotatedZ;
    const perspective = lensScale(lens, pointDepth);
    return { x: centerX + (originX + rolledX) * perspective, y: centerY + (originY + rolledY) * perspective, depth: pointDepth };
  };
}
```

- [ ] **Step 6: 커널 테스트 통과 확인**

Run: `npx vitest run tests/unit/scenes/cinemaFilmLens.test.ts`
Expected: 10 passed.

- [ ] **Step 7: `cornerCoreGeometry.ts` 를 커널에 위임**

`const LENS = 680;`은 유지. `createCoreProjection` 본문을 다음으로 교체(import 추가: `import { createLensProjection } from './filmLens';`):

```ts
/** Rings, layer thickness and their connections share the same scene-clock pose. */
export function createCoreProjection(time: number) {
  const pitch = .16 + Math.sin(time * .31) * .025;
  const yaw = .1 + Math.sin(time * .23 + .8) * .02;
  const point: (x: number, y: number, z?: number) => CoreProjectedPoint = createLensProjection({ lens: LENS, yaw, pitch });
  return {
    point,
    ring(angle: number, radius: number, z = 0) {
      return point(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
    },
  };
}
```

- [ ] **Step 8: `cornerProjection.ts` 를 커널에 위임**

import 추가 `import { createLensProjection } from './filmLens';`. `cornerReadingProjection`에서 `const cosYaw ...` 세 줄과 `return { ... point(...) {...} }` 블록을 다음으로 교체:

```ts
  const point = createLensProjection({ lens: LENS, yaw, pitch, roll: hover.roll, depth, originX, originY,
    centerX: VIEW_CENTER.x, centerY: VIEW_CENTER.y });
  return { depth, yaw, pitch, point };
```

- [ ] **Step 9: `voiceReactorGeometry.ts` 를 커널에 위임**

import 추가 `import { createLensProjection } from './filmLens';`. `projectReactor`를 교체:

```ts
export function projectReactor(p: ReactorPoint, pitch = .27) {
  const tilt = Number.isFinite(pitch) ? pitch : .27;
  const view = createLensProjection({ lens: 900, pitch: tilt, centerX: VOICE_CORE_VIEW.x, centerY: VOICE_CORE_VIEW.y })(p.x, p.y, p.z);
  return { x: view.x, y: view.y, z: view.depth };
}
```

- [ ] **Step 10: `cubeReactorFlight.ts`·`filmFocus.ts` 가 `lensScale` 사용**

cubeReactorFlight.ts 상단에 `import { lensScale } from './filmLens';` 추가, `project`를 교체:

```ts
const project = (x:number,y:number,z:number,center:Point,perspective:number) => {
  const scale=lensScale(perspective,-z);
  return {x:center.x+(x-center.x)*scale,y:center.y+(y-center.y)*scale,scale};
};
```

filmFocus.ts에 `import { lensScale } from './filmLens';` 추가, `focusProjection` 반환문의 `scale: FOCUS_LENS / (FOCUS_LENS - z)`를 `scale: lensScale(FOCUS_LENS, -z)`로 교체.

- [ ] **Step 11: 골든·기존 테스트·지문 모두 통과 확인**

Run: `npx vitest run tests/unit/scenes/cinemaFilmLens.test.ts tests/unit/scenes/cinemaCornerCore.test.ts tests/unit/scenes/cinemaCornerProjection.test.ts tests/unit/scenes/cinemaVoiceCore.test.ts tests/unit/scenes/cinemaReactorRear.test.ts tests/unit/scenes/cinemaCubeReactorFlight.test.ts tests/unit/scenes/cinemaFocus.test.ts tests/unit/scenes/cinemaFilmFingerprint.test.ts`
Expected: 모두 passed, "obsolete"·"written" 스냅샷 0. 이어서 `npm run typecheck && npm run lint` 오류 0.

- [ ] **Step 12: 커밋**

`git status --short`에서 내 파일 외 dirty 항목이 `.playwright-cli/`, `main-audit.yml`(기존 미추적)뿐인지 확인 후:

```bash
bash "$scratch/commit_scoped.sh" "$scratch/msg1.txt" src/cinema/filmLens.ts src/cinema/cornerCoreGeometry.ts src/cinema/cornerProjection.ts src/cinema/voiceReactorGeometry.ts src/cinema/cubeReactorFlight.ts src/cinema/filmFocus.ts tests/unit/scenes/cinemaFilmLens.test.ts docs/specs/2026-09-10-render-common-refactor-design.md docs/plans/2026-09-10-render-common-refactor.md
```

msg1.txt 제목: `refactor(cinema): share the lens projection kernel`

---

### Task 2: `filmMotion.ts` 프레임 루프 헬퍼

**Files:**
- Create: `src/cinema/filmMotion.ts`
- Test: `tests/unit/scenes/cinemaFilmMotion.test.ts`

**Interfaces:**
- Produces: `createFrameLoop(tick: (now: number) => void): FrameLoop` (`FrameLoop = { start(): void; stop(): void; readonly running: boolean }`); `watchReducedMotion(listener?: (reduced: boolean) => void): { readonly reduced: boolean; stop(): void }`; `watchPageVisibility(listener: (hidden: boolean) => void): () => void`; `fitCanvasToBox(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, cssWidth: number, cssHeight: number, maxDpr?: number): number`(dpr 반환).

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/scenes/cinemaFilmMotion.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFrameLoop, fitCanvasToBox, watchPageVisibility, watchReducedMotion } from '@/cinema/filmMotion';

type Frame = (now: number) => void;
let queue: Map<number, Frame>;
let nextId: number;
const flush = (now: number) => { const pending = [...queue.values()]; queue.clear(); pending.forEach(callback => callback(now)); };
const listenerTarget = () => {
  const listeners = new Set<() => void>();
  return { listeners, addEventListener: (_: string, fn: () => void) => listeners.add(fn), removeEventListener: (_: string, fn: () => void) => listeners.delete(fn) };
};

beforeEach(() => {
  queue = new Map(); nextId = 1;
  vi.stubGlobal('requestAnimationFrame', (callback: Frame) => { const id = nextId++; queue.set(id, callback); return id; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { queue.delete(id); });
});
afterEach(() => vi.unstubAllGlobals());

describe('createFrameLoop', () => {
  it('requests one frame per tick until stopped, and start is idempotent', () => {
    const ticks: number[] = [];
    const loop = createFrameLoop(now => ticks.push(now));
    loop.start(); loop.start();
    expect(queue.size).toBe(1);
    flush(16); flush(32);
    expect(ticks).toEqual([16, 32]);
    expect(loop.running).toBe(true);
    loop.stop();
    expect(queue.size).toBe(0);
    expect(loop.running).toBe(false);
    flush(48);
    expect(ticks).toEqual([16, 32]);
  });
  it('ends after the frame whose tick stops it, and can restart', () => {
    const loop = createFrameLoop(now => { if (now >= 2) loop.stop(); });
    loop.start(); flush(1);
    expect(queue.size).toBe(1);
    flush(2);
    expect(queue.size).toBe(0);
    expect(loop.running).toBe(false);
    loop.start();
    expect(queue.size).toBe(1);
  });
});

describe('watchReducedMotion', () => {
  it('reports the current preference, forwards changes and unsubscribes', () => {
    const media = { ...listenerTarget(), matches: false };
    vi.stubGlobal('window', { matchMedia: (query: string) => { expect(query).toBe('(prefers-reduced-motion: reduce)'); return media; } });
    const seen: boolean[] = [];
    const motion = watchReducedMotion(reduced => seen.push(reduced));
    expect(motion.reduced).toBe(false);
    media.matches = true; media.listeners.forEach(fn => fn());
    expect(motion.reduced).toBe(true);
    expect(seen).toEqual([true]);
    motion.stop();
    expect(media.listeners.size).toBe(0);
  });
  it('works without a listener', () => {
    const media = { ...listenerTarget(), matches: true };
    vi.stubGlobal('window', { matchMedia: () => media });
    const motion = watchReducedMotion();
    expect(motion.reduced).toBe(true);
    expect(media.listeners.size).toBe(0);
    motion.stop();
  });
});

describe('watchPageVisibility', () => {
  it('forwards document.hidden on each change and unsubscribes', () => {
    const doc = { ...listenerTarget(), hidden: false };
    vi.stubGlobal('document', doc);
    const seen: boolean[] = [];
    const stop = watchPageVisibility(hidden => seen.push(hidden));
    doc.hidden = true; doc.listeners.forEach(fn => fn());
    doc.hidden = false; doc.listeners.forEach(fn => fn());
    expect(seen).toEqual([true, false]);
    stop();
    expect(doc.listeners.size).toBe(0);
  });
});

describe('fitCanvasToBox', () => {
  it('rounds the bitmap at a capped ratio, resizes only on change and maps units to CSS pixels', () => {
    vi.stubGlobal('window', { devicePixelRatio: 3 });
    let writes = 0;
    const canvas = { w: 0, h: 0, get width() { return this.w; }, set width(v: number) { this.w = v; writes++; },
      get height() { return this.h; }, set height(v: number) { this.h = v; writes++; } } as unknown as HTMLCanvasElement;
    const transforms: number[][] = [];
    const ctx = { setTransform: (...args: number[]) => { transforms.push(args); } } as unknown as CanvasRenderingContext2D;
    expect(fitCanvasToBox(canvas, ctx, 100.4, 50.2)).toBe(2);
    expect([canvas.width, canvas.height]).toEqual([201, 100]);
    expect(writes).toBe(2);
    fitCanvasToBox(canvas, ctx, 100.4, 50.2);
    expect(writes).toBe(2);
    expect(transforms).toEqual([[2, 0, 0, 2, 0, 0], [2, 0, 0, 2, 0, 0]]);
    vi.stubGlobal('window', { devicePixelRatio: 0 });
    expect(fitCanvasToBox(canvas, ctx, 10, 10)).toBe(1);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/scenes/cinemaFilmMotion.test.ts`
Expected: FAIL, "Failed to resolve import "@/cinema/filmMotion"".

- [ ] **Step 3: `src/cinema/filmMotion.ts` 작성**

```ts
/**
 * Frame-loop lifecycle helpers for imperative canvas/SVG effects. These are plain functions, not
 * hooks: an effect keeps its own closure state and decides itself whether a hidden tab pauses,
 * cancels or releases a device. See DESIGN.md "렌더링 구조".
 */
export interface FrameLoop { start(): void; stop(): void; readonly running: boolean }

/** Requests one frame per tick until `stop()`; calling `stop()` inside `tick` ends the loop after that frame. */
export function createFrameLoop(tick: (now: number) => void): FrameLoop {
  let frame = 0, active = false;
  const step = (now: number) => {
    frame = 0;
    tick(now);
    if (active && !frame) frame = requestAnimationFrame(step);
  };
  return {
    get running() { return active; },
    start() { if (active) return; active = true; frame = requestAnimationFrame(step); },
    stop() { active = false; if (frame) cancelAnimationFrame(frame); frame = 0; },
  };
}

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Current `prefers-reduced-motion` state plus an optional change subscription. */
export function watchReducedMotion(listener?: (reduced: boolean) => void) {
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  const change = () => listener?.(media.matches);
  if (listener) media.addEventListener('change', change);
  return {
    get reduced() { return media.matches; },
    stop() { if (listener) media.removeEventListener('change', change); },
  };
}

/** Calls `listener(document.hidden)` on every visibility change; returns the unsubscribe. */
export function watchPageVisibility(listener: (hidden: boolean) => void) {
  const change = () => listener(document.hidden);
  document.addEventListener('visibilitychange', change);
  return () => document.removeEventListener('visibilitychange', change);
}

/** Sizes the bitmap to its CSS box at a capped device pixel ratio and maps drawing units to CSS pixels. */
export function fitCanvasToBox(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D,
  cssWidth: number, cssHeight: number, maxDpr = 2) {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const width = Math.round(cssWidth * dpr), height = Math.round(cssHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return dpr;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/scenes/cinemaFilmMotion.test.ts`
Expected: 6 passed.

- [ ] **Step 5: 커밋**

```bash
bash "$scratch/commit_scoped.sh" "$scratch/msg2.txt" src/cinema/filmMotion.ts tests/unit/scenes/cinemaFilmMotion.test.ts
```

msg2.txt 제목: `feat(cinema): add frame loop lifecycle helpers`

---

### Task 3: 연속 루프 컴포넌트 6곳을 `filmMotion` 으로 이관

**Files:**
- Modify: `src/cinema/JarvisHeading.tsx:11-23`
- Modify: `src/cinema/JarvisCamera.tsx:7-34`
- Modify: `src/cinema/ScannerTeslaEffect.tsx:15-74`
- Modify: `src/cinema/ReactorMenuPrank.tsx:17-103`
- Modify: `src/cinema/JarvisWave.tsx:16-73`
- Modify: `src/cinema/useDriftScroll.ts:38-82`

**Interfaces:**
- Consumes: Task 2의 `createFrameLoop`, `watchReducedMotion`, `watchPageVisibility`, `fitCanvasToBox`.
- Produces: 없음(동작 동일, 헤딩·카메라에 숨김 시 정지 추가).

동작 보존 원칙: 각 파일의 "숨김 시 무엇을 하는가"는 그대로 둔다. 헤딩·카메라: 정지/재개(신규). 스캐너·장난: 취소. 파동: 취소+재개. 드리프트: 매 프레임 `document.hidden` 검사 유지.

- [ ] **Step 1: 작업 트리 확인**

Run: `git status --short`
Expected: 위 6개 파일이 dirty가 아님(Codex 미커밋 편집 없음). dirty면 그 파일은 건너뛰고 보고한다.

- [ ] **Step 2: `JarvisHeading.tsx` effect 교체**

```tsx
import { createFrameLoop, watchPageVisibility, watchReducedMotion } from './filmMotion';
// ...
  useEffect(() => {
    const motion = watchReducedMotion();
    const loop = createFrameLoop(now => {
      const angle = motion.reduced ? 90 : 90 + Math.sin(now / 18000) * 42 + Math.sin(now / 7000) * 7;
      tape.current?.setAttribute('transform', `translate(${430 - angle * 4} 0)`);
      dial.current?.setAttribute('transform', `rotate(${-angle} 36 34)`);
      if (reading.current) reading.current.textContent = `${angle.toFixed(1).padStart(5, '0')}°`;
    });
    const unwatch = watchPageVisibility(hidden => hidden ? loop.stop() : loop.start());
    if (!document.hidden) loop.start();
    return () => { loop.stop(); unwatch(); motion.stop(); };
  }, []);
```

- [ ] **Step 3: `JarvisCamera.tsx` effect 교체**

`let frame = 0; const draw = () => { ... frame = requestAnimationFrame(draw); }; frame = requestAnimationFrame(draw); return () => cancelAnimationFrame(frame);` 구조를 다음으로 바꾼다(그리기 본문은 그대로, 마지막 줄 `frame = requestAnimationFrame(draw);` 삭제):

```tsx
import { createFrameLoop, watchPageVisibility } from './filmMotion';
// ...
    const loop = createFrameLoop(() => {
      /* 기존 draw 본문 그대로 */
    });
    const unwatch = watchPageVisibility(hidden => hidden ? loop.stop() : loop.start());
    if (!document.hidden) loop.start();
    return () => { loop.stop(); unwatch(); };
```

- [ ] **Step 4: `ScannerTeslaEffect.tsx` effect 교체**

`import { createFrameLoop, fitCanvasToBox, watchPageVisibility, watchReducedMotion } from './filmMotion';` 추가. effect 안에서:

- `const motion=window.matchMedia(...)` 줄 삭제.
- `let started:number|null=null,frame=0;` → `let started:number|null=null;`
- `clear` 첫 문장 `cancelAnimationFrame(frame);` → `loop.stop();`
- `finish` 정의 바로 뒤에 `const motion=watchReducedMotion(reduced=>{if(reduced)finish(true);});`
- `draw` 안 `const dpr=Math.min(window.devicePixelRatio||1,2); ... ctx.setTransform(dpr,0,0,dpr,0,0);` 다섯 줄을 `fitCanvasToBox(canvas,ctx,box.width,box.height);` 한 줄로 교체하고 이어지는 `ctx.clearRect(0,0,box.width,box.height);`는 유지.
- `draw` 안의 `frame=requestAnimationFrame(draw);return;`(호버 분기)와 마지막 `frame=requestAnimationFrame(draw);` 는 `return;` / 삭제.
- `draw` 정의 뒤: `const loop=createFrameLoop(draw);`
- `const visibility=...; const reduce=...;` 두 줄과 `document.addEventListener('visibilitychange',visibility); motion.addEventListener('change',reduce);` 삭제 → `const unwatch=watchPageVisibility(hidden=>{if(hidden)finish(true);});`
- `frame=requestAnimationFrame(draw);` → `loop.start();`
- cleanup: `return ()=>{clear();unwatch();document.removeEventListener('keydown',escape);motion.stop();};`

`motion.matches` 참조(draw 안 `document.hidden||motion.matches||...`)는 `motion.reduced`로 바꾼다.

- [ ] **Step 5: `ReactorMenuPrank.tsx` effect 교체**

`import { createFrameLoop, fitCanvasToBox, watchPageVisibility, watchReducedMotion } from './filmMotion';` 추가.

- `const motion = matchMedia(...)` 삭제; `let timer = 0, frame = 0, ...` → `let timer = 0, ...`.
- `clear`: `cancelAnimationFrame(frame); frame = 0;` → `loop.stop();`
- `draw`: `const dpr = ...; if (node.width !== ...) {...}` 와 `ctx.setTransform(dpr,0,0,dpr,0,0);` → `const width = innerWidth, height = innerHeight; fitCanvasToBox(node, ctx, width, height);` (이어지는 `ctx.clearRect(0,0,width,height)` 유지). 마지막 `frame = requestAnimationFrame(draw);` 삭제.
- `draw` 뒤: `const loop = createFrameLoop(draw);`
- `start`: `frame = requestAnimationFrame(draw);` → `loop.start();`
- `cancel` 뒤: `const motion = watchReducedMotion(cancel); const unwatch = watchPageVisibility(cancel);`
- 리스너 등록 줄에서 `document.addEventListener('visibilitychange', cancel); motion.addEventListener('change', cancel);` 삭제; cleanup의 대응 두 removeEventListener → `unwatch(); motion.stop();`
- `motion.matches` 3곳(schedule, draw, start) → `motion.reduced`.

- [ ] **Step 6: `JarvisWave.tsx` effect 교체**

`import { createFrameLoop, watchPageVisibility, watchReducedMotion } from './filmMotion';` 추가.

- `start`의 `window.matchMedia('(prefers-reduced-motion: reduce)').matches` → `watchReducedMotion().reduced`.
- `let frame = 0, previous = 0, ...` → `let previous = 0, ...`.
- `const motion = window.matchMedia(...)` → `const motion = watchReducedMotion();`; `motion.matches` 4곳 → `motion.reduced`.
- `draw` 마지막 `frame = requestAnimationFrame(draw);` 삭제; `draw` 뒤 `const loop = createFrameLoop(draw);`
- `visibility` 함수와 등록/호출 두 줄을 다음으로 교체:

```tsx
    const visibility = (hidden: boolean) => {
      loop.stop(); previous = 0;
      if (hidden) { playback.cancel(); setPlaying(false); }
      else loop.start();
    };
    const unwatch = watchPageVisibility(visibility); visibility(document.hidden);
    return () => { playback.cancel(); loop.stop(); observer.disconnect(); unwatch(); motion.stop(); };
```

- [ ] **Step 7: `useDriftScroll.ts` effect 교체**

`import { createFrameLoop, watchReducedMotion } from './filmMotion';` 추가.

- `const reduced = window.matchMedia(...)` → `const reduced = watchReducedMotion();`; `reduced.matches` → `reduced.reduced`.
- `frame = 0,` 제거; `tick` 마지막 `frame = requestAnimationFrame(tick);` 삭제; `tick` 뒤 `const loop = createFrameLoop(tick);`
- `frame = requestAnimationFrame(tick);` → `loop.start();`; cleanup 첫 줄 `cancelAnimationFrame(frame);` → `loop.stop(); reduced.stop();`

- [ ] **Step 8: 남은 직접 호출 확인**

Run: `grep -n "requestAnimationFrame\|matchMedia\|visibilitychange" src/cinema/JarvisHeading.tsx src/cinema/JarvisCamera.tsx src/cinema/ScannerTeslaEffect.tsx src/cinema/ReactorMenuPrank.tsx src/cinema/JarvisWave.tsx src/cinema/useDriftScroll.ts`
Expected: 출력 없음.

- [ ] **Step 9: 타입·린트·전체 테스트**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: 오류 0, 모든 테스트 passed, 스냅샷 변경 0.

- [ ] **Step 10: 브라우저 확인**

dev 서버 포트 확인: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/cinema` 또는 3010. 실행 중인 포트의 `/cinema`를 Chrome으로 열어 (1) 중앙 리액터가 회전하고 (2) 상단 헤딩 눈금이 움직이며 (3) 신호 감지기 호버 시 전기가 나오고 이탈 시 꺼지고 (4) 콘솔 오류가 없는지 확인한다. 서버가 없으면 `npm run dev`를 별도 포트로 띄우지 말고 "브라우저 미확인"으로 보고한다.

- [ ] **Step 11: 커밋**

```bash
bash "$scratch/commit_scoped.sh" "$scratch/msg3.txt" src/cinema/JarvisHeading.tsx src/cinema/JarvisCamera.tsx src/cinema/ScannerTeslaEffect.tsx src/cinema/ReactorMenuPrank.tsx src/cinema/JarvisWave.tsx src/cinema/useDriftScroll.ts
```

msg3.txt 제목: `refactor(cinema): run continuous canvas loops through filmMotion`

---

### Task 4: DESIGN.md 재편

**Files:**
- Modify: `DESIGN.md` (전체)

**Interfaces:** 없음(문서).

- [ ] **Step 1: 공유 파일 상태 확인**

Run: `git status --short DESIGN.md`
Expected: 출력 없음(깨끗함). dirty면 이 Task를 건너뛰고 보고한다.

- [ ] **Step 2: 원본 보존 및 본문 목록 추출**

```bash
git show HEAD:DESIGN.md > "$scratch/DESIGN.before.md"
grep -n "" DESIGN.md | grep -v ":\s*$" | cut -c1-90
```

각 항목(`- `로 시작하는 문단)을 아래 헤더 중 하나에 배정한다. 판단 기준은 항목이 언급하는 영향 파일이다.

| 헤더 | 배정 기준(영향 파일) |
| --- | --- |
| `## 렌더링 구조` | 신규 작성(아래 Step 3) |
| `## 공통 원칙` | 저작권·참고 자료 재구성 원칙, 렌더 루프 성능 규칙, 재생·정지·탐색 공통 규칙, 접근성(동작 줄이기) |
| `## 테마 · 질감 · 전체 화면` | filmThemes / filmTexture / filmAmbientTexture / filmViewport / SignalFilm 전체 화면 |
| `## 메인 화면` | jarvis*.module.css, JarvisMain, JarvisCenter*, JarvisWave, JarvisStream, JarvisMetricCards, JarvisSignalScanner, ScannerTeslaEffect, ReactorMenuPrank, 브리핑 |
| `## 메뉴` | filmMenuCube / filmMenuGlobe / filmMenuRing / FilmTurbineMenu / FilmDock / FilmChapterMenu / filmMenuPreference |
| `## 장면별 규칙` | draw*Film, 각 장면 상태 모듈(cctvScene, spcScene, raceCar, pcbInspection*, zoneEnvironment, energy*, smtFactory 등) |
| `## 참고 자료` | 외부 링크 항목 |

기존 `## Cinema prototype (/cinema)` 이하는 `## 장면별 규칙`의 하위 `### Cinema prototype (/cinema)`로 강등해 그대로 둔다.

- [ ] **Step 3: 새 `## 렌더링 구조` 절 작성(파일 맨 위 제목 바로 아래)**

```markdown
## 렌더링 구조

- 렌더러는 세 층이며 WebGL/Three.js는 쓰지 않는다(2026-09-08 구체 설계, 2026-09-10 재확인). (1) Canvas 2D + 자체 원근 투영: 모든 장면·리액터·비행 연출. (2) CSS 3D 변환: 메뉴 큐브·구체·HUD 프레임·자이로처럼 접근성 트리와 포커스가 필요한 입체 위젯. (3) SVG/React DOM: 아이콘·게이지·텍스트. 카메라가 거의 고정된 얕은 원근이므로 Canvas 2D가 충분하며, 자유 카메라·조명·재질이 필요해지기 전에는 엔진을 추가하지 않는다.
- 원근 투영은 네 계열만 쓴다. 새 장면은 이 중 하나를 고르고 새 공식을 만들지 않는다. (a) `holoSpace.ts createHoloProjection`: 객체 중심 홀로그램, yaw → pitch 회전, 근접 클램프 12%. 에너지·SPC·투명 설비·PCB·공정망·레이더·ZONE·CCTV. (b) `filmLens.ts createLensProjection`: 화면 고정 평면, pitch → yaw → roll 회전, `lens/(lens+depth)`. 코너 정보판·코너 코어·음성 리액터. `lensScale`은 큐브 비행·포커스 확대도 같이 쓴다. (c) `inspectionSpace.ts InspectionCamera`: 월드 좌표 자유 카메라 + near 클리핑. SMT 공장·검사실·온습도 히트맵 비행. (d) `filmFocus.ts focusProjection`: 2D 접근 확대. 차트·콘솔·스캔 판독. `glassPieGeometry`(tilt 단일 카메라)와 `raceCar.raceProject`(고정 사선 아핀)는 장면 전용 예외다. 회전 순서가 다르므로 계열을 바꾸면 픽셀이 바뀐다. 검증: cinemaFilmLens.test.ts(리팩터 전 골든 값), cinemaFilmFingerprint.test.ts.
- 연속 프레임 루프는 `filmMotion.ts`를 쓴다: `createFrameLoop`(start/stop, tick 안에서 stop 가능), `watchReducedMotion`(현재값 + change 구독), `watchPageVisibility`, `fitCanvasToBox`(DPR 상한 2, 크기 변경 시만 재설정). 숨김 탭에서 무엇을 할지는 컴포넌트가 정한다: 헤딩·카메라·파동은 정지 후 복귀 시 재개, 스캐너·리액터 장난은 취소, 드리프트 스크롤은 프레임마다 검사. 큐브·구체 메뉴(수요 기반 스케줄러), useFilmPlayback(시킹·배속 장면 시계), 음성 훅(장치 수명)은 이 헬퍼 대상이 아니다. 영향: JarvisHeading / JarvisCamera / ScannerTeslaEffect / ReactorMenuPrank / JarvisWave / useDriftScroll → filmMotion.ts. 검증: cinemaFilmMotion.test.ts.
```

- [ ] **Step 4: 파일 재작성**

Step 2의 배정표대로 헤더를 추가하고 항목 문단을 이동한다. 문단 본문은 한 글자도 바꾸지 않는다. 각 헤더 안에서는 기존 상대 순서(최신이 위)를 유지한다.

- [ ] **Step 5: 이동만 했는지 기계적으로 검증**

```bash
diff <(grep -v '^#' "$scratch/DESIGN.before.md" | grep -v '^\s*$' | sort) <(grep -v '^#' DESIGN.md | grep -v '^\s*$' | sort)
```

Expected: `>` 줄 3개(Step 3의 새 항목 3개)만 출력. `<` 줄이 있으면 문장이 바뀌거나 빠진 것이므로 복구한다. 이어서 `grep -c '^## ' DESIGN.md` → 8.

- [ ] **Step 6: DESIGN.md 린트(가능하면)**

Run: `npx -y @google/design.md lint DESIGN.md`
Expected: blocking error 0. 도구가 없거나 네트워크로 실패하면 결과를 그대로 보고한다.

- [ ] **Step 7: 커밋**

`git status --short DESIGN.md`가 ` M DESIGN.md`뿐인지 확인 후:

```bash
bash "$scratch/commit_scoped.sh" "$scratch/msg4.txt" DESIGN.md
```

msg4.txt 제목: `docs(cinema): group DESIGN.md by area and document the render structure`

---

## Self-Review

- 스펙 §1 → Task 1(커널·5개 호출부·골든·지문). §2 → Task 2(헬퍼·테스트), Task 3(6곳 이관, 제외 목록 준수). §3 → Task 4. 누락 없음.
- 형 이름 일치: `LensPose`/`LensPoint`/`createLensProjection`/`lensScale`(Task 1 ↔ DESIGN 문구), `FrameLoop`/`createFrameLoop`/`watchReducedMotion().reduced`/`watchPageVisibility`/`fitCanvasToBox`(Task 2 ↔ Task 3 ↔ DESIGN 문구).
- 자리표시자 없음. 각 코드 단계에 실제 코드 포함.
