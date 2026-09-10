import type { CornerItemState } from './cornerSequence';
import { smooth } from './filmDrawing';
import { createLensProjection } from './filmLens';

const LENS = 760;
const VIEW_CENTER = { x: 640, y: 350 };

/** Each parked reading floats on the scene clock, so pause and reverse seeking stay exact. */
export function cornerHoverOffset(reading: CornerItemState) {
  const age = Math.max(0, reading.localTime - 6.5);
  const presence = smooth(0, 2.4, age) * reading.parkProgress;
  const phase = reading.index * 1.77;
  return {
    x: Math.sin(age * .47 + phase) * 3.5 * presence,
    y: Math.sin(age * (.68 + reading.index * .045) + phase) * 7 * presence,
    depth: Math.sin(age * .51 + phase + .8) * 20 * presence,
    yaw: Math.sin(age * .43 + phase + 1.2) * .024 * presence,
    pitch: Math.sin(age * .57 + phase) * .018 * presence,
    roll: Math.sin(age * .39 + phase + .4) * .009 * presence,
  };
}

/** All four planes turn inward: the edge nearest the screen centre is farther away. */
export function cornerReadingProjection(reading: CornerItemState) {
  const hover = cornerHoverOffset(reading);
  const side = reading.item.corner.x > VIEW_CENTER.x ? 1 : -1;
  const lower = reading.item.corner.y > VIEW_CENTER.y ? 1 : -1;
  const yaw = side * .7 * reading.parkProgress + hover.yaw;
  const pitch = -lower * .12 * reading.parkProgress + hover.pitch;
  const depth = LENS * (1 / reading.scale - 1) + hover.depth;
  const originX = (reading.x + hover.x - VIEW_CENTER.x) / reading.scale;
  const originY = (reading.y + hover.y - VIEW_CENTER.y) / reading.scale;
  const point = createLensProjection({ lens: LENS, yaw, pitch, roll: hover.roll, depth, originX, originY,
    centerX: VIEW_CENTER.x, centerY: VIEW_CENTER.y });
  return { depth, yaw, pitch, point };
}
