import { filmText, signalColor, type FilmFonts } from '../filmDrawing';
import { spcTraceHead } from '../spcScene';
import type { SpcControlSeries, SpcData, ValidSpcAnalysis } from '../spcTypes';
import { drawSpcControlTrace } from './drawSpcControlTrace';

export const SPC_CONTROL_SIZE = { width: 680, height: 410 } as const;

export interface SpcControlChartOptions { time: number; reveal: number; focus: number }
const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

/** Transparent, quantitative X-bar and R surfaces in a shared local coordinate system. */
export function drawSpcControlCharts(ctx: CanvasRenderingContext2D, fonts: FilmFonts, data: SpcData,
  analysis: ValidSpcAnalysis, options: SpcControlChartOptions): { x: number; y: number } | undefined {
  const alpha = ctx.globalAlpha * clamp(options.reveal);
  if (alpha <= .001) return undefined;
  const time = Number.isFinite(options.time) ? Math.max(0, options.time) : 0;
  const focus = clamp(options.focus);
  const left = 35, right = 517, chartWidth = right - left;
  const selectedIndex = analysis.focusGroupIndex;
  const selectedSeries = analysis.r.violations[selectedIndex] ? 'r' : 'xbar';
  let selectedPoint: { x: number; y: number } | undefined;
  const text = (value: string, x: number, y: number, size = 12, opacity = 1,
    heat = 0, align: CanvasTextAlign = 'left', mono = true) => {
    filmText(ctx, fonts, value, x, y, size, alpha * opacity, mono, align, signalColor(heat, 1));
  };

  ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.shadowBlur = 0;
  ctx.setLineDash([]);
  const drawSeries = (key: 'xbar' | 'r', series: SpcControlSeries, top: number, bottom: number,
    titleY: number, title: string) => {
    if (!series.values.length) return;
    const minimum = key === 'r' ? 0 : Math.min(series.lower, series.center, series.upper, ...series.values);
    const maximum = Math.max(series.upper, series.center, series.lower, ...series.values);
    const spread = maximum - minimum;
    const padding = Math.max(spread * .15, Math.abs(series.center) * .0001, .00001);
    const low = key === 'r' ? 0 : minimum - padding;
    const high = Math.max(low + padding, maximum + padding);
    const yFor = (value: number) => bottom - (value - low) / (high - low) * (bottom - top);
    const xFor = (index: number) => series.values.length === 1 ? (left + right) / 2
      : left + index / (series.values.length - 1) * chartWidth;
    const points = series.values.map((value, index) => ({ x: xFor(index), y: yFor(value) }));
    const head = spcTraceHead(time, points.length, key);
    const visible = head >= 0;
    const last = Math.floor(head);
    const precision = Math.max(3, Math.min(6, Math.ceil(-Math.log10(Math.max(.000001, high - low))) + 2));
    const format = (value: number) => Number.isFinite(value) ? value.toFixed(precision) : '—';

    text(title, left, titleY, 21, .97, 0, 'left', false);
    text(`${data.unit} · n = ${analysis.subgroupSize}`, right, titleY, 12, .55, 0, 'right');
    text('CONTROL LIMITS', 538, titleY, 12, .46);

    // Control corridors use the calculated limits, with a luminous edge on the measurement plane.
    const upperY = yFor(series.upper), lowerY = yFor(series.lower);
    const band = ctx.createLinearGradient(0, upperY, 0, Math.max(upperY + 1, lowerY));
    band.addColorStop(0, signalColor(0, .12)); band.addColorStop(.5, signalColor(0, .025));
    band.addColorStop(1, signalColor(0, .095));
    ctx.fillStyle = band; ctx.fillRect(left, upperY, chartWidth, Math.max(0, lowerY - upperY));
    ctx.fillStyle = signalColor(1, .035);
    ctx.fillRect(left, top, chartWidth, Math.max(0, upperY - top));
    ctx.fillRect(left, lowerY, chartWidth, Math.max(0, bottom - lowerY));
    ctx.beginPath();
    for (let index = 0; index < points.length; index += 5) {
      const x = xFor(index); ctx.moveTo(x, top); ctx.lineTo(x, bottom);
    }
    ctx.strokeStyle = signalColor(0, .08); ctx.lineWidth = .75; ctx.stroke();
    if (focus > .001) {
      const x = xFor(selectedIndex), heat = series.violations[selectedIndex] ? 1 : 0;
      ctx.fillStyle = signalColor(heat, focus * .09); ctx.fillRect(x - 10, top, 20, bottom - top);
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom);
      ctx.strokeStyle = signalColor(heat, focus * .3); ctx.setLineDash([2, 4]); ctx.stroke(); ctx.setLineDash([]);
    }

    // Labels remain separate even when a zero-variation sample makes the limits coincide.
    const limits = [
      { name: 'UCL', value: series.upper }, { name: 'CL', value: series.center }, { name: 'LCL', value: series.lower },
    ];
    const labels = limits.map(limit => Math.max(top + 12, Math.min(bottom + 4, yFor(limit.value) + 4)));
    for (let index = 1; index < labels.length; index++) labels[index] = Math.max(labels[index], labels[index - 1] + 24);
    const overshoot = Math.max(0, labels[2] - bottom - 4);
    for (let index = 0; index < labels.length; index++) labels[index] -= overshoot;
    limits.forEach((limit, index) => {
      const y = yFor(limit.value), central = index === 1;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y);
      ctx.setLineDash(central ? [5, 6] : [2, 5]);
      ctx.strokeStyle = signalColor(central ? 0 : .65, central ? .44 : .48);
      ctx.lineWidth = central ? 1 : 1.2; ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(left - 5, y - 4); ctx.lineTo(left, y); ctx.lineTo(left - 5, y + 4);
      ctx.strokeStyle = signalColor(central ? 0 : .65, .76); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(right + 3, y); ctx.lineTo(529, y); ctx.lineTo(536, labels[index] - 4);
      ctx.strokeStyle = signalColor(0, .22); ctx.lineWidth = .75; ctx.stroke();
      text(limit.name, 541, labels[index], 12, central ? .74 : .8, central ? 0 : .65);
      text(format(limit.value), 673, labels[index], 13, .96, central ? 0 : .65, 'right');
    });

    // Only subgroup ticks sit below the plot; there is no full-screen grid or specification line.
    if (key === 'r') {
      const zeroY = yFor(0);
      ctx.beginPath(); ctx.moveTo(left, zeroY); ctx.lineTo(right, zeroY);
      ctx.strokeStyle = signalColor(0, .3); ctx.lineWidth = .75; ctx.stroke();
      text('0', left - 10, zeroY + 4, 12, .55, 0, 'right');
    }
    for (let index = 0; index < points.length; index++) {
      const major = index === 0 || (index + 1) % 5 === 0 || index === points.length - 1;
      const x = xFor(index);
      ctx.beginPath(); ctx.moveTo(x, bottom + 5); ctx.lineTo(x, bottom + (major ? 10 : 7));
      ctx.strokeStyle = signalColor(0, major ? .43 : .16); ctx.lineWidth = 1; ctx.stroke();
      if (major) text(String(index + 1).padStart(2, '0'), x, bottom + 26, 12, .62, 0, 'center');
    }

    if (!visible) return;
    drawSpcControlTrace(ctx, { points, series, head, baseline: yFor(key === 'r' ? 0 : series.center),
      upperY, lowerY, top, bottom, selected: key === selectedSeries ? selectedIndex : null, focus, time });
    if (key === selectedSeries && selectedIndex <= last) {
      selectedPoint = points[selectedIndex];
      if (focus > .001) {
        const point = selectedPoint, heat = series.violations[selectedIndex] ? 1 : 0;
        const align = point.x > right - 110 ? 'right' : 'left';
        const labelX = point.x + (align === 'right' ? -28 : 28);
        const labelY = point.y < top + 25 ? point.y + 23 : point.y - 18;
        text(data.subgroups[selectedIndex].id, labelX, labelY, 13, focus * .96, heat, align);
      }
    }
  };

  drawSeries('xbar', analysis.xbar, 49, 160, 25, 'X̄  /  군 평균 관리도');
  drawSeries('r', analysis.r, 250, 357, 226, 'R  /  군 범위 관리도');
  text(`부분군 ${String(data.subgroups.length).padStart(2, '0')}개  ·  군 크기 ${analysis.subgroupSize}`, left, 407, 12, .54, 0, 'left', false);
  text('SUBGROUP ORDER →', right, 407, 12, .44, 0, 'right');
  ctx.restore();
  return selectedPoint;
}
