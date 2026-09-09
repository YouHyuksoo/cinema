import type { PanelRect } from '../energyDashboard';
import { sevenSegment } from '../energyDashboard';
import type { FilmFonts } from '../filmDrawing';

/** Hex colour → rgba() with the given alpha; used by both energy acts. */
export function withAlpha(hex: string, alpha: number) {
  const digits = hex.replace('#', '');
  const value = Number.parseInt(digits.length === 3 ? digits.split('').map(d => d + d).join('') : digits, 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${Math.max(0, Math.min(1, alpha))})`;
}

/** Glass panel with two clipped corners (top-left and bottom-right), a header tab and a faint inner grid. */
export function drawHudPanel(ctx: CanvasRenderingContext2D, fonts: FilmFonts, rect: PanelRect, options: {
  label: string; line: string; panel: string; ink: string; alpha: number; labelBottom?: boolean; grid?: boolean;
}) {
  const { x, y, width, height } = rect, cut = 14;
  ctx.save();
  ctx.globalAlpha = options.alpha;
  ctx.beginPath();
  ctx.moveTo(x + cut, y); ctx.lineTo(x + width, y); ctx.lineTo(x + width, y + height - cut);
  ctx.lineTo(x + width - cut, y + height); ctx.lineTo(x, y + height); ctx.lineTo(x, y + cut); ctx.closePath();
  const glass = ctx.createLinearGradient(x, y, x + width, y + height);
  glass.addColorStop(0, options.panel); glass.addColorStop(1, withAlpha(options.line, .08));
  ctx.fillStyle = glass; ctx.fill();
  if (options.grid !== false) {
    ctx.save(); ctx.clip();
    ctx.strokeStyle = withAlpha(options.line, .07); ctx.lineWidth = 1;
    for (let gx = x + 18; gx < x + width; gx += 24) { ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + height); ctx.stroke(); }
    for (let gy = y + 18; gy < y + height; gy += 24) { ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + width, gy); ctx.stroke(); }
    ctx.restore();
  }
  ctx.strokeStyle = withAlpha(options.line, .75); ctx.lineWidth = 1.2; ctx.stroke();
  // Bright rails on the two straight edges beside the cuts.
  ctx.strokeStyle = options.line; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(x + cut + 2, y); ctx.lineTo(x + Math.min(width, 96), y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + width, y + height - cut - 2); ctx.lineTo(x + width, y + height - Math.min(height, 70)); ctx.stroke();
  // Header tab.
  const tabY = options.labelBottom ? y + height - 8 : y + 18;
  ctx.font = `10px ${fonts.mono}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = options.line; ctx.fillText('▸', x + 12, tabY);
  ctx.fillStyle = options.ink; ctx.fillText(options.label, x + 24, tabY);
  ctx.restore();
}

/** Seven-segment digits, drawn with rounded strokes; `size` is the digit height. */
export function drawSevenSegment(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number,
  color: string, alpha: number, options: { ghost?: number; align?: 'left' | 'right' | 'center' } = {}) {
  const w = size * .56, gap = size * .16, thickness = Math.max(2, size * .09);
  const characters = text.split('');
  const dots = characters.filter(character => character === '.').length;
  const total = (characters.length - dots) * (w + gap) - gap + dots * gap * 1.6;
  let left = options.align === 'right' ? x - total : options.align === 'center' ? x - total / 2 : x;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = thickness;
  const half = size / 2, inset = thickness * .9;
  for (const character of characters) {
    if (character === '.') {
      // Decimal point: a dot at the baseline between digits, taking only a little width.
      ctx.globalAlpha = alpha; ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(left - gap * .2, y + size, thickness * .65, 0, Math.PI * 2); ctx.fill();
      left += gap * 1.6;
      continue;
    }
    const bits = sevenSegment(character);
    const strokes: [number, number, number, number][] = [
      [left + inset, y, left + w - inset, y],                                    // a
      [left + w, y + inset, left + w, y + half - inset],                         // b
      [left + w, y + half + inset, left + w, y + size - inset],                  // c
      [left + inset, y + size, left + w - inset, y + size],                      // d
      [left, y + half + inset, left, y + size - inset],                          // e
      [left, y + inset, left, y + half - inset],                                 // f
      [left + inset, y + half, left + w - inset, y + half],                      // g
    ];
    strokes.forEach(([x1, y1, x2, y2], index) => {
      const on = (bits >> (6 - index)) & 1;
      const level = on ? alpha : alpha * (options.ghost ?? .08);
      if (level <= 0) return;
      ctx.globalAlpha = level; ctx.strokeStyle = color;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    });
    left += w + gap;
  }
  ctx.restore();
  return total;
}
