import { describe, expect, it, vi } from 'vitest';
import { drawBarFilm } from '@/cinema/drawBarFilm';
import { DEFAULT_PRODUCTION_SNAPSHOT, type ProductionSnapshot } from '@/cinema/productionSnapshot';
import { recordingCanvas } from '../support/recordingCanvas';

vi.mock('@/cinema/components/drawProjectedFilmSurface', () => ({ drawProjectedFilmSurface: () => undefined }));

/**
 * Pins the exact draw-call sequence of the bar scene. A refactor that regroups the code must
 * leave every fingerprint untouched; only a deliberate visual change may update this snapshot.
 */
const fonts = { label: 'Label', mono: 'Mono' };
const lines = (count: number): ProductionSnapshot => ({ unit: 'EA', target: 800,
  lines: Array.from({ length: count }, (_, index) => ({ id: `L-${index + 1}`, label: `LINE ${index + 1}`, value: 500 + index * 37 })) });
const fingerprint = (time: number, snapshot = DEFAULT_PRODUCTION_SNAPSHOT, presentation?: { dimension: '2d' | '3d'; depthScale: number }) => {
  const canvas = recordingCanvas();
  drawBarFilm(canvas.ctx, 1280, 720, time, fonts, presentation, undefined, snapshot);
  return `${canvas.calls.length} calls · ${canvas.fingerprint()}`;
};

describe('bar scene draw-call fingerprint', () => {
  it.each([1.5, 8, 12.5, 14, 20, 26])('default snapshot at %ss', time => {
    expect(fingerprint(time)).toMatchSnapshot();
  });
  it.each([8, 14])('two lines at %ss', time => {
    expect(fingerprint(time, lines(2))).toMatchSnapshot();
  });
  it('twelve lines at 8s (compact headers)', () => {
    expect(fingerprint(8, lines(12))).toMatchSnapshot();
  });
  it('2D presentation at 8s', () => {
    expect(fingerprint(8, DEFAULT_PRODUCTION_SNAPSHOT, { dimension: '2d', depthScale: 1 })).toMatchSnapshot();
  });
  it('is deterministic for the same input', () => {
    expect(fingerprint(8)).toBe(fingerprint(8));
    expect(fingerprint(8)).not.toBe(fingerprint(8.1));
  });
});
