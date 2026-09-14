import { drawPieChart } from './components/drawPieChart';
import { drawChartStage } from './drawChartStage';
import { DEFAULT_CHART_PRESENTATION, type ChartPresentation, type ChartStyle } from './chartPresentation';
import { DEFAULT_FONTS, filmText, signalColor, smooth, type FilmFonts } from './filmDrawing';
import type { FilmViewportInsets } from './filmViewport';
import { DEFAULT_PRODUCTION_SNAPSHOT, productionSnapshotState, type ProductionSnapshot } from './productionSnapshot';

const ORDER: Exclude<ChartStyle, 'auto'>[] = ['bar', 'line', 'area', 'scatter', 'pie'];
const LABELS: Record<Exclude<ChartStyle, 'auto'>, string> = { bar: '막대', line: '선', area: '영역', scatter: '산포', pie: '파이' };

export function activeChartStyle(style: ChartStyle | undefined, time: number) {
  if (style && style !== 'auto') return style;
  return ORDER[Math.floor(Math.max(0, time - 1.5) / 5.1) % ORDER.length]!;
}

/** One feed snapshot rendered through interchangeable chart grammars on the same spatial stage. */
export function drawMultiChartFilm(ctx: CanvasRenderingContext2D, width: number, height: number, time: number,
  fonts: FilmFonts = DEFAULT_FONTS, presentation: ChartPresentation = DEFAULT_CHART_PRESENTATION,
  insets?: FilmViewportInsets, input: ProductionSnapshot = DEFAULT_PRODUCTION_SNAPSHOT) {
  drawChartStage(ctx, width, height, time, fonts, 'PRODUCTION / CHART ANALYSIS', insets);
  const state = productionSnapshotState(input);
  const auto = !presentation.style || presentation.style === 'auto';
  const style = activeChartStyle(presentation.style, time);
  const release = 1 - smooth(25.5, 28, time);
  const reveal = smooth(.45, 1.7, time) * release;
  const phaseTime = auto ? ((Math.max(0, time - 1.5) % 5.1) + .8) : time;
  const data = state.lines.map((line, index) => ({ ...line, chartValue: state.target > 0 ? line.value / state.target * 100 : 0,
    display: `${line.value.toLocaleString('ko-KR')} ${state.unit}`, color: line.color ?? signalColor(index / Math.max(1, state.lines.length - 1), 1) }));

  filmText(ctx, fonts, 'LIVE PRODUCTION DATA', 108, 163, 22, reveal, true);
  filmText(ctx, fonts, `${String(data.length).padStart(2, '0')} CHANNELS · TARGET ${state.target.toLocaleString('en-US')} ${state.unit}`,
    108, 190, 10, reveal * .58, true);
  ORDER.forEach((item, index) => {
    const selected = item === style;
    const x = 108 + index * 112;
    ctx.save(); ctx.globalAlpha = reveal * (selected ? .95 : .28);
    ctx.fillStyle = selected ? signalColor(0, .16) : 'rgba(4,15,21,.22)'; ctx.fillRect(x, 208, 94, 28);
    ctx.strokeStyle = signalColor(selected ? 0 : .15, selected ? .8 : .22); ctx.strokeRect(x + .5, 208.5, 93, 27);
    ctx.restore();
    filmText(ctx, fonts, LABELS[item], x + 47, 227, 11, reveal * (selected ? 1 : .42), true, 'center');
  });
  filmText(ctx, fonts, auto ? 'AUTO SEQUENCE' : 'MANUAL HOLD', 1180, 165, 10, reveal * .55, true, 'right');
  filmText(ctx, fonts, `${presentation.dimension.toUpperCase()} · DEPTH ${Math.round(presentation.depthScale * 100)}%`, 1180, 190, 12, reveal, true, 'right');

  if (!data.length) {
    filmText(ctx, fonts, '표시할 생산 데이터가 없습니다.', 640, 390, 18, reveal * .7, false, 'center');
    return;
  }
  if (style === 'pie') drawPie(ctx, fonts, data.map(item => ({ ...item, value: item.value })), presentation, phaseTime, reveal);
  else drawCartesian(ctx, fonts, data, style, presentation, phaseTime, reveal);
  drawSummary(ctx, fonts, state.total, state.aggregateRatio, state.reached, data.length, state.unit, reveal);
}

function drawCartesian(ctx: CanvasRenderingContext2D, fonts: FilmFonts,
  data: { label: string; chartValue: number; display: string; color: string }[],
  style: Exclude<ChartStyle, 'auto' | 'pie'>, presentation: ChartPresentation, time: number, opacity: number) {
  const x = 116, y = 275, w = 800, h = 300, baseline = y + h;
  const cap = 120, target = 100;
  const depth = presentation.dimension === '3d' ? 18 * presentation.depthScale : 0;
  const progress = smooth(.2, 1.45, time);
  const points = data.map((item, index) => ({
    x: x + (index + .5) * w / data.length,
    y: baseline - item.chartValue / cap * h * progress,
    item,
  }));
  ctx.save(); ctx.globalAlpha = opacity;
  for (let tick = 0; tick <= 4; tick++) {
    const py = baseline - h * tick / 4;
    ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x + w, py);
    ctx.strokeStyle = signalColor(0, tick ? .13 : .38); ctx.lineWidth = tick ? .7 : 1.2; ctx.stroke();
    filmText(ctx, fonts, Math.round(cap * tick / 4).toLocaleString('en-US'), x - 15, py + 3, 9, opacity * .45, true, 'right');
  }
  const targetY = baseline - target / cap * h;
  ctx.setLineDash([5, 8]); ctx.beginPath(); ctx.moveTo(x, targetY); ctx.lineTo(x + w, targetY);
  ctx.strokeStyle = signalColor(1, .52); ctx.stroke(); ctx.setLineDash([]);
  filmText(ctx, fonts, `TARGET ${target.toLocaleString('en-US')}`, x + w, targetY - 8, 9, opacity * .65, true, 'right', signalColor(1, 1));

  if (style === 'bar') {
    const slot = w / data.length, barW = Math.min(92, slot * .48);
    for (const [index, point] of points.entries()) {
      const height = baseline - point.y, left = point.x - barW / 2;
      if (depth) {
        ctx.fillStyle = signalColor(index / Math.max(1, data.length - 1), .11);
        ctx.fillRect(left + depth, point.y - depth, barW, height);
        ctx.beginPath(); ctx.moveTo(left, point.y); ctx.lineTo(left + depth, point.y - depth); ctx.lineTo(left + barW + depth, point.y - depth); ctx.lineTo(left + barW, point.y); ctx.closePath();
        ctx.fillStyle = signalColor(index / Math.max(1, data.length - 1), .3); ctx.fill();
      }
      const gradient = ctx.createLinearGradient(0, point.y, 0, baseline);
      gradient.addColorStop(0, point.item.color); gradient.addColorStop(1, signalColor(0, .12));
      ctx.fillStyle = gradient; ctx.fillRect(left, point.y, barW, height);
      ctx.strokeStyle = point.item.color; ctx.strokeRect(left + .5, point.y + .5, barW - 1, height - 1);
    }
  } else {
    if (depth) {
      ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(point.x + depth, point.y - depth) : ctx.moveTo(point.x + depth, point.y - depth));
      ctx.strokeStyle = signalColor(0, .18); ctx.lineWidth = 7; ctx.stroke();
    }
    if (style === 'area') {
      const fill = ctx.createLinearGradient(0, y, 0, baseline);
      fill.addColorStop(0, signalColor(0, .36)); fill.addColorStop(1, signalColor(0, .015));
      ctx.beginPath(); ctx.moveTo(points[0].x, baseline); points.forEach(point => ctx.lineTo(point.x, point.y)); ctx.lineTo(points.at(-1)!.x, baseline); ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
    }
    if (style !== 'scatter') {
      ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.strokeStyle = signalColor(0, .9); ctx.lineWidth = 2.2; ctx.shadowColor = signalColor(0, .7); ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0;
    }
    points.forEach((point, index) => {
      const radius = style === 'scatter' ? 7 + (point.item.chartValue / cap) * 10 : 5;
      ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = point.item.color; ctx.globalAlpha = opacity * (style === 'scatter' ? .72 : 1); ctx.fill();
      ctx.globalAlpha = opacity; ctx.strokeStyle = '#e9fdff'; ctx.lineWidth = 1; ctx.stroke();
      if (style === 'scatter') {
        ctx.beginPath(); ctx.arc(point.x, point.y, radius + 7 + Math.sin(time * 2 + index) * 2, 0, Math.PI * 2);
        ctx.strokeStyle = signalColor(index / Math.max(1, data.length - 1), .24); ctx.stroke();
      }
    });
  }
  points.forEach(point => {
    filmText(ctx, fonts, point.item.label, point.x, baseline + 28, 12, opacity * .72, true, 'center');
    filmText(ctx, fonts, point.item.display, point.x, baseline + 49, 11, opacity, true, 'center');
  });
  ctx.restore();
}

function drawPie(ctx: CanvasRenderingContext2D, fonts: FilmFonts,
  data: { label: string; value: number; color: string }[], presentation: ChartPresentation, time: number, opacity: number) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  drawPieChart(ctx, fonts, {
    x: 485, y: presentation.dimension === '2d' ? 410 : 385, radius: presentation.dimension === '2d' ? 155 : 205,
    thickness: 64, tilt: .6, time, data, activeIndex: data.findIndex(item => item.value === Math.max(...data.map(entry => entry.value))),
    selection: smooth(1.2, 2.4, time), focus: smooth(.5, 1.8, time), rotation: -.7, opacity, presentation,
  });
  data.forEach((item, index) => {
    const py = 287 + index * 48;
    ctx.fillStyle = item.color; ctx.globalAlpha = opacity; ctx.fillRect(775, py - 10, 18, 3);
    filmText(ctx, fonts, item.label, 810, py, 13, opacity * .72, true);
    filmText(ctx, fonts, `${(item.value / Math.max(1, total) * 100).toFixed(1)}%`, 1010, py, 19, opacity, true, 'right', item.color);
  });
}

function drawSummary(ctx: CanvasRenderingContext2D, fonts: FilmFonts, total: number, ratio: number, reached: number, count: number, unit: string, opacity: number) {
  filmText(ctx, fonts, 'AGGREGATE OUTPUT', 1018, 380, 9, opacity * .48, true);
  filmText(ctx, fonts, total.toLocaleString('en-US'), 1018, 424, 38, opacity, true);
  filmText(ctx, fonts, unit, 1178, 423, 12, opacity * .58, true, 'right');
  filmText(ctx, fonts, `${(ratio * 100).toFixed(1)}% ACHIEVEMENT`, 1018, 458, 13, opacity * .75, true);
  filmText(ctx, fonts, `${String(reached).padStart(2, '0')} / ${String(count).padStart(2, '0')} ON TARGET`, 1018, 491, 11, opacity * .55, true);
}
