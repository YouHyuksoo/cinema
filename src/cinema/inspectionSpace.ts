import type { FilmFonts } from './filmDrawing';
import { filmText } from './filmDrawing';

export interface Point3D { x: number; y: number; z: number }
export interface InspectionCamera extends Point3D {
  yaw: number;
  pitch: number;
  focal: number;
  near: number;
}
export interface InspectionStation {
  readonly id: 1 | 2 | 3 | 4;
  readonly x: number;
  readonly z: number;
}
export const INSPECTION_TARGET = { x: -205, y: 88, z: 825, width: 144, height: 176, depth: 150 } as const;
export const INSPECTION_STATIONS = [
  { id: 1, x: -250, z: 1540 },
  { id: 2, x: 250, z: 1710 },
  { id: 3, x: INSPECTION_TARGET.x, z: 900 },
  { id: 4, x: 310, z: 630 },
] as const satisfies readonly InspectionStation[];

/** Unknown station IDs retain the original SMT 03 view. */
export function inspectionStation(id: number): InspectionStation {
  return INSPECTION_STATIONS.find(station => station.id === id) ?? INSPECTION_STATIONS[2];
}

/** The selected cabinet lifts from its footprint and advances toward the observer. */
export function inspectionFocusPoint(point: Point3D, focus: number): Point3D {
  const amount = Math.max(0, Math.min(1, focus));
  return { x: point.x, y: point.y + amount * 22, z: point.z - amount * 62 };
}

/** A physical dolly and small turn replace the former uniform canvas enlargement. */
export function inspectionCamera(time: number, focus: number): InspectionCamera {
  const mix = (a: number, b: number) => a + (b - a) * focus;
  return {
    x: mix(55 + Math.sin(time * .27) * 50, -110),
    y: mix(215 + Math.sin(time * .37) * 3, 210),
    z: mix(40 + Math.sin(time * .2) * 18, 440),
    yaw: mix(-.09 + Math.sin(time * .27) * .025, -.012),
    pitch: mix(.14 + Math.sin(time * .19) * .008, .30),
    focal: 720,
    near: 35,
  };
}

export function inspectionCameraPoint(camera: InspectionCamera, point: Point3D): Point3D {
  const dx = point.x - camera.x, dy = point.y - camera.y, dz = point.z - camera.z;
  const forward = dx * Math.sin(camera.yaw) + dz * Math.cos(camera.yaw);
  return {
    x: dx * Math.cos(camera.yaw) - dz * Math.sin(camera.yaw),
    y: dy * Math.cos(camera.pitch) + forward * Math.sin(camera.pitch),
    z: -dy * Math.sin(camera.pitch) + forward * Math.cos(camera.pitch),
  };
}

function projectCameraPoint(camera: InspectionCamera, point: Point3D) {
  const scale = camera.focal / Math.max(camera.near, point.z);
  return { x: 640 + point.x * scale, y: 360 - point.y * scale, scale, depth: point.z, visible: point.z >= camera.near };
}

export function projectInspectionPoint(camera: InspectionCamera, point: Point3D) {
  return projectCameraPoint(camera, inspectionCameraPoint(camera, point));
}

function nearIntersection(a: Point3D, b: Point3D, near: number): Point3D {
  const t = (near - a.z) / (b.z - a.z);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: near };
}

/** Segments crossing the eye plane are clipped, so nearby geometry cannot flip or explode. */
export function strokeSpatialPath(ctx: CanvasRenderingContext2D, camera: InspectionCamera,
  points: readonly Point3D[], color: string, width = 1) {
  const view = points.map(point => inspectionCameraPoint(camera, point));
  ctx.beginPath();
  for (let i = 1; i < view.length; i++) {
    let a = view[i - 1], b = view[i];
    if (a.z < camera.near && b.z < camera.near) continue;
    if (a.z < camera.near) a = nearIntersection(a, b, camera.near);
    if (b.z < camera.near) b = nearIntersection(a, b, camera.near);
    const pa = projectCameraPoint(camera, a), pb = projectCameraPoint(camera, b);
    ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
  }
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}

export function fillSpatialPolygon(ctx: CanvasRenderingContext2D, camera: InspectionCamera,
  points: readonly Point3D[], fill: string, stroke?: string) {
  const view = points.map(point => inspectionCameraPoint(camera, point));
  const clipped: Point3D[] = [];
  for (let i = 0; i < view.length; i++) {
    const a = view[i], b = view[(i + 1) % view.length];
    if (a.z >= camera.near) clipped.push(a);
    if ((a.z >= camera.near) !== (b.z >= camera.near)) clipped.push(nearIntersection(a, b, camera.near));
  }
  if (clipped.length < 3) return;
  ctx.beginPath();
  clipped.forEach((point, index) => {
    const screen = projectCameraPoint(camera, point);
    if (index) ctx.lineTo(screen.x, screen.y); else ctx.moveTo(screen.x, screen.y);
  });
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = .85; ctx.stroke(); }
}

/** Text is oriented on the front plane of its equipment, instead of facing the screen. */
export function spatialLabel(ctx: CanvasRenderingContext2D, fonts: FilmFonts, camera: InspectionCamera,
  point: Point3D, text: string, size: number, opacity: number, color = '#b7dbe0') {
  const origin = projectInspectionPoint(camera, point);
  if (!origin.visible) return;
  const right = projectInspectionPoint(camera, { ...point, x: point.x + 1 });
  const down = projectInspectionPoint(camera, { ...point, y: point.y - 1 });
  ctx.save(); ctx.transform(right.x - origin.x, right.y - origin.y, down.x - origin.x, down.y - origin.y, origin.x, origin.y);
  filmText(ctx, fonts, text, 0, 0, size, ctx.globalAlpha * opacity, true, 'left', color);
  ctx.restore();
}

export function inspectionTargetBounds(camera: InspectionCamera, focus = 0,
  station: InspectionStation = inspectionStation(3)) {
  const { width, height, depth } = INSPECTION_TARGET;
  const front = station.z - 75;
  const points = [front, front + depth].flatMap(distance => [-1, 1].flatMap(side => [0, height + 27]
    .map(y => projectInspectionPoint(camera, inspectionFocusPoint({ x: station.x + side * width / 2, y, z: distance }, focus)))));
  const left = Math.min(...points.map(point => point.x)), right = Math.max(...points.map(point => point.x));
  const top = Math.min(...points.map(point => point.y)), bottom = Math.max(...points.map(point => point.y));
  return { x: (left + right) / 2, y: (top + bottom) / 2, width: right - left + 16, height: bottom - top + 16 };
}
