import { ENVIRONMENT_HEATMAP_BOUNDS, environmentHeatmap, type EnvironmentHeatmapRoom } from './environmentHeatmap';
import { smooth } from './filmDrawing';
import type { InspectionCamera, Point3D } from './inspectionSpace';
import { factoryProject, smtFactoryState, SMT_FACTORY_DEPTH, SMT_FACTORY_LINES, SMT_FACTORY_PITCH, type FactoryState } from './smtFactory';
import { SMT_LINE_WIDTH } from './smtLine';
import { DEFAULT_ENVIRONMENT_DATA, ENVIRONMENT_FILM_SECONDS, ENVIRONMENT_TIMING } from './zoneEnvironment';

export interface EnvironmentHeatmapPoint { x: number; y: number }
export interface EnvironmentHeatmapLabel extends EnvironmentHeatmapPoint { width: number; height: number }

/** Keep the ten sensor billboards legible while their floor positions rotate past each other. */
export function environmentHeatmapLabels(points: readonly EnvironmentHeatmapPoint[]): EnvironmentHeatmapLabel[] {
  const width = 88, height = 38, gap = 4.01;
  const minimumX = 145, maximumX = 1135 - width, minimumY = 190, maximumY = 610 - height;
  const clampX = (x: number) => Math.max(minimumX, Math.min(maximumX, x));
  const clampY = (y: number) => Math.max(minimumY, Math.min(maximumY, y));
  const labels: EnvironmentHeatmapLabel[] = [];
  for (const point of points) {
    const preferred = { x: clampX(point.x - width / 2), y: clampY(point.y - 52) };
    // The closest free rectangle lies at the preferred coordinate, a viewport edge,
    // or an already-placed rectangle's separating edge along each axis.
    const xs = [preferred.x, minimumX, maximumX];
    const ys = [preferred.y, minimumY, maximumY];
    for (const label of labels) {
      xs.push(clampX(label.x - width - gap), clampX(label.x + label.width + gap));
      ys.push(clampY(label.y - height - gap), clampY(label.y + label.height + gap));
    }
    let nearest: EnvironmentHeatmapLabel | undefined, distance = Infinity;
    for (const x of xs) for (const y of ys) {
      if (labels.some(label => x < label.x + label.width + 4 && x + width + 4 > label.x
        && y < label.y + label.height + 4 && y + height + 4 > label.y)) continue;
      const candidateDistance = (x - preferred.x) ** 2 + (y - preferred.y) ** 2;
      if (candidateDistance < distance) {
        nearest = { x, y, width, height }; distance = candidateDistance;
      }
    }
    if (!nearest) throw new RangeError('Sensor labels exceed the available installation viewport.');
    labels.push(nearest);
  }
  return labels;
}

const factoryCenterX = ((SMT_FACTORY_LINES - 1) * SMT_FACTORY_PITCH - SMT_FACTORY_DEPTH) / 2;
const factoryCenterZ = SMT_LINE_WIDTH / 2;
export const ENVIRONMENT_HOTSPOT_DWELL = 4.8;
const overview = { eye: { x: factoryCenterX, y: 3500, z: factoryCenterZ },
  target: { x: factoryCenterX, y: 0, z: factoryCenterZ } };
const defaultRooms = environmentHeatmap(DEFAULT_ENVIRONMENT_DATA.zones).rooms;

/** Stable ties retain installation order; unknown sensor values are never ranked as temperatures. */
export function environmentHotspotOrder(rooms: readonly EnvironmentHeatmapRoom[]) {
  return rooms.filter(room => room.temperature !== null && Number.isFinite(room.temperature))
    .sort((a, b) => b.temperature! - a.temperature!);
}

function hotspotStop(room: EnvironmentHeatmapRoom) {
  const b = ENVIRONMENT_HEATMAP_BOUNDS;
  const target = { x: -240 + (room.pin.x - b.x) / b.width * ((SMT_FACTORY_LINES - 1) * SMT_FACTORY_PITCH + 420),
    y: 0, z: -100 + (room.pin.y - b.y) / b.height * (SMT_LINE_WIDTH + 200) };
  // Enter the aisle alongside the sensor, at equipment-eye height instead of hovering overhead.
  return { target, eye: { x: target.x + 145, y: 220, z: target.z - 420 } };
}

function hotspotExit(room: EnvironmentHeatmapRoom) {
  const stop = hotspotStop(room);
  // Gain height while backing away: a shallow climb, with the sensor still in view.
  return { target: stop.target, eye: { ...stop.eye, y: 460, z: stop.eye.z - 800 } };
}

function flightPoint(from: Point3D, to: Point3D, progress: number): Point3D {
  return { x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress, z: from.z + (to.z - from.z) * progress };
}

function aisleFlight(from: Point3D, to: Point3D, progress: number): Point3D {
  const point = flightPoint(from, to, progress);
  if (progress <= 0 || progress >= 1 || from.y > 1000 || to.y > 1000) return point;
  // Travel forward throughout the climb/descent instead of rising and dropping in place.
  // This low arc clears equipment while keeping the final approach shallow.
  return { ...point, y: point.y + 100 * Math.sin(Math.PI * progress) };
}

function flightOrientation(eye: Point3D, target: Point3D) {
  const dx = target.x - eye.x, dz = target.z - eye.z;
  return { yaw: Math.atan2(dx, dz), pitch: Math.atan2(eye.y - target.y, Math.hypot(dx, dz)) };
}

/** The existing VISOR camera carries the thermal floor from an overhead plan into a factory flight. */
export function environmentHeatmapProjection(elapsed: number, rooms: readonly EnvironmentHeatmapRoom[] = defaultRooms) {
  const time = Number.isFinite(elapsed)
    ? Math.max(ENVIRONMENT_TIMING.heatmapStart, Math.min(ENVIRONMENT_FILM_SECONDS, elapsed))
    : ENVIRONMENT_TIMING.heatmapStart;
  const ordered = environmentHotspotOrder(rooms);
  const tourTime = Math.max(0, time - ENVIRONMENT_TIMING.heatmapFull);
  const index = Math.floor(tourTime / ENVIRONMENT_HOTSPOT_DWELL);
  const touring = time > ENVIRONMENT_TIMING.heatmapFull && index < ordered.length;
  const returning = ordered.length > 0 && index >= ordered.length;
  const activeRoom = touring ? ordered[index] : null;
  const local = tourTime - index * ENVIRONMENT_HOTSPOT_DWELL;
  const retreating = !!activeRoom && local >= 3.6;
  const from = retreating ? hotspotStop(activeRoom!)
    : touring && index > 0 ? hotspotExit(ordered[index - 1])
    : returning ? hotspotExit(ordered[ordered.length - 1]) : overview;
  const to = activeRoom ? (retreating ? hotspotExit(activeRoom) : hotspotStop(activeRoom)) : overview;
  // Fly in 1.4s, read 2.2s, back out 1.2s; only then cross to the next sensor.
  const progress = retreating ? smooth(3.6, ENVIRONMENT_HOTSPOT_DWELL, local)
    : touring ? smooth(0, 1.4, local)
    : returning ? smooth(0, 3, tourTime - ordered.length * ENVIRONMENT_HOTSPOT_DWELL) : 0;
  const eye = retreating ? flightPoint(from.eye, to.eye, progress) : aisleFlight(from.eye, to.eye, progress);
  const start = flightOrientation(from.eye, from.target), end = flightOrientation(to.eye, to.target);
  // Blend endpoint angles: interpolating look-at positions would cancel the forward vector during a turn.
  const yawDistance = Math.atan2(Math.sin(end.yaw - start.yaw), Math.cos(end.yaw - start.yaw));
  const camera: InspectionCamera = { ...eye, yaw: start.yaw + yawDistance * progress,
    pitch: start.pitch + (end.pitch - start.pitch) * progress, focal: 720, near: 35 };
  const factoryState: FactoryState = { ...smtFactoryState(0), time, presence: 1, focus: 0, readout: 0,
    manualSelection: null, cameraOverride: camera, cameraX: camera.z, cameraZ: camera.x };
  const bounds = ENVIRONMENT_HEATMAP_BOUNDS;
  return { camera, factoryState,
    activeRoom, rank: touring ? index + 1 : 0, total: ordered.length,
    phase: retreating ? '뒤로 빠지며 완만하게 상승' : touring ? (progress < 1 ? '완만하게 센서 옆으로 진입' : '측면에서 온도 확인') : returning ? '상공 복귀' : '상공 평면',
    point: (x: number, y: number, height = 0) => factoryProject({
      x: -100 + (y - bounds.y) / bounds.height * (SMT_LINE_WIDTH + 200),
      y: height,
      z: -240 + (x - bounds.x) / bounds.width * ((SMT_FACTORY_LINES - 1) * SMT_FACTORY_PITCH + 420),
    }, factoryState),
  };
}
