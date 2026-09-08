import { filmText, signalColor, smooth, type FilmFonts } from '../filmDrawing';
import { cornerCoreAnchor } from '../cornerCoreGeometry';
import { spcPanelProjection, type spcSceneState } from '../spcScene';
import { SPC_CONTROL_SIZE } from './drawSpcControlCharts';
import { SPC_HISTOGRAM_SIZE } from './drawSpcHistogram';

type SceneState = ReturnType<typeof spcSceneState>;

/** Attach the assembled chart planes to the capability instrument without moving any data. */
export function drawSpcSequence(ctx: CanvasRenderingContext2D, fonts: FilmFonts, state: SceneState) {
  ctx.save(); ctx.globalAlpha = state.reveal;
  const corePort = (side: -1 | 1) => {
    const point = cornerCoreAnchor(Math.max(0, state.time - 26), side, true);
    return { x: state.core.x + point.x * state.core.scale, y: state.core.y + point.y * state.core.scale };
  };
  const links = [
    { start: spcPanelProjection(state.controls)(SPC_CONTROL_SIZE.width / 2, 0), end: corePort(-1) },
    { start: spcPanelProjection(state.histogram)(-SPC_HISTOGRAM_SIZE.width / 2, 0), end: corePort(1) },
  ];
  const strength = state.coreOpacity * smooth(27, 28.5, state.time);
  if (strength > .001) for (const link of links) {
    const { start, end } = link;
    ctx.beginPath(); ctx.moveTo(start.x, start.y);
    ctx.bezierCurveTo(start.x, end.y, end.x, start.y, end.x, end.y);
    ctx.strokeStyle = signalColor(0, strength * .1); ctx.lineWidth = 6; ctx.stroke();
    ctx.strokeStyle = signalColor(0, strength * .72); ctx.lineWidth = 1.1; ctx.stroke();
    for (const point of [start, end]) {
      ctx.beginPath(); ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = signalColor(0, strength * .9); ctx.fill();
    }
  }

  const phases = [
    { name: '01  군 평균·범위', start: 0, end: 12 },
    { name: '02  실측 분포', start: 12, end: 26 },
    { name: '03  공정능력', start: 26, end: 36 },
  ];
  phases.forEach((phase, index) => {
    const x = 72 + index * 390, width = 356;
    const progress = smooth(phase.start, phase.end, state.time);
    const active = state.time >= phase.start && state.time < phase.end;
    filmText(ctx, fonts, phase.name, x, 645, 12, state.reveal * (active ? .98 : progress === 1 ? .6 : .28));
    ctx.fillStyle = signalColor(0, .12); ctx.fillRect(x, 657, width, 1);
    ctx.fillStyle = signalColor(0, active ? .88 : .45); ctx.fillRect(x, 656, width * progress, 2);
    if (active) {
      ctx.fillStyle = signalColor(0, .94); ctx.fillRect(x + width * progress - 2, 654, 4, 6);
    }
  });
  ctx.restore();
}
