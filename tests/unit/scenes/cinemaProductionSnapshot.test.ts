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
