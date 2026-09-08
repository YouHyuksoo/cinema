import { filmText, signalColor, smooth, type FilmFonts } from '../filmDrawing';
import type { environmentGaugeState } from '../environmentGauge';
import type { EnvironmentRange } from '../zoneEnvironment';
import { sensorReading } from './drawSensorInstrument';

const TAU = Math.PI * 2;
const START = Math.PI * .75;
const SWEEP = Math.PI * 1.5;
const STATUS_TEXT = { normal: '범위 내', outside: '범위 이탈', missing: '데이터 확인' } as const;

/** Fixed physical scale and readout, assembled inside independently rotating accent rings. */
export function drawEnvironmentGauge(ctx: CanvasRenderingContext2D, fonts: FilmFonts,
  placement: { x: number; y: number; radius: number },
  value: number | null, range: EnvironmentRange, humidity: boolean,
  motion: ReturnType<typeof environmentGaugeState>, alpha: number) {
  if (alpha <= .001) return;
  const reading = sensorReading(value, range, humidity);
  const heat = reading.status === 'outside' ? 1 : humidity ? 0 : .25;
  const { radius } = placement;
  const assembly = motion.assembly;
  const readAlpha = alpha * motion.readingOpacity * smooth(.25, .8, assembly);
  const rotation = motion.outerRotation * (humidity ? -1 : 1) + (humidity ? .65 : 0);
  const innerRotation = motion.innerRotation * (humidity ? -1 : 1);

  ctx.save(); ctx.translate(placement.x, placement.y);
  const arc = (r: number, start: number, span: number, width: number, opacity: number, color = heat) => {
    if (span <= .0001) return;
    ctx.beginPath(); ctx.arc(0, 0, r, start, start + span);
    ctx.strokeStyle = signalColor(color, alpha * opacity); ctx.lineWidth = width; ctx.stroke();
  };
  const spoke = (angle: number, from: number, to: number, width: number, opacity: number) => {
    ctx.beginPath(); ctx.moveTo(Math.cos(angle) * from, Math.sin(angle) * from);
    ctx.lineTo(Math.cos(angle) * to, Math.sin(angle) * to);
    ctx.strokeStyle = signalColor(heat, alpha * opacity); ctx.lineWidth = width; ctx.stroke();
  };
  const text = (content: string, x: number, y: number, size: number, opacity = 1, mono = false, color = signalColor(heat, 1)) =>
    filmText(ctx, fonts, content, x, y, size, readAlpha * opacity, mono, 'center', color);

  const glow = ctx.createRadialGradient(0, 0, 36, 0, 0, radius);
  glow.addColorStop(0, signalColor(heat, alpha * .012));
  glow.addColorStop(.7, signalColor(heat, alpha * .025));
  glow.addColorStop(1, signalColor(heat, 0));
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.fill();

  // The tether ends on this stationary rim. Only accents rotate, never scale labels.
  arc(radius, -Math.PI / 2, TAU * smooth(0, .45, assembly), .8, .32, .1);
  for (let index = 0; index < 8; index++) {
    const reveal = smooth(index * .055, index * .055 + .35, assembly);
    const angle = rotation + index / 8 * TAU;
    const span = (index % 2 ? .32 : .55) * reveal;
    arc(radius - 7, angle, span, index % 2 ? 2 : 4, index % 2 ? .4 : .85);
    arc(radius - 3, angle, span * .72, .65, .38);
    if (reveal > 0) spoke(angle, radius - 10, radius - 2, 1.3, reveal * .7);
  }
  for (let index = 0; index < 48; index++) {
    const reveal = smooth(.1 + index / 48 * .4, .35 + index / 48 * .4, assembly);
    spoke(innerRotation + index / 48 * TAU, radius - 16, radius - (index % 4 ? 18 : 21),
      index % 4 ? .65 : 1.5, reveal * (index % 4 ? .25 : .65));
  }

  // Value, management band and ticks share one physical domain and a fixed 270-degree sweep.
  const trackRadius = radius - 29;
  const trackReveal = smooth(.1, .75, assembly);
  arc(trackRadius, START, SWEEP * trackReveal, 4, .12);
  for (let tick = 0; tick <= 40; tick++) {
    const reveal = smooth(.2 + tick / 40 * .4, .45 + tick / 40 * .4, assembly);
    const angle = START + tick / 40 * SWEEP;
    spoke(angle, trackRadius - (tick % 10 ? 7 : 12), trackRadius - 3, tick % 10 ? .7 : 1.3, reveal * .58);
    if (tick % 10 === 0) {
      const labelRadius = trackRadius - 24;
      text((reading.min + tick / 40 * (reading.max - reading.min)).toFixed(0),
        Math.cos(angle) * labelRadius, Math.sin(angle) * labelRadius + 3, 9, reveal * .7, true);
    }
  }
  if (reading.validRange) {
    const fraction = (n: number) => Math.max(0, Math.min(1, (n - reading.min) / (reading.max - reading.min)));
    const low = START + fraction(range.min) * SWEEP, high = START + fraction(range.max) * SWEEP;
    arc(trackRadius + 5, low, (high - low) * trackReveal, 2, .7, .05);
    spoke(low, trackRadius + 2, trackRadius + 8, 1, trackReveal * .7);
    spoke(high, trackRadius + 2, trackRadius + 8, 1, trackReveal * .7);
  }
  if (reading.status !== 'missing') {
    const valueSpan = SWEEP * reading.fraction;
    ctx.save(); ctx.shadowColor = signalColor(heat, .5); ctx.shadowBlur = 7;
    arc(trackRadius, START, valueSpan * trackReveal, 4, motion.readingOpacity * .95);
    ctx.restore();
    const tip = START + valueSpan;
    const tipAlpha = smooth(.65, 1, assembly) * motion.readingOpacity;
    spoke(tip, trackRadius - 7, trackRadius + 5, 1.5, tipAlpha);
    ctx.beginPath(); ctx.arc(Math.cos(tip) * trackRadius, Math.sin(tip) * trackRadius, 3, 0, TAU);
    ctx.fillStyle = signalColor(heat, alpha * tipAlpha); ctx.fill();
  }

  text(humidity ? '상대 습도' : '온도', 0, -38, 12, .8);
  text(reading.number, 0, 20, humidity ? 57 : 53, 1, true, reading.status === 'outside' ? signalColor(1, 1) : '#d7f8ff');
  text(humidity ? '% RH' : '°C', 0, 43, 14, .85, true);
  text(STATUS_TEXT[reading.status], 0, 81, 12, .95);
  text(reading.validRange ? `관리 ${range.min}–${range.max} ${humidity ? '%' : '°C'}` : '관리 범위 미설정', 0, 100, 10, .65);
  ctx.restore();
}
