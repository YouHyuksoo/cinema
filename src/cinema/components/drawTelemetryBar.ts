import { signalColor, type FilmFonts } from '../filmDrawing';
import { telemetrySegments, type BarTelemetryColumn, type BarTelemetryLayout } from '../barTelemetryGeometry';

/** Transparent luminous plates and a scale that travels with the selected stack. */
export function drawTelemetryBar(ctx: CanvasRenderingContext2D, fonts: FilmFonts,
  layout: BarTelemetryLayout, column: BarTelemetryColumn, time: number, focused = false) {
  const { baseline, height, barWidth, depth, maximum, target } = layout;
  const { left, top, barHeight, heat, index } = column;
  const detail = focused ? layout.focus : 0;
  const right = left + barWidth;
  // On approach, carry only the value-to-target instrument so its empty headroom
  // does not grow through the stationary channel header.
  const instrumentHeight = focused ? Math.max(barHeight, height * (target ?? column.value) / maximum) : height;
  const upper = baseline - instrumentHeight;
  ctx.save(); ctx.lineWidth = .7;
  if (depth > 0) {
    const rearTop = focused ? top : upper;
    ctx.beginPath(); ctx.moveTo(left + depth, baseline - depth); ctx.lineTo(left + depth, rearTop - depth);
    ctx.lineTo(right + depth, rearTop - depth); ctx.lineTo(right + depth, baseline - depth);
    ctx.strokeStyle = signalColor(heat, focused ? .12 : .07); ctx.stroke();
  }
  const sweep = ((time * .17 + index * .13) % 1 + 1) % 1;
  for (const segment of telemetrySegments(height, barHeight)) {
    if (segment.bottom >= instrumentHeight) continue;
    const bottom = baseline - segment.bottom;
    const emptyThickness = Math.min(segment.thickness, instrumentHeight - segment.bottom);
    ctx.fillStyle = signalColor(heat, .075); ctx.fillRect(left, bottom - emptyThickness, barWidth, emptyThickness);
    // The parallel light rail mirrors this value, not an invented second metric.
    ctx.fillStyle = signalColor(heat, .065); ctx.fillRect(left - 10, bottom - emptyThickness, 4, emptyThickness);
    if (segment.lit <= 0) continue;
    const pulse = Math.max(0, 1 - Math.abs(segment.bottom / height - sweep) * 13);
    const brightness = .55 + .23 * segment.bottom / height + pulse * .2;
    const light = ctx.createLinearGradient(left, 0, right, 0);
    light.addColorStop(0, signalColor(heat, brightness)); light.addColorStop(.48, signalColor(heat, brightness * .52));
    light.addColorStop(1, signalColor(heat, Math.min(1, brightness + .1)));
    ctx.fillStyle = light; ctx.fillRect(left, bottom - segment.lit, barWidth, segment.lit);
    ctx.fillStyle = signalColor(heat, .55 + pulse * .35); ctx.fillRect(left - 10, bottom - segment.lit, 4, segment.lit);
    if (depth > 0) {
      ctx.beginPath(); ctx.moveTo(right, bottom); ctx.lineTo(right + depth, bottom - depth);
      ctx.lineTo(right + depth, bottom - depth - segment.lit); ctx.lineTo(right, bottom - segment.lit); ctx.closePath();
      ctx.fillStyle = signalColor(heat, .15 + pulse * .15 + detail * .08); ctx.fill();
      ctx.beginPath(); ctx.moveTo(left, bottom - segment.lit); ctx.lineTo(left + depth, bottom - segment.lit - depth);
      ctx.lineTo(right + depth, bottom - segment.lit - depth); ctx.lineTo(right, bottom - segment.lit); ctx.closePath();
      ctx.fillStyle = signalColor(heat, .025 + pulse * .045); ctx.fill();
    }
  }
  // Precise cap follows the value even when it falls in the space between two strips.
  if (barHeight > 0) {
    const bloom = ctx.createLinearGradient(0, top - 8, 0, top + 12);
    bloom.addColorStop(0, signalColor(heat, 0)); bloom.addColorStop(.4, signalColor(heat, .17)); bloom.addColorStop(1, signalColor(heat, 0));
    ctx.fillStyle = bloom; ctx.fillRect(left - 3, top - 8, barWidth + 6, 20);
    if (depth > 0) {
      ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left + depth, top - depth);
      ctx.lineTo(right + depth, top - depth); ctx.lineTo(right, top); ctx.closePath();
      ctx.fillStyle = signalColor(heat, .16 + detail * .08); ctx.fill();
      ctx.strokeStyle = signalColor(heat, .75); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(left - 3, top); ctx.lineTo(right + 3, top);
    ctx.strokeStyle = signalColor(heat, .98); ctx.lineWidth = 1.8; ctx.stroke();
  }
  ctx.lineWidth = .65;
  for (const edge of [left - 13, right + depth + 4]) {
    ctx.beginPath(); ctx.moveTo(edge, baseline); ctx.lineTo(edge, upper);
    ctx.strokeStyle = signalColor(heat, .17); ctx.stroke();
  }
  const rulerX = right + depth + 9;
  ctx.font = `7px ${fonts.mono}`; ctx.textAlign = 'left';
  for (let tick = 0; tick <= 20; tick++) {
    const tickY = baseline - height * tick / 20;
    if (tickY < upper) continue;
    ctx.beginPath(); ctx.moveTo(rulerX, tickY); ctx.lineTo(rulerX + (tick % 5 === 0 ? 6 : 3), tickY);
    ctx.strokeStyle = signalColor(heat, tick % 5 === 0 ? .55 : .19); ctx.stroke();
    if (tick % 5 === 0) {
      ctx.fillStyle = signalColor(heat, .5);
      ctx.fillText(Math.round(maximum * tick / 20).toLocaleString('en-US'), rulerX + 9, tickY + 2.5);
    }
  }
  if (target !== undefined) {
    const targetY = baseline - height * target / maximum;
    ctx.beginPath(); ctx.moveTo(left - 19, targetY - 4); ctx.lineTo(left - 14, targetY); ctx.lineTo(left - 19, targetY + 4);
    ctx.strokeStyle = signalColor(heat, .95); ctx.lineWidth = 1.1; ctx.stroke();
    ctx.beginPath(); ctx.setLineDash([2, 3]); ctx.moveTo(left - 12, targetY); ctx.lineTo(right + depth + 3, targetY);
    ctx.strokeStyle = signalColor(heat, .55); ctx.lineWidth = .65; ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.beginPath(); ctx.moveTo(left - 15, baseline + 4); ctx.lineTo(right + 5, baseline + 4);
  if (depth > 0) ctx.lineTo(right + depth + 7, baseline - depth + 3);
  ctx.strokeStyle = signalColor(heat, .58); ctx.lineWidth = 1; ctx.stroke();
  if (focused) {
    ctx.beginPath(); ctx.ellipse(column.center, baseline + 8, barWidth * .73, 5, 0, 0, Math.PI * 2);
    ctx.strokeStyle = signalColor(heat, .22); ctx.stroke();
  }
  ctx.restore();
}
