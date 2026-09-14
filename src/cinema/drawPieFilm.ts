import { drawPieChart } from './components/drawPieChart';
import { drawChartStage } from './drawChartStage';
import { DEFAULT_FONTS, filmText, signalColor, smooth, type FilmFonts } from './filmDrawing';
import { applyFocusProjection, focusEnvelope, focusProjection, projectFocusPoint } from './filmFocus';
import { DEFAULT_CHART_PRESENTATION, type ChartPresentation } from './chartPresentation';
import type { FilmViewportInsets } from './filmViewport';
import { DEFAULT_PRODUCTION_SNAPSHOT, productionSnapshotState, type ProductionSnapshot } from './productionSnapshot';

export function drawPieFilm(ctx: CanvasRenderingContext2D, width: number, height: number, t: number,
  fonts: FilmFonts = DEFAULT_FONTS, presentation: ChartPresentation = DEFAULT_CHART_PRESENTATION,
  insets?: FilmViewportInsets, snapshot: ProductionSnapshot = DEFAULT_PRODUCTION_SNAPSHOT) {
  drawChartStage(ctx, width, height, t, fonts, 'PRODUCTION / PIE COMPOSITION', insets);
  const state = productionSnapshotState(snapshot);
  const lines = state.lines.map((line, index) => ({ ...line, color: line.color ?? signalColor(index / Math.max(1, state.lines.length - 1), 1) }));
  const selectedIndex = state.selectedIndex ?? 0;
  if (!lines.length) { filmText(ctx, fonts, '표시할 생산 데이터가 없습니다.', 640, 390, 18, .7, false, 'center'); return; }
  const release = 1 - smooth(25, 28, t);
  const intro = smooth(.4, 1.5, t);
  const selection = focusEnvelope(t, { enter: [8, 11], exit: [21.5, 24.5] });
  const chartFocus = focusEnvelope(t, { enter: [5, 8], exit: [22, 24.5] });
  const readFocus = focusEnvelope(t, { enter: [11, 13.2], exit: [21.5, 24.5] });
  const readProjection = focusProjection({ x: 844, y: 400, focus: readFocus, depth: 80, lift: 10 });
  const selected = lines[selectedIndex];
  const before = lines.slice(0, selectedIndex).reduce((sum, item) => sum + item.value, 0);
  const selectedPercent = selected.value / Math.max(1, state.total) * 100;
  const finalRotation = .40 - (before + selected.value / 2) / Math.max(1, state.total) * Math.PI * 2;
  const rotation = -Math.PI / 2 - .48 * (1 - smooth(1, 4, t)) + (finalRotation + Math.PI / 2) * selection;
  const text = (value: string, x: number, y: number, size: number, opacity: number, mono = false,
    align: CanvasTextAlign = 'left', color = '#d7edf0') =>
    filmText(ctx, fonts, value, x, y, size, opacity * release, mono, align, color);

  const anchors = drawPieChart(ctx, fonts, {
    x: 430, y: presentation.dimension === '2d' ? 365 : 345,
    radius: presentation.dimension === '2d' ? 170 : 235, thickness: 70, tilt: .60, time: t - 1, data: lines,
    activeIndex: selectedIndex, selection, focus: chartFocus, rotation, opacity: release, presentation,
  });
  text('전체 생산량', 844, 189, 16, intro * .65);
  text(state.total.toLocaleString('en-US'), 840, 247, 53, intro, true);
  text(state.unit, 1031, 246, 18, intro * .56, true);
  text('라인별 생산량의 구성', 844, 278, 13, intro * .45);

  const anchor = anchors[selectedIndex];
  const link = smooth(11, 12.5, t) * selection * release;
  if (anchor && link > .001) {
    const endpoint = projectFocusPoint(readProjection, { x: 826, y: 335 });
    ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y); ctx.lineTo(anchor.x + 30, anchor.y);
    ctx.lineTo(endpoint.x - 35, endpoint.y); ctx.lineTo(endpoint.x, endpoint.y);
    ctx.strokeStyle = signalColor(1, link * .72); ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(anchor.x, anchor.y, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = signalColor(1, link); ctx.fill();
  }
  const read = smooth(11, 13.2, t) * selection;
  ctx.save(); applyFocusProjection(ctx, readProjection);
  text(`${selected.label} / 구성 비중`, 844, 340, 16, read, true, 'left', selected.color);
  text(selectedPercent.toFixed(1), 840, 414, 72, read, true, 'left', selected.color);
  text('%', 1029, 411, 27, read * .76, true, 'left', selected.color);
  text(`${selected.value.toLocaleString('en-US')} ${state.unit}`, 844, 460, 29, read, true);
  text(`목표 ${state.target.toLocaleString('en-US')} ${state.unit} · ${Math.max(0, state.target - selected.value)} ${state.unit} 남음`,
    844, 494, 14, read * .6);
  ctx.restore();

  lines.forEach((item, index) => {
    const visible = smooth(3.5 + index * .22, 4.5 + index * .22, t);
    const selectedLine = index === selectedIndex;
    const alpha = visible * (selectedLine ? 1 : 1 - selection * .48);
    const x = 110 + index * 220;
    ctx.save(); ctx.globalAlpha = alpha * release;
    ctx.beginPath(); ctx.moveTo(x, 591); ctx.lineTo(x + 174, 591);
    ctx.strokeStyle = item.color; ctx.lineWidth = selectedLine ? 1.7 : .7;
    ctx.globalAlpha *= selectedLine ? .76 : .32; ctx.stroke(); ctx.restore();
    text(item.label, x, 614, 14, alpha * .8, true, 'left', item.color);
    text(`${item.value.toLocaleString('en-US')} ${state.unit}`, x, 642, 22, alpha, true);
    text(`${(item.value / Math.max(1, state.total) * 100).toFixed(1)}%`, x + 174, 641, 15, alpha * .7, true, 'right', item.color);
  });
}
