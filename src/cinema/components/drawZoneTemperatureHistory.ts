import { filmText, signalColor, type FilmFonts } from '../filmDrawing';
import { TEMPERATURE_HOUR_MS } from '../temperatureHistory';
import type { ZoneEnvironmentState } from '../zoneEnvironment';
import { environmentCardPoint, environmentHistoryLayout } from '../environmentLayout';
import { drawEnvironmentLink } from './drawEnvironmentLink';

/** Histories unfold toward the center, preserving both fixed rows and a shared 24-hour scale. */
export function drawZoneTemperatureHistory(ctx: CanvasRenderingContext2D, fonts: FilmFonts,
  state: ZoneEnvironmentState, item: ZoneEnvironmentState['zones'][number]) {
  const reveal = item.chartReveal;
  if (reveal <= 0) return;
  const { anchor, zone, history } = item;
  const { x, top, width, height } = environmentHistoryLayout(item);
  const alpha = state.reveal * reveal;
  const domain = state.historyDomain;
  const y = (value: number) => top + height * (1 - (value - domain.min) / (domain.max - domain.min));
  const text = (value: string, dx: number, dy: number, size: number, opacity: number,
    align: CanvasTextAlign = 'left') => filmText(ctx, fonts, value, x + dx, top + dy,
    size, alpha * opacity, true, align);
  ctx.save();
  const source = environmentCardPoint(item, 80, item.band === 'top' ? 38 : -43);
  const routeX = anchor.x + 99, end = { x: x + width, y: top + height / 2 };
  drawEnvironmentLink(ctx, [source, { x: routeX, y: source.y }, { x: routeX, y: end.y }, end],
    alpha * .7, .25, state.elapsed + item.index * .1, 1.3);
  text('24H', 0, -15, 10, .75);
  const valid = history.filter(p => p.value !== null);
  const values = valid.map(p => p.value as number);
  if (values.length) text(`${Math.min(...values).toFixed(1)}—${Math.max(...values).toFixed(1)}°C`, width, -15, 10, .8, 'right');
  text(`${domain.max}°`, -5, 4, 9, .55, 'right');
  text(`${domain.min}°`, -5, height, 9, .55, 'right');
  text('−24h', 0, height + 17, 9, .6);
  text('−12h', width / 2, height + 17, 9, .45, 'center');
  text('현재', width, height + 17, 9, .6, 'right');
  ctx.save();
  ctx.beginPath(); ctx.rect(x - 1, top - 3, (width + 2) * reveal, height + 6); ctx.clip();
  const range = zone.temperatureRange;
  if (Number.isFinite(range.min) && Number.isFinite(range.max) && range.min <= range.max) {
    ctx.fillStyle = signalColor(.35, alpha * .035);
    ctx.fillRect(x, y(range.max), width, y(range.min) - y(range.max));
    ctx.setLineDash([3, 6]); ctx.strokeStyle = signalColor(.35, alpha * .2); ctx.lineWidth = .6;
    ctx.beginPath();
    for (const limit of [range.min, range.max]) { ctx.moveTo(x, y(limit)); ctx.lineTo(x + width, y(limit)); }
    ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.strokeStyle = signalColor(.35, alpha * .17); ctx.lineWidth = .6;
  ctx.beginPath(); ctx.moveTo(x, top + height); ctx.lineTo(x + width, top + height); ctx.stroke();
  let previous: (typeof history)[number] | undefined;
  for (const point of history) {
    if (point.value === null) { previous = undefined; continue; }
    const px = x + point.position * width, py = y(point.value);
    const outside = point.value < range.min || point.value > range.max;
    ctx.strokeStyle = signalColor(outside ? 1 : .35, alpha * .95);
    ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 1.5;
    if (previous?.value !== null && previous !== undefined && point.at - previous.at <= 2 * TEMPERATURE_HOUR_MS) {
      ctx.beginPath(); ctx.moveTo(x + previous.position * width, y(previous.value)); ctx.lineTo(px, py);
      ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 5; ctx.stroke(); ctx.shadowBlur = 0;
    }
    ctx.beginPath(); ctx.arc(px, py, outside ? 1.7 : 1, 0, Math.PI * 2); ctx.fill();
    previous = point;
  }
  if (reveal < 1) {
    ctx.fillStyle = signalColor(.35, alpha * .7);
    ctx.fillRect(x + width * reveal - 1, top, 1, height);
  }
  ctx.restore();
  if (!valid.length) text('온도 이력 없음', width / 2, height / 2, 11, .7, 'center');
  ctx.restore();
}
