# 장면 객체 식별자 · 막대 장면 데이터 주입 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 장면 객체의 공통 식별자 규칙을 정의하고, 막대 장면이 외부에서 주입한 생산 스냅샷(라인 1~20개)을 id 기반으로 그리게 한다.

**Architecture:** `sceneObject.ts`(정규화·조회) → `productionSnapshot.ts`(막대 장면 데이터 모델과 파생 상태) → `drawBarFilm.ts`가 스냅샷을 인자로 받아 `productionSnapshotState()` 결과만 읽는다. `barTelemetryGeometry.ts`는 슬롯 폭 기반 밀도 값을 내고 `drawBarChart.ts`가 그에 맞춰 글자 크기와 보조 표기를 조절한다. `filmSceneData.ts`가 주입 통로(`drawSignalFilm` 마지막 인자, `useFilmPlayback` 상태)를 연다. `chartData.ts`는 기본 스냅샷에서 파생한 값을 계속 export 해 파이 장면은 변경하지 않는다.

**Tech Stack:** TypeScript, Next.js 16(App Router), Canvas 2D, Vitest.

**Spec:** `docs/specs/2026-09-08-scene-object-identity-design.md`

## Global Constraints

- 식별자는 도메인 코드 그대로(예: `LINE-01`), 목록 안에서 유일, 대소문자 구분. UUID·계층형 문자열 id 금지.
- 지원 라인 수 1~20개. 0개와 20개 초과도 예외 없이 그린다(20개 초과는 겹침 미보장).
- 값·목표가 유한하지 않거나 음수면 0으로 취급. 목표 0이면 달성률·선택 계산 안 함.
- 연출 시간(28초)과 포커스 타이밍(9~24.5초, 읽기 11~13초)은 바꾸지 않는다.
- 파이 장면(`drawPieFilm.ts`)은 수정하지 않는다.
- 검증 명령(AGENTS.md): `npm run typecheck`, `npm run test:unit`, `npm run build`.
- **동시 작업 주의:** Codex가 `drawSignalFilm.ts`, `useFilmPlayback.ts`, `SignalFilm.tsx`, `DESIGN.md`, `tests/unit/scenes/cinemaFrameState.test.ts`를 미커밋 상태로 수정 중이다. Task 1~4는 이 파일들을 건드리지 않는다. Task 5는 Codex가 커밋한 뒤 진행한다.
- 커밋은 이 계획에서 만든 파일만 `git add <경로>`로 스테이징한다. `git add -A` 금지.

---

### Task 1: 공통 객체 계층 `sceneObject.ts`

**Files:**
- Create: `src/cinema/sceneObject.ts`
- Test: `tests/unit/scenes/cinemaSceneObject.test.ts`

**Interfaces:**
- Produces:
  - `interface SceneObject { id: string; label: string }`
  - `interface MetricObject extends SceneObject { value: number; unit?: string }`
  - `normalizeSceneObjects<T extends SceneObject>(items: readonly T[]): T[]`
  - `findSceneObject<T extends SceneObject>(items: readonly T[], id: string | null | undefined): T | undefined`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/unit/scenes/cinemaSceneObject.test.ts
import { describe, expect, it } from 'vitest';
import { findSceneObject, normalizeSceneObjects, type SceneObject } from '@/cinema/sceneObject';

describe('scene object identity', () => {
  it('drops empty or blank ids and keeps the first of duplicate ids', () => {
    const items: SceneObject[] = [
      { id: 'LINE-01', label: 'A' }, { id: '', label: 'empty' }, { id: '   ', label: 'blank' },
      { id: 'LINE-02', label: 'B' }, { id: 'LINE-01', label: 'A duplicate' },
    ];
    expect(normalizeSceneObjects(items).map(item => [item.id, item.label]))
      .toEqual([['LINE-01', 'A'], ['LINE-02', 'B']]);
  });

  it('trims ids, treats ids as case sensitive and falls back to the id when the label is blank', () => {
    const items = normalizeSceneObjects([{ id: ' LINE-01 ', label: '' }, { id: 'line-01', label: '  ' }]);
    expect(items.map(item => item.id)).toEqual(['LINE-01', 'line-01']);
    expect(items.map(item => item.label)).toEqual(['LINE-01', 'line-01']);
  });

  it('keeps extra fields and returns the same object when nothing needed cleaning', () => {
    const line = { id: 'LINE-01', label: 'LINE 01', value: 860 };
    const [kept] = normalizeSceneObjects([line]);
    expect(kept).toBe(line);
    expect(kept.value).toBe(860);
  });

  it('finds objects by trimmed id and returns undefined for missing, empty or null ids', () => {
    const items = normalizeSceneObjects([{ id: 'LINE-01', label: 'A' }, { id: 'LINE-02', label: 'B' }]);
    expect(findSceneObject(items, 'LINE-02')?.label).toBe('B');
    expect(findSceneObject(items, ' LINE-02 ')?.label).toBe('B');
    expect(findSceneObject(items, 'LINE-09')).toBeUndefined();
    expect(findSceneObject(items, '')).toBeUndefined();
    expect(findSceneObject(items, null)).toBeUndefined();
    expect(findSceneObject(items, undefined)).toBeUndefined();
  });

  it('tolerates a missing list', () => {
    expect(normalizeSceneObjects(undefined as unknown as SceneObject[])).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/scenes/cinemaSceneObject.test.ts`
Expected: FAIL — `Cannot find module '@/cinema/sceneObject'`

- [ ] **Step 3: 구현**

```ts
// src/cinema/sceneObject.ts
/** Every scene object carries a domain code as its id; the label is only for display. */
export interface SceneObject { id: string; label: string }
export interface MetricObject extends SceneObject { value: number; unit?: string }

const cleanId = (id: unknown) => typeof id === 'string' ? id.trim() : '';

/** Drops blank ids and later duplicates; a blank label falls back to the id. Untouched objects are returned as-is. */
export function normalizeSceneObjects<T extends SceneObject>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items ?? []) {
    const id = cleanId(item?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const label = typeof item.label === 'string' && item.label.trim() ? item.label : id;
    result.push(id === item.id && label === item.label ? item : { ...item, id, label });
  }
  return result;
}

export function findSceneObject<T extends SceneObject>(items: readonly T[], id: string | null | undefined): T | undefined {
  const wanted = cleanId(id);
  return wanted ? items.find(item => item.id === wanted) : undefined;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/scenes/cinemaSceneObject.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/cinema/sceneObject.ts tests/unit/scenes/cinemaSceneObject.test.ts
git commit -m "feat(cinema): add scene object identity contract"
```

---

### Task 2: 막대 장면 데이터 모델 `productionSnapshot.ts`와 `chartData.ts` 파생

**Files:**
- Create: `src/cinema/productionSnapshot.ts`
- Modify: `src/cinema/chartData.ts` (전체 교체)
- Test: `tests/unit/scenes/cinemaProductionSnapshot.test.ts`

**Interfaces:**
- Consumes: Task 1의 `SceneObject`, `normalizeSceneObjects`, `findSceneObject`
- Produces:
  - `interface ProductionLine extends SceneObject { value: number; color?: string; accent?: boolean }`
  - `interface ProductionSnapshot { unit: string; target: number; lines: readonly ProductionLine[]; selectedId?: string | null }`
  - `interface ProductionSnapshotState { lines: ProductionLine[]; unit: string; target: number; total: number; aggregateTarget: number; aggregateRatio: number; reached: number; maximum: number; selectedIndex: number | undefined; selected: ProductionLine | undefined }`
  - `DEFAULT_PRODUCTION_SNAPSHOT: ProductionSnapshot`
  - `productionSnapshotState(snapshot: ProductionSnapshot): ProductionSnapshotState`
  - `selectProductionLine(lines: readonly ProductionLine[], target: number, selectedId?: string | null): number | undefined`
  - `productionScale(lines: readonly ProductionLine[], target: number): number`
  - `chartData.ts`는 기존 export 이름을 유지: `PRODUCTION_LINES`(color 필수), `PRODUCTION_TOTAL`, `PRODUCTION_TARGET`, `SELECTED_LINE_INDEX`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/unit/scenes/cinemaProductionSnapshot.test.ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_PRODUCTION_SNAPSHOT, productionScale, productionSnapshotState, selectProductionLine,
  type ProductionLine } from '@/cinema/productionSnapshot';
import { PRODUCTION_LINES, PRODUCTION_TARGET, PRODUCTION_TOTAL, SELECTED_LINE_INDEX } from '@/cinema/chartData';

const line = (id: string, value: number): ProductionLine => ({ id, label: id.replace('-', ' '), value });

describe('production snapshot selection rule', () => {
  const lines = [line('LINE-01', 900), line('LINE-02', 720), line('LINE-03', 940), line('LINE-04', 610)];

  it('uses selectedId when it names a line', () => {
    expect(selectProductionLine(lines, 800, 'LINE-02')).toBe(1);
  });

  it('falls back to the lowest attainment below target when selectedId is missing or unknown', () => {
    expect(selectProductionLine(lines, 800, undefined)).toBe(3);
    expect(selectProductionLine(lines, 800, null)).toBe(3);
    expect(selectProductionLine(lines, 800, 'LINE-99')).toBe(3);
  });

  it('selects nothing when every line reached the target or the target is unusable', () => {
    expect(selectProductionLine(lines, 600, undefined)).toBeUndefined();
    expect(selectProductionLine(lines, 0, undefined)).toBeUndefined();
    expect(selectProductionLine(lines, NaN, undefined)).toBeUndefined();
    expect(selectProductionLine(lines, 0, 'LINE-01')).toBe(0);
  });

  it('breaks ties toward the earlier line', () => {
    expect(selectProductionLine([line('A', 500), line('B', 500)], 800, undefined)).toBe(0);
  });
});

describe('production scale', () => {
  it('always contains the peak value and the target with headroom, rounded to a readable step', () => {
    for (const [values, target] of [[[860, 720, 940, 610, 790], 800], [[10, 300, 900], 1200], [[0, 300, 1600], 1000], [[5], 0]] as const) {
      const scale = productionScale(values.map((value, index) => line(String(index), value)), target);
      expect(scale).toBeGreaterThanOrEqual(Math.max(...values, target) * 1.15);
      const magnitude = 10 ** Math.floor(Math.log10(scale));
      expect([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]).toContain(Number((scale / magnitude).toFixed(2)));
    }
    expect(productionScale([], 0)).toBe(1.2);
    expect(productionScale([line('A', NaN), line('B', -5)], Infinity)).toBe(1.2);
  });
});

describe('production snapshot state', () => {
  it('normalizes lines, sanitizes values and derives totals', () => {
    const state = productionSnapshotState({ unit: ' EA ', target: 800,
      lines: [line('LINE-01', 900), { id: '', label: 'x', value: 5 }, line('LINE-01', 1), line('LINE-02', NaN), line('LINE-03', -3)] });
    expect(state.lines.map(item => item.id)).toEqual(['LINE-01', 'LINE-02', 'LINE-03']);
    expect(state.lines.map(item => item.value)).toEqual([900, 0, 0]);
    expect(state.unit).toBe('EA');
    expect(state.total).toBe(900);
    expect(state.aggregateTarget).toBe(2400);
    expect(state.aggregateRatio).toBeCloseTo(900 / 2400);
    expect(state.reached).toBe(1);
    expect(state.selectedIndex).toBe(1);
    expect(state.selected?.id).toBe('LINE-02');
    expect(state.maximum).toBeGreaterThanOrEqual(900 * 1.15);
  });

  it('handles an empty snapshot and a zero target without selection or ratios', () => {
    const empty = productionSnapshotState({ unit: 'EA', target: 800, lines: [] });
    expect(empty.lines).toEqual([]);
    expect(empty.total).toBe(0);
    expect(empty.aggregateRatio).toBe(0);
    expect(empty.selectedIndex).toBeUndefined();
    const noTarget = productionSnapshotState({ unit: 'EA', target: 0, lines: [line('A', 10)] });
    expect(noTarget.reached).toBe(0);
    expect(noTarget.aggregateRatio).toBe(0);
    expect(noTarget.selectedIndex).toBeUndefined();
  });

  it('keeps the legacy chart constants in step with the default snapshot so the pie scene is unchanged', () => {
    const state = productionSnapshotState(DEFAULT_PRODUCTION_SNAPSHOT);
    expect(PRODUCTION_LINES.map(item => [item.label, item.value]))
      .toEqual([['LINE 01', 860], ['LINE 02', 720], ['LINE 03', 940], ['LINE 04', 610], ['LINE 05', 790]]);
    expect(PRODUCTION_LINES.every(item => typeof item.color === 'string')).toBe(true);
    expect(PRODUCTION_LINES[3].accent).toBe(true);
    expect(PRODUCTION_TOTAL).toBe(state.total);
    expect(PRODUCTION_TARGET).toBe(800);
    expect(SELECTED_LINE_INDEX).toBe(3);
    expect(state.selected?.id).toBe('LINE-04');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/scenes/cinemaProductionSnapshot.test.ts`
Expected: FAIL — `Cannot find module '@/cinema/productionSnapshot'`

- [ ] **Step 3: 구현**

```ts
// src/cinema/productionSnapshot.ts
import { findSceneObject, normalizeSceneObjects, type SceneObject } from './sceneObject';

export interface ProductionLine extends SceneObject { value: number; color?: string; accent?: boolean }
export interface ProductionSnapshot {
  unit: string;
  /** Per-line target. */
  target: number;
  lines: readonly ProductionLine[];
  /** Line to bring forward; falls back to the lowest attainment below target. */
  selectedId?: string | null;
}
export interface ProductionSnapshotState {
  lines: ProductionLine[];
  unit: string;
  target: number;
  total: number;
  aggregateTarget: number;
  aggregateRatio: number;
  reached: number;
  /** Chart scale that contains every value and the target with headroom. */
  maximum: number;
  selectedIndex: number | undefined;
  selected: ProductionLine | undefined;
}

/** The demo snapshot the bar and pie scenes both start from. */
export const DEFAULT_PRODUCTION_SNAPSHOT: ProductionSnapshot = {
  unit: 'EA', target: 800,
  lines: [
    { id: 'LINE-01', label: 'LINE 01', value: 860, color: '#5fe3ff' },
    { id: 'LINE-02', label: 'LINE 02', value: 720, color: '#79b7a9' },
    { id: 'LINE-03', label: 'LINE 03', value: 940, color: '#c4e7f0' },
    { id: 'LINE-04', label: 'LINE 04', value: 610, color: '#ffc168', accent: true },
    { id: 'LINE-05', label: 'LINE 05', value: 790, color: '#398698' },
  ],
};

const positive = (value: number | undefined) => Number.isFinite(value) && value! > 0 ? value! : 0;
const SCALE_STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10] as const;
const SCALE_HEADROOM = 1.15;

/** selectedId wins; otherwise the lowest attainment below target; nothing when all lines reached it. */
export function selectProductionLine(lines: readonly ProductionLine[], target: number, selectedId?: string | null): number | undefined {
  const chosen = findSceneObject(lines, selectedId);
  if (chosen) return lines.indexOf(chosen);
  const goal = positive(target);
  if (!goal) return undefined;
  let index: number | undefined, lowest = Infinity;
  lines.forEach((line, position) => {
    const ratio = positive(line.value) / goal;
    if (ratio < 1 && ratio < lowest) { lowest = ratio; index = position; }
  });
  return index;
}

/** Readable ceiling: peak × headroom rounded up to a 1 / 1.2 / 1.5 / 2 / 2.5 / 3 / 4 / 5 / 6 / 8 / 10 step. */
export function productionScale(lines: readonly ProductionLine[], target: number) {
  const peak = lines.reduce((max, line) => Math.max(max, positive(line.value)), Math.max(1, positive(target)));
  const padded = peak * SCALE_HEADROOM;
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const step = SCALE_STEPS.find(candidate => candidate * magnitude >= padded - 1e-9) ?? 10;
  return step * magnitude;
}

export function productionSnapshotState(snapshot: ProductionSnapshot): ProductionSnapshotState {
  const lines = normalizeSceneObjects(snapshot?.lines ?? []).map(line => ({ ...line, value: positive(line.value) }));
  const target = positive(snapshot?.target);
  const unit = typeof snapshot?.unit === 'string' && snapshot.unit.trim() ? snapshot.unit.trim() : 'EA';
  const total = lines.reduce((sum, line) => sum + line.value, 0);
  const aggregateTarget = target * lines.length;
  const aggregateRatio = aggregateTarget > 0 ? total / aggregateTarget : 0;
  const reached = target > 0 ? lines.filter(line => line.value >= target).length : 0;
  const selectedIndex = selectProductionLine(lines, target, snapshot?.selectedId);
  return { lines, unit, target, total, aggregateTarget, aggregateRatio, reached,
    maximum: productionScale(lines, target), selectedIndex,
    selected: selectedIndex === undefined ? undefined : lines[selectedIndex] };
}
```

```ts
// src/cinema/chartData.ts  (전체 교체)
import { DEFAULT_PRODUCTION_SNAPSHOT, productionSnapshotState } from './productionSnapshot';

/** Legacy view of the default snapshot; the pie scene still reads these. The bar scene takes a snapshot directly. */
const state = productionSnapshotState(DEFAULT_PRODUCTION_SNAPSHOT);
export const PRODUCTION_LINES = state.lines.map(line => ({ ...line, color: line.color ?? '#5fe3ff' }));
export const PRODUCTION_TOTAL = state.total;
export const PRODUCTION_TARGET = state.target;
export const SELECTED_LINE_INDEX = state.selectedIndex ?? 0;
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/scenes/cinemaProductionSnapshot.test.ts tests/unit/scenes/cinemaGlassPieGeometry.test.ts && npm run typecheck`
Expected: PASS. typecheck 오류 없음(파이 장면이 `item.color`를 string으로 계속 사용).

- [ ] **Step 5: 커밋**

```bash
git add src/cinema/productionSnapshot.ts src/cinema/chartData.ts tests/unit/scenes/cinemaProductionSnapshot.test.ts
git commit -m "feat(cinema): model the production snapshot with line ids and a selection rule"
```

---

### Task 3: 막대 밀도 — `barTelemetryGeometry.ts`와 `drawBarChart.ts`

**Files:**
- Modify: `src/cinema/barTelemetryGeometry.ts:28-54` (`barTelemetryLayout`)
- Modify: `src/cinema/components/drawBarChart.ts:28-55` (컬럼 루프)
- Test: `tests/unit/scenes/cinemaBarTelemetry.test.ts` (테스트 추가)

**Interfaces:**
- Produces: `barTelemetryLayout()` 반환 객체에 `channelScale: number`(0.45~1), `compact: boolean` 추가. 기존 필드는 그대로.

- [ ] **Step 1: 실패하는 테스트 추가** — `cinemaBarTelemetry.test.ts` 파일 끝에 추가

```ts
describe('bar density for variable line counts', () => {
  const lines = (count: number) => Array.from({ length: count }, (_, index) => ({ label: `LINE ${index + 1}`, value: 500 + index * 20 }));

  it('keeps five channels at full scale and shrinks headers as channels narrow, never below .45', () => {
    const five = barTelemetryLayout({ ...options, data: lines(5) })!;
    expect(five.channelScale).toBe(1);
    expect(five.compact).toBe(false);
    const one = barTelemetryLayout({ ...options, data: lines(1) })!;
    expect(one.channelScale).toBe(1);
    expect(one.slot).toBe(options.width);
    const twelve = barTelemetryLayout({ ...options, data: lines(12) })!;
    expect(twelve.channelScale).toBeLessThan(1);
    expect(twelve.channelScale).toBeGreaterThanOrEqual(.45);
    expect(twelve.compact).toBe(true);
    const twenty = barTelemetryLayout({ ...options, data: lines(20) })!;
    expect(twenty.channelScale).toBe(.45);
    expect(twenty.compact).toBe(true);
  });

  it('keeps every column inside the chart area for 1, 2, 12 and 20 lines', () => {
    for (const count of [1, 2, 12, 20]) {
      const layout = barTelemetryLayout({ ...options, data: lines(count), time: 20 })!;
      expect(layout.columns).toHaveLength(count);
      for (const column of layout.columns) {
        expect(column.left).toBeGreaterThanOrEqual(layout.x);
        expect(column.left + layout.barWidth).toBeLessThanOrEqual(layout.x + layout.width);
        expect(column.top).toBeGreaterThanOrEqual(layout.y);
      }
      const lefts = layout.columns.map(column => column.left);
      expect([...lefts].sort((a, b) => a - b)).toEqual(lefts);
    }
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/scenes/cinemaBarTelemetry.test.ts`
Expected: FAIL — `expect(received).toBe(expected)` on `channelScale` (undefined)

- [ ] **Step 3: 구현** — `barTelemetryLayout` 반환 직전에 밀도 계산 추가

```ts
// src/cinema/barTelemetryGeometry.ts — 상수 추가 (positive 아래)
/** Slot width of the original five-channel layout; narrower slots scale their headers down. */
const REFERENCE_SLOT = 138;
const COMPACT_SLOT = 70;

// barTelemetryLayout 안, `const stagger = ...` 다음 줄에 추가
  const channelScale = Math.max(.45, Math.min(1, slot / REFERENCE_SLOT));
  const compact = slot < COMPACT_SLOT;

// return 문 교체
  return { x, y, width, height, baseline, slot, barWidth, target, maximum, selected, focus, depth, channelScale, compact, columns };
```

`drawBarChart.ts` 컬럼 루프를 아래로 교체(`for (const column of columns) {` 부터 루프 끝 `}` 까지):

```ts
  const { channelScale: scale, compact } = layout;
  for (const column of columns) {
    const { index, heat, center, datum, value, growth, top, start } = column;
    const channelLeft = x + slot * index + 2, channelRight = x + slot * (index + 1) - 8;
    const dim = selected === undefined || selected === index ? 1 : 1 - focus * .52;
    ctx.save(); ctx.globalAlpha *= dim * smooth(start - .6, start, time);
    // Small open headers identify each acquisition channel without enclosing the graph.
    ctx.beginPath(); ctx.moveTo(channelLeft, y - 31); ctx.lineTo(channelLeft, y - 58);
    ctx.lineTo(channelRight - 5, y - 58); ctx.lineTo(channelRight, y - 53); ctx.lineTo(channelRight, y - 31);
    ctx.strokeStyle = signalColor(heat, .28); ctx.lineWidth = .7; ctx.stroke();
    if (compact) {
      // Narrow channels keep only the channel number; the readouts below carry the value.
      text(`T${index + 1}`, center, y - 39, 18 * scale, heat, .96, 'center', slot - 8);
    }
    else {
      ctx.fillStyle = signalColor(heat, .08); ctx.fillRect(channelRight - 29, y - 55, 26, 21);
      text(`T${index + 1}`, channelRight - 16, y - 39, 18 * scale, heat, .96, 'center');
      text(`CH / ${String(index + 1).padStart(2, '0')}`, channelLeft + 6, y - 43, 9 * scale, heat, .7);
      text('OUTPUT', channelLeft + 6, y - 31, 7 * scale, heat, .4);
      for (let mark = 0; mark < 7; mark++) {
        ctx.fillStyle = signalColor(heat, mark < Math.round(value / layout.maximum * 7) ? .4 : .08);
        ctx.fillRect(channelLeft + 6 + mark * 7, y - 24, 4, 1.5);
      }
      text(`${Math.round(value / layout.maximum * growth * 100)}% FS`, channelRight, y - 18, 7 * scale, heat, .5, 'right');
    }
    ctx.save(); ctx.globalAlpha *= index === selected ? 1 - focus * .8 : 1;
    drawTelemetryBar(ctx, fonts, layout, column, time);
    ctx.globalAlpha *= index === selected ? 1 - focus : 1;
    text(Math.round(value * growth).toLocaleString('en-US'), center, top - layout.depth - 10, 18 * scale, heat, .95, 'center', slot - 10);
    ctx.restore();
    const characters = Math.max(0, Math.floor((time - start + .25) * 24));
    text(Array.from(datum.label).slice(0, characters).join(''), center, baseline + 33, 15 * scale, heat, .9, 'center', slot - 12);
    if (!compact) {
      const attainment = target !== undefined && target > 0 ? `${(value / target * 100).toFixed(1)}% / REF` : unit;
      text(attainment, center, baseline + 53, 9 * scale, heat, .56, 'center', slot - 12);
    }
    ctx.restore();
  }
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/scenes/cinemaBarTelemetry.test.ts && npm run typecheck`
Expected: PASS (기존 테스트 포함), typecheck 오류 없음

- [ ] **Step 5: 커밋**

```bash
git add src/cinema/barTelemetryGeometry.ts src/cinema/components/drawBarChart.ts tests/unit/scenes/cinemaBarTelemetry.test.ts
git commit -m "feat(cinema): scale bar channel headers by density for 1-20 lines"
```

---

### Task 4: `drawBarFilm`이 스냅샷을 받는다

**Files:**
- Modify: `src/cinema/drawBarFilm.ts` (전체 교체)
- Create: `tests/unit/support/canvasFixture.ts`
- Test: `tests/unit/scenes/cinemaBarFilm.test.ts`

**Interfaces:**
- Consumes: Task 2의 `ProductionSnapshot`, `DEFAULT_PRODUCTION_SNAPSHOT`, `productionSnapshotState`
- Produces: `drawBarFilm(ctx, width, height, t, fonts = DEFAULT_FONTS, presentation = DEFAULT_CHART_PRESENTATION, insets?, snapshot: ProductionSnapshot = DEFAULT_PRODUCTION_SNAPSHOT)` — 8번째 인자가 스냅샷. Task 5의 `drawSignalFilm`이 이 자리에 `data.production`을 넘긴다.
- 테스트 도우미: `canvasFixture()` → `{ ctx, texts: { value, x, y, opacity }[], fills, stack }`. `cinemaFrameState.test.ts`의 fixture를 파일로 옮긴 것(그 테스트는 Codex가 수정 중이라 건드리지 않고, 새 도우미만 만든다).

- [ ] **Step 1: 테스트 도우미 작성**

```ts
// tests/unit/support/canvasFixture.ts
interface Paint {
  globalAlpha: number; globalCompositeOperation: string; filter: string; shadowColor: string;
  shadowBlur: number; shadowOffsetX: number; shadowOffsetY: number; lineDash: number[];
}
export interface Fill extends Paint { fillStyle: unknown; rect: number[] }
export interface Text { value: string; x: number; y: number; opacity: number }

/** Stateful Canvas stand-in: paths are ignored, but save/restore, paint state and text calls are real. */
export function canvasFixture(initial: Partial<Paint> = {}) {
  let state: Record<string, unknown> = {
    globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none',
    shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    lineDash: [], fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, ...initial,
  };
  const stack: Record<string, unknown>[] = [], fills: Fill[] = [], texts: Text[] = [];
  const paint = (): Paint => ({
    globalAlpha: state.globalAlpha as number, globalCompositeOperation: state.globalCompositeOperation as string,
    filter: state.filter as string, shadowColor: state.shadowColor as string, shadowBlur: state.shadowBlur as number,
    shadowOffsetX: state.shadowOffsetX as number, shadowOffsetY: state.shadowOffsetY as number,
    lineDash: [...state.lineDash as number[]],
  });
  const gradient = () => ({ addColorStop: () => undefined });
  const methods: Record<string, unknown> = {
    canvas: { width: 1280, height: 720 },
    save: () => stack.push({ ...state, lineDash: [...state.lineDash as number[]] }),
    restore: () => { state = stack.pop() ?? state; },
    fillRect: (...rect: number[]) => fills.push({ ...paint(), fillStyle: state.fillStyle, rect }),
    fillText: (value: string, x: number, y: number) => texts.push({ value, x, y, opacity: state.globalAlpha as number }),
    getLineDash: () => [...state.lineDash as number[]],
    setLineDash: (segments: number[]) => { state.lineDash = [...segments]; },
    createLinearGradient: gradient, createRadialGradient: gradient, createConicGradient: gradient,
    measureText: (text: string) => ({ width: text.length * 7 }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  };
  const noop = () => undefined;
  const ctx = new Proxy({}, {
    get: (_target, key) => typeof key === 'string' ? methods[key] ?? state[key] ?? noop : undefined,
    set: (_target, key, value) => { state[String(key)] = value; return true; },
  }) as CanvasRenderingContext2D;
  return { ctx, fills, texts, stack };
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

```ts
// tests/unit/scenes/cinemaBarFilm.test.ts
import { describe, expect, it, vi } from 'vitest';
import { drawBarFilm } from '@/cinema/drawBarFilm';
import type { ProductionSnapshot } from '@/cinema/productionSnapshot';
import { canvasFixture } from '../support/canvasFixture';

vi.mock('@/cinema/components/drawProjectedFilmSurface', () => ({ drawProjectedFilmSurface: () => undefined }));

const snapshot = (count: number, extra: Partial<ProductionSnapshot> = {}): ProductionSnapshot => ({
  unit: 'EA', target: 800,
  lines: Array.from({ length: count }, (_, index) => ({ id: `SMT-${index + 1}`, label: `SMT ${index + 1}`, value: 700 + index * 30 })),
  ...extra,
});
const fonts = { label: 'sans-serif', mono: 'monospace' };
const values = (texts: { value: string }[]) => texts.map(text => text.value);

describe('bar film with an injected production snapshot', () => {
  it('draws the injected line labels and the real channel count', () => {
    const fixture = canvasFixture();
    drawBarFilm(fixture.ctx, 1280, 720, 8, fonts, undefined, undefined, snapshot(2));
    const drawn = values(fixture.texts);
    expect(drawn).toContain('SMT 1');
    expect(drawn).toContain('SMT 2');
    expect(drawn).toContain('02 CHANNELS');
    expect(drawn).toContain('EA / 2 LINES  ·  89.4%');
    expect(drawn).toContain('00 / 02');
    expect(drawn).not.toContain('LINE 01');
    expect(fixture.stack).toHaveLength(0);
  });

  it('brings the selected line forward during the focus window and reads its numbers', () => {
    const fixture = canvasFixture();
    drawBarFilm(fixture.ctx, 1280, 720, 14, fonts, undefined, undefined, snapshot(3, { selectedId: 'SMT-2' }));
    const drawn = values(fixture.texts);
    expect(drawn).toContain('ACTUAL OUTPUT');
    expect(drawn.filter(value => value === 'SMT 2').length).toBeGreaterThanOrEqual(2);
    expect(drawn).toContain('Δ −70 EA');
  });

  it('skips the detail panel when no line is below target', () => {
    const fixture = canvasFixture();
    drawBarFilm(fixture.ctx, 1280, 720, 14, fonts, undefined, undefined, snapshot(3, { target: 600 }));
    const drawn = values(fixture.texts);
    expect(drawn).not.toContain('ACTUAL OUTPUT');
    expect(drawn).toContain('03 / 03');
    expect(fixture.stack).toHaveLength(0);
  });

  it('renders 20 lines and an empty snapshot without throwing', () => {
    for (const data of [snapshot(20), snapshot(0)]) {
      const fixture = canvasFixture();
      expect(() => drawBarFilm(fixture.ctx, 1280, 720, 8, fonts, undefined, undefined, data)).not.toThrow();
      expect(fixture.stack).toHaveLength(0);
      expect(values(fixture.texts)).toContain(`${String(data.lines.length).padStart(2, '0')} CHANNELS`);
    }
  });

  it('falls back to the default snapshot when none is given', () => {
    const fixture = canvasFixture();
    drawBarFilm(fixture.ctx, 1280, 720, 8, fonts);
    const drawn = values(fixture.texts);
    expect(drawn).toContain('LINE 04');
    expect(drawn).toContain('05 CHANNELS');
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run tests/unit/scenes/cinemaBarFilm.test.ts`
Expected: FAIL — `02 CHANNELS` 없음(현재 `05 CHANNELS` 고정), `SMT 1` 없음

- [ ] **Step 4: 구현** — `drawBarFilm.ts` 전체 교체

```ts
import { drawBarChart } from './components/drawBarChart';
import { drawChartStage } from './drawChartStage';
import { DEFAULT_FONTS, filmText, signalColor, smooth, type FilmFonts } from './filmDrawing';
import { applyFocusProjection, focusEnvelope, focusProjection, projectFocusPoint } from './filmFocus';
import { DEFAULT_CHART_PRESENTATION, type ChartPresentation } from './chartPresentation';
import type { FilmViewportInsets } from './filmViewport';
import { DEFAULT_PRODUCTION_SNAPSHOT, productionSnapshotState, type ProductionSnapshot } from './productionSnapshot';

const FOCUS_WINDOW = { enter: [9, 11.5] as [number, number], exit: [21.5, 24.5] as [number, number] };
const READ_WINDOW = { enter: [11, 13.2] as [number, number], exit: [21.5, 24.5] as [number, number] };

/** One production snapshot drives every channel; the selected line is chosen by id or by the snapshot rule. */
export function drawBarFilm(ctx: CanvasRenderingContext2D, width: number, height: number, t: number,
  fonts: FilmFonts = DEFAULT_FONTS, presentation: ChartPresentation = DEFAULT_CHART_PRESENTATION,
  insets?: FilmViewportInsets, snapshot: ProductionSnapshot = DEFAULT_PRODUCTION_SNAPSHOT) {
  drawChartStage(ctx, width, height, t, fonts, 'PRODUCTION / BAR COMPARISON', insets);
  const state = productionSnapshotState(snapshot);
  const { lines, unit, target, total, aggregateRatio, reached, selected } = state;
  const release = 1 - smooth(25, 28, t);
  const intro = smooth(.4, 1.6, t);
  const hasSelection = selected !== undefined;
  const focus = hasSelection ? focusEnvelope(t, FOCUS_WINDOW) : 0;
  const activeIndex = hasSelection && t >= 9 && t < 24.5 ? state.selectedIndex : undefined;
  const readFocus = hasSelection ? focusEnvelope(t, READ_WINDOW) : 0;
  const readProjection = focusProjection({ x: 955, y: 385, focus: readFocus, depth: 85, lift: 10 });
  const text = (value: string, x: number, y: number, size: number, opacity: number, mono = false, heat = 0) =>
    filmText(ctx, fonts, value, x, y, size, opacity * release, mono, 'left', signalColor(heat, 1));
  const count = String(lines.length).padStart(2, '0');

  const gauge = (x: number, y: number, width: number, ratio: number, opacity: number, heat = 0) => {
    const segments = 32, slot = width / segments, charge = Math.max(0, Math.min(1, ratio));
    ctx.save(); ctx.globalAlpha = opacity * release;
    for (let segment = 0; segment < segments; segment++) {
      const fill = Math.max(0, Math.min(1, charge * segments - segment));
      ctx.fillStyle = signalColor(heat, .1); ctx.fillRect(x + slot * segment, y, slot - 2, 7);
      if (fill > 0) {
        ctx.fillStyle = signalColor(heat, .72); ctx.fillRect(x + slot * segment, y, (slot - 2) * fill, 7);
      }
      if (segment % 8 === 0) {
        ctx.fillStyle = signalColor(heat, .28); ctx.fillRect(x + slot * segment, y + 11, 1, 3);
      }
    }
    ctx.fillStyle = signalColor(heat, .65); ctx.fillRect(x + width - 1, y - 3, 1, 16);
    ctx.restore();
  };

  text('PRODUCTION TELEMETRY', 150, 177, 25, intro * .94, true);
  text('라인별 생산 실적 · 1교대 · 공통 수량 기준', 151, 204, 12, intro * .52);
  text(`${count} CHANNELS`, 724, 176, 10, intro * .47, true);
  ctx.save(); ctx.globalAlpha = intro * release;
  ctx.beginPath(); ctx.moveTo(136, 157); ctx.lineTo(136, 181); ctx.lineTo(145, 190);
  ctx.strokeStyle = signalColor(0, .65); ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = signalColor(0, .8); ctx.fillRect(139, 157, 3, 5);
  ctx.restore();
  const anchors = drawBarChart(ctx, fonts, {
    x: 150, y: 280, width: 690, height: 250, time: t - 1.1,
    data: lines, maxValue: state.maximum, target: target > 0 ? target : undefined, unit, activeIndex, focus, opacity: release, presentation,
  });

  text('AGGREGATE / TOTAL OUTPUT', 956, 165, 10, intro * .5, true);
  text(total.toLocaleString('en-US'), 953, 208, 42, intro, true);
  text(`${unit} / ${lines.length} LINES  ·  ${(aggregateRatio * 100).toFixed(1)}%`, 956, 231, 10, intro * .6, true);
  gauge(956, 246, 196, aggregateRatio, intro * .7);
  const anchor = selected !== undefined && state.selectedIndex !== undefined ? anchors[state.selectedIndex] : undefined;
  if (selected && anchor && focus > .001) {
    const difference = selected.value - target;
    const selectedRatio = target > 0 ? selected.value / target : 0;
    const heat = difference < 0 ? 1 : 0;
    const reveal = smooth(10, 12, t);
    const endpoint = projectFocusPoint(readProjection, { x: 944, y: 301 });
    ctx.save(); ctx.beginPath(); ctx.rect(anchor.x - 6, 220, (endpoint.x - anchor.x + 6) * reveal, 345); ctx.clip();
    ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y - 10); ctx.lineTo(anchor.x + 44, anchor.y - 40);
    ctx.lineTo(endpoint.x - 32, endpoint.y); ctx.lineTo(endpoint.x, endpoint.y);
    ctx.strokeStyle = signalColor(heat, focus * release * .58); ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(anchor.x, anchor.y - 10, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = signalColor(heat, focus * release * .85); ctx.fill(); ctx.restore();
    const read = smooth(11.5, 13, t) * focus;
    ctx.save(); applyFocusProjection(ctx, readProjection);
    ctx.save(); ctx.globalAlpha = read * release;
    ctx.beginPath(); ctx.moveTo(944, 280); ctx.lineTo(944, 301); ctx.lineTo(951, 308);
    ctx.moveTo(944, 510); ctx.lineTo(944, 531); ctx.lineTo(964, 531);
    ctx.strokeStyle = signalColor(heat, .65); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = signalColor(heat, .6); ctx.fillRect(955, 278, 25, 2);
    ctx.restore();
    text(selected.label, 955, 302, 15, read, true, heat);
    text('ACTUAL OUTPUT', 955, 325, 9, read * .52, true);
    text(selected.value.toLocaleString('en-US'), 952, 374, 49, read, true, heat);
    text(unit, 1070, 372, 13, read * .67, true, heat);
    text(`${(selectedRatio * 100).toFixed(1)}%`, 955, 408, 25, read, true, heat);
    text('ACHIEVEMENT', 1057, 406, 9, read * .5, true);
    gauge(956, 425, 192, selectedRatio, read, heat);
    text(`TARGET  ${target.toLocaleString('en-US')} ${unit}`, 956, 463, 12, read * .67, true);
    const signedDifference = `${difference < 0 ? '−' : '+'}${Math.abs(difference).toLocaleString('en-US')}`;
    text(`Δ ${signedDifference} ${unit}`, 955, 493, 22, read, true, heat);
    text(difference < 0 ? `목표까지 ${Math.abs(difference)} ${unit} 추가 필요`
      : difference > 0 ? `목표보다 ${difference} ${unit} 초과 달성` : '설정한 생산 목표 달성', 956, 519, 12, read * .76, false, heat);
    ctx.restore();
  }
  const summary = smooth(4.6, 6.3, t);
  const totals = [
    { x: 150, label: 'TARGET / LINE', value: `${target.toLocaleString('en-US')} ${unit}` },
    { x: 399, label: 'AGGREGATE ACHIEVEMENT', value: `${(aggregateRatio * 100).toFixed(1)}%` },
    { x: 685, label: 'LINES ON TARGET', value: `${String(reached).padStart(2, '0')} / ${count}` },
  ];
  for (const item of totals) {
    text(item.label, item.x, 616, 9, summary * .43, true);
    text(item.value, item.x, 641, 19, summary * .84, true);
    ctx.save(); ctx.globalAlpha = summary * release;
    ctx.fillStyle = signalColor(0, .45); ctx.fillRect(item.x - 9, 607, 2, 34);
    ctx.restore();
  }
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run tests/unit/scenes/cinemaBarFilm.test.ts && npm run test:unit && npm run typecheck`
Expected: 새 테스트 5개 PASS, 전체 단위 테스트 PASS, typecheck 오류 없음. `cinemaGallery.test.ts`가 막대 장면 스냅샷을 검사한다면 기본 스냅샷 결과가 이전과 같아야 한다(라벨·값·선택 인덱스 3 동일).

- [ ] **Step 6: 커밋**

```bash
git add src/cinema/drawBarFilm.ts tests/unit/scenes/cinemaBarFilm.test.ts tests/unit/support/canvasFixture.ts
git commit -m "feat(cinema): draw the bar scene from an injected production snapshot"
```

---

### Task 5: 주입 통로 `filmSceneData.ts` — Codex 커밋 이후 진행

**선행 조건:** `git status`에서 `src/cinema/drawSignalFilm.ts`, `src/cinema/useFilmPlayback.ts`, `DESIGN.md`가 clean 상태(Codex 커밋 완료)여야 한다. 아니면 이 Task를 시작하지 않는다.

**Files:**
- Create: `src/cinema/filmSceneData.ts`
- Modify: `src/cinema/drawSignalFilm.ts` (`Renderer` 타입, `bars` renderer, `drawSignalFilm`·`drawFilmChapter` 시그니처)
- Modify: `src/cinema/useFilmPlayback.ts` (`clock` 초기값, `sceneData` state, 렌더 호출, 반환 객체)
- Modify: `DESIGN.md` (변경 영향 경로 1항목 추가)
- Test: `tests/unit/scenes/cinemaFilmSceneData.test.ts`

**Interfaces:**
- Consumes: Task 2 `ProductionSnapshot`, `DEFAULT_PRODUCTION_SNAPSHOT`; Task 4 `drawBarFilm(…, snapshot)`
- Produces:
  - `interface FilmSceneData { production: ProductionSnapshot }`
  - `DEFAULT_FILM_SCENE_DATA: FilmSceneData`
  - `mergeFilmSceneData(base: FilmSceneData, change: Partial<FilmSceneData>): FilmSceneData`
  - `drawSignalFilm(ctx, width, height, t, fonts?, insets?, charts?, factory?, environment?, data: FilmSceneData = DEFAULT_FILM_SCENE_DATA)`
  - `useFilmPlayback()` 반환에 `sceneData: FilmSceneData`, `updateSceneData(change: Partial<FilmSceneData>): void` 추가

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/unit/scenes/cinemaFilmSceneData.test.ts
import { describe, expect, it, vi } from 'vitest';
import { drawSignalFilm } from '@/cinema/drawSignalFilm';
import { DEFAULT_FILM_SCENE_DATA, mergeFilmSceneData, type FilmSceneData } from '@/cinema/filmSceneData';
import { chapterStart } from '@/cinema/filmProgram';
import { canvasFixture } from '../support/canvasFixture';

vi.mock('@/cinema/components/drawProjectedFilmSurface', () => ({ drawProjectedFilmSurface: () => undefined }));

describe('film scene data injection', () => {
  it('merges partial updates over the defaults without touching untouched scenes', () => {
    const merged = mergeFilmSceneData(DEFAULT_FILM_SCENE_DATA, { production: { unit: 'PCS', target: 10, lines: [] } });
    expect(merged.production.unit).toBe('PCS');
    expect(mergeFilmSceneData(DEFAULT_FILM_SCENE_DATA, {})).toEqual(DEFAULT_FILM_SCENE_DATA);
    expect(DEFAULT_FILM_SCENE_DATA.production.lines).toHaveLength(5);
  });

  it('routes injected production lines into the bar scene', () => {
    const data: FilmSceneData = { production: { unit: 'EA', target: 800,
      lines: [{ id: 'SMT-A', label: 'SMT A', value: 640 }, { id: 'SMT-B', label: 'SMT B', value: 910 }] } };
    const fixture = canvasFixture();
    drawSignalFilm(fixture.ctx, 1280, 720, chapterStart('bars') + 8, undefined, undefined, undefined, null, null, data);
    const drawn = fixture.texts.map(text => text.value);
    expect(drawn).toContain('SMT A');
    expect(drawn).toContain('02 CHANNELS');
    expect(drawn).not.toContain('LINE 01');
    expect(fixture.stack).toHaveLength(0);
  });

  it('draws the default snapshot when no data is passed', () => {
    const fixture = canvasFixture();
    drawSignalFilm(fixture.ctx, 1280, 720, chapterStart('bars') + 8);
    expect(fixture.texts.map(text => text.value)).toContain('05 CHANNELS');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/scenes/cinemaFilmSceneData.test.ts`
Expected: FAIL — `Cannot find module '@/cinema/filmSceneData'`

- [ ] **Step 3: 구현**

```ts
// src/cinema/filmSceneData.ts
import { DEFAULT_PRODUCTION_SNAPSHOT, type ProductionSnapshot } from './productionSnapshot';

/** Everything a film frame reads from outside: one entry per data-driven scene. */
export interface FilmSceneData { production: ProductionSnapshot }

export const DEFAULT_FILM_SCENE_DATA: FilmSceneData = { production: DEFAULT_PRODUCTION_SNAPSHOT };

/** Scenes not named in the change keep their current data. */
export function mergeFilmSceneData(base: FilmSceneData, change: Partial<FilmSceneData>): FilmSceneData {
  return { ...base, ...(change.production ? { production: change.production } : {}) };
}
```

`drawSignalFilm.ts` 수정(현재 파일 기준 diff):

```ts
// import 추가
import { DEFAULT_FILM_SCENE_DATA, type FilmSceneData } from './filmSceneData';

// Renderer 타입: environment 뒤에 data 추가
type Renderer = (ctx: CanvasRenderingContext2D, width: number, height: number, time: number, fonts: FilmFonts,
  insets: FilmViewportInsets | undefined, charts: FilmChartSettings, factory: FactoryInteraction | null,
  environment: ZoneEnvironmentState | null, data: FilmSceneData) => void;

// bars renderer 교체
  bars: (ctx, width, height, time, fonts, insets, charts, _factory, _environment, data) =>
    drawBarFilm(ctx, width, height, time, fonts, charts.bars, insets, data.production),

// drawSignalFilm 시그니처: environment 뒤에 추가
  ..., environment: ZoneEnvironmentState | null = null, data: FilmSceneData = DEFAULT_FILM_SCENE_DATA) {
  // 내부 호출
    drawFilmChapter(ctx, width, height, t, fonts, insets, charts, factory, environment, data);

// drawFilmChapter 시그니처와 renderer 호출에 data 추가
function drawFilmChapter(..., environment: ZoneEnvironmentState | null, data: FilmSceneData) {
  const { chapter, index, start, localTime } = chapterAt(t);
  renderers[chapter.id](ctx, width, height, localTime, fonts, insets, charts, factory, environment, data);
```

`useFilmPlayback.ts` 수정:

```ts
// import 추가
import { DEFAULT_FILM_SCENE_DATA, mergeFilmSceneData, type FilmSceneData } from './filmSceneData';

// clock 초기값에 추가
  const clock = useRef({ ..., theme: DEFAULT_FILM_THEME, sceneData: DEFAULT_FILM_SCENE_DATA });
// state 추가 (theme state 아래)
  const [sceneData, setSceneData] = useState<FilmSceneData>(DEFAULT_FILM_SCENE_DATA);
// 렌더 호출 교체
        drawSignalFilm(themed.ctx, node.width, node.height, current.time, fonts, viewport, current.charts, readFactoryState(), environmentFrame, current.sceneData);
// 반환 객체: `theme, factory, environment,` 뒤에 `sceneData,` 추가하고 메서드 추가
    updateSceneData(change: Partial<FilmSceneData>) {
      clock.current.sceneData = mergeFilmSceneData(clock.current.sceneData, change);
      setSceneData(clock.current.sceneData);
    },
```

`DESIGN.md`의 변경 영향 경로 절에 한 줄 추가(절 이름은 현재 파일에서 확인):

```md
- 막대 장면 데이터: `productionSnapshot.ts`(모델·선택 규칙·눈금) → `filmSceneData.ts`(주입 통로) → `drawSignalFilm.ts` bars renderer → `drawBarFilm.ts` → `barTelemetryGeometry.ts`(밀도) → `drawBarChart.ts`. 라인 추가·삭제·값 변경은 스냅샷만 바꾼다. 파이 장면은 `chartData.ts` 파생값을 읽는다.
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/scenes/cinemaFilmSceneData.test.ts && npm run test:unit && npm run typecheck && npm run build`
Expected: 모두 PASS, build 성공

- [ ] **Step 5: 커밋**

```bash
git add src/cinema/filmSceneData.ts src/cinema/drawSignalFilm.ts src/cinema/useFilmPlayback.ts DESIGN.md tests/unit/scenes/cinemaFilmSceneData.test.ts
git commit -m "feat(cinema): open the film scene data channel and feed the bar scene"
```

---

## 완료 기준

- Task 1~5 커밋 완료, `npm run typecheck` · `npm run test:unit` · `npm run build` 통과.
- 파이 장면 코드 무변경, 기본 스냅샷으로 그린 막대 장면이 이전과 같은 라벨·값·선택(LINE 04)을 보인다.
- 라인 2개·20개·선택 없음·0개 스냅샷을 주입해도 예외 없이 그려진다.
