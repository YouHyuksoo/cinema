import { filmText, signalColor, type FilmFonts } from '../filmDrawing';
import { energyCoreState, type EnergyReading } from '../energyCore';
import { ENERGY_CHANNELS, energyGaugeProjection, energyPowerReading, energyPulsePoint, energyPulseProjection } from '../energyPower';
import { applyFocusProjection, projectFocusPoint } from '../filmFocus';

export function drawEnergyPulse(ctx: CanvasRenderingContext2D, time: number, reading: EnergyReading, heat: number) {
  const state = energyCoreState(time), metric = energyPowerReading(reading), project = energyPulseProjection(time);
  const ratio = metric.fill * state.assembly;
  ctx.save();
  const glow = ctx.createRadialGradient(775, 262, 8, 775, 262, 320);
  glow.addColorStop(0, signalColor(heat, state.opacity * metric.fill * .09));
  glow.addColorStop(1, signalColor(heat, 0)); ctx.fillStyle = glow; ctx.fillRect(455, -58, 640, 640);
  for (let strand = 11; strand >= 0; strand--) {
    ctx.beginPath();
    for (let step = 0; step <= 180; step++) {
      const point = project(energyPulsePoint(step / 180, strand, time, ratio));
      if (step) ctx.lineTo(point.x, point.y); else ctx.moveTo(point.x, point.y);
    }
    ctx.lineWidth = strand === 0 ? 2.5 : .85;
    ctx.strokeStyle = signalColor(heat, state.opacity * (strand === 0 ? .95 : .12 + (11 - strand) * .025));
    ctx.shadowColor = signalColor(heat, .8); ctx.shadowBlur = strand === 0 ? 13 : 0; ctx.stroke();
  }
  ctx.shadowBlur = 0;
  if (metric.available && metric.fill > 0) {
    for (let index = 0; index < 18; index++) {
      const u = ((time * (.08 + ratio * .09) + index / 18) % 1 + 1) % 1;
      const point = project(energyPulsePoint(u, index % 4, time, ratio));
      const alpha = state.opacity * Math.sin(Math.PI * u);
      ctx.fillStyle = signalColor(heat, alpha * .8);
      ctx.fillRect(point.x - 1.5, point.y - 1.5, 3, 3);
    }
  }
  // A low segmented reflection shares the pulse's local amplitude.
  for (let segment = 0; segment < 78; segment++) {
    const u = segment / 77, sample = energyPulsePoint(u, 0, time, ratio);
    const h = Math.abs(sample.y) * .26;
    ctx.fillStyle = signalColor(heat, state.opacity * .24); ctx.fillRect(410 + segment * 9.8, 351 - h, 4, Math.max(1, h));
  }
  ctx.restore();
  return project(energyPulsePoint(.7, 0, time, ratio));
}

export function drawEnergyPowerGauge(ctx: CanvasRenderingContext2D, fonts: FilmFonts, index: number,
  time: number, reading: EnergyReading) {
  const state = energyCoreState(time), channel = ENERGY_CHANNELS[index];
  const metric = energyPowerReading(reading), projection = energyGaugeProjection(index, time);
  const active = state.index === index && state.focus > .01, alpha = state.opacity * (active ? 1 : .68);
  const heat = metric.over ? 1 : channel.heat, y = 426 + index * 82;
  const x = 344, width = 646, height = 20, fill = metric.fill * state.assembly;
  ctx.save(); applyFocusProjection(ctx, projection);
  const text = (value: string, xx: number, yy: number, size: number, opacity = 1, align: CanvasTextAlign = 'left') =>
    filmText(ctx, fonts, value, xx, yy, size, alpha * opacity, true, align, signalColor(heat, 1));
  text(`0${index + 1} / ${channel.label}`, 137, y - 10, 11, .65);
  filmText(ctx, fonts, channel.title, 137, y + 15, 20, alpha, false, 'left', signalColor(heat, 1));
  text(metric.available ? `${(metric.ratio * 100).toFixed(1)}%` : '—', 1130, y + 8, 27, 1, 'right');
  text(metric.available ? `${reading.value.toLocaleString('en-US')} / ${reading.capacity.toLocaleString('en-US')} ${reading.unit}` : '데이터 확인', 990, y - 19, 10, .85, 'right');
  ctx.lineWidth = .75;
  ctx.strokeStyle = signalColor(heat, alpha * .18);
  ctx.beginPath(); ctx.moveTo(x - 10, y - 15); ctx.lineTo(x - 10, y + 15);
  ctx.lineTo(x + width + 10, y + 15); ctx.lineTo(x + width + 10, y - 15); ctx.stroke();
  for (let segment = 0; segment < 72; segment++) {
    const xx = x + segment * width / 72, w = width / 72 - 2;
    const lit = Math.max(0, Math.min(1, fill * 72 - segment));
    ctx.fillStyle = signalColor(heat, alpha * .065); ctx.fillRect(xx, y - height / 2, w, height);
    if (!lit) continue;
    const glint = Math.max(0, 1 - Math.abs(segment / 72 - ((time * .23) % 1)) * 14);
    const light = ctx.createLinearGradient(xx, y - height / 2, xx, y + height / 2);
    light.addColorStop(0, signalColor(heat, alpha * (.88 + glint * .1)));
    light.addColorStop(.5, signalColor(heat, alpha * (.48 + glint * .25)));
    light.addColorStop(1, signalColor(heat, alpha * .8));
    ctx.fillStyle = light; ctx.fillRect(xx, y - height / 2, w * lit, height);
    ctx.beginPath(); ctx.moveTo(xx, y - 10); ctx.lineTo(xx + 5, y - 15);
    ctx.lineTo(xx + w * lit + 5, y - 15); ctx.lineTo(xx + w * lit, y - 10); ctx.closePath();
    ctx.fillStyle = signalColor(heat, alpha * .2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(xx + w * lit, y - 10); ctx.lineTo(xx + w * lit + 5, y - 15);
    ctx.lineTo(xx + w * lit + 5, y + 5); ctx.lineTo(xx + w * lit, y + 10); ctx.closePath();
    ctx.fillStyle = signalColor(heat, alpha * .27); ctx.fill();
  }
  for (let tick = 0; tick <= 20; tick++) {
    const xx = x + tick / 20 * width;
    ctx.beginPath(); ctx.moveTo(xx, y + 21); ctx.lineTo(xx, y + (tick % 5 ? 24 : 28));
    ctx.strokeStyle = signalColor(heat, alpha * .35); ctx.stroke();
    if (!(tick % 5)) text(String(tick * 5), xx, y + 39, 7, .55, 'center');
  }
  if (fill > 0) {
    const capX = x + width * fill;
    ctx.fillStyle = signalColor(heat, alpha * .94); ctx.fillRect(capX - 1, y - 15, 2, 30);
  }
  if (metric.over) text('기준 초과', 1130, y + 30, 10, .9, 'right');
  ctx.restore();
  return projectFocusPoint(projection, { x: x + fill * width, y: y - 16 });
}
