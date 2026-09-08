import { filmText, signalColor, type FilmFonts } from '../filmDrawing';
import type { ZoneEnvironmentState } from '../zoneEnvironment';
import { drawSensorRotor, sensorReading } from './drawSensorInstrument';
import { drawZoneTemperatureHistory } from './drawZoneTemperatureHistory';
import { environmentFocusConnection } from '../environmentLayout';
import { drawEnvironmentLink } from './drawEnvironmentLink';
import { ENVIRONMENT_GAUGES, environmentGaugeState } from '../environmentGauge';
import { drawEnvironmentGauge } from './drawEnvironmentGauge';

/** Ten suspended sensor stations share their projection with the selected station's tether. */
export function drawEnvironmentZones(ctx: CanvasRenderingContext2D, fonts: FilmFonts, state: ZoneEnvironmentState) {
  for (const item of state.zones) drawZoneTemperatureHistory(ctx, fonts, state, item);
  for (const item of [...state.zones].sort((a, b) => a.focus - b.focus)) {
    const { zone, anchor, focus, reveal, status } = item;
    const alpha = state.reveal * reveal * item.cardOpacity, heat = status === 'outside' ? 1 : .4;
    if (alpha <= .001) continue;
    ctx.save();
    ctx.translate(anchor.x, anchor.y); ctx.scale(anchor.scale, anchor.scale);
    ctx.transform(1, item.tilt, 0, .96, 0, 0);
    const line = (x1: number, y1: number, x2: number, y2: number, opacity: number) => {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.strokeStyle = signalColor(heat, alpha * opacity); ctx.lineWidth = .7; ctx.stroke();
    };
    const glow = ctx.createLinearGradient(0, -48, 0, 46);
    glow.addColorStop(0, signalColor(heat, alpha * (.035 + focus * .08)));
    glow.addColorStop(1, signalColor(heat, 0));
    ctx.fillStyle = glow; ctx.fillRect(-84, -43, 168, 82);
    line(-84, -43, 68, -43, .35 + focus * .35); line(68, -43, 84, -29, .35);
    line(-84, -43, -84, 38, .17); line(84, -29, 84, 38, .17);
    line(-84, 39, 84, 39, .35); line(-81, 42, 81, 42, .14);
    const text = (value: string, x: number, y: number, size: number, opacity = 1, mono = false, colorHeat = heat) =>
      filmText(ctx, fonts, value, x, y, size, alpha * opacity, mono, 'left', signalColor(colorHeat, 1));
    text(zone.id, -73, -26, 13, 1, true);
    text(zone.name, -73, -11, 9, .6);
    const temp = sensorReading(zone.temperature, zone.temperatureRange, false);
    const rh = sensorReading(zone.humidity, zone.humidityRange, true);
    drawSensorRotor(ctx, 68, -26, 10, (temp.fraction + rh.fraction) / 2, state.elapsed, heat, alpha);
    text(temp.number, -73, 14, 25, 1, true, temp.heat);
    text('°C', -13, 11, 9, .8, true, temp.heat);
    text(rh.number, 17, 14, 25, 1, true, rh.heat);
    text('%', 59, 11, 10, .8, true, rh.heat);
    for (const [column, reading] of [temp, rh].entries()) {
      const x = column ? 17 : -73, width = column ? 56 : 64;
      for (let segment = 0; segment < 18; segment++) {
        const fill = Math.max(0, Math.min(1, reading.fraction * 18 - segment));
        ctx.fillStyle = signalColor(reading.heat, alpha * .12);
        ctx.fillRect(x + segment * width / 18, 22, width / 18 - 1, 5);
        if (fill > 0) {
          ctx.fillStyle = signalColor(reading.heat, alpha * .85);
          ctx.fillRect(x + segment * width / 18, 22, (width / 18 - 1) * fill, 5);
        }
      }
    }
    line(-73, 33, 73, 33, .18);
    text(status === 'outside' ? '! 범위 이탈' : status === 'missing' ? '데이터 확인' : 'TEMP / RH  ·  범위 내', -73, 54, 8, .75, true);
    ctx.restore();
  }
}

export function drawEnvironmentFocus(ctx: CanvasRenderingContext2D, fonts: FilmFonts, state: ZoneEnvironmentState) {
  const selected = state.selected;
  if (!selected) return;
  const motion = environmentGaugeState(state);
  const alpha = state.reveal * motion.opacity, zone = selected.zone;
  const { temperature, humidity } = ENVIRONMENT_GAUGES;
  drawEnvironmentLink(ctx, environmentFocusConnection(state), alpha * motion.assembly * state.focus,
    selected.status === 'outside' ? 1 : .25, state.elapsed, 2.1);
  filmText(ctx, fonts, zone.id, 640, 313, 18, alpha * motion.readingOpacity, true, 'center');
  filmText(ctx, fonts, zone.name, 640, 335, 13, alpha * motion.readingOpacity * .85, false, 'center');
  // Both channels stay mounted while the selected station and its tether advance.
  const linkAlpha = alpha * motion.assembly * .7;
  drawEnvironmentLink(ctx, [{ x: temperature.x + temperature.radius, y: temperature.y }, { x: 622, y: temperature.y }],
    linkAlpha, .1, state.elapsed, 1.3);
  drawEnvironmentLink(ctx, [{ x: 658, y: humidity.y }, { x: humidity.x - humidity.radius, y: humidity.y }],
    linkAlpha, .1, state.elapsed, 1.3);
  drawSensorRotor(ctx, 640, temperature.y, 15, 1, state.elapsed, .1, linkAlpha);
  drawEnvironmentGauge(ctx, fonts, temperature, zone.temperature, zone.temperatureRange, false, motion, alpha);
  drawEnvironmentGauge(ctx, fonts, humidity, zone.humidity, zone.humidityRange, true, motion, alpha);
}
