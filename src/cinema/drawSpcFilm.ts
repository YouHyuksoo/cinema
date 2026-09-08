import { drawCornerField } from './components/drawCornerField';
import { drawHolographicCore } from './components/drawHolographicCore';
import { drawProjectedFilmSurface } from './components/drawProjectedFilmSurface';
import { drawSpcControlCharts, SPC_CONTROL_SIZE } from './components/drawSpcControlCharts';
import { drawSpcHistogram, SPC_HISTOGRAM_SIZE } from './components/drawSpcHistogram';
import { drawSpcInspection } from './components/drawSpcInspection';
import { drawSpcSequence } from './components/drawSpcSequence';
import { DEFAULT_FONTS, filmText, signalColor, smooth, type FilmFonts } from './filmDrawing';
import { beginFilmViewport, type FilmViewportInsets } from './filmViewport';
import { DEFAULT_SPC_DATA } from './spcData';
import { spcPanelProjection, spcSceneState } from './spcScene';
import { analyzeSpc } from './spcStatistics';
import type { SpcData } from './spcTypes';

const numeric = (value: number | null, digits = 3) => value === null || !Number.isFinite(value) ? '—' : value.toFixed(digits);

/** One measurement snapshot supplies the limits, distribution and capability at every stage. */
export function drawSpcFilm(ctx: CanvasRenderingContext2D, width: number, height: number, time: number,
  fonts: FilmFonts = DEFAULT_FONTS, insets?: FilmViewportInsets, data: SpcData = DEFAULT_SPC_DATA) {
  const view = beginFilmViewport(ctx, width, height, insets), state = spcSceneState(time);
  drawCornerField(ctx, view, state.time, state.capability * .6 + state.controlFocus * .2);
  ctx.save(); ctx.fillStyle = 'rgba(4,11,16,.44)';
  ctx.fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top); ctx.restore();
  const analysis = analyzeSpc(data);
  const text = (value: string, x: number, y: number, size: number, alpha: number, mono = false,
    align: CanvasTextAlign = 'left', heat = 0) =>
    filmText(ctx, fonts, value, x, y, size, state.reveal * alpha, mono, align, signalColor(heat, 1));
  text('SPC', 72, 69, 12, .6, true);
  text(data?.name ?? '측정 데이터 없음', 1208, 102, 12, .56, false, 'right');
  if (!analysis.valid) {
    text('SPC 데이터를 확인해 주세요', 640, 326, 28, .9, false, 'center', 1);
    text(analysis.reason, 640, 367, 15, .8, false, 'center');
    return;
  }

  const controlProjection = spcPanelProjection(state.controls);
  let anchor: { x: number; y: number } | undefined;
  ctx.save(); ctx.globalAlpha = state.controlsOpacity;
  drawProjectedFilmSurface(ctx, { ...SPC_CONTROL_SIZE, project: controlProjection, draw: surface => {
    surface.translate(-SPC_CONTROL_SIZE.width / 2, -SPC_CONTROL_SIZE.height / 2);
    const point = drawSpcControlCharts(surface, fonts, data, analysis,
      { time: state.time, reveal: state.controlReveal, focus: state.controlFocus });
    if (point) anchor = controlProjection(point.x - SPC_CONTROL_SIZE.width / 2, point.y - SPC_CONTROL_SIZE.height / 2);
  } });
  ctx.restore();

  const inspection = (1 - smooth(12, 14, state.time)) * smooth(2, 3.5, state.time);
  const heat = analysis.outOfControl ? 1 : 0;
  drawSpcSequence(ctx, fonts, state);
  drawSpcInspection(ctx, fonts, data, analysis, { time: state.time,
    focus: state.controlFocus, opacity: inspection * state.reveal, anchor });

  if (state.histogramOpacity > .001) {
    ctx.save(); ctx.globalAlpha = state.histogramOpacity;
    drawProjectedFilmSurface(ctx, { ...SPC_HISTOGRAM_SIZE, project: spcPanelProjection(state.histogram), draw: surface => {
      surface.translate(-SPC_HISTOGRAM_SIZE.width / 2, -SPC_HISTOGRAM_SIZE.height / 2);
      drawSpcHistogram(surface, fonts, data, analysis, { time: state.time, reveal: state.histogramReveal,
        focus: smooth(18, 20, state.time) * (1 - state.capability) });
    } });
    ctx.restore();
  }
  const distributionText = smooth(15, 17, state.time) * (1 - smooth(23, 25, state.time));
  if (distributionText > .001) {
    text('01 / CONTROL HISTORY', 244, 226, 12, distributionText * .65, true, 'center');
    text(`이탈 부분군 ${analysis.violationCount}개`, 244, 537, 17, distributionText * .9, false, 'center', heat);
    text(`LSL ${numeric(data.lsl)}  /  USL ${numeric(data.usl)}`, 772, 589, 16, distributionText * .84, true, 'center', 1);
    text('규격 한계는 관리한계와 별도로 입력합니다', 772, 617, 13, distributionText * .6, false, 'center');
  }

  if (state.coreOpacity > .001) {
    // The two chart planes recede while the capability instrument approaches the focal plane.
    ctx.save(); ctx.translate(state.core.x, state.core.y); ctx.scale(state.core.scale, state.core.scale);
    drawHolographicCore(ctx, fonts, { time: Math.max(0, state.time - 26), reveal: 1,
      opacity: state.coreOpacity, title: '공정능력', label: 'Cpk / WITHIN', value: numeric(analysis.cpk),
      unit: 'PROCESS CAPABILITY INDEX', progress: (analysis.cpk ?? 0) / data.cpkTarget,
      progressLabel: `설정 목표 ${numeric(data.cpkTarget, 2)}`, eyebrow: '03 / CAPABILITY',
      status: analysis.outOfControl ? '관리한계 이탈 · Cpk 참고값' : '3σ 한계 이탈 없음 · 정규성 미검증',
      detail: `Cp ${numeric(analysis.cp)}  ·  σw ${numeric(analysis.sigmaWithin, 4)}` });
    ctx.restore();
    const reading = state.coreOpacity / Math.max(.001, state.reveal);
    text('01 / X̄–R', 245, 227, 13, reading * .62, true, 'center');
    text(`${analysis.violationCount}개 부분군 이탈`, 245, 533, 16, reading * .85, false, 'center', heat);
    text('02 / DISTRIBUTION', 1030, 257, 12, reading * .62, true, 'center');
    text(`규격 밖 ${analysis.outsideSpecs} / ${analysis.totalSamples}개`, 1030, 535, 15, reading * .85, false, 'center', analysis.outsideSpecs ? 1 : 0);
    text(analysis.sigmaWithin === 0 ? '군내 변동이 0이므로 Cp / Cpk를 산출할 수 없습니다.'
      : analysis.outOfControl ? '공정 안정성 확인 필요 · 정규성 미검증 · 능력지수는 참고값'
        : '정규성 미검증 · 공정 안정성 추가 확인 후 능력지수를 해석하세요',
    640, 596, 14, reading * .84, false, 'center', heat);
    text(`군내 σ = R̄ / d₂   ·   설정 목표 Cpk ≥ ${numeric(data.cpkTarget, 2)}`, 640, 622, 12, reading * .53, true, 'center');
  }
  text(`${analysis.totalSamples} READINGS / DEMO DATA`, 1208, 689, 10, .48, true, 'right');
}
