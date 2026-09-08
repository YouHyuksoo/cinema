import { DEFAULT_FONTS, filmText, signalColor, smooth, type FilmFonts } from './filmDrawing';
import { beginFilmViewport, fillFilmViewport, type FilmViewportInsets } from './filmViewport';
import { drawUnfoldMetric } from './components/drawUnfoldMetric';
import { unfoldMetricsState } from './unfoldMetrics';
import { CORNER_PRODUCTION } from './cornerSequence';
import { FILM_DURATIONS } from './filmProgram';

export const UNFOLD_FILM_SECONDS = FILM_DURATIONS.unfold;

/** Numbers become chart geometry; completed charts keep their place in the final production view. */
export function drawUnfoldFilm(ctx: CanvasRenderingContext2D, width: number, height: number, time: number,
  fonts: FilmFonts = DEFAULT_FONTS, insets?: FilmViewportInsets) {
  const view = beginFilmViewport(ctx, width, height, insets);
  const state = unfoldMetricsState(time), { elapsed, presence, overview } = state;
  ctx.fillStyle = '#040b10'; fillFilmViewport(ctx, view);
  const wash = ctx.createRadialGradient(640, 350, 20, 640, 350, 650);
  wash.addColorStop(0, signalColor(0, .075 * presence)); wash.addColorStop(1, signalColor(0, 0));
  ctx.fillStyle = wash; fillFilmViewport(ctx, view);

  ctx.save(); ctx.globalAlpha = presence;
  // A quiet construction plane gives the moving particles a stable spatial reference.
  for (let index = 0; index < 9; index++) {
    const y = 160 + index * 58;
    ctx.beginPath(); ctx.moveTo(72, y); ctx.bezierCurveTo(365, y - 18, 865, y - 18, 1208, y);
    ctx.strokeStyle = signalColor(0, .022); ctx.lineWidth = .6; ctx.stroke();
  }
  for (let index = 0; index < 45; index++) {
    const x = 85 + index * 173 % 1110, y = 150 + index * 127 % 465;
    ctx.fillStyle = signalColor(0, .045 + Math.sin(elapsed * .4 + index) ** 2 * .05);
    ctx.fillRect(x, y, 1.3, 1.3);
  }
  const introduction = (1 - smooth(1.7, 2.7, elapsed)) * smooth(.2, 1.2, elapsed);
  ctx.strokeStyle = signalColor(0, introduction * .45); ctx.lineWidth = 1;
  for (let ring = 0; ring < 3; ring++) {
    ctx.beginPath(); ctx.ellipse(640, 345, 80 + ring * 32, 20 + ring * 7, -.12, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  filmText(ctx, fonts, '수치가 형태를 갖추기 시작합니다', 640, 413, 17, introduction * presence, false, 'center');

  for (const item of [...state.items].sort((a, b) => a.focus - b.focus)) {
    if (item.settled > .01 && item.settled < .99) {
      ctx.save();
      ctx.beginPath(); ctx.moveTo(640, 345);
      ctx.quadraticCurveTo((640 + item.x) / 2, Math.min(345, item.y) - 35, item.x, item.y);
      ctx.strokeStyle = signalColor(0, item.opacity * Math.sin(item.settled * Math.PI) * .25);
      ctx.lineWidth = 1.2; ctx.setLineDash([3, 7]); ctx.stroke(); ctx.restore();
    }
    drawUnfoldMetric(ctx, fonts, item, state);
  }

  const summary = overview * presence;
  if (summary > .001) {
    ctx.save(); ctx.globalAlpha = summary;
    ctx.strokeStyle = signalColor(0, .38); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(114, 374); ctx.lineTo(114, 366); ctx.lineTo(1166, 366); ctx.lineTo(1166, 374);
    ctx.moveTo(114, 402); ctx.lineTo(114, 410); ctx.lineTo(1166, 410); ctx.lineTo(1166, 402); ctx.stroke();
    for (const item of state.items) {
      const endY = item.y < 390 ? 366 : 410;
      const fromY = item.y + (item.y < 390 ? 1 : -1) * 170 * item.scale;
      ctx.beginPath(); ctx.moveTo(item.x, fromY); ctx.lineTo(item.x, endY);
      ctx.strokeStyle = signalColor(item.metric.heat, .55); ctx.stroke();
      ctx.beginPath(); ctx.arc(item.x, endY, 2.5, 0, Math.PI * 2); ctx.fillStyle = signalColor(item.metric.heat, .8); ctx.fill();
    }
    ctx.restore();
    const totals = [
      { label: '생산 목표', value: CORNER_PRODUCTION.target, x: 205, heat: 0 },
      { label: '생산 실적', value: CORNER_PRODUCTION.actual, x: 545, heat: 0 },
      { label: '생산 잔여', value: CORNER_PRODUCTION.remaining, x: 885, heat: 1 },
    ];
    for (const total of totals) {
      filmText(ctx, fonts, total.label, total.x, 394, 14, summary * .65);
      filmText(ctx, fonts, total.value.toLocaleString('en-US'), total.x + 104, 398, 28, summary, true, 'left', signalColor(total.heat, 1));
      filmText(ctx, fonts, 'EA', total.x + 205, 397, 11, summary * .55, true);
    }
    filmText(ctx, fonts, '−', 495, 397, 26, summary * .5, true);
    filmText(ctx, fonts, '=', 835, 397, 24, summary * .5, true);
  }

  filmText(ctx, fonts, 'METRICS / DATA TRANSFORMATION', 72, 76, 14, presence * .65, true);
  filmText(ctx, fonts, overview > .5 ? '흩어진 지표가 하나의 생산 현황으로' : '숫자가 차트가 되고, 차트가 현황이 됩니다', 72, 104, 20, presence * .92);
  filmText(ctx, fonts, '시연 데이터 / 목표 · 실적 · 품질 · 속도', 1208, 104, 11, presence * .5, false, 'right');
  const active = state.activeIndex === null ? null : state.items[state.activeIndex];
  const phase = elapsed < 2 ? '01 / READ THE NUMBER' : overview > 0 ? '04 / PRODUCTION SYNTHESIS'
    : active && active.morph < .01 ? '01 / READ THE NUMBER' : active && active.settled < .01 ? '02 / NUMBER TO CHART' : '03 / PLACE THE CHART';
  filmText(ctx, fonts, phase, 72, 689, 10, presence * .5, true);
  const caption = overview > 0 ? '계획과 실적의 차이에 품질·사이클 지표를 함께 놓고 읽습니다.'
    : active ? active.settled > .01 ? '완성된 차트가 자리를 잡고, 다음 지표를 위한 공간을 만듭니다.'
      : active.morph > .01 ? `${active.metric.label} · 숫자의 빛 조각이 차트의 형태로 이어집니다.`
        : `${active.metric.label}  /  ${active.metric.reference}` : '숫자 → 형태 → 배치 → 종합';
  filmText(ctx, fonts, caption, 640, 655, 14, presence * .7, false, 'center');
}
