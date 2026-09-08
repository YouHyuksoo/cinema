import { describe, expect, it } from 'vitest';
import { CORE_BOUNDS, CORE_OUTER_RADIUS, cornerCoreAnchor, createCoreProjection } from '@/cinema/cornerCoreGeometry';

describe('corner finale circular core projection', () => {
  it('keeps all three ring layers finite and inside the drawing surface for the full finale', () => {
    let maxX = 0, maxY = 0;
    for (let tick = 0; tick <= 110; tick++) {
      const projection = createCoreProjection(tick / 10);
      for (const z of [-18, 0, 22]) {
        for (let step = 0; step < 96; step++) {
          const point = projection.ring(step * Math.PI * 2 / 96, CORE_OUTER_RADIUS, z);
          if (!Object.values(point).every(Number.isFinite)) throw new Error(`Invalid core point at ${tick / 10}s`);
          maxX = Math.max(maxX, Math.abs(point.x));
          maxY = Math.max(maxY, Math.abs(point.y));
        }
      }
    }
    expect(maxX).toBeLessThan(CORE_BOUNDS.width / 2);
    expect(maxY).toBeLessThan(CORE_BOUNDS.height / 2);
  });

  it('retains a nearly circular face while making front and back layers visibly distinct', () => {
    const projection = createCoreProjection(5);
    const left = projection.ring(Math.PI, CORE_OUTER_RADIUS);
    const right = projection.ring(0, CORE_OUTER_RADIUS);
    const top = projection.ring(-Math.PI / 2, CORE_OUTER_RADIUS);
    const bottom = projection.ring(Math.PI / 2, CORE_OUTER_RADIUS);
    const aspect = Math.hypot(right.x - left.x, right.y - left.y) / Math.hypot(bottom.x - top.x, bottom.y - top.y);
    expect(aspect).toBeGreaterThan(.94);
    expect(aspect).toBeLessThan(1.06);
    expect(right.depth).toBeLessThan(left.depth);
    expect(top.depth).toBeLessThan(bottom.depth);
    const near = projection.point(CORE_OUTER_RADIUS, 0, -18);
    const far = projection.point(CORE_OUTER_RADIUS, 0, 22);
    expect(far.depth - near.depth).toBeGreaterThan(35);
    expect(Math.hypot(near.x - far.x, near.y - far.y)).toBeGreaterThan(5);
  });

  it.each([
    { side: 1 as const, lower: false, angle: -.5 },
    { side: 1 as const, lower: true, angle: .5 },
    { side: -1 as const, lower: false, angle: Math.PI + .5 },
    { side: -1 as const, lower: true, angle: Math.PI - .5 },
  ])('attaches the $side / lower=$lower connector to its outer ring quadrant', ({ side, lower, angle }) => {
    for (const time of [0, 3, 7.5, 11]) {
      const endpoint = cornerCoreAnchor(time, side, lower);
      const ring = createCoreProjection(time).ring(angle, CORE_OUTER_RADIUS, 0);
      expect(endpoint).toEqual(ring);
      expect(Math.sign(endpoint.x)).toBe(side);
      expect(Math.sign(endpoint.y)).toBe(lower ? 1 : -1);
    }
  });

  it('moves gently but reconstructs the exact pose when paused or seeking backwards', () => {
    const before = createCoreProjection(4).ring(.8, CORE_OUTER_RADIUS, -18);
    const anchorBefore = cornerCoreAnchor(4, -1, false);
    const later = createCoreProjection(9).ring(.8, CORE_OUTER_RADIUS, -18);
    expect(cornerCoreAnchor(9, -1, false)).not.toEqual(anchorBefore);
    expect(Math.hypot(before.x - later.x, before.y - later.y)).toBeGreaterThan(.1);
    expect(createCoreProjection(4).ring(.8, CORE_OUTER_RADIUS, -18)).toEqual(before);
    expect(cornerCoreAnchor(4, -1, false)).toEqual(anchorBefore);
  });
});
