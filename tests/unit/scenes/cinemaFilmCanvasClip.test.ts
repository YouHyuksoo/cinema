import { describe, expect, it } from 'vitest';
import { filmCanvasClip } from '@/cinema/filmCanvasClip';

const context = (transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) => ({
  canvas: { width: 1920, height: 1080 }, getTransform: () => transform,
}) as unknown as CanvasRenderingContext2D;

describe('visible canvas region', () => {
  it('keeps the full viewport for scenes without a clip', () => {
    expect(filmCanvasClip(context())).toEqual({ left: 0, top: 0, right: 1920, bottom: 1080 });
  });
  it('maps the translated bird-view clip into physical pixels without reducing detail', () => {
    expect(filmCanvasClip(context({ a: 1.5, b: 0, c: 0, d: 1.5, e: 0, f: 72 }),
      { left: 145, top: 150, right: 1135, bottom: 562 }))
      .toEqual({ left: 217, top: 297, right: 1703, bottom: 915 });
  });
  it('contains all rotated corners and clamps them to the canvas', () => {
    expect(filmCanvasClip(context({ a: 0, b: 1, c: -1, d: 0, e: 50, f: 0 }),
      { left: 10, top: 0, right: 100, bottom: 200 }))
      .toEqual({ left: 0, top: 10, right: 50, bottom: 100 });
  });
});
