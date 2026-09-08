import { filmText, signalColor, type FilmFonts } from '../filmDrawing';
import { SMT_LINE, SMT_LINE_WIDTH, SMT_STATIONS } from '../smtLine';
import type { WorkOrderTraceState } from '../workOrderTrace';
import { drawSmtEquipment } from './drawSmtEquipment';

const PROCESS_LEFT = 88;
const PROCESS_RIGHT = 1192;
const EQUIPMENT_FLOOR = 398;
const PROCESS_RAIL = 422;
const EQUIPMENT_SCALE = (PROCESS_RIGHT - PROCESS_LEFT) / SMT_LINE_WIDTH;

/** Rail positions share the canonical equipment widths and process order. */
export function traceStationPoint(index: number) {
  const station = SMT_STATIONS[Math.max(0, Math.min(SMT_STATIONS.length - 1, Math.trunc(index)))];
  return { x: PROCESS_LEFT + station.x * EQUIPMENT_SCALE, y: PROCESS_RAIL };
}

/** Stage completion arrives at its machine, so an inspection rejects at the correct station. */
export function traceUnitPoint(stageIndex: number, stageProgress: number) {
  const index = Math.max(0, Math.min(SMT_LINE.length - 1, Math.trunc(stageIndex)));
  const from = index > 0 ? traceStationPoint(index - 1) : { x: PROCESS_LEFT, y: PROCESS_RAIL };
  const to = traceStationPoint(index);
  const progress = Math.max(0, Math.min(1, stageProgress));
  return { x: from.x + (to.x - from.x) * progress, y: PROCESS_RAIL };
}

/** Eight distinct SMT machines and station counts; units and NG branches are drawn by the scene. */
export function drawWorkOrderProcess(
  ctx: CanvasRenderingContext2D,
  fonts: FilmFonts,
  state: WorkOrderTraceState,
  opacity: number,
) {
  if (opacity <= 0) return;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.moveTo(PROCESS_LEFT, PROCESS_RAIL);
  ctx.lineTo(1200, PROCESS_RAIL);
  ctx.strokeStyle = signalColor(0, .19);
  ctx.lineWidth = 1.25;
  ctx.stroke();

  const finishX = state.units.reduce((furthest, unit) => unit.status === 'waiting' ? furthest
    : Math.max(furthest, traceUnitPoint(unit.stageIndex, unit.stageProgress).x), PROCESS_LEFT);
  if (finishX > PROCESS_LEFT) {
    ctx.beginPath();
    ctx.moveTo(PROCESS_LEFT, PROCESS_RAIL);
    ctx.lineTo(finishX, PROCESS_RAIL);
    ctx.strokeStyle = signalColor(0, .12);
    ctx.lineWidth = 8;
    ctx.shadowBlur = 13;
    ctx.shadowColor = signalColor(0, .42);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = signalColor(0, .7);
    ctx.lineWidth = 1.7;
    ctx.stroke();
  }

  SMT_LINE.forEach((equipment, index) => {
    const stage = state.stages[index];
    const point = traceStationPoint(index);
    const active = Boolean(stage?.active);
    const entered = (stage?.entered ?? 0) > 0;
    const defects = stage?.defects ?? 0;
    const wip = stage?.wip ?? 0;
    const stageOpacity = opacity * (active ? 1 : entered ? .81 : .46);
    const width = equipment.width * EQUIPMENT_SCALE;

    if (active) {
      const glow = ctx.createLinearGradient(0, EQUIPMENT_FLOOR - 160, 0, EQUIPMENT_FLOOR + 8);
      glow.addColorStop(0, signalColor(0, 0));
      glow.addColorStop(1, signalColor(0, .115));
      ctx.fillStyle = glow;
      ctx.fillRect(point.x - width / 2 - 7, EQUIPMENT_FLOOR - 160, width + 14, 168);
    }

    ctx.save();
    ctx.globalAlpha = stageOpacity;
    ctx.translate(point.x, EQUIPMENT_FLOOR);
    ctx.scale(EQUIPMENT_SCALE, EQUIPMENT_SCALE);
    // The shared elevation supplies machine detail; full-size labels stay readable below the rail.
    ctx.beginPath();
    ctx.rect(-equipment.width / 2 - 20, -equipment.height - 55, equipment.width + 40, equipment.height + 65);
    ctx.clip();
    drawSmtEquipment(ctx, fonts, equipment, state.elapsed, defects > 0 ? .35 : 0);
    ctx.restore();

    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.moveTo(point.x, EQUIPMENT_FLOOR + 11);
    ctx.lineTo(point.x, PROCESS_RAIL - 5);
    ctx.strokeStyle = signalColor(0, active ? .75 : .25);
    ctx.lineWidth = active ? 1.5 : 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(point.x, PROCESS_RAIL, active ? 5 : 3.4, 0, Math.PI * 2);
    ctx.strokeStyle = signalColor(0, active ? 1 : entered ? .7 : .33);
    ctx.lineWidth = active ? 1.6 : 1;
    ctx.stroke();
    if (active) {
      ctx.beginPath();
      ctx.arc(point.x, PROCESS_RAIL, 9.5 + Math.sin(state.elapsed * 3) * 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = signalColor(0, .2);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    filmText(ctx, fonts, String(index + 1).padStart(2, '0'), point.x, 442, 9,
      stageOpacity * .7, true, 'center', '#88c1cc');
    filmText(ctx, fonts, equipment.label, point.x, 459, equipment.id === 'printer' ? 12 : 13,
      stageOpacity, false, 'center', active ? '#ddfaff' : '#a9cdd4');
    filmText(ctx, fonts, `통과 ${stage?.passed ?? 0}`, point.x, 480, 12,
      stageOpacity * .9, false, 'center', '#bee8ed');
    const detail = defects > 0 ? `불량 ${defects} · 재공 ${wip}` : `재공 ${wip}`;
    filmText(ctx, fonts, detail, point.x, 499, 10,
      stageOpacity * (entered ? .96 : .5), false, 'center', defects > 0 ? '#ffc168' : '#72bac7');
  });
  ctx.restore();
}
