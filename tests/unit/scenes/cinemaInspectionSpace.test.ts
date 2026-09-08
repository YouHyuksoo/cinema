import { describe, expect, it } from 'vitest';
import { focusEnvelope } from '@/cinema/filmFocus';
import {
  fillSpatialPolygon, INSPECTION_STATIONS, INSPECTION_TARGET, inspectionCamera, inspectionFocusPoint, inspectionStation, inspectionTargetBounds,
  projectInspectionPoint, strokeSpatialPath, type InspectionCamera,
} from '@/cinema/inspectionSpace';

const CAMERA: InspectionCamera = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, focal: 720, near: 35 };

function capturePath() {
  const points: [number, number][] = [];
  let fills = 0;
  const ctx = {
    beginPath() {}, closePath() {}, stroke() {},
    moveTo(x: number, y: number) { points.push([x, y]); },
    lineTo(x: number, y: number) { points.push([x, y]); },
    fill() { fills += 1; },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, points, get fills() { return fills; } };
}

describe('inspection space perspective', () => {
  it('looks up each station and preserves SMT 03 for an unknown identifier', () => {
    for (const station of INSPECTION_STATIONS) expect(inspectionStation(station.id)).toBe(station);
    for (const unknown of [0, 5, 3.5, NaN, Infinity]) expect(inspectionStation(unknown)).toBe(inspectionStation(3));
    expect(inspectionTargetBounds(CAMERA, .6)).toEqual(inspectionTargetBounds(CAMERA, .6, inspectionStation(3)));
  });

  it.each(INSPECTION_STATIONS)('tracks the complete cabinet and lamp of station $id at each focus depth', station => {
    const camera = { ...CAMERA, x: station.x + 85, y: 210, z: station.z - 550, yaw: -.06, pitch: .24 };
    for (const focus of [0, .5, 1]) {
      const bounds = inspectionTargetBounds(camera, focus, station);
      expect(Object.values(bounds).every(Number.isFinite)).toBe(true);
      for (const x of [station.x - 72, station.x + 72]) {
        for (const y of [0, 203]) {
          for (const z of [station.z - 75, station.z + 75]) {
            const point = projectInspectionPoint(camera, inspectionFocusPoint({ x, y, z }, focus));
            expect(point.visible).toBe(true);
            expect(point.x).toBeGreaterThanOrEqual(bounds.x - bounds.width / 2);
            expect(point.x).toBeLessThanOrEqual(bounds.x + bounds.width / 2);
            expect(point.y).toBeGreaterThanOrEqual(bounds.y - bounds.height / 2);
            expect(point.y).toBeLessThanOrEqual(bounds.y + bounds.height / 2);
          }
        }
      }
      const thermal = projectInspectionPoint(camera,
        inspectionFocusPoint({ x: station.x + 25, y: 88, z: station.z - 76.5 }, focus));
      expect(thermal.x).toBeGreaterThan(bounds.x - bounds.width / 2);
      expect(thermal.x).toBeLessThan(bounds.x + bounds.width / 2);
      expect(thermal.y).toBeGreaterThan(bounds.y - bounds.height / 2);
      expect(thermal.y).toBeLessThan(bounds.y + bounds.height / 2);
    }
  });

  it('makes equal physical widths half as wide at twice the depth', () => {
    const widthAt = (z: number) => projectInspectionPoint(CAMERA, { x: 50, y: 0, z }).x
      - projectInspectionPoint(CAMERA, { x: -50, y: 0, z }).x;

    expect(widthAt(500)).toBeCloseTo(144, 9);
    expect(widthAt(1000)).toBeCloseTo(72, 9);
  });

  it('moves nearby objects farther across the view during lateral camera travel', () => {
    const shifted = { ...CAMERA, x: 10 };
    const movementAt = (z: number) => projectInspectionPoint(shifted, { x: 0, y: 0, z }).x
      - projectInspectionPoint(CAMERA, { x: 0, y: 0, z }).x;

    expect(movementAt(500)).toBeCloseTo(-14.4, 9);
    expect(movementAt(1000)).toBeCloseTo(-7.2, 9);
  });

  it('clips geometry crossing the eye plane to finite visible segments and polygons', () => {
    const line = capturePath();
    strokeSpatialPath(line.ctx, CAMERA, [{ x: -1, y: 0, z: -10 }, { x: 1, y: 0, z: 100 }], '#fff');
    expect(line.points).toHaveLength(2);
    expect(line.points[0][0]).toBeCloseTo(636.25974026, 6);
    expect(line.points[1][0]).toBeCloseTo(647.2, 6);

    const polygon = capturePath();
    fillSpatialPolygon(polygon.ctx, CAMERA, [
      { x: -1, y: -1, z: -10 }, { x: 1, y: -1, z: 100 },
      { x: 1, y: 1, z: 100 }, { x: -1, y: 1, z: -10 },
    ], '#fff');
    expect(polygon.fills).toBe(1);
    expect(polygon.points).toHaveLength(4);
    expect([...line.points, ...polygon.points].flat().every(Number.isFinite)).toBe(true);
    expect(Math.min(...polygon.points.map(([x]) => x))).toBeCloseTo(636.25974026, 6);
  });

  it('emits no path coordinates or fill for geometry entirely behind the near plane', () => {
    const drawing = capturePath();
    const behind = [{ x: -10, y: 0, z: -100 }, { x: 10, y: 0, z: 10 }, { x: 0, y: 10, z: 34 }];
    strokeSpatialPath(drawing.ctx, CAMERA, behind, '#fff');
    fillSpatialPolygon(drawing.ctx, CAMERA, behind, '#fff');

    expect(drawing.points).toHaveLength(0);
    expect(drawing.fills).toBe(0);
  });

  it('keeps the tracked equipment visible and inside the frame throughout the inspection move', () => {
    const { x, z, width, height, depth } = INSPECTION_TARGET;
    for (let time = 0; time <= 32; time += 0.25) {
      const focus = focusEnvelope(time, { enter: [7, 11], exit: [26.7, 29.2] });
      const camera = inspectionCamera(time, focus);
      const bounds = inspectionTargetBounds(camera, focus);
      for (const distance of [z, z + depth]) {
        for (const side of [-1, 1]) {
          for (const y of [0, height + 27]) {
            const point = projectInspectionPoint(camera, inspectionFocusPoint({ x: x + side * width / 2, y, z: distance }, focus));
            expect(point.visible, `target visibility at ${time}s`).toBe(true);
            expect(point.x).toBeGreaterThan(0);
            expect(point.x).toBeLessThan(1280);
            expect(point.y).toBeGreaterThan(0);
            expect(point.y).toBeLessThan(720);
            expect(point.x).toBeGreaterThanOrEqual(bounds.x - bounds.width / 2);
            expect(point.x).toBeLessThanOrEqual(bounds.x + bounds.width / 2);
            expect(point.y).toBeGreaterThanOrEqual(bounds.y - bounds.height / 2);
            expect(point.y).toBeLessThanOrEqual(bounds.y + bounds.height / 2);
          }
        }
      }
      expect(Object.values(bounds).every(Number.isFinite)).toBe(true);
      expect(bounds.width).toBeGreaterThan(0);
      expect(bounds.height).toBeGreaterThan(0);
    }
  });

  it('brings the cabinet and measured feature closer together, then restores both before the fade', () => {
    const point = { x: INSPECTION_TARGET.x + 25, y: 88, z: INSPECTION_TARGET.z - 1.5 };
    const camera = inspectionCamera(14, 1);
    const focused = inspectionFocusPoint(point, 1);
    expect(focused.y).toBeGreaterThan(point.y);
    expect(focused.z).toBeLessThan(point.z);
    expect(projectInspectionPoint(camera, focused).scale).toBeGreaterThan(projectInspectionPoint(camera, point).scale);
    const recovered = focusEnvelope(29.2, { enter: [7, 11], exit: [26.7, 29.2] });
    expect(recovered).toBe(0);
    expect(inspectionFocusPoint(point, recovered)).toEqual(point);
    expect(inspectionTargetBounds(camera, recovered)).toEqual(inspectionTargetBounds(camera));
  });
});
