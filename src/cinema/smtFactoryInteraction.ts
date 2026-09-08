import type { InspectionCamera, Point3D } from './inspectionSpace';
import { SMT_LINE_WIDTH } from './smtLine';
import {
  factoryCamera, factoryWorld, smtFactoryState, SMT_FACTORY_DEPTH,
  SMT_FACTORY_LINES, SMT_FACTORY_PITCH, SMT_FACTORY_STATIONS, type FactoryStation,
} from './smtFactory';

/** Orbit coordinates use the same world axes as InspectionCamera. */
export type FactoryOrbit = { target: Point3D; yaw: number; pitch: number; distance: number };
export type FactoryInteraction = { orbit: FactoryOrbit; selectedKey: string | null };

const FOCAL = 720;
const NEAR = 35;
const MIN_DISTANCE = 180;
const MAX_DISTANCE = 3500;
const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const wrapYaw = (yaw: number) => ((yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;

function validOrbit(orbit: FactoryOrbit): FactoryOrbit {
  return {
    target: { x: finite(orbit.target.x), y: finite(orbit.target.y, 100), z: finite(orbit.target.z, 500) },
    yaw: wrapYaw(finite(orbit.yaw)), pitch: clamp(finite(orbit.pitch, .14), .06, 1.35),
    distance: clamp(finite(orbit.distance, 550), MIN_DISTANCE, MAX_DISTANCE),
  };
}

function forward(yaw: number, pitch: number): Point3D {
  return { x: Math.sin(yaw) * Math.cos(pitch), y: -Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) };
}

function stationCenter(station: FactoryStation): Point3D {
  return factoryWorld({ x: station.x, y: station.height / 2, z: station.z - SMT_FACTORY_DEPTH / 2 });
}

/** Taking manual control keeps the current eye and heading without a visual jump. */
export function createFactoryInteraction(time: number): FactoryInteraction {
  const state = smtFactoryState(time), camera = factoryCamera(state);
  const station = state.focus > .5 ? state.station
    : SMT_FACTORY_STATIONS.find(item => item.line === state.station.line && item.id === 'loader')!;
  const center = stationCenter(station), direction = forward(camera.yaw, camera.pitch);
  const distance = clamp((center.x - camera.x) * direction.x + (center.y - camera.y) * direction.y
    + (center.z - camera.z) * direction.z, 450, 700);
  return { selectedKey: null, orbit: {
    target: { x: camera.x + direction.x * distance, y: camera.y + direction.y * distance,
      z: camera.z + direction.z * distance },
    yaw: camera.yaw, pitch: camera.pitch, distance,
  } };
}

export function interactionCamera(orbit: FactoryOrbit): InspectionCamera {
  const safe = validOrbit(orbit), direction = forward(safe.yaw, safe.pitch);
  return { x: safe.target.x - direction.x * safe.distance, y: safe.target.y - direction.y * safe.distance,
    z: safe.target.z - direction.z * safe.distance, yaw: safe.yaw, pitch: safe.pitch, focal: FOCAL, near: NEAR };
}

export function orbitFactory(orbit: FactoryOrbit, dx: number, dy: number): FactoryOrbit {
  const safe = validOrbit(orbit);
  return { ...safe, yaw: wrapYaw(safe.yaw - finite(dx) * .006),
    pitch: clamp(safe.pitch + finite(dy) * .006, .06, 1.35) };
}

export function zoomFactory(orbit: FactoryOrbit, delta: number): FactoryOrbit {
  const safe = validOrbit(orbit);
  return { ...safe, distance: clamp(safe.distance * Math.exp(clamp(finite(delta), -2000, 2000) * .001),
    MIN_DISTANCE, MAX_DISTANCE) };
}

/** Drag the ground with the pointer; the orbit pivot remains at its existing height. */
export function panFactory(orbit: FactoryOrbit, dx: number, dy: number): FactoryOrbit {
  const safe = validOrbit(orbit), scale = safe.distance / FOCAL;
  const right = clamp(finite(dx), -100000, 100000) * scale;
  const ahead = clamp(finite(dy), -100000, 100000) * scale / Math.max(.25, Math.sin(safe.pitch));
  return { ...safe, target: {
    x: clamp(safe.target.x - Math.cos(safe.yaw) * right + Math.sin(safe.yaw) * ahead,
      -700, (SMT_FACTORY_LINES - 1) * SMT_FACTORY_PITCH + 700),
    y: safe.target.y,
    z: clamp(safe.target.z + Math.sin(safe.yaw) * right + Math.cos(safe.yaw) * ahead,
      -850, SMT_LINE_WIDTH + 700),
  } };
}

export function focusFactoryStation(station: FactoryStation, orbit: FactoryOrbit): FactoryOrbit {
  const safe = validOrbit(orbit);
  let focused = { ...safe, target: stationCenter(station),
    distance: clamp(Math.max(station.width, station.height + 45, SMT_FACTORY_DEPTH) * 2.3, 380, MAX_DISTANCE) };
  // At entrance height, earlier machines can hide a downstream target even when it is centered.
  // Raise the eye only as far as needed to reveal that cabinet, retaining the user's heading.
  while (focused.pitch < 1.35
    && pickFactoryStation({ x: 640, y: 360 }, interactionCamera(focused))?.key !== station.key) {
    focused = { ...focused, pitch: Math.min(1.35, focused.pitch + .08) };
  }
  return focused;
}

/** Ray parameter is camera-space depth, so near clipping uses the same units as rendering. */
function intersectCabinet(camera: InspectionCamera, ray: Point3D, station: FactoryStation): number | null {
  const min: Point3D = { x: station.z - SMT_FACTORY_DEPTH, y: 0, z: station.x - station.width / 2 };
  const max: Point3D = { x: station.z, y: station.height, z: station.x + station.width / 2 };
  let enter = -Infinity, exit = Infinity;
  for (const axis of ['x', 'y', 'z'] as const) {
    if (Math.abs(ray[axis]) < 1e-9) {
      if (camera[axis] < min[axis] || camera[axis] > max[axis]) return null;
      continue;
    }
    const a = (min[axis] - camera[axis]) / ray[axis], b = (max[axis] - camera[axis]) / ray[axis];
    enter = Math.max(enter, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
    if (enter > exit) return null;
  }
  if (exit < camera.near) return null;
  return enter >= camera.near ? enter : exit;
}

/** Logical coordinates can extend beyond 1280x720 on wide canvases; only the real surface bounds input. */
export function pickFactoryStation(point: { x: number; y: number }, camera: InspectionCamera): FactoryStation | null {
  if (![point.x, point.y, camera.x, camera.y, camera.z, camera.yaw, camera.pitch, camera.focal, camera.near]
    .every(Number.isFinite) || camera.focal <= 0 || camera.near <= 0) return null;
  const u = (point.x - 640) / camera.focal, v = (360 - point.y) / camera.focal;
  const sinYaw = Math.sin(camera.yaw), cosYaw = Math.cos(camera.yaw);
  const sinPitch = Math.sin(camera.pitch), cosPitch = Math.cos(camera.pitch);
  const ray = { x: cosYaw * u + sinYaw * sinPitch * v + sinYaw * cosPitch,
    y: cosPitch * v - sinPitch,
    z: -sinYaw * u + cosYaw * sinPitch * v + cosYaw * cosPitch };
  let closest: FactoryStation | null = null, depth = Infinity;
  for (const station of SMT_FACTORY_STATIONS) {
    const hit = intersectCabinet(camera, ray, station);
    if (hit !== null && hit < depth) { closest = station; depth = hit; }
  }
  return closest;
}
