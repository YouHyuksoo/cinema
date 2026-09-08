import { filmText, signalColor, smooth, type FilmFonts } from '../filmDrawing';
import type { SpcData, ValidSpcAnalysis } from '../spcTypes';

export const SPC_HISTOGRAM_SIZE = { width: 560, height: 370 } as const;
export interface SpcHistogramOptions { time: number; reveal: number; focus: number }

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Actual bin frequencies only; specification limits are independent of the control chart limits. */
export function drawSpcHistogram(ctx: CanvasRenderingContext2D, fonts: FilmFonts,
  data: SpcData, analysis: ValidSpcAnalysis, options: SpcHistogramOptions): void {
  const reveal = clamp(options.reveal), focus = clamp(options.focus);
  if (reveal <= 0) return;
  const { bins, min, max, binWidth } = analysis.histogram;
  const plot = { left: 52, right: 521, top: 83, bottom: 270 };
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
  const selectedIndex = bins.reduce((selected, bin, index) => {
    const best = bins[selected];
    return !best || bin.count > best.count || (bin.count === best.count
      && Math.abs((bin.lower + bin.upper) / 2 - analysis.mean) < Math.abs((best.lower + best.upper) / 2 - analysis.mean))
      ? index : selected;
  }, 0);

  ctx.save();
  ctx.globalAlpha = reveal;
  filmText(ctx, fonts, 'DISTRIBUTION / HISTOGRAM', 20, 25, 12, reveal * .79, true);
  filmText(ctx, fonts, `실측 ${analysis.totalSamples}개 · 규격 한계 LSL / USL`, 20, 45, 11, reveal * .6);
  filmText(ctx, fonts, '빈도', 24, 76, 10, reveal * .52);

  for (const tick of [0, ceiling / 2, ceiling]) {
    const yy = y(tick);
    ctx.beginPath(); ctx.moveTo(plot.left, yy); ctx.lineTo(plot.right + 5, yy);
    ctx.strokeStyle = signalColor(0, tick === 0 ? .36 : .085);
    ctx.lineWidth = tick === 0 ? 1.2 : .6; ctx.stroke();
    filmText(ctx, fonts, String(tick), plot.left - 10, yy + 4, 10, reveal * .58, true, 'right');
  }

  // Three translucent faces retain the exact front-face count; depth never changes its value.
  bins.forEach((bin, index) => {
    if (bin.count <= 0) return;
    const growth = smooth(index / Math.max(1, bins.length) * .18, .72 + index / Math.max(1, bins.length) * .28, reveal);
    const left = x(bin.lower) + 1.5, right = x(bin.upper) - 1.5;
    const top = y(bin.count * growth), bottom = plot.bottom;
    const active = index === selectedIndex;
    const intensity = active ? .25 + focus * .2 : .16;
    const depth = 4 + focus * 2;
    const pulse = .5 + Math.sin(options.time * 1.7) * .5;
    const fill = ctx.createLinearGradient(left, top, right, bottom);
    fill.addColorStop(0, signalColor(0, intensity + .13));
    fill.addColorStop(.2, signalColor(0, intensity * .5));
    fill.addColorStop(.78, signalColor(.03, .045));
    fill.addColorStop(1, signalColor(0, intensity * .7));
    ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(right, top);
    ctx.lineTo(right, bottom); ctx.lineTo(left, bottom); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = active ? 1.3 : .8;
    ctx.strokeStyle = signalColor(0, active ? .65 : .3); ctx.stroke();

    ctx.beginPath(); ctx.moveTo(right, top); ctx.lineTo(right + depth, top - depth);
    ctx.lineTo(right + depth, bottom - depth); ctx.lineTo(right, bottom); ctx.closePath();
    ctx.fillStyle = signalColor(.05, intensity * .45); ctx.fill();
    ctx.strokeStyle = signalColor(0, .21); ctx.lineWidth = .65; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left + depth, top - depth);
    ctx.lineTo(right + depth, top - depth); ctx.lineTo(right, top); ctx.closePath();
    ctx.fillStyle = signalColor(0, intensity + .18); ctx.fill();
    ctx.strokeStyle = signalColor(0, .55); ctx.stroke();

    ctx.beginPath();
    for (let strip = bottom - 7; strip > top + 4; strip -= 8) {
      ctx.moveTo(left + 2, strip); ctx.lineTo(right - 2, strip);
    }
    ctx.lineWidth = .8; ctx.strokeStyle = signalColor(0, active ? .18 + focus * pulse * .11 : .105); ctx.stroke();
    if (active && growth > .9) {
      filmText(ctx, fonts, `${bin.count}`, (left + right) / 2 + depth / 2, top - depth - 8,
        12, reveal * (.7 + focus * .3), true, 'center');
    }
  });

  // LSL/USL use their own warm limit strokes, never bin-wide failure coloring.
  for (const [label, value] of [['LSL', data.lsl], ['USL', data.usl]] as const) {
    const xx = x(value);
    ctx.beginPath(); ctx.moveTo(xx, plot.top - 10); ctx.lineTo(xx, plot.bottom + 5);
    ctx.strokeStyle = signalColor(1, .82); ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(xx - 4, plot.top - 12); ctx.lineTo(xx + 4, plot.top - 12);
    ctx.lineTo(xx, plot.top - 7); ctx.closePath(); ctx.fillStyle = signalColor(1, .9); ctx.fill();
    const labelX = Math.max(72, Math.min(488, xx));
    filmText(ctx, fonts, `${label} ${format(value)}`, labelX, 64, 12, reveal * .92, true, 'center', signalColor(1, 1));
  }

  const meanX = x(analysis.mean);
  ctx.beginPath(); ctx.moveTo(meanX, plot.top + 9); ctx.lineTo(meanX, plot.bottom + 37);
  ctx.strokeStyle = signalColor(.05, .75); ctx.lineWidth = 1.1; ctx.setLineDash([2, 5]); ctx.stroke(); ctx.setLineDash([]);
  for (let tick = 0; tick <= 4; tick++) {
    const value = domainMin + domainSpan * tick / 4;
    const xx = x(value);
    ctx.beginPath(); ctx.moveTo(xx, plot.bottom); ctx.lineTo(xx, plot.bottom + 4);
    ctx.strokeStyle = signalColor(0, .35); ctx.lineWidth = .7; ctx.stroke();
    filmText(ctx, fonts, format(value), xx, plot.bottom + 19, 10, reveal * .65, true, 'center');
  }
  filmText(ctx, fonts, `평균 ${format(analysis.mean)} ${data.unit}`, Math.max(129, Math.min(432, meanX)), 320,
    12, reveal * .9, true, 'center');
  const outside = analysis.outsideSpecs;
  filmText(ctx, fonts, `규격 밖 실측 ${outside} / ${analysis.totalSamples}개`, 20, 349,
    12, reveal * .9, false, 'left', signalColor(outside > 0 ? 1 : .03, 1));
  filmText(ctx, fonts, `측정 단위 ${data.unit}`, 540, 349, 10, reveal * .56, false, 'right');
  ctx.restore();
}
