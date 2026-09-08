import { filmText, signalColor, type FilmFonts } from '../filmDrawing';
import { environmentReadingStatus, type EnvironmentRange } from '../zoneEnvironment';

const TAU = Math.PI * 2;
const STATUS_TEXT = { normal: '범위 내', outside: '범위 이탈', missing: '데이터 확인' } as const;

/** Rotating instrument markings are decorative; the filled arc always represents the reading. */
export function drawSensorRotor(ctx: CanvasRenderingContext2D, x: number, y: number,
  radius: number, fraction: number, time: number, heat: number, alpha: number) {
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = alpha;
  for (let index = 0; index < 36; index++) {
    const a = index / 36 * TAU;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * radius, Math.sin(a) * radius);
    ctx.lineTo(Math.cos(a) * (radius - (index % 3 ? 2 : 4)), Math.sin(a) * (radius - (index % 3 ? 2 : 4)));
    ctx.strokeStyle = signalColor(heat, .42); ctx.lineWidth = .7; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(0, 0, radius * .76, -Math.PI / 2, -Math.PI / 2 + TAU * fraction);
  ctx.strokeStyle = signalColor(heat, .8); ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, radius * .53, time * .55, time * .55 + Math.PI * 1.2);
  ctx.strokeStyle = signalColor(heat, .45); ctx.lineWidth = .7; ctx.stroke();
  ctx.fillStyle = signalColor(heat, .7); ctx.fillRect(-1.5, -1.5, 3, 3);
  ctx.restore();
}

export function sensorReading(value: number | null, range: EnvironmentRange, humidity: boolean) {
  const status = environmentReadingStatus(value, range, humidity);
  const validRange = Number.isFinite(range.min) && Number.isFinite(range.max) && range.min <= range.max;
  const scaleValue = value !== null && Number.isFinite(value) ? value : 0;
  const min = humidity ? 0 : validRange ? Math.min(0, range.min - 5, scaleValue) : 0;
  const max = humidity ? 100 : validRange ? Math.max(40, range.max + 5, scaleValue) : 40;
  const fraction = status === 'missing' ? 0 : Math.max(0, Math.min(1, (value! - min) / (max - min)));
  return { status, min, max, fraction, validRange,
    number: status === 'missing' ? '—' : value!.toFixed(humidity ? 0 : 1),
    heat: status === 'outside' ? 1 : humidity ? 0 : .65 };
}

/** A segmented channel uses one physical scale for value, ticks and the management band. */
export function drawSensorInstrument(ctx: CanvasRenderingContext2D, fonts: FilmFonts,
  x: number, y: number, value: number | null, range: EnvironmentRange, humidity: boolean,
  alpha: number, time: number) {
  const reading = sensorReading(value, range, humidity);
  const { status, fraction, heat, min, max, validRange } = reading;
  ctx.save(); ctx.translate(x, y);
  const text = (v: string, xx: number, yy: number, size: number, opacity = 1, mono = false) =>
    filmText(ctx, fonts, v, xx, yy, size, alpha * opacity, mono, 'left', signalColor(heat, 1));
  const line = (x1: number, y1: number, x2: number, y2: number, opacity: number, width = .7) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = signalColor(heat, alpha * opacity); ctx.lineWidth = width; ctx.stroke();
  };
  // Open technical frame, with a fine rear edge rather than an opaque dashboard tile.
  ctx.fillStyle = signalColor(heat, alpha * .022); ctx.fillRect(0, 0, 372, 214);
  line(0, 0, 352, 0, .35); line(352, 0, 372, 20, .35);
  line(372, 20, 372, 213, .18); line(0, 0, 0, 203, .18);
  line(0, 214, 350, 214, .35); line(350, 214, 372, 192, .35);
  line(3, 218, 352, 218, .1);
  text(humidity ? 'RH / 상대 습도' : 'TEMP / 온도', 10, -9, 11, .8, true);
  text(humidity ? 'CHANNEL 02' : 'CHANNEL 01', 270, -9, 9, .5, true);
  drawSensorRotor(ctx, 43, 37, 26, fraction, time, heat, alpha);
  text(reading.number, 92, 58, 58, 1, true);
  text(humidity ? '% RH' : '°C', 245, 53, 19, .85, true);
  text(status === 'outside' ? '! LIMIT' : status === 'missing' ? 'NO DATA' : 'IN RANGE', 285, 20, 9, .85, true);
  for (let segment = 0; segment < 12; segment++) {
    const fill = Math.max(0, Math.min(1, fraction * 12 - segment));
    const xx = 10 + segment * 27;
    ctx.fillStyle = signalColor(heat, alpha * .045); ctx.fillRect(xx, 73, 24, 10);
    if (fill > 0) { ctx.fillStyle = signalColor(heat, alpha * .7); ctx.fillRect(xx, 73, 24 * fill, 10); }
    ctx.strokeStyle = signalColor(heat, alpha * .23); ctx.lineWidth = .5; ctx.strokeRect(xx, 73, 24, 10);
  }
  drawSensorRotor(ctx, 350, 78, 8, fraction, time, heat, alpha);
  line(10, 94, 362, 94, .22);
  // 32 segment columns and a physically aligned allowed-range band.
  const top = 105, height = 86, bottom = top + height;
  for (let segment = 0; segment < 32; segment++) {
    const fill = Math.max(0, Math.min(1, fraction * 32 - segment));
    const yy = bottom - (segment + 1) * height / 32;
    ctx.fillStyle = signalColor(heat, alpha * .1); ctx.fillRect(15, yy, 32, 1.65);
    if (fill > 0) { ctx.fillStyle = signalColor(heat, alpha * .9); ctx.fillRect(15, yy, 32 * fill, 1.65); }
  }
  for (let index = 0; index <= 4; index++) {
    const yy = bottom - index / 4 * height;
    line(51, yy, 58, yy, .4);
    text((min + index / 4 * (max - min)).toFixed(0), 62, yy + 3, 8, .6, true);
  }
  const ordinate = (v: number) => bottom - Math.max(0, Math.min(1, (v - min) / (max - min))) * height;
  if (validRange) {
    const rangeTop = ordinate(range.max), rangeBottom = ordinate(range.min);
    ctx.fillStyle = signalColor(heat, alpha * .2); ctx.fillRect(89, rangeTop, 4, rangeBottom - rangeTop);
    line(87, rangeTop, 98, rangeTop, .8); line(87, rangeBottom, 98, rangeBottom, .8);
  }
  text('MANAGEMENT LIMITS', 120, 115, 8, .5, true);
  text(validRange ? `${range.min} — ${range.max} ${humidity ? '%' : '°C'}` : '미설정', 120, 138, 19, .9, true);
  text(STATUS_TEXT[status], 120, 170, 17, .95);
  text(humidity ? '상대 습도 / RH SENSOR' : '구역 온도 / THERMAL SENSOR', 120, 190, 9, .5, true);
  // Small right-side rail repeats the same current reading, not a fabricated trend.
  for (let segment = 0; segment < 24; segment++) {
    ctx.fillStyle = signalColor(heat, alpha * (segment / 24 < fraction ? .45 : .07));
    ctx.fillRect(335, bottom - segment * 3.4, 20, 1.3);
  }
  line(10, 201, 360, 201, .2);
  text('READOUT / CURRENT SNAPSHOT', 12, 211, 7, .46, true);
  ctx.restore();
}
