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
