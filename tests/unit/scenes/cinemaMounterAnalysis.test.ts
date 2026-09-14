import { describe, expect, it } from 'vitest';
import { DEFAULT_MOUNTER_ANALYSIS, mounterAnalysisState, mounterTourState } from '@/cinema/mounterAnalysis';
import { activeChartStyle } from '@/cinema/drawMultiChartFilm';
import { drawMultiChartFilm } from '@/cinema/drawMultiChartFilm';
import { drawMounterAnalysisFilm } from '@/cinema/drawMounterAnalysisFilm';
import { canvasFixture } from '../support/canvasFixture';

describe('mounter multi-chart analysis', () => {
  it('normalizes heterogeneous units against each metric target', () => {
    const state = mounterAnalysisState(DEFAULT_MOUNTER_ANALYSIS);
    expect(state.mounters).toHaveLength(5);
    expect(state.mounters[0].metrics.map(metric => metric.label)).toEqual(['픽업률', '로스율', '인식 오류율', '사이클타임', '노즐 불량', '헤더 불량']);
    expect(state.metrics.find(metric => metric.id === 'M01-cycle-time')?.performance).toBeGreaterThan(100);
    expect(state.metrics.find(metric => metric.id === 'M01-loss-rate')?.performance).toBeLessThan(100);
  });

  it('holds and then moves sideways through at most five mounters', () => {
    expect(mounterTourState(5, 2)).toEqual({ focus: 0, activeIndex: 0 });
    expect(mounterTourState(5, 5)).toEqual({ focus: 1, activeIndex: 1 });
    expect(mounterTourState(8, 25).activeIndex).toBe(4);
  });

  it('cycles through all chart grammars and honors a manual choice', () => {
    expect([0, 5.1, 10.2, 15.3, 20.4].map(offset => activeChartStyle('auto', 1.5 + offset))).toEqual(['bar', 'line', 'area', 'scatter', 'pie']);
    expect(activeChartStyle('scatter', 99)).toBe('scatter');
  });

  it('renders the dedicated mounter machine and diagnostics without leaking canvas state', () => {
    const fixture = canvasFixture();
    drawMounterAnalysisFilm(fixture.ctx, 1280, 720, 8);
    expect(fixture.texts.map(text => text.value)).toContain('픽업률');
    expect(fixture.texts.map(text => text.value)).toContain('노즐 불량');
    expect(fixture.texts.map(text => text.value)).toContain('MOUNTER 02');
    expect(fixture.stack).toHaveLength(0);
  });

  it('renders every production chart form separately from the mounter scene', () => {
    for (const style of ['bar', 'line', 'area', 'scatter', 'pie'] as const) {
      for (const dimension of ['2d', '3d'] as const) {
        const fixture = canvasFixture();
        drawMultiChartFilm(fixture.ctx, 1280, 720, 8, undefined, { style, dimension, depthScale: 1 });
        expect(fixture.texts.map(text => text.value)).toContain('LINE 01');
        expect(fixture.stack, `${style} ${dimension}`).toHaveLength(0);
      }
    }
  });
});
