import { filmText, signalColor, smooth, type FilmFonts } from '../filmDrawing';

export interface TargetReticleOptions {
  /** Center of the target in the caller's canvas coordinate space. */
  x: number;
  y: number;
  /** Nominal bracket bounds once the target is locked. */
  width: number;
  height: number;
  time: number;
  reveal?: number;
  lock?: number;
  heat?: number;
  label?: string;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Trace a corner from its vertical tip, through the corner, to its horizontal tip. */
function bracket(ctx: CanvasRenderingContext2D, x: number, y: number, sx: number, sy: number,
  length: number, progress: number) {
  const distance = clamp(progress) * length * 2;
  ctx.beginPath(); ctx.moveTo(x, y - sy * length);
  ctx.lineTo(x, y - sy * (length - Math.min(distance, length)));
  if (distance > length) ctx.lineTo(x - sx * (distance - length), y);
  ctx.stroke();
}

/** Transparent focus marks; reveal, scanning and lock-in are entirely driven by supplied values. */
export function drawTargetReticle(ctx: CanvasRenderingContext2D, fonts: FilmFonts, options: TargetReticleOptions) {
  const { x, y, width, height, time } = options;
  const reveal = clamp(options.reveal ?? smooth(0, .8, time));
  const lock = clamp(options.lock ?? 0);
  const heat = clamp(options.heat ?? 0);
  if (time < 0 || width <= 0 || height <= 0 || reveal <= 0 ||
    ![x, y, width, height, time, reveal, lock, heat].every(Number.isFinite)) return;

  const settle = smooth(0, 1, lock);
  const margin = Math.min(10, Math.min(width, height) * .065) * (1 - settle);
  const halfWidth = width / 2 + margin, halfHeight = height / 2 + margin;
  const cornerLength = Math.min(36, Math.min(width, height) * .2);
  const lineReveal = smooth(0, 1, reveal);
  const fontSize = Math.max(11, Math.min(14, width / 15));

  ctx.save(); ctx.translate(x, y);
  ctx.globalAlpha *= smooth(0, .25, reveal);
  const alpha = ctx.globalAlpha;
  ctx.setLineDash([]); ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  ctx.shadowBlur = 0; ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = 1.15;
  ctx.strokeStyle = signalColor(heat, .65 + settle * .3);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const;
  corners.forEach(([sx, sy], index) => {
    bracket(ctx, sx * halfWidth, sy * halfHeight, sx, sy, cornerLength,
      clamp((lineReveal - index * .045) / (1 - index * .045)));
  });

  // A broken ring has an empty center, leaving the tracked object visible.
  const radius = Math.min(width, height) * .27;
  const phase = time * .32;
  ctx.lineWidth = .8; ctx.strokeStyle = signalColor(heat, .2 * lineReveal);
  for (let index = 0; index < 4; index++) {
    const start = index * Math.PI / 2 + phase + .22;
    ctx.beginPath(); ctx.arc(0, 0, radius, start, start + .48 * lineReveal); ctx.stroke();
  }

  const marks = smooth(.25, 1, reveal);
  ctx.strokeStyle = signalColor(heat, (.38 + settle * .25) * marks);
  for (const direction of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(direction * (radius + 5), 0); ctx.lineTo(direction * (radius + 13), 0);
    ctx.moveTo(0, direction * (radius + 5)); ctx.lineTo(0, direction * (radius + 13));
    ctx.stroke();
  }

  // The sweep fades out as the target settles, without retaining an animation clock.
  if (settle < 1) {
    const scanY = Math.sin(time * 2.25) * Math.max(0, halfHeight - 9);
    ctx.strokeStyle = signalColor(heat, .28 * (1 - settle) * marks);
    ctx.beginPath(); ctx.moveTo(-halfWidth + 7, scanY); ctx.lineTo(halfWidth - 7, scanY); ctx.stroke();
    ctx.strokeStyle = signalColor(heat, .65 * (1 - settle) * marks);
    for (const direction of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(direction * (halfWidth + 3), scanY);
      ctx.lineTo(direction * (halfWidth + 8), scanY); ctx.stroke();
    }
  }

  // Graduated edges resolve only after focus, suggesting a measured target extent.
  ctx.strokeStyle = signalColor(heat, .5 * settle * marks);
  for (let index = -3; index <= 3; index++) {
    const tickX = index * width / 10;
    const tickLength = index === 0 ? 7 : 3;
    ctx.beginPath();
    ctx.moveTo(tickX, halfHeight); ctx.lineTo(tickX, halfHeight - tickLength);
    ctx.stroke();
  }
  for (const direction of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(direction * halfWidth, -height * .12);
    ctx.lineTo(direction * halfWidth, height * .12);
    ctx.moveTo(direction * halfWidth, 0);
    ctx.lineTo(direction * (halfWidth - 6), 0); ctx.stroke();
  }

  ctx.font = `${fontSize}px ${fonts.mono}`;
  const label = options.label ?? (lock >= .95 ? 'TARGET LOCK' : 'ACQUIRING');
  const characters = Array.from(label);
  let visible = label;
  while (characters.length && ctx.measureText(visible).width > width) {
    characters.pop(); visible = characters.length ? characters.join('') + '…' : '';
  }
  filmText(ctx, fonts, visible, -halfWidth, -halfHeight - 10, fontSize,
    alpha * marks * (.55 + settle * .3), true, 'left', signalColor(heat, 1));
  ctx.restore();
}
