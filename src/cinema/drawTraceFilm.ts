import { DEFAULT_FONTS, filmText, signalColor, smooth, type FilmFonts } from './filmDrawing';
import { beginFilmViewport, fillFilmViewport, type FilmViewportInsets } from './filmViewport';
import { drawWorkOrderProcess, traceStationPoint, traceUnitPoint } from './components/drawWorkOrderProcess';
import { drawWorkOrderReadouts } from './components/drawWorkOrderReadouts';
import { TRACE_TIMING, TRACE_WORK_ORDER, workOrderTraceState } from './workOrderTrace';
import { FILM_DURATIONS } from './filmProgram';

export const TRACE_FILM_SECONDS = FILM_DURATIONS.trace;

/** A single work order becomes physical PCB flow, inspection rejects and completed output. */
export function drawTraceFilm(ctx: CanvasRenderingContext2D, width: number, height: number, time: number,
  fonts: FilmFonts = DEFAULT_FONTS, insets?: FilmViewportInsets) {
  const view = beginFilmViewport(ctx, width, height, insets);
  const state = workOrderTraceState(time), t = state.elapsed;
  const presence = smooth(.1, .65, t) * (1 - smooth(TRACE_TIMING.fadeAt, TRACE_TIMING.endAt, t));
  const linePresence = smooth(1.3, TRACE_TIMING.launchAt, t) * presence;
  ctx.fillStyle = '#040b10'; fillFilmViewport(ctx, view);
  const wash = ctx.createRadialGradient(640, 380, 10, 640, 380, 620);
  wash.addColorStop(0, signalColor(0, .075 * presence)); wash.addColorStop(1, signalColor(0, 0));
  ctx.fillStyle = wash; fillFilmViewport(ctx, view);

  // The order release is visibly attached to the entrance of the production line.
  ctx.save(); ctx.globalAlpha = linePresence;
  ctx.beginPath(); ctx.moveTo(100, 246); ctx.lineTo(78, 262); ctx.lineTo(78, 422); ctx.lineTo(124, 422);
  ctx.strokeStyle = signalColor(0, .38); ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
  drawWorkOrderProcess(ctx, fonts, state, linePresence);

  // Each moving mark has a deterministic PCB serial; rejected units never continue downstream.
  ctx.save(); ctx.globalAlpha = linePresence;
  for (const unit of state.units) {
    if (unit.status !== 'processing') continue;
    const point = traceUnitPoint(unit.stageIndex, unit.stageProgress);
    const lane = (unit.serial % 3 - 1) * 6;
    ctx.fillStyle = signalColor(0, .8); ctx.shadowColor = signalColor(0, .8); ctx.shadowBlur = 4;
    ctx.fillRect(point.x - 2.5, point.y + lane - 1.5, 5, 3);
  }
  ctx.shadowBlur = 0;
  for (const event of state.events) {
    const age = t - event.at;
    if (age < 0) continue;
    const station = traceStationPoint(event.stageIndex);
    const nextStation = traceStationPoint(event.stageIndex + 1);
    const branchX = station.x + (nextStation.x - station.x) * .56;
    const previousRejects = state.events.filter(other => other.stageIndex === event.stageIndex && other.at < event.at).length;
    const endX = branchX + 8 + previousRejects * 14;
    const reveal = smooth(0, .75, age);
    const points = [station, { x: branchX, y: station.y + 20 }, { x: branchX, y: 495 }, { x: endX, y: 510 }];
    ctx.beginPath(); ctx.moveTo(station.x, station.y);
    points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
    ctx.strokeStyle = signalColor(1, .28 + .5 * (1 - smooth(.8, 2.2, age)));
    ctx.lineWidth = 1.5; ctx.stroke();
    if (age < 1.8) {
      const lengths = points.slice(1).map((point, i) => Math.hypot(point.x - points[i].x, point.y - points[i].y));
      let travel = reveal * lengths.reduce((sum, value) => sum + value, 0);
      let marker = points[points.length - 1];
      for (let i = 0; i < lengths.length; i++) {
        if (travel <= lengths[i]) {
          const fraction = travel / lengths[i];
          marker = { x: points[i].x + (points[i + 1].x - points[i].x) * fraction,
            y: points[i].y + (points[i + 1].y - points[i].y) * fraction }; break;
        }
        travel -= lengths[i];
      }
      ctx.beginPath(); ctx.arc(marker.x, marker.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = signalColor(1, 1); ctx.shadowColor = signalColor(1, .9); ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(station.x, station.y, 8 + age * 23, 0, Math.PI * 2);
      ctx.strokeStyle = signalColor(1, 1 - smooth(0, 1.8, age)); ctx.stroke();
    }
    ctx.strokeStyle = signalColor(1, .8); ctx.strokeRect(endX - 4.5, 506, 9, 9);
  }
  ctx.restore();
  drawWorkOrderReadouts(ctx, fonts, state, presence);

  filmText(ctx, fonts, 'WORK ORDER / PRODUCTION TRACE', 72, 76, 14, presence * .72, true);
  filmText(ctx, fonts, `${TRACE_WORK_ORDER.line}  /  시연 데이터`, 1208, 104, 12, presence * .55, false, 'right');
  if (state.phase === 'complete') {
    filmText(ctx, fonts, `지시 ${TRACE_WORK_ORDER.quantity} EA → 양품 ${state.completedGood} EA + 불량 ${state.defectCount} EA · 작업 종료`,
      640, 657, 14, presence * .8, false, 'center');
  }
  const phase = t < TRACE_TIMING.launchAt ? '01 / CREATE WORK ORDER' : state.phase === 'complete'
    ? '04 / PRODUCTION RESULT' : state.completedGood > 0 ? '03 / ACCUMULATE OUTPUT' : '02 / PROCESS & INSPECT';
  filmText(ctx, fonts, phase, 72, 689, 10, presence * .5, true);
}
