import { signalColor } from '../filmDrawing';
import type { SpcControlSeries } from '../spcTypes';

interface Point { x: number; y: number }
interface ControlTraceOptions {
  points: readonly Point[];
  series: SpcControlSeries;
  head: number;
  baseline: number;
  upperY: number;
  lowerY: number;
  top: number;
  bottom: number;
  selected: number | null;
  focus: number;
  time: number;
}

/** The front edge stays at each measured value; light and depth sit behind that edge. */
export function drawSpcControlTrace(ctx: CanvasRenderingContext2D, options: ControlTraceOptions) {
  const { points, series, head, baseline, upperY, lowerY, top, bottom, selected, focus, time } = options;
  if (!points.length) return;
  const last = Math.min(points.length - 1, Math.floor(head));
  const a = points[last], b = points[Math.min(last + 1, points.length - 1)];
  const portion = head - last;
  const tip = { x: a.x + (b.x - a.x) * portion, y: a.y + (b.y - a.y) * portion };
  const visible = points.slice(0, last + 1);
  if (last < points.length - 1) visible.push(tip);
  const path = (offsetX = 0, offsetY = 0) => {
    ctx.beginPath();
    visible.forEach((point, index) => index ? ctx.lineTo(point.x + offsetX, point.y + offsetY)
      : ctx.moveTo(point.x + offsetX, point.y + offsetY));
  };

  ctx.save(); ctx.setLineDash([]); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const body = ctx.createLinearGradient(0, top, 0, bottom);
  body.addColorStop(0, signalColor(0, .29)); body.addColorStop(.65, signalColor(0, .09));
  body.addColorStop(1, signalColor(0, .015));
  path(); ctx.lineTo(tip.x, baseline); ctx.lineTo(points[0].x, baseline); ctx.closePath();
  ctx.fillStyle = body; ctx.fill();

  // Subgroup stems make the sampling rhythm visible without adding interpolated observations.
  for (let index = 0; index <= last; index++) {
    const point = points[index], heat = series.violations[index] ? 1 : 0;
    ctx.beginPath(); ctx.moveTo(point.x, baseline); ctx.lineTo(point.x, point.y);
    ctx.strokeStyle = signalColor(heat, heat ? .52 : .18); ctx.lineWidth = heat ? 1.7 : 1; ctx.stroke();
  }
  path();
  for (let index = visible.length - 1; index >= 0; index--) ctx.lineTo(visible[index].x + 3, visible[index].y + 5);
  ctx.closePath(); ctx.fillStyle = signalColor(0, .12); ctx.fill();
  path(3, 5); ctx.strokeStyle = signalColor(0, .16); ctx.lineWidth = 1; ctx.stroke();
  path(); ctx.strokeStyle = signalColor(0, .13); ctx.lineWidth = 8; ctx.stroke();
  ctx.strokeStyle = signalColor(0, .97); ctx.lineWidth = 2.25; ctx.stroke();

  // Warm edges identify the actual segments touching an out-of-control observation.
  for (let index = 1; index < visible.length; index++) {
    if (!series.violations[index - 1] && !series.violations[index]) continue;
    ctx.beginPath(); ctx.moveTo(visible[index - 1].x, visible[index - 1].y);
    ctx.lineTo(visible[index].x, visible[index].y);
    ctx.strokeStyle = signalColor(1, .98); ctx.lineWidth = 2.5; ctx.stroke();
  }

  if (head < points.length - 1) {
    const scan = ctx.createLinearGradient(tip.x - 24, 0, tip.x, 0);
    scan.addColorStop(0, signalColor(0, 0)); scan.addColorStop(1, signalColor(0, .16));
    ctx.fillStyle = scan; ctx.fillRect(Math.max(points[0].x, tip.x - 24), top,
      Math.min(24, tip.x - points[0].x), bottom - top);
    ctx.beginPath(); ctx.moveTo(tip.x, top); ctx.lineTo(tip.x, bottom);
    ctx.strokeStyle = signalColor(0, .32); ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(tip.x, tip.y, 5, 0, Math.PI * 2);
    ctx.shadowColor = signalColor(0, 1); ctx.shadowBlur = 14;
    ctx.fillStyle = signalColor(0, 1); ctx.fill(); ctx.shadowBlur = 0;
  }

  for (let index = 0; index <= last; index++) {
    const point = points[index], heat = series.violations[index] ? 1 : 0;
    ctx.beginPath(); ctx.arc(point.x, point.y, heat ? 4.4 : 3.1, 0, Math.PI * 2);
    ctx.fillStyle = signalColor(heat, 1); ctx.fill();
    if (heat) {
      ctx.beginPath(); ctx.arc(point.x, point.y, 7.5, 0, Math.PI * 2);
      ctx.strokeStyle = signalColor(1, .66); ctx.lineWidth = 1.2; ctx.stroke();
    }
    if (index !== selected || focus <= .001) continue;
    const pulse = .5 + .5 * Math.sin(time * 3.2);
    const radius = 12 + pulse * 4;
    ctx.strokeStyle = signalColor(heat, focus * .85); ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      ctx.moveTo(point.x + sx * radius, point.y + sy * (radius - 5));
      ctx.lineTo(point.x + sx * radius, point.y + sy * radius);
      ctx.lineTo(point.x + sx * (radius - 5), point.y + sy * radius);
    }
    ctx.stroke();
    if (heat) {
      const limitY = series.values[index] > series.upper ? upperY : lowerY;
      ctx.beginPath(); ctx.moveTo(point.x + 20, point.y); ctx.lineTo(point.x + 20, limitY);
      ctx.moveTo(point.x + 16, point.y); ctx.lineTo(point.x + 24, point.y);
      ctx.moveTo(point.x + 16, limitY); ctx.lineTo(point.x + 24, limitY);
      ctx.strokeStyle = signalColor(1, focus * .65); ctx.lineWidth = 1; ctx.stroke();
    }
  }
  ctx.restore();
}
