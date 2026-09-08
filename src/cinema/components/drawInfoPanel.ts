import { filmText, signalColor, smooth, type FilmFonts } from '../filmDrawing';
import { applyFocusProjection, focusProjection, projectFocusPoint } from '../filmFocus';
import { infoPanelFrame, type InfoPanelFrameVariant } from './infoPanelFrame';

export interface InfoPanelLine {
  label: string;
  value: string;
  warning?: boolean;
}

export interface InfoPanelOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  time: number;
  title: string;
  lines: readonly InfoPanelLine[];
  charsPerSecond?: number;
  opacity?: number;
  focus?: number;
  frameVariant?: InfoPanelFrameVariant;
}

export function infoPanelFocusProjection(options: Pick<InfoPanelOptions, 'x' | 'y' | 'width' | 'height' | 'focus'>) {
  return focusProjection({ x: options.x + options.width / 2, y: options.y + options.height / 2,
    focus: options.focus ?? 0, depth: 130, lift: 16 });
}

type Point = readonly [number, number];
const BURST_SECONDS = .09;

function fitText(ctx: CanvasRenderingContext2D, value: string, maxWidth: number): string[] {
  const characters = Array.from(value);
  if (maxWidth <= 0) return [];
  if (ctx.measureText(value).width <= maxWidth) return characters;
  if (ctx.measureText('…').width > maxWidth) return [];
  let low = 0, high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (ctx.measureText(characters.slice(0, middle).join('') + '…').width <= maxWidth) low = middle;
    else high = middle - 1;
  }
  return [...characters.slice(0, low), '…'];
}

function traceEdge(ctx: CanvasRenderingContext2D, points: readonly Point[], progress: number) {
  const lengths = points.slice(1).map((point, index) => Math.hypot(point[0] - points[index][0], point[1] - points[index][1]));
  let remaining = lengths.reduce((total, length) => total + length, 0) * progress;
  ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
  for (let index = 0; index < lengths.length; index++) {
    const part = Math.min(1, remaining / Math.max(.001, lengths[index]));
    ctx.lineTo(points[index][0] + (points[index + 1][0] - points[index][0]) * part,
      points[index][1] + (points[index + 1][1] - points[index][1]) * part);
    remaining -= lengths[index];
    if (remaining <= 0) break;
  }
  ctx.stroke();
}

/** Draw one reusable panel from local elapsed seconds; no timers or retained animation state. */
export function drawInfoPanel(ctx: CanvasRenderingContext2D, fonts: FilmFonts, options: InfoPanelOptions) {
  const { x, y, width, height, time, title, lines } = options;
  if (time < 0 || !Number.isFinite(time) || width <= 2 || height <= 2) return;
  const opacity = Math.max(0, Math.min(1, options.opacity ?? 1));
  if (opacity === 0) return;
  const speed = Math.max(1, Math.min(180, options.charsPerSecond ?? 30));
  const padding = Math.min(22, width * .08);
  const innerLeft = x + padding, innerWidth = Math.max(0, width - padding * 2);
  const titleSize = 18, labelSize = 16, valueSize = 21;
  const rowTop = y + 82;
  const rowHeight = Math.max(30, Math.min(45, (height - 103) / Math.max(1, lines.length)));
  const labelWidth = Math.max(0, innerWidth * .43 - 12);
  const valueX = innerLeft + innerWidth * .46;
  const valueWidth = Math.max(0, innerLeft + innerWidth - valueX - 8);
  const frame = infoPanelFrame(x, y, width, height, options.frameVariant ?? 'command');
  const perimeter = frame.outline;
  ctx.save();
  const alpha = ctx.globalAlpha * opacity;
  ctx.globalAlpha = alpha; ctx.setLineDash([]); ctx.lineWidth = 1;
  const projection = infoPanelFocusProjection(options);
  if (projection.depth > .01) {
    const rim = projection.depth / 130 * 10;
    const front = perimeter.map(([px, py]) => projectFocusPoint(projection, { x: px, y: py }));
    ctx.beginPath();
    front.forEach((point, index) => index ? ctx.lineTo(point.x + rim * .6, point.y + rim) : ctx.moveTo(point.x + rim * .6, point.y + rim));
    ctx.closePath(); ctx.fillStyle = 'rgba(0,4,9,.32)'; ctx.fill();
    ctx.strokeStyle = signalColor(0, .18); ctx.stroke();
    for (const index of [1, 2, 3, 4, 5]) {
      const point = front[index];
      ctx.beginPath(); ctx.moveTo(point.x, point.y); ctx.lineTo(point.x + rim * .6, point.y + rim);
      ctx.strokeStyle = signalColor(0, .3); ctx.stroke();
    }
  }
  applyFocusProjection(ctx, projection);
  ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; ctx.textBaseline = 'alphabetic';
  ctx.beginPath();
  perimeter.forEach(([px, py], index) => { if (index === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); });
  ctx.closePath();
  ctx.fillStyle = `rgba(2,22,22,${smooth(0, .6, time) * .9})`; ctx.fill();

  // Opposing corners trace two halves of the same clipped outline.
  ctx.strokeStyle = 'rgba(0,245,237,.94)'; ctx.lineWidth = 1.5;
  const halfway = Math.floor(perimeter.length / 2);
  traceEdge(ctx, perimeter.slice(0, halfway + 1), smooth(0, .8, time));
  traceEdge(ctx, [...perimeter.slice(halfway), perimeter[0]], smooth(.08, .8, time));
  ctx.save(); ctx.globalAlpha *= smooth(.4, 1, time);
  ctx.fillStyle = '#00f5ed';
  for (const tab of frame.tabs) {
    ctx.beginPath(); tab.forEach(([px, py], index) => index ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
    ctx.closePath(); ctx.fill();
  }
  ctx.lineWidth = 1;
  for (const vent of frame.vents) traceEdge(ctx, vent, 1);
  ctx.restore();
  ctx.beginPath();
  perimeter.forEach(([px, py], index) => index ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
  ctx.closePath(); ctx.clip();
  ctx.lineWidth = 1;
  ctx.strokeStyle = signalColor(0, .2);
  traceEdge(ctx, [[innerLeft, y + 53], [x + width - padding, y + 53]], smooth(.65, 1.1, time));

  // All text is measured and clipped inside the inset; a cursor always has room to finish.
  ctx.save(); ctx.beginPath();
  ctx.rect(innerLeft, y + Math.min(14, height / 4), innerWidth, Math.max(0, height - Math.min(14, height / 4) - 14));
  ctx.clip();
  const duration = (characters: readonly string[]) => Math.ceil(characters.length / (speed * BURST_SECONDS)) * BURST_SECONDS;
  const typeText = (characters: readonly string[], start: number, tx: number, baseline: number, size: number,
    maxWidth: number, heat: number, strength: number, mono = false) => {
    const elapsed = time - start;
    if (elapsed < 0 || characters.length === 0) return;
    const steps = Math.floor(elapsed / BURST_SECONDS) + 1;
    const count = Math.min(characters.length, Math.floor(steps * speed * BURST_SECONDS));
    const visible = characters.slice(0, count).join('');
    filmText(ctx, fonts, visible, tx, baseline, size, alpha * strength, mono, 'left', signalColor(heat, 1));
    const typingEnd = duration(characters);
    if (elapsed <= typingEnd + .16) {
      ctx.font = `${size}px ${mono ? fonts.mono : fonts.label}`;
      const cursorX = tx + ctx.measureText(visible).width + 3;
      const cursorWidth = Math.min(5, Math.max(0, tx + maxWidth + 8 - cursorX));
      ctx.fillStyle = signalColor(heat, strength * (elapsed <= typingEnd ? .85 : .4));
      ctx.fillRect(cursorX, baseline - size + 3, cursorWidth, size - 2);
    }
  };

  ctx.font = `${titleSize}px ${fonts.label}`;
  const titleCharacters = fitText(ctx, title, Math.max(0, innerWidth - 8));
  typeText(titleCharacters, .82, innerLeft, y + 34, titleSize, innerWidth - 8, 0, .9);
  let nextStart = .82 + duration(titleCharacters) + .2;

  lines.forEach((line, index) => {
    const baseline = rowTop + rowHeight * index;
    ctx.font = `${labelSize}px ${fonts.label}`;
    const labelCharacters = fitText(ctx, line.label, labelWidth);
    ctx.font = `${valueSize}px ${fonts.mono}`;
    const valueCharacters = fitText(ctx, line.value, valueWidth);
    const labelStart = nextStart;
    const valueStart = labelStart + duration(labelCharacters) + .09;
    const heat = line.warning ? 1 : 0;
    const scanTime = time - valueStart;

    if (baseline - valueSize < y + height - 14) {
      if (scanTime >= 0 && scanTime < .65) {
        const scanProgress = smooth(0, .65, scanTime);
        const scanX = valueX + scanProgress * (valueWidth + 8);
        const scan = ctx.createLinearGradient(scanX - 42, 0, scanX + 6, 0);
        scan.addColorStop(0, signalColor(heat, 0));
        scan.addColorStop(.82, signalColor(heat, .12 * (1 - scanProgress)));
        scan.addColorStop(1, signalColor(heat, 0));
        ctx.fillStyle = scan; ctx.fillRect(valueX, baseline - 19, valueWidth + 8, 25);
      }
      typeText(labelCharacters, labelStart, innerLeft, baseline, labelSize, labelWidth, heat, .61);
      typeText(valueCharacters, valueStart, valueX, baseline, valueSize, valueWidth, heat, .95, true);
    }
    nextStart = valueStart + duration(valueCharacters) + .16;
  });

  ctx.restore(); ctx.restore();
}
