import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { drawProjectedFilmSurface } from '../../../src/cinema/components/drawProjectedFilmSurface';
import { recordingCanvas } from '../support/recordingCanvas';

beforeEach(() => vi.stubGlobal('document', { createElement: () => {
  const { ctx } = recordingCanvas();
  return { width: 0, height: 0, getContext: () => ctx };
} }));
afterEach(() => vi.unstubAllGlobals());

describe('projected equipment artwork', () => {
  it('shares a frame across repeated equipment, and refreshes when time or detail changes', () => {
    const { ctx } = recordingCanvas(), draw = vi.fn();
    const paint = (time: number, scale = 1) => drawProjectedFilmSurface(ctx, {
      width: 100, height: 100, project: (x, y) => ({ x: 300 + x * scale, y: 300 + y * scale }),
      draw, cache: { key: 'loader', time },
    });
    paint(1); paint(1); paint(1);
    expect(draw).toHaveBeenCalledTimes(1);
    paint(2);
    expect(draw).toHaveBeenCalledTimes(2);
    paint(2, 2);
    expect(draw).toHaveBeenCalledTimes(3);
    paint(2, 1);
    expect(draw).toHaveBeenCalledTimes(3);
  });
  it('does not rasterize artwork wholly outside the canvas', () => {
    const { ctx } = recordingCanvas(), draw = vi.fn();
    drawProjectedFilmSurface(ctx, { width: 100, height: 100,
      project: (x, y) => ({ x: x - 500, y }), draw });
    expect(draw).not.toHaveBeenCalled();
  });
});
