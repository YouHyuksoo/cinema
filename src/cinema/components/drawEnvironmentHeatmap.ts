import { filmText, type FilmFonts } from '../filmDrawing';
import { environmentHeatmap, environmentTemperatureColor } from '../environmentHeatmap';
import { environmentHeatmapLabels, environmentHeatmapProjection } from '../environmentHeatmapProjection';
import type { ZoneEnvironmentState } from '../zoneEnvironment';
import { drawEnvironmentSpace } from './drawEnvironmentSpace';
import { drawEnvironmentSensorCallout } from './drawEnvironmentSensorCallout';

/** Descend from the overhead heatmap into the visor's actual factory perspective. */
export function drawEnvironmentHeatmap(ctx: CanvasRenderingContext2D, fonts: FilmFonts, state: ZoneEnvironmentState) {
  const reveal = state.heatmapReveal;
  if (reveal <= .001) return;
  const model = environmentHeatmap(state.zones.map(item => item.zone));
  const projection = environmentHeatmapProjection(state.elapsed, model.rooms);
  const alpha = reveal * state.reveal;
  const active = projection.activeRoom;
  filmText(ctx, fonts, active
    ? `${projection.rank}/${projection.total} · ${active.zone.name} · ${active.reading}°C · ${projection.phase}`
    : projection.total ? '고온 구역부터 순차 확인 · 센서값 보간' : '유효한 온도 데이터 없음',
    1114, 176, 11, alpha * .85, false, 'right');
  ctx.save();
  ctx.beginPath(); ctx.rect(145, 198, 990, 412); ctx.clip();
  ctx.translate(0, 48);
  drawEnvironmentSpace(ctx, fonts, model, projection, alpha, reveal,
    { left: 145, top: 150, right: 1135, bottom: 562 });
  ctx.restore();
  const visible = model.rooms.map(room => {
    const point = projection.point(room.pin.x, room.pin.y);
    return { room, point, pin: { x: point.x, y: point.y + 48 } };
  }).filter(({point, pin}) => point.visible && pin.x > 155 && pin.x < 1125 && pin.y > 210 && pin.y < 596)
    .sort((a, b) => Number(b.room.key === active?.key) - Number(a.room.key === active?.key));
  const labels = environmentHeatmapLabels(visible.map(item => item.pin));
  for (const [index, item] of visible.entries()) {
    const selected = item.room.key === active?.key;
    drawEnvironmentSensorCallout(ctx, fonts, item.room, item.pin, labels[index], state.elapsed,
      alpha * (active && !selected ? .45 : 1));
    if (selected) {
      ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = item.room.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(item.pin.x, item.pin.y, 22, 10, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
  }
  const legendX = 458, legendY = 622, legendWidth = 364;
  ctx.save(); ctx.globalAlpha = alpha;
  for (let segment = 0; segment < 100; segment++) {
    const value = model.domain.min + (model.domain.max - model.domain.min) * segment / 99;
    ctx.fillStyle = environmentTemperatureColor(value, model.domain).color;
    ctx.fillRect(legendX + legendWidth * segment / 100, legendY, legendWidth / 100 + .3, 5);
  }
  filmText(ctx, fonts, '온도 °C', legendX - 24, legendY + 6, 11, alpha * .76, true, 'right');
  for (let tick = 0; tick <= 4; tick++) {
    const value = model.domain.min + (model.domain.max - model.domain.min) * tick / 4;
    filmText(ctx, fonts, (Number.isInteger(value) ? value : value.toFixed(1)) + '°',
      legendX + legendWidth * tick / 4, legendY + 23, 10, alpha * .72, true, 'center');
  }
  filmText(ctx, fonts, '● 센서 위치', 1098, legendY + 9, 11, alpha * .65, false, 'right');
  ctx.restore();
}
