import { energyCoreState, ENERGY_LAYERS, type EnergyReading } from './energyCore';
import { focusProjection } from './filmFocus';
import { createHoloProjection } from './holoSpace';

export function energyPowerReading(reading: EnergyReading) {
  const available = Number.isFinite(reading.value) && reading.value >= 0
    && Number.isFinite(reading.capacity) && reading.capacity > 0;
  const ratio = available ? reading.value / reading.capacity : 0;
  return { available, ratio, fill: Math.min(1, ratio), over: available && ratio > 1 };
}
export function energyGaugeProjection(index: number, time: number) {
  const state = energyCoreState(time);
  return focusProjection({ x: 640, y: 426 + index * 82,
    focus: index === state.index ? state.focus : 0, depth: 95, lift: 8 });
}

/** A visual pulse driven by the metric ratio, not sampled electrical AC measurements. */
export function energyPulsePoint(position: number, strand: number, time: number, fill: number) {
  const u = Math.max(0, Math.min(1, position));
  const envelope = Math.sin(Math.PI * u) ** 1.2;
  const phase = u * Math.PI * 6 - time * 2.8 + strand * .24;
  const amplitude = Math.max(0, Math.min(1, fill)) * 76;
  return { x: (u - .5) * 740,
    y: envelope * amplitude * (Math.sin(phase) * .72 + Math.sin(phase * 1.8 + time * .4) * .28),
    z: envelope * Math.cos(phase + strand * .3) * amplitude * .44 };
}
export function energyPulseProjection(time: number) {
  const state = energyCoreState(time);
  return createHoloProjection({ x: 786, y: 262, yaw: -.04, pitch: .28,
    scale: 1 + state.focus * .05, distance: 1800 });
}
export const ENERGY_CHANNELS = ENERGY_LAYERS.map(({ key, title, label, heat }) => ({ key, title, label, heat }));
