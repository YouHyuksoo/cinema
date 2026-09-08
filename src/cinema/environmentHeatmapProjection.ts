import { ENVIRONMENT_HEATMAP_BOUNDS } from './environmentHeatmap';
import { smooth } from './filmDrawing';
import type { InspectionCamera, Point3D } from './inspectionSpace';
import { factoryProject, smtFactoryState, SMT_FACTORY_DEPTH, SMT_FACTORY_LINES, SMT_FACTORY_PITCH, type FactoryState } from './smtFactory';
import { SMT_LINE_WIDTH } from './smtLine';
import { ENVIRONMENT_FILM_SECONDS, ENVIRONMENT_TIMING } from './zoneEnvironment';

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
const FLIGHT_STOPS = [
  { at: 38, eye: { x: factoryCenterX, y: 3500, z: factoryCenterZ }, target: { x: factoryCenterX, y: 0, z: factoryCenterZ } },
  { at: 42, eye: { x: 300, y: 540, z: -320 }, target: { x: 300, y: 70, z: 500 } },
  { at: 46, eye: { x: 300, y: 380, z: 850 }, target: { x: 300, y: 70, z: 1320 } },
  { at: 50, eye: { x: 1370, y: 620, z: 1670 }, target: { x: 1250, y: 50, z: 700 } },
  { at: 52, eye: { x: 1750, y: 780, z: 1300 }, target: { x: 1050, y: 50, z: 650 } },
] as const;

function flightPoint(from: Point3D, to: Point3D, progress: number): Point3D {
  return { x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress, z: from.z + (to.z - from.z) * progress };
}

function flightOrientation(eye: Point3D, target: Point3D) {
  const dx = target.x - eye.x, dz = target.z - eye.z;
  return { yaw: Math.atan2(dx, dz), pitch: Math.atan2(eye.y - target.y, Math.hypot(dx, dz)) };
}

/** The existing VISOR camera carries the thermal floor from an overhead plan into a factory flight. */
export function environmentHeatmapProjection(elapsed: number) {
  const time = Number.isFinite(elapsed)
    ? Math.max(ENVIRONMENT_TIMING.heatmapStart, Math.min(ENVIRONMENT_FILM_SECONDS, elapsed))
    : ENVIRONMENT_TIMING.heatmapStart;
  const segment = time <= FLIGHT_STOPS[0].at ? 0 : time < 42 ? 1 : time < 46 ? 2 : time < 50 ? 3 : 4;
  const from = FLIGHT_STOPS[Math.max(0, segment - 1)], to = FLIGHT_STOPS[segment];
  const progress = segment ? smooth(from.at, to.at, time) : 0;
  const eye = flightPoint(from.eye, to.eye, progress);
  const start = flightOrientation(from.eye, from.target), end = flightOrientation(to.eye, to.target);
  // Blend endpoint angles: interpolating look-at positions would cancel the forward vector during a turn.
  const yawDistance = Math.atan2(Math.sin(end.yaw - start.yaw), Math.cos(end.yaw - start.yaw));
  const camera: InspectionCamera = { ...eye, yaw: start.yaw + yawDistance * progress,
    pitch: start.pitch + (end.pitch - start.pitch) * progress, focal: 720, near: 35 };
  const factoryState: FactoryState = { ...smtFactoryState(0), time, presence: 1, focus: 0, readout: 0,
    manualSelection: null, cameraOverride: camera, cameraX: camera.z, cameraZ: camera.x };
  const bounds = ENVIRONMENT_HEATMAP_BOUNDS;
  return { camera, factoryState,
    phase: ['상공 평면', '라인 입구로 하강', '설비 사이 전진', '라인 선회', '상공 복귀'][segment],
    point: (x: number, y: number, height = 0) => factoryProject({
      x: -100 + (y - bounds.y) / bounds.height * (SMT_LINE_WIDTH + 200),
      y: height,
      z: -240 + (x - bounds.x) / bounds.width * ((SMT_FACTORY_LINES - 1) * SMT_FACTORY_PITCH + 420),
    }, factoryState),
  };
}
