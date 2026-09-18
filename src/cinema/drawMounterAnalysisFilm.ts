import { drawMounterTransport } from './components/drawMounterTransport';
import { drawMounterLockOn } from './components/drawMounterLockOn';
import { drawMounterCabinet } from './components/drawMounterCabinet';
import { drawChartStage } from './drawChartStage';
import { DEFAULT_FONTS, filmText, signalColor, smooth, type FilmFonts } from './filmDrawing';
import type { FilmViewportInsets } from './filmViewport';
import { DEFAULT_MOUNTER_ANALYSIS, mounterAnalysisState, mounterTourState, type MounterAnalysisData } from './mounterAnalysis';

/** One SMT line with up to five mounters. The camera tours sideways while PCBs keep flowing on one conveyor. */
export function drawMounterAnalysisFilm(ctx: CanvasRenderingContext2D, width: number, height: number, time: number,
  fonts: FilmFonts = DEFAULT_FONTS, insets?: FilmViewportInsets, input: MounterAnalysisData = DEFAULT_MOUNTER_ANALYSIS) {
  drawChartStage(ctx, width, height, time, fonts, 'EQUIPMENT / MOUNTER ANALYSIS', insets);
  const state = mounterAnalysisState(input);
  const tour = mounterTourState(state.mounters.length, time);
  const active = state.mounters[tour.activeIndex];
  const reveal = smooth(.35, 1.6, time) * (1 - smooth(25.5, 28, time));

  filmText(ctx, fonts, state.name, 72, 145, 20, reveal, true);
  filmText(ctx, fonts, `PCB FLOW  →  ${state.mounters.map((_, index) => String(index + 1).padStart(2, '0')).join('  →  ')}`, 72, 170, 10, reveal * .58, true);
  if (!active) {
    filmText(ctx, fonts, '마운터 데이터 대기', 640, 380, 17, reveal, true, 'center');
    return;
  }

  ctx.save(); ctx.globalAlpha = reveal;
  drawMounterTransport(ctx, tour.focus, state.mounters.length, time); ctx.restore();
  state.mounters.forEach((mounter, index) => {
    const x = 640 + (index - tour.focus) * 350;
    const distance = Math.abs(index - tour.focus);
    if (x < -230 || x > 1510) return;
    drawMachine(ctx, fonts, x, 345, time, index, 1, reveal * Math.max(.45, 1 - distance * .2), index === tour.activeIndex, mounter.label, () => {
      ctx.save(); ctx.translate(-x, -345);
      drawMounterTransport(ctx, tour.focus, state.mounters.length, time); ctx.restore();
    });
  });

  drawMounterLockOn(ctx, fonts, 640 + (tour.activeIndex - tour.focus) * 350,
    Math.abs(tour.activeIndex - tour.focus), time, reveal, tour.activeIndex);
  const alarm = active.metrics.length - active.normal;
  filmText(ctx, fonts, `${String(tour.activeIndex + 1).padStart(2, '0')} / ${String(state.mounters.length).padStart(2, '0')}`, 1200, 145, 12, reveal, true, 'right');
  filmText(ctx, fonts, active.label, 1200, 169, 16, reveal, true, 'right');
  filmText(ctx, fonts, `HEALTH ${active.score.toFixed(1)} · ${alarm ? `${alarm} CHECK` : 'NORMAL'}`, 1200, 191, 10, reveal * .72, true, 'right', alarm ? signalColor(1, 1) : signalColor(0, 1));

  const panelWidth = 181;
  active.metrics.slice(0, 6).forEach((metric, index) =>
    drawMetric(ctx, fonts, metric, 72 + index * (panelWidth + 13), 555, panelWidth, time - index * .08, reveal));

  // Tour progress and station positions use the same world coordinate as the equipment.
  ctx.save(); ctx.globalAlpha = reveal * .55; ctx.strokeStyle = signalColor(0, .22); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(394, 521); ctx.lineTo(886, 521); ctx.stroke();
  state.mounters.forEach((_, index) => {
    const x = 394 + (state.mounters.length === 1 ? 246 : index / (state.mounters.length - 1) * 492);
    ctx.beginPath(); ctx.arc(x, 521, index === tour.activeIndex ? 5 : 2.5, 0, Math.PI * 2);
    ctx.fillStyle = index === tour.activeIndex ? signalColor(0, 1) : signalColor(0, .3); ctx.fill();
  });
  ctx.restore();
}

function drawMachine(ctx: CanvasRenderingContext2D, fonts: FilmFonts, x: number, y: number, time: number, index: number,
  scale: number, alpha: number, selected: boolean, label: string, transport: () => void) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.scale(scale, scale);
  drawMounterCabinet(ctx, time, index, transport);
  ctx.restore();
  filmText(ctx, fonts, label, x, y + 160 * scale, selected ? 13 : 10, alpha, true, 'center', selected ? signalColor(0, 1) : signalColor(0, .7));
}

function drawMetric(ctx: CanvasRenderingContext2D, fonts: FilmFonts,
  metric: ReturnType<typeof mounterAnalysisState>['metrics'][number], x: number, y: number, width: number, time: number, opacity: number) {
  const warning = metric.performance < 100, color = warning ? signalColor(1, 1) : metric.color ?? signalColor(0, 1);
  const reveal = smooth(.2, .85, time) * opacity;
  ctx.save(); ctx.globalAlpha = reveal;
  ctx.fillStyle = 'rgba(3,12,17,.72)'; ctx.fillRect(x, y, width, 82);
  ctx.strokeStyle = warning ? signalColor(1, .52) : signalColor(0, .28); ctx.strokeRect(x + .5, y + .5, width - 1, 81);
  ctx.fillStyle = color; ctx.fillRect(x, y, 3, 82);
  filmText(ctx, fonts, metric.label, x + 12, y + 21, 10, reveal * .68, true);
  filmText(ctx, fonts, metric.value.toLocaleString('ko-KR'), x + 12, y + 52, 21, reveal, true, 'left', color);
  filmText(ctx, fonts, metric.unit, x + 92, y + 51, 9, reveal * .56, true);
  filmText(ctx, fonts, warning ? 'CHECK' : 'NORMAL', x + width - 12, y + 21, 8, reveal * .82, true, 'right', color);
  filmText(ctx, fonts, `기준 ${metric.direction === 'higher' ? '≥' : '≤'} ${metric.target}`, x + width - 12, y + 62, 8, reveal * .46, true, 'right');
  ctx.restore();
}
