import { createLensProjection } from './filmLens';

export const CORE_OUTER_RADIUS = 190;
export const CORE_BOUNDS = { width: 440, height: 440 } as const;

const LENS = 680;
const ANCHOR_ANGLE = .5;

export interface CoreProjectedPoint {
  x: number;
  y: number;
  depth: number;
}

/** Rings, layer thickness and their connections share the same scene-clock pose. */
export function createCoreProjection(time: number) {
  const pitch = .16 + Math.sin(time * .31) * .025;
  const yaw = .1 + Math.sin(time * .23 + .8) * .02;
  const point: (x: number, y: number, z?: number) => CoreProjectedPoint = createLensProjection({ lens: LENS, yaw, pitch });
  return {
    point,
    ring(angle: number, radius: number, z = 0) {
      return point(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
    },
  };
}

/** Local connector endpoints on the visible outer ring, ordered by screen quadrant. */
export function cornerCoreAnchor(time: number, side: -1 | 1, lower: boolean) {
  const angle = side === 1
    ? (lower ? ANCHOR_ANGLE : -ANCHOR_ANGLE)
    : (lower ? Math.PI - ANCHOR_ANGLE : Math.PI + ANCHOR_ANGLE);
  return createCoreProjection(time).ring(angle, CORE_OUTER_RADIUS);
}
