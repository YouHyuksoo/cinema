import { filmText, signalColor, smooth, type FilmFonts } from '../filmDrawing';
import { SMT_LINE } from '../smtLine';
import { TRACE_TIMING, TRACE_WORK_ORDER, workOrderTraceState, type WorkOrderTraceState } from '../workOrderTrace';
import { infoPanelFrame, type InfoPanelFrameVariant } from './infoPanelFrame';

// Sample the same deterministic production model once; the graph has no independent clock.
const HISTORY = Array.from({ length: 121 }, (_, index) => {
  const at = index / 120 * TRACE_TIMING.summaryAt;
  const state = workOrderTraceState(at);
  return { at, good: state.completedGood, defects: state.defectCount };
});

function frame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  opacity: number, heat = 0, variant: InfoPanelFrameVariant = 'telemetry') {
  const shape = infoPanelFrame(x, y, w, h, variant);
  ctx.save(); ctx.globalAlpha = opacity;
  ctx.beginPath(); shape.outline.forEach(([px, py], index) => index ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
  ctx.closePath(); ctx.strokeStyle = signalColor(heat, .6); ctx.lineWidth = 1.15; ctx.stroke();
  ctx.fillStyle = signalColor(heat, .8);
  for (const tab of shape.tabs) {
    ctx.beginPath(); tab.forEach(([px, py], index) => index ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
    ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = signalColor(heat, .35); ctx.lineWidth = .8;
  for (const vent of shape.vents) { ctx.beginPath(); ctx.moveTo(...vent[0]); ctx.lineTo(...vent[1]); ctx.stroke(); }
  ctx.restore();
}

function drawOrder(ctx: CanvasRenderingContext2D, fonts: FilmFonts, state: WorkOrderTraceState, opacity: number) {
  const settle = smooth(1.1, TRACE_TIMING.launchAt, state.elapsed);
  const x = 420 + (72 - 420) * settle, y = 164 + (126 - 164) * settle;
  const width = 440 + (352 - 440) * settle, height = 138 + (116 - 138) * settle;
  frame(ctx, x, y, width, height, opacity, 0, 'command');
  filmText(ctx, fonts, state.created ? 'WORK ORDER / 생성 완료' : 'WORK ORDER / 생성 중', x + 25, y + 33, 11, opacity * .65, true);
  filmText(ctx, fonts, state.created ? TRACE_WORK_ORDER.id : 'NEW WORK ORDER', x + 25, y + 63, 24 - 3 * settle, opacity, true);
  filmText(ctx, fonts, `${TRACE_WORK_ORDER.product} · 지시 ${state.issued} EA`, x + 25, y + 84, 12, opacity * .75, true);
  filmText(ctx, fonts, `투입 ${state.released} / ${TRACE_WORK_ORDER.quantity} EA`, x + 25, y + 103, 12, opacity * .9, true, 'left', signalColor(0, 1));
}

function drawCounters(ctx: CanvasRenderingContext2D, fonts: FilmFonts, state: WorkOrderTraceState, opacity: number) {
  const metrics = [
    { label: '투입 대기', value: state.notStarted, heat: 0, english: 'QUEUED' },
    { label: '공정 진행', value: state.inProcess, heat: 0, english: 'IN PROCESS' },
    { label: '생산량 · 양품', value: state.completedGood, heat: 0, english: 'GOOD OUTPUT' },
    { label: '불량 누적', value: state.defectCount, heat: 1, english: 'REJECTED' },
  ];
  metrics.forEach((metric, index) => {
    const x = 466 + index * 187;
    filmText(ctx, fonts, metric.label, x, 150, 14, opacity * .8);
    filmText(ctx, fonts, String(metric.value).padStart(2, '0'), x, 196, 43, opacity, true, 'left', signalColor(metric.heat, 1));
    filmText(ctx, fonts, 'EA', x + 127, 195, 12, opacity * .5, true);
    ctx.beginPath(); ctx.moveTo(x, 210); ctx.lineTo(x + 143, 210);
    ctx.strokeStyle = signalColor(metric.heat, opacity * .3); ctx.lineWidth = 1; ctx.stroke();
    filmText(ctx, fonts, metric.english, x, 228, 9, opacity * .45, true);
  });
}

function drawInspection(ctx: CanvasRenderingContext2D, fonts: FilmFonts, state: WorkOrderTraceState, opacity: number) {
  const event = state.latestEvent;
  const pulse = event ? 1 - smooth(.4, 2, state.elapsed - event.at) : 0;
  frame(ctx, 72, 526, 508, 105, opacity * (.65 + pulse * .35), event ? 1 : 0, 'analysis');
  const label = state.phase === 'complete' ? '검사 이력 / 불량 분리 완료' : event ? '검사 이벤트 / 불량 검출' : '검사 이벤트 / 검출 대기';
  filmText(ctx, fonts, label, 94, 551, 12, opacity * .7, false, 'left', signalColor(event ? 1 : 0, 1));
  const detail = event ? `${SMT_LINE[event.stageIndex].label} · PCB ${String(event.serial).padStart(3, '0')} · ${event.label}`
    : 'SPI → MAOI → AOI 검사 이력을 연결합니다.';
  filmText(ctx, fonts, detail, 94, 580, 17, opacity * .96);
  const inspection = state.stages.filter(stage => ['spi', 'maoi', 'aoi'].includes(stage.equipment.id));
  inspection.forEach((stage, index) => {
    filmText(ctx, fonts, `${stage.equipment.label}  ${stage.defects} EA`, 94 + index * 153, 610, 12,
      opacity * .8, true, 'left', signalColor(stage.defects ? 1 : 0, 1));
  });
}

function drawOutputHistory(ctx: CanvasRenderingContext2D, fonts: FilmFonts, state: WorkOrderTraceState, opacity: number) {
  const left = 642, right = 1180, top = 569, bottom = 614;
  filmText(ctx, fonts, state.phase === 'complete' ? '작업 완료 / 생산 실적 확정' : '생산 실적 / 누적 추이', left, 543, 14, opacity * .88);
  filmText(ctx, fonts, `양품 ${state.completedGood}  /  불량 ${state.defectCount}`, right, 543, 12, opacity * .8, true, 'right');
  ctx.save(); ctx.globalAlpha = opacity;
  ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left, bottom); ctx.lineTo(right, bottom);
  ctx.strokeStyle = signalColor(0, .22); ctx.lineWidth = 1; ctx.stroke();
  ctx.setLineDash([2, 5]); ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(right, top);
  ctx.strokeStyle = signalColor(0, .1); ctx.stroke(); ctx.setLineDash([]);
  const samples = HISTORY.filter(point => point.at < state.elapsed);
  samples.push({ at: Math.min(state.elapsed, TRACE_TIMING.summaryAt), good: state.completedGood, defects: state.defectCount });
  for (const [key, heat] of [['good', 0], ['defects', 1]] as const) {
    ctx.beginPath();
    samples.forEach((point, index) => {
      const x = left + point.at / TRACE_TIMING.summaryAt * (right - left);
      const y = bottom - point[key] / TRACE_WORK_ORDER.quantity * (bottom - top);
      if (index) { const previous = samples[index - 1]; ctx.lineTo(x, bottom - previous[key] / TRACE_WORK_ORDER.quantity * (bottom - top)); ctx.lineTo(x, y); }
      else ctx.moveTo(x, y);
    });
    ctx.strokeStyle = signalColor(heat, .9); ctx.lineWidth = 1.8; ctx.shadowBlur = 5; ctx.shadowColor = signalColor(heat, .6); ctx.stroke();
  }
  ctx.restore();
  filmText(ctx, fonts, '0', left - 9, bottom + 2, 9, opacity * .4, true, 'right');
  filmText(ctx, fonts, String(TRACE_WORK_ORDER.quantity), left - 9, top + 3, 9, opacity * .4, true, 'right');
  filmText(ctx, fonts, '작업 시작', left, 632, 10, opacity * .5);
  filmText(ctx, fonts, '작업 종료', right, 632, 10, opacity * .5, false, 'right');
}

export function drawWorkOrderReadouts(ctx: CanvasRenderingContext2D, fonts: FilmFonts, state: WorkOrderTraceState, presence: number) {
  drawOrder(ctx, fonts, state, presence);
  const opacity = presence * smooth(2.1, 3.2, state.elapsed);
  drawCounters(ctx, fonts, state, opacity);
  drawInspection(ctx, fonts, state, opacity);
  drawOutputHistory(ctx, fonts, state, opacity);
}
