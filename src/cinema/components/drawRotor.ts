import { signalColor, smooth } from '../filmDrawing';
import { TAU } from '../gearGeometry';

export interface RotorOptions {
  x: number;
  y: number;
  /** The outer radius in the caller's canvas coordinate space. */
  radius: number;
  time: number;
  reveal?: number;
  speed?: number;
  heat?: number;
  variant?: 'segments' | 'orbit' | 'sweep';
}

function arc(ctx: CanvasRenderingContext2D, radius: number, from: number, to: number, heat: number, opacity: number) {
  ctx.beginPath(); ctx.arc(0, 0, radius, from, to);
  ctx.strokeStyle = signalColor(heat, opacity); ctx.stroke();
}

function ticks(ctx: CanvasRenderingContext2D, radius: number, count: number, phase: number, heat: number, opacity: number) {
  for (let index = 0; index < count; index++) {
    const angle = phase + index / count * TAU;
    const major = index % (count / 8) === 0;
    const inner = radius * (major ? .92 : .965);
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    ctx.strokeStyle = signalColor(heat, opacity * (major ? 1 : .4)); ctx.stroke();
  }
}

function segments(ctx: CanvasRenderingContext2D, radius: number, angle: number, heat: number) {
  ticks(ctx, radius, 64, angle * .12, heat, .48);
  const rings = [
    { radius: .89, count: 3, direction: 1, opacity: .65, arc: .72 },
    { radius: .77, count: 4, direction: -.73, opacity: .38, arc: .66 },
    { radius: .65, count: 2, direction: 1.23, opacity: .23, arc: .82 },
  ];
  for (const ring of rings) {
    const spacing = TAU / ring.count;
    const phase = angle * ring.direction;
    for (let index = 0; index < ring.count; index++) {
      const start = phase + index * spacing;
      arc(ctx, radius * ring.radius, start, start + spacing * ring.arc, heat, ring.opacity);
      const end = start + spacing * ring.arc;
      ctx.beginPath();
      ctx.moveTo(Math.cos(end) * radius * (ring.radius - .025), Math.sin(end) * radius * (ring.radius - .025));
      ctx.lineTo(Math.cos(end) * radius * ring.radius, Math.sin(end) * radius * ring.radius);
      ctx.strokeStyle = signalColor(heat, ring.opacity * .85); ctx.stroke();
    }
  }
  arc(ctx, radius * .89, angle - .15, angle, heat, .92);
}

function orbit(ctx: CanvasRenderingContext2D, radius: number, angle: number, heat: number) {
  for (let index = 0; index < 2; index++) {
    const tilt = (index === 0 ? -.64 : .64) + angle * (index === 0 ? .055 : -.055);
    const phase = angle * (index === 0 ? 1 : -1.17) + index * Math.PI;
    const rx = radius * .95, ry = radius * .43;
    ctx.save(); ctx.rotate(tilt);
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.strokeStyle = signalColor(heat, index === 0 ? .34 : .22); ctx.stroke();

    // The tapered arc belongs to the orbit, and its node follows that exact ellipse.
    for (let segment = 0; segment < 12; segment++) {
      const start = phase - .48 + segment * .04;
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, start, start + .045);
      ctx.strokeStyle = signalColor(heat, .1 + segment / 11 * .63); ctx.stroke();
    }
    const nodeX = Math.cos(phase) * rx, nodeY = Math.sin(phase) * ry;
    ctx.beginPath(); ctx.arc(nodeX, nodeY, Math.max(1.3, radius * .014), 0, TAU);
    ctx.fillStyle = signalColor(heat, .96); ctx.fill();
    ctx.beginPath(); ctx.arc(nodeX, nodeY, Math.max(3, radius * .029), 0, TAU);
    ctx.strokeStyle = signalColor(heat, .2); ctx.stroke();
    ctx.restore();
  }
}

function sweep(ctx: CanvasRenderingContext2D, radius: number, angle: number, heat: number) {
  ticks(ctx, radius, 48, -Math.PI / 2, heat, .54);
  arc(ctx, radius * .88, 0, TAU, heat, .21);
  const sweepAngle = angle - Math.PI / 2;
  const fanWidth = .64;
  for (let segment = 0; segment < 20; segment++) {
    const start = sweepAngle - fanWidth + segment / 20 * fanWidth;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius * .87, start, start + fanWidth / 20 + .003);
    ctx.closePath();
    ctx.fillStyle = signalColor(heat, .012 + segment / 19 * .085); ctx.fill();
  }
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(sweepAngle) * radius * .88, Math.sin(sweepAngle) * radius * .88);
  ctx.strokeStyle = signalColor(heat, .75); ctx.stroke();
  arc(ctx, radius * .88, sweepAngle - .2, sweepAngle, heat, .8);
  ctx.beginPath(); ctx.arc(0, 0, Math.max(1.2, radius * .012), 0, TAU);
  ctx.fillStyle = signalColor(heat, .66); ctx.fill();
}

/** Pure canvas decoration: all movement and the radial reveal follow the supplied time. */
export function drawRotor(ctx: CanvasRenderingContext2D, options: RotorOptions) {
  const { x, y, radius, time, speed = 1, variant = 'segments' } = options;
  const reveal = Math.max(0, Math.min(1, options.reveal ?? 1));
  const heat = Math.max(0, Math.min(1, options.heat ?? 0));
  if (reveal <= 0 || radius <= 0 || ![x, y, radius, time, speed, reveal, heat].every(Number.isFinite)) return;
  const angle = time * speed * .38;
  const extent = smooth(0, 1, reveal);
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha *= smooth(0, .3, reveal);
  ctx.lineWidth = Math.max(.65, Math.min(1.05, radius / 150));
  ctx.lineCap = 'butt'; ctx.lineJoin = 'round'; ctx.shadowBlur = 0;
  if (reveal < 1) {
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius + 1, -Math.PI / 2, -Math.PI / 2 + extent * TAU);
    ctx.closePath(); ctx.clip();
  }
  if (variant === 'orbit') orbit(ctx, radius, angle, heat);
  else if (variant === 'sweep') sweep(ctx, radius, angle, heat);
  else segments(ctx, radius, angle, heat);
  ctx.restore();
}
