import { describe, expect, it } from 'vitest';
import { CORNER_PRODUCTION } from '@/cinema/cornerSequence';
import { FILM_DURATIONS } from '@/cinema/filmProgram';
import {
  UNFOLD_CARD_SIZE, UNFOLD_HUB, UNFOLD_METRICS, unfoldMetricsState, type UnfoldMetricState,
} from '@/cinema/unfoldMetrics';

function bounds(item: UnfoldMetricState) {
  return {
    left: item.x - UNFOLD_CARD_SIZE.width * item.scale / 2,
    right: item.x + UNFOLD_CARD_SIZE.width * item.scale / 2,
    top: item.y - UNFOLD_CARD_SIZE.height * item.scale / 2,
    bottom: item.y + UNFOLD_CARD_SIZE.height * item.scale / 2,
  };
}

describe('numbers that become charts and assemble a metric summary', () => {
  it('keeps displayed values and chart baselines consistent with the same production counts', () => {
    expect(UNFOLD_METRICS.map(metric => [metric.value, metric.unit])).toEqual([
      ['87.4', '%'], ['96.4', '%'], ['8.2', 's'], ['183', 'EA'],
    ]);
    const [production, quality, cycle, remaining] = UNFOLD_METRICS;
    expect(production.value).toBe((CORNER_PRODUCTION.actual / CORNER_PRODUCTION.target * 100).toFixed(1));
    expect(remaining.numericValue + CORNER_PRODUCTION.actual).toBe(CORNER_PRODUCTION.target);
    expect(quality.numericValue - quality.baseline).toBeCloseTo(quality.deviation);
    expect(cycle.numericValue - cycle.baseline).toBeCloseTo(cycle.deviation);
    for (const metric of UNFOLD_METRICS) expect(metric.numericValue).toBe(Number(metric.value));
    expect(FILM_DURATIONS.unfold).toBe(32);
  });

  it('starts with an empty stage and gives each number a separate readable period', () => {
    for (const time of [0, 1, 2]) expect(unfoldMetricsState(time).items.every(item => item.opacity === 0)).toBe(true);
    for (let index = 0; index < 4; index++) {
      for (const delay of [1.1, 1.6, 2.4]) {
        const state = unfoldMetricsState(2 + index * 6 + delay), item = state.items[index];
        expect(state.activeIndex).toBe(index);
        expect(item).toMatchObject({ x: UNFOLD_HUB.x, y: UNFOLD_HUB.y,
          opacity: 1, scale: 1, focus: 1, morph: 0, settled: 0 });
        expect(state.items.slice(index + 1).every(next => next.opacity === 0)).toBe(true);
      }
    }
  });

  it('finishes turning the number into a chart before moving it out of the center', () => {
    for (let index = 0; index < 4; index++) {
      const morphing = unfoldMetricsState(2 + index * 6 + 3.25).items[index];
      expect(morphing.morph).toBeGreaterThan(0);
      expect(morphing.morph).toBeLessThan(1);
      expect(morphing).toMatchObject({ x: UNFOLD_HUB.x, y: UNFOLD_HUB.y, settled: 0 });
    }
    for (let time = 0; time <= FILM_DURATIONS.unfold; time += .05) {
      for (const item of unfoldMetricsState(time).items) {
        if (item.settled > 0) expect(item.morph, `chart moved before morph finished at ${time}`).toBe(1);
      }
    }
  });

  it('preserves every completed chart while the later numbers are introduced', () => {
    for (let index = 0; index < 4; index++) {
      for (let time = 2 + index * 6 + 5.7; time <= 30; time += .15) {
        const item = unfoldMetricsState(time).items[index];
        expect(item).toMatchObject({ x: item.metric.target.x, y: item.metric.target.y,
          settled: 1, morph: 1, reveal: 1 });
        expect(item.scale).toBeCloseTo(item.metric.target.scale);
        expect(item.opacity).toBeGreaterThanOrEqual(.149);
      }
    }
  });

  it('gives only one large reading visual priority and dims charts behind it', () => {
    for (let time = 2; time < 26; time += .05) {
      const state = unfoldMetricsState(time);
      const foreground = state.items.filter(item => item.opacity > .5 && item.scale > .7);
      expect(foreground.length, `competing foreground readings at ${time}`).toBeLessThanOrEqual(1);
      if (state.activeIndex !== null) {
        const active = state.items[state.activeIndex];
        if (active.opacity > .95 && active.settled === 0) {
          for (const earlier of state.items.slice(0, state.activeIndex)) expect(earlier.opacity).toBeLessThanOrEqual(.151);
        }
      }
    }
  });

  it('assembles a readable summary with all four distinct charts and no panel overlap', () => {
    const state = unfoldMetricsState(28);
    expect(state.activeIndex).toBeNull();
    expect(state.overview).toBe(1);
    expect(state.items.every(item => item.opacity === 1 && item.morph === 1 && item.settled === 1)).toBe(true);
    const panels = state.items.map(bounds);
    for (const panel of panels) {
      expect(panel.left).toBeGreaterThan(72);
      expect(panel.right).toBeLessThan(1208);
      expect(panel.top).toBeGreaterThan(150);
      expect(panel.bottom).toBeLessThan(640);
    }
    for (let a = 0; a < panels.length; a++) {
      for (let b = a + 1; b < panels.length; b++) {
        const horizontal = Math.max(0, Math.min(panels[a].right, panels[b].right) - Math.max(panels[a].left, panels[b].left));
        const vertical = Math.max(0, Math.min(panels[a].bottom, panels[b].bottom) - Math.max(panels[a].top, panels[b].top));
        expect(horizontal * vertical).toBe(0);
      }
    }
  });

  it('keeps visible geometry finite and within the viewport for the whole sequence', () => {
    for (let time = 0; time <= FILM_DURATIONS.unfold; time += .05) {
      const state = unfoldMetricsState(time);
      for (const item of state.items) {
        expect([item.x, item.y, item.scale, item.rotation, item.port.x, item.port.y].every(Number.isFinite)).toBe(true);
        for (const value of [item.appear, item.morph, item.settled, item.focus, item.opacity]) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
        if (item.opacity < .01) continue;
        const panel = bounds(item);
        expect(panel.left).toBeGreaterThan(72);
        expect(panel.right).toBeLessThan(1208);
        expect(panel.top).toBeGreaterThan(135);
        expect(panel.bottom).toBeLessThan(640);
      }
    }
  });

  it('fades the assembled summary without resetting its positions or chart forms', () => {
    const visible = unfoldMetricsState(30), fading = unfoldMetricsState(31), finished = unfoldMetricsState(32);
    expect(visible.presence).toBe(1);
    expect(fading.presence).toBeGreaterThan(0);
    expect(fading.presence).toBeLessThan(1);
    expect(finished.presence).toBe(0);
    visible.items.forEach((item, index) => {
      expect(finished.items[index]).toMatchObject({ x: item.x, y: item.y, scale: item.scale, morph: 1, settled: 1, opacity: 0 });
    });
  });

  it('reconstructs morphing and settled charts identically on a backward seek', () => {
    const originalData = JSON.stringify(UNFOLD_METRICS);
    for (const time of [3.4, 5.5, 6.8, 11.2, 24.5, 28]) {
      const expected = unfoldMetricsState(time);
      unfoldMetricsState(32); unfoldMetricsState(0); unfoldMetricsState(18);
      expect(unfoldMetricsState(time)).toEqual(expected);
    }
    expect(JSON.stringify(UNFOLD_METRICS)).toBe(originalData);
    expect(unfoldMetricsState(-5)).toEqual(unfoldMetricsState(0));
    expect(unfoldMetricsState(NaN)).toEqual(unfoldMetricsState(0));
    expect(unfoldMetricsState(Infinity)).toEqual(unfoldMetricsState(0));
    expect(unfoldMetricsState(50)).toEqual(unfoldMetricsState(32));
  });
});
