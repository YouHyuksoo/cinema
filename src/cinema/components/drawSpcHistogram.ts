import { filmText, signalColor, smooth, type FilmFonts } from '../filmDrawing';
import { finiteUnit as clamp } from '../filmMath';
import type { SpcData, ValidSpcAnalysis } from '../spcTypes';

export const SPC_HISTOGRAM_SIZE = { width: 560, height: 370 } as const;
export interface SpcHistogramOptions { time: number; reveal: number; focus: number }


/** Actual bin frequencies only; specification limits are independent of the control chart limits. */
export function drawSpcHistogram(ctx: CanvasRenderingContext2D, fonts: FilmFonts,
  data: SpcData, analysis: ValidSpcAnalysis, options: SpcHistogramOptions): void {
  const reveal = clamp(options.reveal), focus = clamp(options.focus), alpha = ctx.globalAlpha * reveal;
  if (alpha <= .001) return;
  const time = Number.isFinite(options.time) ? Math.max(0, options.time) : 0;
  const { bins, min, max, binWidth } = analysis.histogram;
  const plot = { left: 52, right: 522, top: 87, bottom: 247 };
  const domainMin = Math.min(min, data.lsl), domainMax = Math.max(max, data.usl);
  const domainSpan = Math.max(domainMax - domainMin, binWidth, Number.EPSILON);
  const padding = domainSpan * .045;
  const x = (value: number) => plot.left + (value - domainMin + padding) / (domainSpan + padding * 2)
    * (plot.right - plot.left);
  const peak = Math.max(1, analysis.histogram.peak);
  const step = Math.max(1, Math.ceil(peak / 4));
  const ceiling = step * 4;
  const y = (count: number) => plot.bottom - count / ceiling * (plot.bottom - plot.top);
  const decimals = Math.max(0, Math.min(5, Math.ceil(-Math.log10(Math.max(binWidth, .00001))) + 1));
  const format = (value: number) => value.toFixed(decimals);
  const text = (value: string, xx: number, yy: number, size: number, opacity: number,
    mono = false, align: CanvasTextAlign = 'left', heat = 0) =>
    filmText(ctx, fonts, value, xx, yy, size, alpha * opacity, mono, align, signalColor(heat, 1));
  const selectedIndex = bins.reduce((selected, bin, index) => {
    const best = bins[selected];
    return !best || bin.count > best.count || (bin.count === best.count
      && Math.abs((bin.lower + bin.upper) / 2 - analysis.mean) < Math.abs((best.lower + best.upper) / 2 - analysis.mean))
      ? index : selected;
  }, 0);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'butt'; ctx.lineJoin = 'round'; ctx.setLineDash([]);
  text('실측 분포', 20, 27, 23, .98);
  text('02 / DISTRIBUTION', 540, 25, 12, .65, true, 'right');
  text(`${analysis.totalSamples} READINGS`, 540, 47, 12, .75, true, 'right');
  text('빈도', 24, 79, 11, .64);

  const lslX = x(data.lsl), uslX = x(data.usl);
  const corridor = ctx.createLinearGradient(0, plot.top, 0, plot.bottom);
  corridor.addColorStop(0, signalColor(0, .018));
  corridor.addColorStop(.72, signalColor(0, .045));
  corridor.addColorStop(1, signalColor(0, .115));
  ctx.fillStyle = corridor;
  ctx.fillRect(lslX, plot.top, uslX - lslX, plot.bottom - plot.top);
  // The warm field marks a value range, never the status of an entire straddling bin.
  for (const [left, right] of [[plot.left, lslX], [uslX, plot.right]]) {
    const warm = ctx.createLinearGradient(0, plot.top, 0, plot.bottom);
    warm.addColorStop(0, signalColor(1, .012)); warm.addColorStop(1, signalColor(1, .13));
    ctx.fillStyle = warm; ctx.fillRect(left, plot.top, right - left, plot.bottom - plot.top);
  }

  for (const tick of [0, ceiling / 4, ceiling / 2, ceiling * .75, ceiling]) {
    const yy = y(tick);
    ctx.beginPath(); ctx.moveTo(plot.left, yy); ctx.lineTo(plot.right + 5, yy);
    ctx.strokeStyle = signalColor(0, tick === 0 ? .66 : .105);
    ctx.lineWidth = tick === 0 ? 1.5 : .65; ctx.stroke();
    text(String(tick), plot.left - 10, yy + 4, 11, .64, true, 'right');
  }

  // Three translucent faces retain the exact front-face count; depth never changes its value.
  bins.forEach((bin, index) => {
    if (bin.count <= 0) return;
    const phase = index / Math.max(1, bins.length);
    const growth = smooth(.12 + phase * .16, .68 + phase * .28, reveal);
    if (growth <= .001) return;
    const left = x(bin.lower) + 2.5, right = x(bin.upper) - 2.5;
    const top = y(bin.count * growth), bottom = plot.bottom;
    const active = index === selectedIndex;
    const intensity = active ? .33 + focus * .19 : .25;
    const depth = (4 + focus * 3) * growth;
    const pulse = .5 + Math.sin(time * 1.7) * .5;
    const fill = ctx.createLinearGradient(left, top, right, bottom);
    fill.addColorStop(0, signalColor(0, intensity + .23));
    fill.addColorStop(.2, signalColor(0, intensity * .65));
    fill.addColorStop(.78, signalColor(.03, .055));
    fill.addColorStop(1, signalColor(0, intensity * .8));
    ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(right, top);
    ctx.lineTo(right, bottom); ctx.lineTo(left, bottom); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = active ? 1.3 : .8;
    ctx.strokeStyle = signalColor(0, active ? .85 : .5); ctx.stroke();

    ctx.beginPath(); ctx.moveTo(right, top); ctx.lineTo(right + depth, top - depth);
    ctx.lineTo(right + depth, bottom - depth); ctx.lineTo(right, bottom); ctx.closePath();
    ctx.fillStyle = signalColor(.05, intensity * .55); ctx.fill();
    ctx.strokeStyle = signalColor(0, .4); ctx.lineWidth = .8; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left + depth, top - depth);
    ctx.lineTo(right + depth, top - depth); ctx.lineTo(right, top); ctx.closePath();
    ctx.fillStyle = signalColor(0, intensity + .3); ctx.fill();
    ctx.strokeStyle = signalColor(0, .85); ctx.stroke();
    ctx.save(); ctx.shadowColor = signalColor(0, .8); ctx.shadowBlur = active ? 10 : 5;
    ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(right, top);
    ctx.strokeStyle = signalColor(0, .96); ctx.lineWidth = active ? 1.8 : 1.2; ctx.stroke(); ctx.restore();

    ctx.beginPath();
    for (let strip = bottom - 7; strip > top + 4; strip -= 8) {
      ctx.moveTo(left + 2, strip); ctx.lineTo(right - 2, strip);
    }
    ctx.lineWidth = .7; ctx.strokeStyle = signalColor(0, active ? .15 + focus * pulse * .11 : .11); ctx.stroke();
    const tall = bottom - top > 32;
    text(String(Math.round(bin.count * growth)), (left + right) / 2, tall ? top + 21 : top - depth - 7,
      active ? 18 : 13, smooth(.1, .35, growth) * (active ? 1 : .85), true, 'center');
  });

  // LSL/USL use their own warm limit strokes, never bin-wide failure coloring.
  for (const [label, value] of [['LSL', data.lsl], ['USL', data.usl]] as const) {
    const xx = x(value);
    ctx.save(); ctx.shadowColor = signalColor(1, .65); ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(xx, plot.top - 8); ctx.lineTo(xx, plot.bottom + 4);
    ctx.strokeStyle = signalColor(1, .82); ctx.lineWidth = 1.2; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(xx - 6, plot.top - 9); ctx.lineTo(xx + 6, plot.top - 9);
    ctx.moveTo(xx - 6, plot.bottom + 4); ctx.lineTo(xx + 6, plot.bottom + 4);
    ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    const labelX = Math.max(72, Math.min(488, xx));
    text(`${label} ${format(value)}`, labelX, 66, 12, .97, true, 'center', 1);
  }

  const meanX = x(analysis.mean);
  ctx.beginPath(); ctx.moveTo(meanX, plot.top + 9); ctx.lineTo(meanX, plot.bottom);
  ctx.strokeStyle = 'rgba(218,247,255,.72)'; ctx.lineWidth = 1.1; ctx.setLineDash([2, 5]); ctx.stroke(); ctx.setLineDash([]);
  for (let tick = 0; tick <= 4; tick++) {
    const value = domainMin + domainSpan * tick / 4;
    const xx = x(value);
    ctx.beginPath(); ctx.moveTo(xx, plot.bottom); ctx.lineTo(xx, plot.bottom + 4);
    ctx.strokeStyle = signalColor(0, .35); ctx.lineWidth = .7; ctx.stroke();
    text(format(value), xx, plot.bottom + 20, 11, .75, true, 'center');
  }

  // One point per raw measurement; only vertical lanes separate overlapping observations.
  // The horizontal coordinate always remains its actual measured value.
  const samples = data.subgroups.flatMap(group => [...group.values]);
  const sampleReveal = smooth(.02, .55, reveal);
  const scanX = plot.left + (time * .11 % 1) * (plot.right - plot.left);
  samples.forEach((value, index) => {
    if (index / samples.length > sampleReveal) return;
    const xx = x(value), yy = 283 + index % 5 * 3;
    const heat = value < data.lsl || value > data.usl ? 1 : 0;
    const nearScan = Math.max(0, 1 - Math.abs(xx - scanX) / 32) * focus;
    ctx.fillStyle = signalColor(heat, heat ? .96 : .35 + nearScan * .6);
    ctx.fillRect(xx - (heat ? 1.5 : 1), yy, heat ? 3 : 2, heat ? 3 : 2);
    if (heat) {
      ctx.beginPath(); ctx.moveTo(xx, 278); ctx.lineTo(xx, 298);
      ctx.strokeStyle = signalColor(1, .28); ctx.lineWidth = .7; ctx.stroke();
    }
  });
  ctx.beginPath(); ctx.moveTo(plot.left, 304); ctx.lineTo(plot.right, 304);
  ctx.strokeStyle = signalColor(0, .18); ctx.lineWidth = .75; ctx.stroke();
  text('RAW SAMPLES / 개별 측정값', 20, 321, 10, .57, true);
  text(`규격 내 ${analysis.totalSamples - analysis.outsideSpecs}개`, 540, 321, 11, .66, false, 'right');
  const outside = analysis.outsideSpecs;
  text(`규격 밖  ${outside} / ${analysis.totalSamples}`, 20, 351, 20, .96, true, 'left', outside > 0 ? 1 : 0);
  text(`평균  ${format(analysis.mean)} ${data.unit}`, 540, 351, 17, .94, true, 'right');
  ctx.restore();
}
