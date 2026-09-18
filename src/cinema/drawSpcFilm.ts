import { drawCornerField } from './components/drawCornerField';
import { drawSpcControlCharts } from './components/drawSpcControlCharts';
import { drawSpcHistogram } from './components/drawSpcHistogram';
import { drawSpcCapability } from './components/drawSpcCapability';
import { DEFAULT_FONTS, filmText, signalColor, smooth, type FilmFonts } from './filmDrawing';
import { beginFilmViewport, type FilmViewportInsets } from './filmViewport';
import { DEFAULT_SPC_DATA } from './spcData';
import { spcTargetAnalysis, spcTour } from './spcTour';
import type { SpcData } from './spcTypes';

/** All three instruments read the same selected feed snapshot throughout the tour. */
export function drawSpcFilm(ctx: CanvasRenderingContext2D, width: number, height: number, time: number,
  fonts: FilmFonts = DEFAULT_FONTS, insets?: FilmViewportInsets, data: SpcData = DEFAULT_SPC_DATA) {
  const view = beginFilmViewport(ctx, width, height, insets);
  const tour = spcTour(data, time);
  drawCornerField(ctx, view, time, .25);
  const text = (value: string, x: number, y: number, size = 14, alpha = 1) =>
    filmText(ctx, fonts, value, x, y, size, alpha, false, 'left', signalColor(0, 1));
  ctx.save();
  ctx.fillStyle = 'rgba(4,11,16,.62)';
  ctx.fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top);
  text('SMT / SPC 공정 분석', 35, 65, 27);
  text('X̄–R 관리도 · 히스토그램 · Cpk 공정능력', 35, 97, 14, .65);
  text('분석 대상 / 자동 순회', 1000, 95, 18);
  const rowHeight = 66, visibleRows = 7;
  const first = Math.max(0, Math.min(tour.index - 3, tour.targets.length - visibleRows));
  tour.targets.slice(first, first + visibleRows).forEach((target, offset) => {
    const index = first + offset, active = index === tour.index, y = 135 + offset * rowHeight;
    ctx.fillStyle = signalColor(0, active ? .16 : .025);
    ctx.fillRect(988, y, 264, 58);
    if (active) {
      ctx.fillStyle = signalColor(0, .95); ctx.fillRect(988, y, 3, 58);
      ctx.fillRect(992, y + 56, 260 * tour.progress, 2);
    }
    text(`${String(index + 1).padStart(2, '0')}  ${target.name}`, 1004, y + 25, 14, active ? 1 : .5);
    text(`${target.unit}  ·  ${target.subgroups.length} 부분군`, 1030, y + 45, 11, active ? .8 : .35);
  });
  const target = tour.target;
  if (!target) { text('분석 대상 데이터가 없습니다', 80, 330, 24); ctx.restore(); return; }
  text(target.name, 35, 137, 20);
  const analysis = spcTargetAnalysis(target);
  if (!analysis.valid) { text(analysis.reason, 35, 330, 18); ctx.restore(); return; }
  // Accelerate only the trace reveal, then leave all charts readable until the next target.
  const reveal = .25 + .75 * smooth(0, .22, tour.progress);
  ctx.save(); ctx.translate(22, 168); ctx.scale(.82, .82);
  drawSpcControlCharts(ctx, fonts, target, analysis, { time: 2.5 + tour.progress * 30, reveal: 1, focus: 0 });
  ctx.restore();
  ctx.save(); ctx.translate(584, 146); ctx.scale(.69, .69);
  drawSpcHistogram(ctx, fonts, target, analysis, { time, reveal, focus: 0 });
  ctx.restore();
  ctx.save(); ctx.translate(595, 424);
  drawSpcCapability(ctx, fonts, target, analysis);
  ctx.restore();
  text(`평균 ${analysis.mean.toFixed(3)} ${target.unit}`, 50, 557, 19);
  text(`부분군 ${analysis.subgroupSize}개씩 · 총 ${analysis.totalSamples}개 측정`, 50, 590, 14, .75);
  text(`관리한계 이탈 ${analysis.violationCount}개 · 규격 밖 ${analysis.outsideSpecs}개`, 50, 618, 14, .75);
  text(analysis.outOfControl ? '관리한계 이탈 · 공정능력은 참고값' : '3σ 한계 이탈 없음 · 정규성 미검증', 50, 650, 13, .65);
  text(`${tour.index + 1} / ${tour.targets.length}`, 1000, 655, 15, .75);
  text(data === DEFAULT_SPC_DATA ? '시뮬레이션 측정값 / 예시 규격' : '연결된 품질 피드 / 입력 규격', 35, 695, 12, .45);
  ctx.restore();
}
