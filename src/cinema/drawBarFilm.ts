import { drawBarChart } from './components/drawBarChart';
import { PRODUCTION_LINES, PRODUCTION_TARGET, PRODUCTION_TOTAL, SELECTED_LINE_INDEX } from './chartData';
import { drawChartStage } from './drawChartStage';
import { DEFAULT_FONTS, filmText, signalColor, smooth, type FilmFonts } from './filmDrawing';
import { applyFocusProjection, focusEnvelope, focusProjection, projectFocusPoint } from './filmFocus';
import { DEFAULT_CHART_PRESENTATION, type ChartPresentation } from './chartPresentation';
import type { FilmViewportInsets } from './filmViewport';

export function drawBarFilm(ctx: CanvasRenderingContext2D, width: number, height: number, t: number,
  fonts: FilmFonts = DEFAULT_FONTS, presentation: ChartPresentation = DEFAULT_CHART_PRESENTATION,
  insets?: FilmViewportInsets) {
  drawChartStage(ctx, width, height, t, fonts, 'PRODUCTION / BAR COMPARISON', insets);
  const release = 1 - smooth(25, 28, t);
  const intro = smooth(.4, 1.6, t);
  const focus = focusEnvelope(t, { enter: [9, 11.5], exit: [21.5, 24.5] });
  const activeIndex = t >= 9 && t < 24.5 ? SELECTED_LINE_INDEX : undefined;
  const readFocus = focusEnvelope(t, { enter: [11, 13.2], exit: [21.5, 24.5] });
  const readProjection = focusProjection({ x: 955, y: 385, focus: readFocus, depth: 85, lift: 10 });
  const text = (value: string, x: number, y: number, size: number, opacity: number, mono = false, heat = 0) =>
    filmText(ctx, fonts, value, x, y, size, opacity * release, mono, 'left', signalColor(heat, 1));
  const aggregateTarget = PRODUCTION_TARGET * PRODUCTION_LINES.length;
  const aggregateRatio = aggregateTarget > 0 ? PRODUCTION_TOTAL / aggregateTarget : 0;
  const reached = PRODUCTION_LINES.filter(line => line.value >= PRODUCTION_TARGET).length;

  const gauge = (x: number, y: number, width: number, ratio: number, opacity: number, heat = 0) => {
    const segments = 32, slot = width / segments, charge = Math.max(0, Math.min(1, ratio));
    ctx.save(); ctx.globalAlpha = opacity * release;
    for (let segment = 0; segment < segments; segment++) {
      const fill = Math.max(0, Math.min(1, charge * segments - segment));
      ctx.fillStyle = signalColor(heat, .1); ctx.fillRect(x + slot * segment, y, slot - 2, 7);
      if (fill > 0) {
        ctx.fillStyle = signalColor(heat, .72); ctx.fillRect(x + slot * segment, y, (slot - 2) * fill, 7);
      }
      if (segment % 8 === 0) {
        ctx.fillStyle = signalColor(heat, .28); ctx.fillRect(x + slot * segment, y + 11, 1, 3);
      }
    }
    ctx.fillStyle = signalColor(heat, .65); ctx.fillRect(x + width - 1, y - 3, 1, 16);
    ctx.restore();
  };

  text('PRODUCTION TELEMETRY', 150, 177, 25, intro * .94, true);
  text('라인별 생산 실적 · 1교대 · 공통 수량 기준', 151, 204, 12, intro * .52);
  text('05 CHANNELS', 724, 176, 10, intro * .47, true);
  ctx.save(); ctx.globalAlpha = intro * release;
  ctx.beginPath(); ctx.moveTo(136, 157); ctx.lineTo(136, 181); ctx.lineTo(145, 190);
  ctx.strokeStyle = signalColor(0, .65); ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = signalColor(0, .8); ctx.fillRect(139, 157, 3, 5);
  ctx.restore();
  const anchors = drawBarChart(ctx, fonts, {
    x: 150, y: 280, width: 690, height: 250, time: t - 1.1,
    data: PRODUCTION_LINES, maxValue: 1000, target: PRODUCTION_TARGET, unit: 'EA', activeIndex, focus, opacity: release, presentation,
  });

  text('AGGREGATE / TOTAL OUTPUT', 956, 165, 10, intro * .5, true);
  text(PRODUCTION_TOTAL.toLocaleString('en-US'), 953, 208, 42, intro, true);
  text(`EA / ${PRODUCTION_LINES.length} LINES  ·  ${(aggregateRatio * 100).toFixed(1)}%`, 956, 231, 10, intro * .6, true);
  gauge(956, 246, 196, aggregateRatio, intro * .7);
  const selected = PRODUCTION_LINES[SELECTED_LINE_INDEX];
  const difference = selected.value - PRODUCTION_TARGET;
  const selectedRatio = PRODUCTION_TARGET > 0 ? selected.value / PRODUCTION_TARGET : 0;
  const heat = difference < 0 ? 1 : 0;
  const anchor = anchors[SELECTED_LINE_INDEX];
  if (anchor && focus > .001) {
    const reveal = smooth(10, 12, t);
    const endpoint = projectFocusPoint(readProjection, { x: 944, y: 301 });
    ctx.save(); ctx.beginPath(); ctx.rect(anchor.x - 6, 220, (endpoint.x - anchor.x + 6) * reveal, 345); ctx.clip();
    ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y - 10); ctx.lineTo(anchor.x + 44, anchor.y - 40);
    ctx.lineTo(endpoint.x - 32, endpoint.y); ctx.lineTo(endpoint.x, endpoint.y);
    ctx.strokeStyle = signalColor(heat, focus * release * .58); ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(anchor.x, anchor.y - 10, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = signalColor(heat, focus * release * .85); ctx.fill(); ctx.restore();
    const read = smooth(11.5, 13, t) * focus;
    ctx.save(); applyFocusProjection(ctx, readProjection);
    ctx.save(); ctx.globalAlpha = read * release;
    ctx.beginPath(); ctx.moveTo(944, 280); ctx.lineTo(944, 301); ctx.lineTo(951, 308);
    ctx.moveTo(944, 510); ctx.lineTo(944, 531); ctx.lineTo(964, 531);
    ctx.strokeStyle = signalColor(heat, .65); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = signalColor(heat, .6); ctx.fillRect(955, 278, 25, 2);
    ctx.restore();
    text(`${selected.label} / FOCUS`, 955, 302, 15, read, true, heat);
    text('ACTUAL OUTPUT', 955, 325, 9, read * .52, true);
    text(selected.value.toLocaleString('en-US'), 952, 374, 49, read, true, heat);
    text('EA', 1070, 372, 13, read * .67, true, heat);
    text(`${(selectedRatio * 100).toFixed(1)}%`, 955, 408, 25, read, true, heat);
    text('ACHIEVEMENT', 1057, 406, 9, read * .5, true);
    gauge(956, 425, 192, selectedRatio, read, heat);
    text(`TARGET  ${PRODUCTION_TARGET.toLocaleString('en-US')} EA`, 956, 463, 12, read * .67, true);
    const signedDifference = `${difference < 0 ? '−' : '+'}${Math.abs(difference).toLocaleString('en-US')}`;
    text(`Δ ${signedDifference} EA`, 955, 493, 22, read, true, heat);
    text(difference < 0 ? `목표까지 ${Math.abs(difference)} EA 추가 필요`
      : difference > 0 ? `목표보다 ${difference} EA 초과 달성` : '설정한 생산 목표 달성', 956, 519, 12, read * .76, false, heat);
    text('TRUE ZERO / TARGET REFERENCED', 955, 550, 9, read * .38, true);
    ctx.restore();
  }
  const summary = smooth(4.6, 6.3, t);
  const totals = [
    { x: 150, label: 'TARGET / LINE', value: `${PRODUCTION_TARGET.toLocaleString('en-US')} EA` },
    { x: 399, label: 'AGGREGATE ACHIEVEMENT', value: `${(aggregateRatio * 100).toFixed(1)}%` },
    { x: 685, label: 'LINES ON TARGET', value: `${String(reached).padStart(2, '0')} / ${String(PRODUCTION_LINES.length).padStart(2, '0')}` },
  ];
  for (const item of totals) {
    text(item.label, item.x, 616, 9, summary * .43, true);
    text(item.value, item.x, 641, 19, summary * .84, true);
    ctx.save(); ctx.globalAlpha = summary * release;
    ctx.fillStyle = signalColor(0, .45); ctx.fillRect(item.x - 9, 607, 2, 34);
    ctx.restore();
  }
  text(t < 6 ? 'BUILD / 수량 전개' : t < 11 ? 'APPROACH / 라인 접근' : t < 21.5 ? 'FOCUS / 목표 대비' : t < 25 ? 'RETURN / 비교 공간으로' : 'RELEASE / 다음 형태', 72, 689, 10, .5, true);
}
