import { gearOutline, TAU, type Gear } from '../gearGeometry';
import { signalColor } from '../filmDrawing';

/** Reusable rotating gear rim. The angle belongs to the caller's shared clock. */
export function drawGear(ctx: CanvasRenderingContext2D, gear: Gear, reveal = 1, heat = 0, drive = false, thickness = 0) {
  const visibility = Math.max(0, Math.min(1, reveal));
  const { x, y, radius, angle, teeth } = gear;
  if (visibility <= .001 || radius <= 0 || teeth < 3 || ![x, y, radius, angle, teeth, visibility].every(Number.isFinite)) return;
  const inset = Math.min(1, radius / 72);
  ctx.save(); ctx.globalAlpha *= visibility; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, radius + 18, -Math.PI / 2, -Math.PI / 2 + TAU * visibility); ctx.closePath(); ctx.clip();
  const points = gearOutline(gear);
  const rimDepth = Math.max(0, Math.min(14, thickness));
  if (rimDepth > .01) {
    const dx = rimDepth * .45, dy = rimDepth;
    ctx.beginPath();
    points.forEach(([px, py], i) => i ? ctx.lineTo(px + dx, py + dy) : ctx.moveTo(px + dx, py + dy));
    ctx.closePath(); ctx.strokeStyle = signalColor(heat, .24); ctx.lineWidth = 1; ctx.stroke();
    for (let i = 0; i < points.length; i += 6) {
      const [px, py] = points[i];
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + dx, py + dy);
      ctx.strokeStyle = signalColor(heat, .18); ctx.lineWidth = .7; ctx.stroke();
    }
  }
  ctx.beginPath(); points.forEach(([px, py], i) => { if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py); }); ctx.closePath();
  ctx.moveTo(x + radius - 15 * inset, y); ctx.arc(x, y, radius - 15 * inset, 0, TAU, true);
  ctx.fillStyle = signalColor(heat, .075); ctx.fill('evenodd');
  ctx.strokeStyle = signalColor(heat, .9); ctx.lineWidth = 1;
  ctx.shadowColor = signalColor(heat, .4); ctx.shadowBlur = 5; ctx.stroke(); ctx.shadowBlur = 0;
  for (let i = 0; i < teeth; i++) {
    const a = angle + i / teeth * TAU;
    const inner = radius - (i % 4 === 0 ? 30 : 25) * inset;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner);
    ctx.lineTo(x + Math.cos(a) * (radius - 20 * inset), y + Math.sin(a) * (radius - 20 * inset));
    ctx.strokeStyle = signalColor(heat, i % 4 === 0 ? .65 : .25); ctx.lineWidth = 1; ctx.stroke();
  }
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.arc(x, y, radius - 36 * inset, angle + i * TAU / 3, angle + i * TAU / 3 + .82);
    ctx.strokeStyle = signalColor(heat, .35); ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(x, y, radius - 44 * inset, 0, TAU); ctx.strokeStyle = signalColor(heat, .10); ctx.lineWidth = .7; ctx.stroke();
  if (drive) {
    ctx.beginPath(); ctx.arc(x, y, radius - 47 * inset, -.3, -.3 + heat * 1.4 + .6);
    ctx.strokeStyle = signalColor(heat, .65); ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.restore();
}
