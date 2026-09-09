import { filmText, fitText, signalColor, smooth, type FilmFonts } from '../filmDrawing';
import { CORNER_CARD_SIZE, type CornerItem } from '../cornerSequence';

export type CornerReadoutItem = Omit<CornerItem, 'corner'>;

export interface CornerReadoutOptions {
  item: CornerReadoutItem;
  time: number;
  reveal: number;
  opacity: number;
  parkProgress: number;
}

const TAU = Math.PI * 2;
const unit = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

function surfaceBounds(width: number, height: number) {
  return { left: -width / 2 + 12, right: width / 2 - 18, top: -height / 2 + 11, bottom: height / 2 - 15 };
}

/** Use the optical face itself as the connection anchor, including its inset from the clip. */
export function cornerReadoutEdge(_kind: 'reading', side: -1 | 1, y = 0) {
  const bounds = surfaceBounds(CORNER_CARD_SIZE.width, CORNER_CARD_SIZE.height);
  return { x: side < 0 ? bounds.left : bounds.right, y };
}

function opticalSurface(ctx: CanvasRenderingContext2D, width: number, height: number, heat: number) {
  const { left, right, top, bottom } = surfaceBounds(width, height);
  const points = [[left + 14, top], [right - 16, top], [right, top + 16], [right, bottom - 14],
    [right - 14, bottom], [left + 14, bottom], [left, bottom - 14], [left, top + 14]];
  const lower = points.slice(3, 7);
  ctx.beginPath(); ctx.moveTo(lower[0][0], lower[0][1]);
  lower.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
  lower.toReversed().forEach(([x, y]) => ctx.lineTo(x + 6, y + 7));
  ctx.closePath(); ctx.fillStyle = signalColor(0, .07); ctx.fill();
  ctx.strokeStyle = signalColor(0, .22); ctx.lineWidth = .8; ctx.stroke();

  ctx.beginPath(); points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  const face = ctx.createLinearGradient(left, top, right, bottom);
  face.addColorStop(0, signalColor(0, .025)); face.addColorStop(.44, signalColor(0, .065));
  face.addColorStop(.52, signalColor(0, .025)); face.addColorStop(1, signalColor(0, .014));
  ctx.fillStyle = face; ctx.fill(); ctx.strokeStyle = signalColor(0, .11); ctx.stroke();

  ctx.beginPath(); ctx.moveTo(left, top + 36); ctx.lineTo(left, top + 14);
  ctx.lineTo(left + 14, top); ctx.lineTo(left + 59, top);
  ctx.moveTo(right - 44, bottom); ctx.lineTo(right - 14, bottom);
  ctx.lineTo(right, bottom - 14); ctx.lineTo(right, bottom - 35);
  ctx.strokeStyle = signalColor(0, .63); ctx.lineWidth = 1.1; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(right - 59, top); ctx.lineTo(right - 16, top); ctx.lineTo(right, top + 16);
  ctx.strokeStyle = signalColor(heat, .72); ctx.stroke();
}

function fittedText(ctx: CanvasRenderingContext2D, fonts: FilmFonts, text: string, size: number, width: number) {
  ctx.font = `${size}px ${fonts.label}`;
  return fitText(ctx, text, width);
}

function miniature(ctx: CanvasRenderingContext2D, fonts: FilmFonts, item: CornerReadoutItem,
  time: number, park: number, alpha: number) {
  const growth = smooth(.2, 1.15, time);
  const heat = unit(item.heat);
  const parsed = Number.parseFloat(item.value);
  const amount = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  ctx.save(); ctx.globalAlpha *= growth;
  if (item.kind === 'production') {
    const phase = time * .7 * (1 - park * .9);
    ctx.beginPath(); ctx.moveTo(-132, 61); ctx.lineTo(132, 61);
    ctx.strokeStyle = signalColor(0, .18); ctx.lineWidth = 1; ctx.stroke();
    const points = Array.from({ length: 73 }, (_, index) => {
      const u = index / 72;
      return [-132 + u * 264, 43 - Math.sin(u * TAU * 2 + phase) * 8 - Math.sin(u * TAU * 5 - phase) * 3];
    });
    ctx.beginPath(); points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = signalColor(heat, .9); ctx.lineWidth = 2; ctx.stroke();
    ctx.lineTo(132, 61); ctx.lineTo(-132, 61); ctx.closePath();
    ctx.fillStyle = signalColor(heat, .065); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-132, 66); ctx.lineTo(-132 + 264 * unit(amount / 100), 66);
    ctx.strokeStyle = signalColor(heat, .55); ctx.lineWidth = 3; ctx.stroke();
  } else if (item.kind === 'quality') {
    const cx = 112, cy = 42, radius = 24;
    ctx.beginPath(); ctx.arc(cx + 2, cy + 4, radius, 0, TAU);
    ctx.strokeStyle = signalColor(0, .18); ctx.lineWidth = 5; ctx.stroke();
    const end = -Math.PI / 2 + unit(amount / 100) * TAU;
    ctx.beginPath(); ctx.arc(cx, cy, radius, -Math.PI / 2, end);
    ctx.strokeStyle = signalColor(0, .72); ctx.lineWidth = 5; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, radius, end, Math.PI * 1.5);
    ctx.strokeStyle = signalColor(1, .9); ctx.lineWidth = 5; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, radius + 6, time * .2, time * .2 + Math.PI * 1.15);
    ctx.strokeStyle = signalColor(0, .48); ctx.lineWidth = .9; ctx.stroke();
    for (let index = 0; index < 8; index++) {
      const x = -132 + index * 25;
      ctx.fillStyle = signalColor(0, .19 + index / 7 * .22); ctx.fillRect(x, 39, 15, 9);
      ctx.strokeStyle = signalColor(0, .42); ctx.strokeRect(x, 39, 15, 9);
    }
  } else if (item.kind === 'equipment') {
    const match = `${item.value}${item.unit}`.match(/(\d+)\s*\/\s*(\d+)/);
    const active = Math.max(0, Math.min(12, match ? Number(match[1]) : amount));
    for (let index = 0; index < 12; index++) {
      const x = -132 + index * 22;
      const running = index < active;
      ctx.fillStyle = signalColor(running ? 0 : 1, running ? .22 : .055);
      ctx.fillRect(x, 32, 17, 27);
      ctx.strokeStyle = signalColor(running ? 0 : 1, running ? .68 : .86); ctx.lineWidth = 1.1;
      ctx.strokeRect(x, 32, 17, 27);
      ctx.beginPath(); ctx.moveTo(x, 32); ctx.lineTo(x + 2, 29); ctx.lineTo(x + 19, 29); ctx.lineTo(x + 17, 32);
      ctx.strokeStyle = signalColor(running ? 0 : 1, .39); ctx.stroke();
      if (!running) {
        ctx.beginPath(); ctx.moveTo(x + 4, 38); ctx.lineTo(x + 13, 53);
        ctx.moveTo(x + 13, 38); ctx.lineTo(x + 4, 53); ctx.stroke();
      }
    }
  } else {
    const maximum = Math.max(10, Math.ceil(amount));
    const marker = -132 + 264 * unit(amount / maximum);
    ctx.beginPath(); ctx.moveTo(-132, 39); ctx.lineTo(132, 39);
    ctx.strokeStyle = signalColor(0, .23); ctx.lineWidth = 5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-132, 39); ctx.lineTo(marker, 39);
    ctx.strokeStyle = signalColor(heat, .78); ctx.lineWidth = 5; ctx.stroke();
    for (let index = 0; index <= 10; index++) {
      const x = -132 + index * 26.4;
      ctx.beginPath(); ctx.moveTo(x, 44); ctx.lineTo(x, index % 5 === 0 ? 53 : 49);
      ctx.strokeStyle = signalColor(0, .44); ctx.lineWidth = .8; ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(marker, 24); ctx.lineTo(marker - 5, 31); ctx.lineTo(marker + 5, 31); ctx.closePath();
    ctx.fillStyle = signalColor(heat, .95); ctx.fill();
    filmText(ctx, fonts, '0', -132, 70, 16, alpha * growth * .55, true, 'left', signalColor(0, 1));
    filmText(ctx, fonts, `${maximum} ${item.unit}`, 132, 70, 16, alpha * growth * .55, true, 'right', signalColor(0, 1));
  }
  ctx.restore();
}

/** All geometry stays inside a 340 × 210 plane; the caller animates its camera and position. */
export function drawCornerReadout(ctx: CanvasRenderingContext2D, fonts: FilmFonts, options: CornerReadoutOptions) {
  const { item, time } = options;
  const alpha = ctx.globalAlpha * unit(options.opacity) * unit(options.reveal);
  if (!Number.isFinite(time) || time < 0 || alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.rect(-170, -105, 340, 210); ctx.clip();
  ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0; ctx.setLineDash([]);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.textBaseline = 'alphabetic';
  const heat = unit(item.heat), park = unit(options.parkProgress);
  opticalSurface(ctx, 340, 210, heat);
  const text = (value: string, x: number, y: number, size: number, strength = 1, warmth = heat, mono = false) =>
    filmText(ctx, fonts, value, x, y, size, alpha * strength, mono, 'left', signalColor(warmth, 1));
  text(fittedText(ctx, fonts, item.label, 19, 272), -132, -61, 19, smooth(0, .45, time) * .88, 0);
  ctx.font = `62px ${fonts.mono}`;
  const valueWidth = ctx.measureText(item.value).width;
  ctx.font = `24px ${fonts.label}`;
  const unitWidth = ctx.measureText(item.unit).width;
  const size = Math.max(54, Math.min(62, 62 * Math.max(1, 270 - unitWidth - 10) / Math.max(1, valueWidth)));
  const read = smooth(.15, .8, time);
  text(item.value, -132, 8, size, read, heat, true);
  ctx.font = `${size}px ${fonts.mono}`;
  const unitX = -132 + ctx.measureText(item.value).width + 10;
  text(item.unit, unitX, 5, 24, read * .78, heat);
  miniature(ctx, fonts, item, time, park, alpha);
  text(fittedText(ctx, fonts, item.detail, 16, 272), -132, 86, 16, smooth(.55, 1.2, time) * .74, 0);
  ctx.restore();
}
