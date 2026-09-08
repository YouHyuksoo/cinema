import { signalColor } from '../filmDrawing';
import type { EnvironmentPoint } from '../environmentLayout';

/** A bright core, soft edge, and traveling marker emphasize the same attached path. */
export function drawEnvironmentLink(ctx: CanvasRenderingContext2D, points: readonly EnvironmentPoint[],
  alpha: number, heat: number, time: number, width = 1.8) {
  if (points.length < 2 || alpha <= .001) return;
  ctx.save();
  ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
  ctx.strokeStyle = signalColor(heat, alpha * .15); ctx.lineWidth = width + 4; ctx.stroke();
  ctx.strokeStyle = signalColor(heat, alpha * .92); ctx.lineWidth = width;
  ctx.shadowColor = signalColor(heat, .8); ctx.shadowBlur = 7; ctx.stroke(); ctx.shadowBlur = 0;
  const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
  let travel = ((time * .8) % 1 + 1) % 1 * lengths.reduce((sum, length) => sum + length, 0);
  for (let index = 0; index < lengths.length; index++) {
    if (travel <= lengths[index] && lengths[index] > .001) {
      const fraction = travel / lengths[index], from = points[index], to = points[index + 1];
      ctx.beginPath(); ctx.arc(from.x + (to.x - from.x) * fraction, from.y + (to.y - from.y) * fraction, 2.7, 0, Math.PI * 2);
      ctx.fillStyle = signalColor(heat, alpha); ctx.fill(); break;
    }
    travel -= lengths[index];
  }
  for (const point of [points[0], points[points.length - 1]]) {
    ctx.beginPath(); ctx.arc(point.x, point.y, 3, 0, Math.PI * 2); ctx.fillStyle = signalColor(heat, alpha); ctx.fill();
    ctx.beginPath(); ctx.arc(point.x, point.y, 5.5, 0, Math.PI * 2); ctx.lineWidth = .8;
    ctx.strokeStyle = signalColor(heat, alpha * .5); ctx.stroke();
  }
  ctx.restore();
}
