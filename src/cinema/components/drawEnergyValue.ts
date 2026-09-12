import type { FilmFonts } from '../filmDrawing';

/** Shared screen typography; y is the top of the numeric readout. */
export function drawEnergyValue(ctx: CanvasRenderingContext2D, fonts: FilmFonts, text: string,
  x: number, y: number, size: number, color: string, alpha: number,
  options: { align?: 'left' | 'right' | 'center' } = {}) {
  ctx.save();
  ctx.font = `500 ${size}px ${fonts.label}`;
  ctx.textAlign = options.align ?? 'left';
  ctx.textBaseline = 'top';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  const width = ctx.measureText(text).width;
  ctx.restore();
  return width;
}
