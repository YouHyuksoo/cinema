import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { drawProjectedFilmSurface, surfaceRasterSizeForFrame } from '../../../src/cinema/components/drawProjectedFilmSurface';
import { recordingCanvas } from '../support/recordingCanvas';
import { shouldRenderSmtEquipmentSurface, smtSurfaceFrameTime } from '../../../src/cinema/components/drawSmtFactory';

beforeEach(() => vi.stubGlobal('document', { createElement: () => {
  const { ctx } = recordingCanvas();
  return { width: 0, height: 0, getContext: () => ctx };
} }));
afterEach(() => vi.unstubAllGlobals());

describe('projected equipment artwork', () => {
  it('limits internal SMT equipment texture refreshes to twelve frames per second', () => {
    expect(smtSurfaceFrameTime(1)).toBe(1);
    expect(smtSurfaceFrameTime(1.04)).toBe(1);
    expect(smtSurfaceFrameTime(1.09)).toBeCloseTo(1.0833, 3);
  });
  it('keeps detailed perspective artwork on the selected cabinet only', () => {
    expect(shouldRenderSmtEquipmentSurface('L3-maoi','L3-maoi')).toBe(true);
    expect(shouldRenderSmtEquipmentSurface('L2-maoi','L3-maoi')).toBe(false);
    expect(shouldRenderSmtEquipmentSurface('L3-maoi',null)).toBe(false);
  });
  it('shares the largest raster only within one frame instead of ratcheting forever', () => {
    expect(surfaceRasterSizeForFrame({width:320,height:180},{width:900,height:500},true)).toEqual({width:900,height:500});
    expect(surfaceRasterSizeForFrame({width:320,height:180},{width:900,height:500},false)).toEqual({width:320,height:180});
  });
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
