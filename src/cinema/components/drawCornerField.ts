import { signalColor } from '../filmDrawing';
import type { FilmViewportBounds } from '../filmViewport';

/** A continuous optical field extends beyond the composition and behind its dock. */
export function drawCornerField(ctx: CanvasRenderingContext2D, view: FilmViewportBounds, time: number, emphasis: number) {
  const width = view.right - view.left, height = view.bottom - view.top;
  const extent = Math.hypot(width, height);
  ctx.fillStyle = '#040b10'; ctx.fillRect(view.left, view.top, width, height);
  const wash = ctx.createRadialGradient(640, 350, 20, 640, 350, extent * .67);
  wash.addColorStop(0, '#12303b'); wash.addColorStop(.4, '#081a24'); wash.addColorStop(1, '#02070c');
  ctx.fillStyle = wash; ctx.fillRect(view.left, view.top, width, height);
  ctx.save(); ctx.lineWidth = .55;

  // Sparse, faint arcs suggest depth; the optical wash carries the space.
  const vanishing = { x: 640 + Math.sin(time * .11) * 16, y: 350 + Math.cos(time * .09) * 7 };
  for (let index = 0; index < 4; index++) {
    const layer = 3 + index * 4;
    const depth = 1 + layer * .23;
    const spread = 145 + layer * layer * 6;
    ctx.beginPath();
    ctx.moveTo(view.left, vanishing.y + spread / depth);
    ctx.bezierCurveTo(vanishing.x - width * .3, vanishing.y + spread * .3,
      vanishing.x + width * .3, vanishing.y + spread * .3, view.right, vanishing.y + spread / depth);
    ctx.strokeStyle = signalColor(0, .008 + index * .002); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(view.left, vanishing.y - spread / depth);
    ctx.bezierCurveTo(vanishing.x - width * .3, vanishing.y - spread * .3,
      vanishing.x + width * .3, vanishing.y - spread * .3, view.right, vanishing.y - spread / depth);
    ctx.stroke();
  }

  for (let index = 0; index < 64; index++) {
    const depth = .4 + (index * .173 % 1.6);
    const x = view.left + ((index * 137.5 + time * (1 + depth * 3)) % width + width) % width;
    const y = view.top + (index * 233.7 % height) + Math.sin(time * .14 + index) * 4;
    const size = .5 + depth * .6;
    ctx.fillStyle = signalColor(0, .06 + depth * .025); ctx.fillRect(x, y, size, size);
  }

  // A broad light response establishes the focal plane without enclosing a second screen.
  const light = ctx.createRadialGradient(640, 350, 35, 640, 350, 400);
  light.addColorStop(0, signalColor(0, .025 + emphasis * .024));
  light.addColorStop(1, signalColor(0, 0));
  ctx.fillStyle = light; ctx.fillRect(view.left, view.top, width, height);
  ctx.restore();
}
