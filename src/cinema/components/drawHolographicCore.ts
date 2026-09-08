import { createCoreProjection, CORE_OUTER_RADIUS } from '../cornerCoreGeometry';
import { filmText, signalColor, smooth, type FilmFonts } from '../filmDrawing';

export interface HolographicCoreOptions {
  time: number;
  reveal: number;
  opacity: number;
  title: string;
  label: string;
  value: string;
  unit: string;
  progress: number;
  progressLabel?: string;
  detail: string;
  eyebrow?: string;
  status?: string;
}

const TAU = Math.PI * 2;
type Projection = ReturnType<typeof createCoreProjection>;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

function arc(ctx: CanvasRenderingContext2D, plane: Projection, radius: number, z: number,
  start: number, end: number) {
  ctx.beginPath();
  const steps = Math.max(2, Math.ceil(Math.abs(end - start) * 24));
  for (let index = 0; index <= steps; index++) {
    const point = plane.ring(start + (end - start) * index / steps, radius, z);
    if (index === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
}

function housing(ctx: CanvasRenderingContext2D, plane: Projection, time: number, assembly: number) {
  ctx.lineCap = 'butt';
  for (let index = 0; index < 4; index++) {
    const start = index * TAU / 4 + .085;
    ctx.strokeStyle = signalColor(0, .28); ctx.lineWidth = .8;
    arc(ctx, plane, CORE_OUTER_RADIUS, 0, start, start + (TAU / 4 - .17) * assembly);
    ctx.strokeStyle = signalColor(0, .09);
    arc(ctx, plane, 181, 18, start, start + (TAU / 4 - .2) * assembly);
  }
  for (let index = 0; index < 80 * assembly; index++) {
    const angle = index / 80 * TAU - time * .028;
    const major = index % 10 === 0;
    const a = plane.ring(angle, major ? 161 : 167, 10), b = plane.ring(angle, 172, 10);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = signalColor(0, major ? .62 : .2); ctx.lineWidth = major ? 2.2 : 1; ctx.stroke();
  }
  ctx.strokeStyle = signalColor(0, .14); ctx.lineWidth = .7;
  arc(ctx, plane, 157, 20, 0, TAU * assembly);
  for (let index = 0; index < 6; index++) {
    const start = index * TAU / 6 + time * .055;
    ctx.strokeStyle = signalColor(0, index % 2 ? .2 : .48); ctx.lineWidth = index % 2 ? 1 : 3;
    arc(ctx, plane, 177, -7, start, start + .21 * assembly);
  }
  // Short diagonal registration marks keep the optical field open.
  for (const angle of [.78, 2.36, 3.92, 5.5]) {
    for (const offset of [-.014, .014]) {
      const a = plane.ring(angle + offset, 200, 0), b = plane.ring(angle + offset, 209, 0);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = signalColor(0, .35); ctx.lineWidth = .8; ctx.stroke();
    }
  }
}

function plasma(ctx: CanvasRenderingContext2D, plane: Projection, time: number, assembly: number) {
  const phase = time * .56;
  // A translucent side wall joins the rear and front rim on the same projected cylinder.
  const sides = Array.from({ length: 96 }, (_, index) => {
    const angle = index / 96 * TAU;
    return { angle, depth: plane.ring(angle, 138, 0).depth };
  }).sort((a, b) => b.depth - a.depth);
  for (const { angle } of sides) {
    if (angle > TAU * assembly) continue;
    const next = angle + TAU / 96 + .002;
    const points = [plane.ring(angle, 139, 18), plane.ring(next, 139, 18),
      plane.ring(next, 139, -18), plane.ring(angle, 139, -18)];
    ctx.beginPath(); points.forEach((p, index) => index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
    ctx.fillStyle = `rgba(115,70,240,${.045 + (.5 + .5 * Math.sin(angle)) * .07})`; ctx.fill();
  }
  ctx.strokeStyle = 'rgba(103,78,255,.42)'; ctx.lineWidth = 1.5;
  arc(ctx, plane, 139, 18, 0, TAU * assembly);

  ctx.save();
  const glow = ctx.createRadialGradient(0, 0, 104, 0, 0, 162);
  glow.addColorStop(0, 'rgba(104,28,255,0)'); glow.addColorStop(.35, 'rgba(125,30,255,.06)');
  glow.addColorStop(.58, 'rgba(159,43,255,.32)'); glow.addColorStop(.73, 'rgba(156,44,255,.1)');
  glow.addColorStop(1, 'rgba(112,38,255,0)');
  ctx.fillStyle = glow; ctx.fillRect(-166, -166, 332, 332);

  const outer: { x: number; y: number }[] = [], inner: typeof outer = [];
  const count = Math.max(2, Math.round(240 * assembly));
  for (let index = 0; index <= count; index++) {
    const angle = index / count * TAU * assembly - Math.PI / 2;
    const surge = Math.pow(.5 + .5 * Math.cos(angle * 3 - phase), 9);
    const ripple = Math.sin(angle * 17 + time * 1.6) * .9 + Math.sin(angle * 31 - time * 1.1) * .45;
    outer.push(plane.ring(angle, 137 + ripple + surge * 2, -18));
    inner.push(plane.ring(angle, 129 + ripple * .5 - surge * 14, -18));
  }
  ctx.beginPath(); outer.forEach((p, index) => index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  for (let index = inner.length - 1; index >= 0; index--) ctx.lineTo(inner[index].x, inner[index].y);
  ctx.closePath();
  const energy = ctx.createLinearGradient(-130, -110, 130, 110);
  energy.addColorStop(0, '#8b4bff'); energy.addColorStop(.28, '#e470ff'); energy.addColorStop(.53, '#a333ff');
  energy.addColorStop(.77, '#f2a6ff'); energy.addColorStop(1, '#8138ff');
  ctx.fillStyle = energy; ctx.shadowColor = '#a839ff'; ctx.shadowBlur = 17; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.beginPath(); outer.forEach((p, index) => index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.strokeStyle = 'rgba(251,211,255,.9)'; ctx.lineWidth = 1.15; ctx.stroke();
  ctx.beginPath(); inner.forEach((p, index) => index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.strokeStyle = 'rgba(210,146,255,.8)'; ctx.lineWidth = .65; ctx.stroke();

  // Fine moving filaments sit above the translucent band, like light in a glass channel.
  for (let layer = 0; layer < 3; layer++) {
    ctx.beginPath();
    for (let index = 0; index <= count; index++) {
      const angle = index / count * TAU * assembly - Math.PI / 2;
      const radius = 131 + layer * 2.1 + Math.sin(angle * (11 + layer * 3) - time * (1.2 + layer * .15)) * 1.15;
      const p = plane.ring(angle, radius, -19 - layer);
      if (index === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = layer === 1 ? 'rgba(255,220,255,.62)' : 'rgba(202,120,255,.6)';
    ctx.lineWidth = layer === 1 ? .65 : .45; ctx.stroke();
  }

  for (let index = 0; index < 3; index++) {
    const angle = phase / 3 + index * TAU / 3;
    ctx.strokeStyle = 'rgba(255,237,255,.94)'; ctx.lineWidth = 2.3;
    arc(ctx, plane, 137.5, -19, angle - .065, angle + .065 * assembly);
  }
  ctx.restore();
}

/** Reusable optical core. The caller controls position, zoom and its shared scene clock. */
export function drawHolographicCore(ctx: CanvasRenderingContext2D, fonts: FilmFonts, options: HolographicCoreOptions) {
  const { time } = options;
  const alpha = ctx.globalAlpha * clamp(options.opacity) * clamp(options.reveal);
  if (!Number.isFinite(time) || time < 0 || alpha <= .001) return;
  const plane = createCoreProjection(time);
  const assembly = smooth(0, 1.25, time);
  ctx.save(); ctx.globalAlpha = alpha; ctx.setLineDash([]); ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = 'source-over'; ctx.lineJoin = 'round'; ctx.textBaseline = 'alphabetic';
  housing(ctx, plane, time, assembly);
  plasma(ctx, plane, time, assembly);

  for (let index = 0; index < 64 * assembly; index++) {
    const angle = index / 64 * TAU + time * .025;
    const a = plane.ring(angle, 105, -22), b = plane.ring(angle, index % 8 === 0 ? 112 : 108, -22);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = signalColor(0, index % 8 ? .14 : .46); ctx.lineWidth = .8; ctx.stroke();
  }
  const progress = Number.isFinite(options.progress) ? clamp(options.progress) : 0;
  ctx.strokeStyle = signalColor(0, .1); ctx.lineWidth = 2;
  arc(ctx, plane, 98, -25, -Math.PI / 2, TAU * assembly - Math.PI / 2);
  ctx.strokeStyle = signalColor(0, .54); ctx.lineWidth = 2;
  arc(ctx, plane, 98, -25, -Math.PI / 2, -Math.PI / 2 + TAU * progress * smooth(.5, 1.8, time));

  const read = smooth(.35, 1.45, time), face = plane.point(0, 0, -30);
  ctx.save(); ctx.translate(face.x, face.y);
  const text = (value: string, y: number, size: number, strength: number, mono = false, color = signalColor(0, 1)) =>
    filmText(ctx, fonts, value, 0, y, size, alpha * read * strength, mono, 'center', color);
  text(options.title, -61, 15, .85);
  text(options.label, -35, 12, .6);
  ctx.font = `65px ${fonts.mono}`;
  const valueSize = Math.min(65, 152 / Math.max(1, ctx.measureText(options.value).width) * 65);
  text(options.value, 26, valueSize, 1, true, '#f5edff');
  text(options.unit, 46, 12, .72, true);
  text(options.progressLabel ?? `${(progress * 100).toFixed(1)}% 달성`, 73, 12, .9, true);
  ctx.restore();
  filmText(ctx, fonts, options.eyebrow ?? 'SIGNAL / CORE', 0, -204, 10, alpha * read * .5, true, 'center');
  if (options.status) filmText(ctx, fonts, options.status, 0, 195, 11, alpha * read * .62, false, 'center', signalColor(.35, 1));
  filmText(ctx, fonts, options.detail, 0, 215, 12, alpha * read * .72, true, 'center', signalColor(0, 1));
  ctx.restore();
}
