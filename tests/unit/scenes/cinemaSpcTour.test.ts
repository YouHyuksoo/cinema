import { describe, expect, it } from 'vitest';
import { DEFAULT_SPC_DATA } from '@/cinema/spcData';
import { spcTour, spcTargetAnalysis } from '@/cinema/spcTour';
import { drawSpcFilm } from '@/cinema/drawSpcFilm';
import { feedToSceneDocuments } from '@/cinema/feedScenes';
import { canvasFixture } from '../support/canvasFixture';
import { sceneDataEntry } from '@/cinema/sceneDataRegistry';

describe('SPC simultaneous target tour', () => {
  it('uses different control-trace shapes for every seeded measurement, even after rescaling', () => {
    const shapes = DEFAULT_SPC_DATA.targets!.map(target => {
      const analysis = spcTargetAnalysis(target);
      if (!analysis.valid) throw new Error(analysis.reason);
      const values = analysis.xbar.values;
      const min = Math.min(...values), span = Math.max(...values) - min;
      return values.map(value => (value - min) / span);
    });
    for (let i = 0; i < shapes.length; i++) for (let j = i + 1; j < shapes.length; j++) {
      expect(Math.max(...shapes[i].map((value, k) => Math.abs(value - shapes[j][k])))).toBeGreaterThan(.1);
    }
  });
  it('visits every target in feed order during one chapter and wraps', () => {
    const count = DEFAULT_SPC_DATA.targets!.length;
    for (let i = 0; i < count; i++) {
      const tour = spcTour(DEFAULT_SPC_DATA, (i + .5) * 40 / count);
      expect(tour.index).toBe(i);
      expect(tour.target).toBe(DEFAULT_SPC_DATA.targets![i]);
      expect(spcTargetAnalysis(tour.target!)).toBe(spcTargetAnalysis(tour.target!));
    }
    expect(spcTour(DEFAULT_SPC_DATA, 40).index).toBe(0);
  });
  it('honors single and empty feeds without injecting demo measurements', () => {
    const single = { ...DEFAULT_SPC_DATA, targets: undefined };
    expect(spcTour(single, 30).target).toBe(single);
    expect(spcTour({ ...single, targets: [] }, 30).target).toBeUndefined();
  });
  it('keeps control, histogram and capability labels present for every target', () => {
    const count = DEFAULT_SPC_DATA.targets!.length;
    for (let i = 0; i < count; i++) {
      const { ctx, texts, stack } = canvasFixture();
      drawSpcFilm(ctx, 1280, 900, (i + .5) * 40 / count);
      const labels = texts.map(text => text.value).join('\n');
      expect(labels).toContain('실측 분포');
      expect(labels).toContain('Cpk 공정능력');
      expect(labels).toContain('X̄');
      expect(labels).toContain(DEFAULT_SPC_DATA.targets![i].name);
      expect(stack).toHaveLength(0);
    }
  });
  it('preserves target measurements through the quality feed adapter', () => {
    const [document] = feedToSceneDocuments('quality', { ...DEFAULT_SPC_DATA }, { source: 'demo', at: new Date().toISOString() });
    expect((document.data as typeof DEFAULT_SPC_DATA).targets).toBe(DEFAULT_SPC_DATA.targets);
  });
  it('rejects malformed targets and ambiguous partial updates', () => {
    const entry = sceneDataEntry('spc')!;
    expect(entry.normalize({ ...DEFAULT_SPC_DATA, targets: [{ id: 'broken' }] })).toBeUndefined();
    expect(entry.normalize({ ...DEFAULT_SPC_DATA, targets: [DEFAULT_SPC_DATA.targets![0], DEFAULT_SPC_DATA.targets![0]] })).toBeUndefined();
    expect(entry.patch!(DEFAULT_SPC_DATA, [{ id: 'SG-01', values: [1, 2] }]).error).toBeTruthy();
  });
});
