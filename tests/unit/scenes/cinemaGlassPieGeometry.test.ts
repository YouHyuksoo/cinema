import { describe, expect, it } from 'vitest';
import {
  buildGlassPieSliceGeometry, projectGlassPiePoint,
  type GlassPieSliceGeometryOptions,
} from '@/cinema/glassPieGeometry';

const SECTOR: GlassPieSliceGeometryOptions = {
  radius: 100, start: 0, end: Math.PI / 2, thickness: 30,
  projection: { tilt: Math.PI / 4, distance: 1000 },
};

describe('glass pie geometry', () => {
  it('preserves the data angle at both arc ends and closes each extruded sector', () => {
    const geometry = buildGlassPieSliceGeometry({ ...SECTOR, projection: { tilt: Math.PI / 2, distance: 1000 } })!;
    expect(geometry.outerTop[0].x).toBeCloseTo(100, 9);
    expect(geometry.outerTop[0].y).toBeCloseTo(0, 9);
    expect(geometry.outerTop.at(-1)!.x).toBeCloseTo(0, 9);
    expect(geometry.outerTop.at(-1)!.y).toBeCloseTo(100, 9);
    expect(geometry.walls.every(wall => wall.length === 4)).toBe(true);
    expect(geometry.walls.at(-2)).toContain(geometry.center);
    expect(geometry.walls.at(-1)).toContain(geometry.center);
  });

  it('places the lower surface below and farther from the camera than the top', () => {
    const geometry = buildGlassPieSliceGeometry(SECTOR)!;
    expect(geometry.bottom[0].y).toBeGreaterThan(geometry.center.y);
    expect(geometry.bottom[0].depth).toBeGreaterThan(geometry.center.depth);

    const flat = buildGlassPieSliceGeometry({ ...SECTOR, thickness: 0 })!;
    expect(flat.bottom).toEqual(flat.top);
  });

  it('shows equal world widths larger at the front than at the back of the plate', () => {
    const front = projectGlassPiePoint({ x: 100, y: 200, z: 0 }, SECTOR.projection);
    const back = projectGlassPiePoint({ x: 100, y: -200, z: 0 }, SECTOR.projection);
    expect(front.x).toBeGreaterThan(100);
    expect(back.x).toBeLessThan(100);
    expect(front.depth).toBeLessThan(back.depth);
  });

  it('keeps the midpoint anchor attached when a selected piece moves and lifts', () => {
    const geometry = buildGlassPieSliceGeometry({
      ...SECTOR, end: Math.PI, offsetX: 40, offsetY: -30, lift: 50,
      projection: { tilt: Math.PI / 2, distance: 1000 },
    })!;
    expect(geometry.center.x).toBeCloseTo(40 / .95, 9);
    expect(geometry.center.y).toBeCloseTo(-30 / .95, 9);
    expect(geometry.anchor.x).toBeCloseTo(geometry.center.x, 9);
    expect(geometry.anchor.y - geometry.center.y).toBeCloseTo(100 / .95, 9);
    expect(geometry.anchor.depth).toBeCloseTo(geometry.center.depth, 9);
  });

  it('keeps a full circle closed without drawing a radial internal wall', () => {
    const geometry = buildGlassPieSliceGeometry({ ...SECTOR, start: -.8, end: Math.PI * 2 - .8 })!;
    expect(geometry.outerTop[0].x).toBeCloseTo(geometry.outerTop.at(-1)!.x, 9);
    expect(geometry.outerTop[0].y).toBeCloseTo(geometry.outerTop.at(-1)!.y, 9);
    expect(geometry.walls.some(wall => wall.includes(geometry.center))).toBe(false);
  });

  it('handles tiny slices and oversized sweeps with bounded finite geometry', () => {
    for (const end of [1e-12, Math.PI * 2, 1e300]) {
      const geometry = buildGlassPieSliceGeometry({ ...SECTOR, end })!;
      expect(geometry).not.toBeNull();
      expect(geometry.outerTop.length).toBeLessThanOrEqual(73);
      expect([...geometry.top, ...geometry.bottom, geometry.anchor]
        .every(point => Object.values(point).every(Number.isFinite))).toBe(true);
    }
    const nearEye = projectGlassPiePoint({ x: 20, y: 2000, z: 0 }, SECTOR.projection);
    expect(Object.values(nearEye).every(Number.isFinite)).toBe(true);
  });

  it('rejects invalid dimensions, invalid camera settings, and overflowing coordinates', () => {
    for (const change of [
      { radius: 0 }, { radius: -5 }, { thickness: -1 }, { end: 0 }, { start: Number.NaN },
      { offsetX: Number.POSITIVE_INFINITY }, { lift: Number.NaN },
      { projection: { tilt: 0, distance: 0 } },
      { radius: Number.MAX_VALUE, offsetX: Number.MAX_VALUE },
    ]) expect(buildGlassPieSliceGeometry({ ...SECTOR, ...change })).toBeNull();
  });
});
