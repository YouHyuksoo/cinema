import { smooth } from './filmDrawing';
import { createHoloProjection, type HoloPoint } from './holoSpace';

export const ENERGY_CORE_SECONDS = 32;
export interface EnergyReading { value: number; capacity: number; unit: string }
export interface EnergyCoreData {
  name: string;
  power: EnergyReading;
  production: EnergyReading;
  efficiency: EnergyReading;
}
export const DEFAULT_ENERGY_DATA: EnergyCoreData = {
  name: 'SMT LINE / ENERGY MONITOR',
  power: { value: 92.4, capacity: 140, unit: 'kW' },
  production: { value: 1267, capacity: 1450, unit: 'EA' },
  efficiency: { value: 94.8, capacity: 100, unit: '%' },
};
export const ENERGY_LAYERS = [
  { key: 'power', title: '전력', label: 'POWER', radius: 170, heat: .72 },
  { key: 'production', title: '생산량', label: 'OUTPUT', radius: 131, heat: .1 },
  { key: 'efficiency', title: '효율', label: 'EFFICIENCY', radius: 91, heat: 0 },
] as const;

export function energyRatio(reading: EnergyReading) {
  return Number.isFinite(reading.value) && Number.isFinite(reading.capacity) && reading.capacity > 0
    ? Math.max(0, Math.min(1, reading.value / reading.capacity)) : 0;
}

export function energyCoreState(time: number) {
  const elapsed = Number.isFinite(time) ? Math.max(0, Math.min(ENERGY_CORE_SECONDS, time)) : 0;
  const index = Math.min(2, Math.max(0, Math.floor((elapsed - 3) / 8)));
  const localTime = elapsed - (3 + index * 8);
  const focus = smooth(0, 1.8, localTime) * (1 - smooth(6.1, 7.6, localTime));
  const readout = smooth(1.3, 2.6, localTime) * (1 - smooth(5.8, 6.8, localTime));
  const release = 1 - smooth(30, 32, elapsed);
  return { index, localTime, focus, readout, opacity: smooth(0, 1.1, elapsed) * release,
    assembly: smooth(.3, 2.8, elapsed), summary: smooth(27, 28.3, elapsed) * release };
}
export type EnergyCoreState = ReturnType<typeof energyCoreState>;

export function energyLayerCenter(index: number, state: EnergyCoreState): HoloPoint {
  const separation = index === state.index ? state.focus : 0;
  return { x: 0, y: (index - 1) * 8 - separation * 35, z: (index - 1) * 16 - separation * 135 };
}

export function energyCoreProjection(time: number, state: EnergyCoreState) {
  return createHoloProjection({ x: 478, y: 365, yaw: -.3 + Math.sin(time * .08) * .16,
    pitch: .22, scale: .98 + state.focus * .12, distance: 980 });
}

/** Every rotating shell and leader point uses this same material-space pose. */
export function energyLayerPoint(index: number, state: EnergyCoreState, time: number,
  latitude: number, longitude: number): HoloPoint {
  const center = energyLayerCenter(index, state), layer = ENERGY_LAYERS[index];
  const angle = longitude + time * (index % 2 ? -.15 : .12) + index * .8;
  const r = layer.radius * (.7 + .3 * state.assembly);
  const x = Math.cos(latitude) * Math.cos(angle) * r;
  const y = Math.sin(latitude) * r;
  const z = Math.cos(latitude) * Math.sin(angle) * r;
  const tilt = -.22 + index * .28;
  return { x: center.x + x * Math.cos(tilt) - y * Math.sin(tilt),
    y: center.y + x * Math.sin(tilt) + y * Math.cos(tilt), z: center.z + z };
}
