import { filmText, signalColor, smooth, type FilmFonts } from '../filmDrawing';
import { metricNumberCloud, morphMetricPoints } from '../metricMorphGeometry';
import type { UnfoldMetricState, UnfoldMetricsState } from '../unfoldMetrics';
import { drawMetricChart } from './drawMetricChart';
import { infoPanelFrame } from './infoPanelFrame';

/** The identical luminous samples draw the digit, travel, and become the data-bearing chart. */
export function drawUnfoldMetric(ctx: CanvasRenderingContext2D, fonts: FilmFonts,
  item: UnfoldMetricState, state: UnfoldMetricsState) {
  if (item.opacity <= .001 || item.scale <= .001) return;
  const { metric, opacity, morph } = item;
  const cloud = metricNumberCloud(metric.id, item.displayValue);
  const chartReveal = smooth(.45, .98, morph);
  const digitPresence = 1 - smooth(.02, .5, morph);
  ctx.save(); ctx.translate(item.x, item.y); ctx.rotate(item.rotation); ctx.scale(item.scale, item.scale);
  ctx.globalAlpha = opacity;

  const frame = infoPanelFrame(-400, -170, 800, 340, item.index % 2 ? 'analysis' : 'telemetry');
  ctx.beginPath(); frame.outline.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
  ctx.strokeStyle = signalColor(0, chartReveal * .23); ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = signalColor(0, chartReveal * .6);
  for (const tab of frame.tabs) {
    ctx.beginPath(); tab.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill();
  }
  // A thin back contour gives the source numeral depth before it releases its particles.
  if (digitPresence > .001) {
    for (const offset of [8, 0]) {
      ctx.beginPath();
      for (const contour of cloud.contours) contour.forEach(([x, y], index) => index ? ctx.lineTo(x + offset * .7, y + offset) : ctx.moveTo(x + offset * .7, y + offset));
      ctx.strokeStyle = signalColor(0, digitPresence * (offset ? .18 : .9));
      ctx.lineWidth = offset ? 3.2 : 2.1; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.shadowColor = signalColor(0, .5); ctx.shadowBlur = offset ? 0 : 12; ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  drawMetricChart(ctx, fonts, metric, chartReveal, opacity, state.elapsed);
  const points = morph === 0 ? cloud.source : morphMetricPoints(metric.id, morph);
  const previous = morph > .01 && morph < .99 ? morphMetricPoints(metric.id, Math.max(0, morph - .045)) : null;
  ctx.globalAlpha = opacity;
  if (previous) {
    ctx.lineWidth = 1; ctx.beginPath();
    for (let index = 0; index < points.length; index += 3) {
      ctx.moveTo(previous[index].x, previous[index].y); ctx.lineTo(points[index].x, points[index].y);
    }
    ctx.strokeStyle = signalColor(0, .16); ctx.stroke();
  }
  ctx.shadowBlur = 0;
  points.forEach((point, index) => {
    const reveal = smooth(index / points.length * .55, .3 + index / points.length * .55, item.appear);
    if (reveal < .001) return;
    const glint = .64 + .36 * Math.sin(index * .7 - state.elapsed * 2.1) ** 2;
    ctx.fillStyle = signalColor(point.heat, reveal * (.55 + glint * .45));
    const size = 1.65 + (1 - morph) * .9;
    ctx.fillRect(point.x - size / 2, point.y - size / 2, size, size);
  });
  const text = (value: string, x: number, y: number, size: number, strength: number, mono = false,
    align: CanvasTextAlign = 'left', heat = 0) => filmText(ctx, fonts, value, x, y, size, opacity * strength, mono, align, signalColor(heat, 1));
  text(metric.key, -340, -143, 11, .54, true);
  text(metric.label, -340, -108, 26, .96);
  text(`${metric.value} ${metric.unit}`, 338, -111, 24, chartReveal, true, 'right', metric.heat * .65);
  text(metric.unit, 235, 68, 31, digitPresence * .8, true);
  text(metric.reference, -340, 145, 18, chartReveal * .75);
  text(metric.difference, 338, 145, 20, chartReveal, false, 'right', metric.heat);
  ctx.restore();
}
