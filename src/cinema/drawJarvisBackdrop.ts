import type { FilmViewportBounds } from './filmViewport';
import { signalColor } from './filmDrawing';
import { getFilmContextTheme } from './filmThemeCanvas';

interface BackdropGradients { key: string; field: CanvasGradient; glow: CanvasGradient }
const gradients = new WeakMap<CanvasRenderingContext2D, BackdropGradients>();
const STAR_DIM = signalColor(0, .06);
const STAR_WARM = signalColor(.8, .06);

/** The two backdrop gradients depend only on the viewport size and palette; rebuild them on change, not per frame. */
function backdropGradients(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const key = `${width}x${height}|${getFilmContextTheme(ctx)}`;
  const cached = gradients.get(ctx);
  if (cached?.key === key) return cached;
  const field = ctx.createRadialGradient(640, 320, 10, 640, 320, Math.max(width, height) * .6);
  field.addColorStop(0, '#0a141f'); field.addColorStop(.45, '#040a10'); field.addColorStop(1, '#010307');
  const glow = ctx.createRadialGradient(640, 320, 0, 640, 320, 260);
  glow.addColorStop(0, signalColor(.1, .04)); glow.addColorStop(1, signalColor(0, 0));
  const created = { key, field, glow };
  gradients.set(ctx, created);
  return created;
}

export function drawJarvisBackdrop(ctx: CanvasRenderingContext2D, view: FilmViewportBounds, time: number) {
  const width = view.right - view.left, height = view.bottom - view.top;
  ctx.fillStyle = '#020509'; ctx.fillRect(view.left, view.top, width, height);
  const { field, glow } = backdropGradients(ctx, width, height);
  ctx.fillStyle = field; ctx.fillRect(view.left, view.top, width, height);
  ctx.fillStyle = glow; ctx.fillRect(380, 60, 520, 520);
  for (let i = 0; i < 32; i++) {
    const x = view.left + (i * 137.2 + time * .9) % width;
    const y = view.top + (i * 273.7) % height;
    ctx.fillStyle = i % 3 ? STAR_DIM : STAR_WARM;
    ctx.fillRect(x, y, 1, 1);
  }
}
