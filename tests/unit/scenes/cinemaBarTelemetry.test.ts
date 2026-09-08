import { describe, expect, it } from 'vitest';
import { barTelemetryLayout, telemetrySegments, type BarChartOptions } from '@/cinema/barTelemetryGeometry';
import { CHART_DEPTH_RANGE } from '@/cinema/chartPresentation';
import { projectFocusPoint } from '@/cinema/filmFocus';

const options: BarChartOptions = {
  x: 150, y: 280, width: 690, height: 250, time: 8,
  data: [{ label: 'A', value: 0 }, { label: 'B', value: 150 }, { label: 'C', value: 300 }],
  maxValue: 500, target: 240,
};

describe('segmented telemetry bar data and geometry', () => {
  it('uses one true-zero scale that contains every actual value and the reference, including overruns', () => {
    for (const [values, target, proposedMax] of [
      [[0, 75, 150], 120, 100], [[10, 300, 900], 1200, 500], [[0, 300, 1600], 1000, 500],
    ] as const) {
      const layout = barTelemetryLayout({ ...options, data: values.map((value, index) => ({ label: String(index), value })),
        maxValue: proposedMax, target })!;
      expect(layout.maximum).toBeGreaterThanOrEqual(target);
      expect(layout.maximum).toBeGreaterThanOrEqual(Math.max(...values));
      const referenceY = layout.baseline - layout.height * target / layout.maximum;
      expect(referenceY).toBeGreaterThanOrEqual(layout.y);
      expect(referenceY).toBeLessThanOrEqual(layout.baseline);
      for (const column of layout.columns) {
        expect(column.top).toBeGreaterThanOrEqual(layout.y);
        expect(column.top).toBeLessThanOrEqual(layout.baseline);
        expect((layout.baseline - column.top) / layout.height).toBeCloseTo(column.value / layout.maximum);
        if (column.value === 0) expect(column.top).toBe(layout.baseline);
      }
    }
  });

  it('does not turn invalid or zero readings into active bars and safely declines an unusable chart', () => {
    const invalid = barTelemetryLayout({ ...options, data: [0, -20, NaN, Infinity, -Infinity]
      .map((value, index) => ({ label: String(index), value })), maxValue: NaN, target: Infinity, activeIndex: 2, focus: 1 })!;
    expect(invalid.target).toBeUndefined();
    expect(invalid.selected).toBeUndefined();
    expect(invalid.focus).toBe(0);
    expect(invalid.maximum).toBeGreaterThan(0);
    expect(invalid.columns.every(column => column.value === 0 && column.barHeight === 0
      && column.top === invalid.baseline && column.anchor.y === invalid.baseline)).toBe(true);
    expect(barTelemetryLayout({ ...options, data: [] })).toBeUndefined();
    for (const geometry of [{ x: NaN }, { y: Infinity }, { width: 0 }, { width: -1 }, { height: 0 },
      { height: Infinity }, { time: -1 }, { time: NaN }, { time: Infinity }]) {
      expect(barTelemetryLayout({ ...options, ...geometry })).toBeUndefined();
    }
  });

  it('never lights an empty value or extends a partial luminous strip beyond the measurement', () => {
    for (const height of [1, 137.3, 280]) {
      for (const fill of [-10, 0, .025, height * .019, height * .37, height, height * 2]) {
        const segments = telemetrySegments(height, fill);
        const endpoint = Math.max(0, Math.min(height, fill));
        let previousEnd = 0;
        for (const segment of segments) {
          expect(segment.bottom).toBeGreaterThanOrEqual(previousEnd);
          expect(segment.lit).toBeGreaterThanOrEqual(0);
          expect(segment.lit).toBeLessThanOrEqual(segment.thickness);
          if (segment.lit > 0) expect(segment.bottom + segment.lit).toBeLessThanOrEqual(endpoint + 1e-10);
          previousEnd = segment.bottom + segment.thickness;
        }
        if (fill <= 0) expect(segments.every(segment => segment.lit === 0)).toBe(true);
      }
    }
    const partial = telemetrySegments(240, 2.05).filter(segment => segment.lit > 0);
    expect(partial).toHaveLength(1);
    expect(partial[0].lit).toBeLessThan(partial[0].thickness);
    expect(partial[0].bottom + partial[0].lit).toBeCloseTo(2.05);
    expect(telemetrySegments(0, 12)).toEqual([]);
    expect(telemetrySegments(Infinity, 12)).toEqual([]);
    expect(telemetrySegments(120, NaN)).toEqual([]);
  });

  it('reconstructs growth and selected anchors after backwards seeks without mutating input data', () => {
    const data = Object.freeze(options.data.map(datum => Object.freeze({ ...datum })));
    const input = Object.freeze({ ...options, data, activeIndex: 1, focus: .6, time: 1.9 });
    const expected = barTelemetryLayout(input);
    const late = barTelemetryLayout({ ...input, time: 8 })!;
    for (const time of [12, 0, 4.1, 1.9, .5, 9]) barTelemetryLayout({ ...input, time });
    expect(barTelemetryLayout(input)).toEqual(expected);
    expect(late.columns.every((column, index) => column.barHeight >= expected!.columns[index].barHeight)).toBe(true);
    expect(barTelemetryLayout({ ...input, time: 0 })!.columns.every(column => column.barHeight === 0)).toBe(true);
    expect(data).toEqual(options.data);
  });

  it('changes extrusion with the 2D/3D depth control while preserving actual-value heights', () => {
    const flat = barTelemetryLayout({ ...options, presentation: { dimension: '2d', depthScale: 1.6 } })!;
    const shallow = barTelemetryLayout({ ...options, presentation: { dimension: '3d', depthScale: CHART_DEPTH_RANGE.min } })!;
    const deep = barTelemetryLayout({ ...options, presentation: { dimension: '3d', depthScale: CHART_DEPTH_RANGE.max } })!;
    expect(flat.depth).toBe(0);
    expect(shallow.depth).toBeGreaterThan(0);
    expect(deep.depth).toBeGreaterThan(shallow.depth);
    expect(deep.depth / shallow.depth).toBeCloseTo(CHART_DEPTH_RANGE.max / CHART_DEPTH_RANGE.min);
    expect(flat.columns.map(column => column.barHeight)).toEqual(deep.columns.map(column => column.barHeight));
    expect(shallow.columns.map(column => column.anchor)).toEqual(deep.columns.map(column => column.anchor));
    expect(barTelemetryLayout({ ...options, presentation: { dimension: '3d', depthScale: -4 } })!.depth).toBe(shallow.depth);
    expect(barTelemetryLayout({ ...options, presentation: { dimension: '3d', depthScale: 10 } })!.depth).toBe(deep.depth);
    expect(Number.isFinite(barTelemetryLayout({ ...options, presentation: { dimension: '3d', depthScale: NaN } })!.depth)).toBe(true);
  });

  it('attaches the selected value and zero anchors to the same focus projection without changing its ratio', () => {
    for (const focus of [0, .25, .75, 1]) {
      const layout = barTelemetryLayout({ ...options, activeIndex: 1, focus })!;
      const column = layout.columns[1];
      const head = projectFocusPoint(column.lens, { x: column.center, y: column.top });
      const zero = projectFocusPoint(column.lens, { x: column.center, y: layout.baseline });
      const fullScale = projectFocusPoint(column.lens, { x: column.center, y: layout.y });
      expect(column.anchor).toEqual({ x: head.x, y: head.y, baseline: zero.y, value: column.value });
      expect((column.anchor.baseline - column.anchor.y) / (zero.y - fullScale.y))
        .toBeCloseTo(column.value / layout.maximum);
      expect(column.anchor.baseline - column.anchor.y).toBeCloseTo(column.barHeight * column.lens.scale);
      expect(layout.columns[2].lens.scale).toBe(1);
      expect(layout.columns[2].anchor.baseline).toBe(layout.baseline);
      if (focus > 0) {
        expect(column.lens.depth).toBeGreaterThan(0);
        expect(column.lens.scale).toBeGreaterThan(1);
        expect(column.anchor.baseline).toBeLessThan(layout.baseline);
      }
    }
  });

  it('preserves value ratios and finite separated columns across chart sizes and dense channel counts', () => {
    for (const [width, height] of [[360, 180], [690, 250], [1200, 420]]) {
      for (const count of [3, 12, 40]) {
        const data = Array.from({ length: count }, (_, index) => ({ label: `T${index + 1}`, value: (index + 1) * 12 }));
        for (const depthScale of [CHART_DEPTH_RANGE.min, CHART_DEPTH_RANGE.max]) {
          const layout = barTelemetryLayout({ ...options, width, height, data,
            presentation: { dimension: '3d', depthScale } })!;
          for (const column of layout.columns) {
            expect([column.top, column.barHeight, column.left, column.anchor.x, column.anchor.y, column.anchor.baseline]
              .every(Number.isFinite)).toBe(true);
            expect(column.barHeight / height).toBeCloseTo(column.value / layout.maximum);
            const next = layout.columns[column.index + 1];
            if (next) expect(column.left + layout.barWidth + layout.depth).toBeLessThan(next.left);
          }
        }
      }
    }
  });
});

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
