import { signalColor, smooth } from '../filmDrawing';
import { RIBBON_NUMBER_GLYPHS as GLYPHS, type RibbonGlyphPoint as Point } from '../ribbonNumberGeometry';

const unit = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

function revealedPoints(points: readonly Point[], reveal: number): Point[] {
  const lengths = points.slice(1).map((point, index) => Math.hypot(point[0] - points[index][0], point[1] - points[index][1]));
  let remaining = lengths.reduce((sum, length) => sum + length, 0) * reveal;
  const visible: Point[] = [points[0]];
  for (let index = 0; index < lengths.length && remaining > 0; index++) {
    const amount = lengths[index] === 0 ? 1 : Math.min(1, remaining / lengths[index]);
    visible.push([points[index][0] + (points[index + 1][0] - points[index][0]) * amount,
      points[index][1] + (points[index + 1][1] - points[index][1]) * amount]);
    remaining -= lengths[index];
  }
  return visible;
}

function strokeContour(ctx: CanvasRenderingContext2D, points: readonly Point[], dx = 0, dy = 0) {
  ctx.beginPath(); ctx.moveTo(points[0][0] + dx, points[0][1] + dy);
  for (const [x, y] of points.slice(1)) ctx.lineTo(x + dx, y + dy);
  ctx.stroke();
}

/** The carrier rises into a translucent conductor; its thickness folds away on the same clock. */
export function drawRibbonNumber(ctx: CanvasRenderingContext2D, {
  value, x, y, rise, heat, focus = 0,
}: { value: string; x: number; y: number; rise: number; heat: number; focus?: number }) {
  if (typeof value !== 'string' || !Number.isFinite(x) || !Number.isFinite(y)) return;
  const opening = unit(rise), warmth = unit(heat), approach = unit(focus);
  const reveal = smooth(0, .2, opening);
  if (reveal <= 0) return;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.shadowBlur = 0;
  let cursor = x;
  for (const [index, character] of [...value].entries()) {
    const glyph = GLYPHS[character];
    const width = character === '.' ? 15 : 37;
    const phase = smooth(index * .09, .62 + index * .09, opening);
    if (glyph) {
      const points = revealedPoints(glyph.map(([gx, gy]): Point => [cursor + gx * width, y - (14 + (1 - gy) * 59) * phase]), reveal);
      if (points.length > 1) {
        const dx = (4.3 + approach * 1.5) * phase;
        const dy = (4.8 + approach * 1.7) * phase;
        const strokeWidth = .65 + phase * ((character === '.' ? 3.05 : 2.65) + approach * .45);

        ctx.strokeStyle = signalColor(warmth, (.07 + phase * .23) * reveal);
        ctx.lineWidth = strokeWidth * .85;
        strokeContour(ctx, points, dx, dy);

        ctx.fillStyle = signalColor(warmth, phase * (.11 + approach * .05) * reveal);
        for (let edge = 1; edge < points.length; edge++) {
          const [ax, ay] = points[edge - 1], [bx, by] = points[edge];
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
          ctx.lineTo(bx + dx, by + dy); ctx.lineTo(ax + dx, ay + dy); ctx.closePath(); ctx.fill();
        }
        ctx.beginPath();
        for (const [px, py] of points) { ctx.moveTo(px, py); ctx.lineTo(px + dx, py + dy); }
        ctx.strokeStyle = signalColor(warmth, phase * .36 * reveal); ctx.lineWidth = .65; ctx.stroke();

        const face = ctx.createLinearGradient(cursor, y - 73 * phase - 1, cursor + width, y - 14 * phase + 1);
        face.addColorStop(0, signalColor(warmth, (.16 + phase * .77) * reveal));
        face.addColorStop(.46, signalColor(warmth, (.14 + phase * .43) * reveal));
        face.addColorStop(1, signalColor(warmth, (.16 + phase * .66) * reveal));
        ctx.strokeStyle = face; ctx.lineWidth = strokeWidth; strokeContour(ctx, points);
        ctx.strokeStyle = `rgba(238,250,249,${phase * (.56 + approach * .14) * reveal})`;
        ctx.lineWidth = .45 + phase * .25; strokeContour(ctx, points, -.45 * phase, -.45 * phase);
      }
    }
    // Preserve the value's spacing even when a source contains an unsupported glyph.
    cursor += width + (character === '.' ? 5 : 13);
  }
  ctx.restore();
}
