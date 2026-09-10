import type { Point } from './filmMenuCube';

/** The cube on the intro stage is this much larger than its docked size. */
export const CUBE_INTRO_SCALE = 1.6;
export const CUBE_INTRO_FLIGHT_MS = 1200;
export const CUBE_INTRO_SNAP_MS = 300;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Stage-to-dock flight: a shallow arc that shrinks to dock size and banks into the turn; `snap` is a straight, fast hop. */
export function cubeIntroFlight(elapsed: number, from: Point, to: Point, mode: 'return' | 'snap') {
  const duration = mode === 'snap' ? CUBE_INTRO_SNAP_MS : CUBE_INTRO_FLIGHT_MS;
  const t = Number.isFinite(elapsed) ? Math.max(0, Math.min(1, elapsed / duration)) : 0;
  const p = smooth(t);
  // Exactly zero at both endpoints (sin(pi) is not), so the cube lands on the dock with no residual bank or lift.
  const arc = mode === 'snap' || t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * p);
  return {
    x: from.x + (to.x - from.x) * p,
    y: from.y + (to.y - from.y) * p - arc * 60,
    scale: CUBE_INTRO_SCALE + (1 - CUBE_INTRO_SCALE) * p,
    bank: arc ? -8 * arc : 0,
    yaw: arc ? 24 * arc : 0,
    done: t >= 1,
  };
}
