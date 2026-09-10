import { smooth } from './filmDrawing';
import { lensScale } from './filmLens';

export interface FocusTiming { enter: readonly [number, number]; exit: readonly [number, number] }
export interface FocusProjection {
  x: number; y: number; anchorX: number; anchorY: number; scale: number; depth: number;
}

const FOCUS_LENS = 1000;

/** Approach, hold for reading, then return on the same seekable scene clock. */
export function focusEnvelope(time: number, timing: FocusTiming) {
  return smooth(timing.enter[0], timing.enter[1], time) * (1 - smooth(timing.exit[0], timing.exit[1], time));
}

/** Apparent size comes from forward depth; geometry and annotations share this projection. */
export function focusProjection({ x, y, focus, depth = 160, lift = 20 }: {
  x: number; y: number; focus: number; depth?: number; lift?: number;
}): FocusProjection {
  const amount = Math.max(0, Math.min(1, Number.isFinite(focus) ? focus : 0));
  const z = Math.max(-FOCUS_LENS, Math.min(FOCUS_LENS * .65, depth)) * amount;
  return { x, y: y - lift * amount, anchorX: x, anchorY: y, scale: lensScale(FOCUS_LENS, -z), depth: z };
}

export function projectFocusPoint(projection: FocusProjection, point: { x: number; y: number }) {
  return { x: projection.x + (point.x - projection.anchorX) * projection.scale,
    y: projection.y + (point.y - projection.anchorY) * projection.scale };
}

/** Call between save/restore so the screen-fixed optics retain their own depth. */
export function applyFocusProjection(ctx: CanvasRenderingContext2D, projection: FocusProjection) {
  ctx.translate(projection.x, projection.y);
  ctx.transform(projection.scale, 0, 0, projection.scale, 0, 0);
  ctx.translate(-projection.anchorX, -projection.anchorY);
}
