import { DEFAULT_ENERGY_DATA, energyCoreState, type EnergyCoreData } from './energyCore';
import { ENERGY_CHANNELS, energyPowerReading } from './energyPower';
import { drawEnergyPowerGauge } from './components/drawEnergyPower';
import { drawEnergyReactor } from './components/drawEnergyReactor';
import { drawCornerField } from './components/drawCornerField';
import { DEFAULT_FONTS, filmText, signalColor, type FilmFonts } from './filmDrawing';
import { beginFilmViewport, type FilmViewportInsets } from './filmViewport';
import { applyFocusProjection, focusProjection } from './filmFocus';

export function drawEnergyCoreFilm(ctx: CanvasRenderingContext2D, width: number, height: number, time: number,
  fonts: FilmFonts = DEFAULT_FONTS, insets?: FilmViewportInsets, data: EnergyCoreData = DEFAULT_ENERGY_DATA) {
  const state = energyCoreState(time), channel = ENERGY_CHANNELS[state.index], reading = data[channel.key];
  const metric = energyPowerReading(reading);
  const view = beginFilmViewport(ctx, width, height, insets);
  drawCornerField(ctx, view, time, state.focus * .5);
  const text = (value: string, x: number, y: number, size: number, alpha = 1, mono = false) =>
    filmText(ctx, fonts, value, x, y, size, state.opacity * alpha, mono, 'left', signalColor(channel.heat, 1));
  text('ENERGY / ARC REACTOR', 72, 76, 14, .8, true);
  text(data.name, 72, 102, 10, .5, true);
  const pulse = drawEnergyReactor(ctx, time, data, state);
  ctx.save();
  applyFocusProjection(ctx, focusProjection({ x: 222, y: 235, focus: state.focus, depth: 65, lift: 4 }));
  text(`${channel.label} / ${channel.title}`, 110, 174, 13, .7, true);
  text(metric.available ? reading.value.toLocaleString('en-US', { maximumFractionDigits: 1 }) : '—', 107, 239, 60, 1, true);
  text(reading.unit, 113, 274, 23, .75, true);
  text(metric.available ? `기준 ${reading.capacity.toLocaleString('en-US')} ${reading.unit}` : '데이터 확인', 113, 312, 13, .7);
  text(metric.available ? `${(metric.ratio * 100).toFixed(1)}%  /  ${metric.over ? '기준 초과' : '기준 대비'}` : '유효한 측정값과 기준이 필요합니다', 113, 341, 11, .8, true);
  ctx.restore();
  const anchors = ENERGY_CHANNELS.map((item, index) => drawEnergyPowerGauge(ctx, fonts, index, time, data[item.key]));
  if (state.readout > 0) {
    const anchor = anchors[state.index];
    ctx.save(); ctx.globalAlpha = state.opacity * state.readout * .3;
    ctx.beginPath(); ctx.moveTo(pulse.x, pulse.y);
    ctx.bezierCurveTo(pulse.x + 30, 363, anchor.x, 370, anchor.x, anchor.y);
    ctx.strokeStyle = signalColor(channel.heat, .9); ctx.lineWidth = .9; ctx.stroke(); ctx.restore();
  }
  text('POWER CHANNELS / 03', 72, 689, 10, .5, true);
  text('시연 데이터', 990, 689, 11, .5);
}
