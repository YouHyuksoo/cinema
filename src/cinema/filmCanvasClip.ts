import type { FilmViewportBounds } from './filmViewport';

/** Conservative pixel bounds of a logical clip; the canvas's real clip still trims edges. */
export function filmCanvasClip(ctx: CanvasRenderingContext2D, clip?: FilmViewportBounds): FilmViewportBounds {
  if (!clip) return { left: 0, top: 0, right: ctx.canvas.width, bottom: ctx.canvas.height };
  const t = ctx.getTransform();
  const points = [clip.left, clip.right].flatMap(x => [clip.top, clip.bottom]
    .map(y => ({ x: t.a * x + t.c * y + t.e, y: t.b * x + t.d * y + t.f })));
  return {
    left: Math.max(0, Math.floor(Math.min(...points.map(p => p.x)))),
    top: Math.max(0, Math.floor(Math.min(...points.map(p => p.y)))),
    right: Math.min(ctx.canvas.width, Math.ceil(Math.max(...points.map(p => p.x)))),
    bottom: Math.min(ctx.canvas.height, Math.ceil(Math.max(...points.map(p => p.y)))),
  };
}
