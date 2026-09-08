import { ENERGY_LAYERS, energyRatio, type EnergyCoreData, type EnergyCoreState } from './energyCore';
import { energyPowerReading } from './energyPower';
import { createHoloProjection, type HoloPoint } from './holoSpace';

/**
 * Arc reactor geometry for the energy scene: a plasma core, three concentric metric rings
 * (power / output / efficiency) on the existing energyLayer shells, an ignition ring of coils
 * and electric arcs whose count follows the power ratio. Time only animates; every size,
 * lit fraction and arc count comes from the data.
 */
export const REACTOR_CENTER = { x: 790, y: 228 } as const;
export const REACTOR_COILS = 24;
export const REACTOR_SEGMENTS = 48;
export const REACTOR_ARC_MAX = 6;
const TAU = Math.PI * 2;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const hash = (a: number, b: number, c: number) => { const h = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return h - Math.floor(h); };

/** Ring centers: stacked in depth, the focused ring lifts gently toward the viewer (milder than the old shell pose). */
export function reactorLayerCenter(index: number, state: EnergyCoreState): HoloPoint {
  const separation = index === state.index ? state.focus : 0;
  return { x: 0, y: (index - 1) * 6 - separation * 18, z: (index - 1) * 14 - separation * 60 };
}

/** A point on ring `index` at the given latitude/longitude, with per-ring tilt and slow counter-rotation. */
export function reactorLayerPoint(index: number, state: EnergyCoreState, time: number, latitude: number, longitude: number): HoloPoint {
  const center = reactorLayerCenter(index, state), layer = ENERGY_LAYERS[index];
  const angle = longitude + time * (index % 2 ? -.15 : .12) + index * .8;
  const r = layer.radius * (.7 + .3 * state.assembly);
  const x = Math.cos(latitude) * Math.cos(angle) * r, y = Math.sin(latitude) * r, z = Math.cos(latitude) * Math.sin(angle) * r;
  const tilt = -.18 + index * .2;
  return { x: center.x + x * Math.cos(tilt) - y * Math.sin(tilt), y: center.y + x * Math.sin(tilt) + y * Math.cos(tilt), z: center.z + z };
}

export function energyReactorProjection(time: number, state: EnergyCoreState) {
  return createHoloProjection({ x: REACTOR_CENTER.x, y: REACTOR_CENTER.y, yaw: -.35 + Math.sin(time * .07) * .22,
    pitch: .62, scale: .76 + state.focus * .05, distance: 1100 });
}

/** Coils light one after another, clockwise, while the reactor assembles; all lit once assembly completes. */
export function coilIgnition(index: number, state: EnergyCoreState) {
  return clamp(state.assembly * (REACTOR_COILS + 3) - index);
}

/** Each ring is a segmented charge gauge: lit segments = metric fill, revealed with assembly. */
export function ringCharge(index: number, data: EnergyCoreData, state: EnergyCoreState) {
  const layer = ENERGY_LAYERS[index];
  const metric = energyPowerReading(data[layer.key]);
  const fill = metric.fill * state.assembly;
  return { fill, lit: Math.round(fill * REACTOR_SEGMENTS), over: metric.over, available: metric.available, heat: metric.over ? 1 : layer.heat };
}

/** Plasma core brightness follows efficiency; it breathes but never exceeds the data-driven ceiling. */
export function reactorCore(data: EnergyCoreData, state: EnergyCoreState, time: number) {
  const efficiency = energyRatio(data.efficiency);
  const breathing = .82 + .18 * Math.sin(time * 3.1);
  const intensity = efficiency * state.assembly;
  return { intensity, breathing, radius: 22 + intensity * 16, heat: energyPowerReading(data.power).over || energyPowerReading(data.efficiency).over ? 1 : 0 };
}

export interface ReactorArc { points: HoloPoint[]; flicker: number }

/** Jagged discharges from the core to the outer ring; count scales with power, none at zero input. Deterministic per 1/12 s. */
export function reactorArcs(data: EnergyCoreData, state: EnergyCoreState, time: number): ReactorArc[] {
  const power = energyPowerReading(data.power);
  if (!power.available || power.fill <= 0 || state.assembly < .9) return [];
  const count = Math.max(1, Math.round(power.fill * REACTOR_ARC_MAX));
  const frame = Math.floor(time * 12), frameTime = frame / 12;
  const arcs: ReactorArc[] = [];
  for (let arc = 0; arc < count; arc++) {
    const longitude = hash(frame, arc, 1) * TAU;
    const target = reactorLayerPoint(0, state, frameTime, 0, longitude);
    const origin = reactorLayerCenter(2, state);
    const points: HoloPoint[] = [origin];
    const segments = 9;
    for (let step = 1; step < segments; step++) {
      const u = step / segments, wobble = Math.sin(Math.PI * u) * 22;
      points.push({
        x: origin.x + (target.x - origin.x) * u + (hash(frame, arc, step * 3) - .5) * wobble,
        y: origin.y + (target.y - origin.y) * u + (hash(frame, arc, step * 3 + 1) - .5) * wobble,
        z: origin.z + (target.z - origin.z) * u + (hash(frame, arc, step * 3 + 2) - .5) * wobble,
      });
    }
    points.push(target);
    arcs.push({ points, flicker: .55 + hash(frame, arc, 7) * .45 });
  }
  return arcs;
}

/** Outer coil tick: from just outside the power ring to the coil tip, following the ring's tilt. */
export function coilSegment(index: number, state: EnergyCoreState, time: number) {
  const angle = index / REACTOR_COILS * TAU;
  const point = reactorLayerPoint(0, state, time, 0, angle), center = reactorLayerCenter(0, state);
  const along = (scale: number): HoloPoint => ({ x: center.x + (point.x - center.x) * scale, y: center.y + (point.y - center.y) * scale, z: center.z + (point.z - center.z) * scale });
  return { inner: along(1.08), outer: along(1.24), tip: along(1.3) };
}
