import { filmText, signalColor, type FilmFonts } from '../filmDrawing';
import type { EnvironmentHeatmapRoom } from '../environmentHeatmap';
import type { EnvironmentHeatmapLabel, EnvironmentHeatmapPoint } from '../environmentHeatmapProjection';
import { infoPanelFrame } from './infoPanelFrame';
import { drawEnvironmentLink } from './drawEnvironmentLink';

/** Reuse the existing clipped HUD frame with a fully transparent interior. */
export function drawEnvironmentSensorCallout(ctx: CanvasRenderingContext2D, fonts: FilmFonts,
  room: EnvironmentHeatmapRoom, pin: EnvironmentHeatmapPoint, label: EnvironmentHeatmapLabel,
  time: number, alpha: number) {
  const end = { x: Math.max(label.x + 12, Math.min(label.x + label.width - 12, pin.x)),
    y: pin.y < label.y ? label.y : label.y + label.height };
  drawEnvironmentLink(ctx, [pin, { x: pin.x, y: (pin.y + end.y) / 2 },
    { x: end.x, y: (pin.y + end.y) / 2 }, end], alpha * .9, 0, time, 1.6);
  const frame = infoPanelFrame(label.x, label.y, label.width, label.height, 'telemetry');
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.strokeStyle = signalColor(0, .95); ctx.lineWidth = 1;
  ctx.shadowColor = signalColor(0, .7); ctx.shadowBlur = 4;
  ctx.beginPath(); frame.outline.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath(); ctx.stroke();
  ctx.fillStyle = signalColor(0, .9);
  for (const tab of frame.tabs) {
    ctx.beginPath(); tab.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath(); ctx.fill();
  }
  for (const vent of frame.vents) {
    ctx.beginPath(); vent.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  }
  ctx.shadowColor = 'rgba(0,8,16,.9)'; ctx.shadowBlur = 5;
  filmText(ctx, fonts, room.zone.id + (room.status === 'outside' ? ' !' : room.status === 'missing' ? ' ?' : ''),
    label.x + 9, label.y + 12, 9, alpha * .9, true);
  filmText(ctx, fonts, room.reading + '°C', label.x + 9, label.y + 31, 18, alpha, true, 'left',
    signalColor(room.status === 'outside' ? 1 : 0, 1));
  ctx.restore();
}
