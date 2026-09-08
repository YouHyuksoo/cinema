import type { ZoneEnvironmentState } from './zoneEnvironment';

type ZoneItem = ZoneEnvironmentState['zones'][number];
export interface EnvironmentPoint { x: number; y: number }

/** Matches the mini-card's actual scale and tilted drawing plane. */
export function environmentCardPoint(item: ZoneItem, x: number, y: number): EnvironmentPoint {
  return { x: item.anchor.x + x * item.anchor.scale,
    y: item.anchor.y + (item.tilt * x + .96 * y) * item.anchor.scale };
}

export function environmentFocusLayout(focus: number) {
  const scale = .90 + Math.max(0, Math.min(1, focus)) * .10;
  return { x: 640, y: 391, scale,
    point: (x: number, y: number) => ({ x: 640 + (x - 640) * scale, y: 391 + (y - 391) * scale }) };
}

/** Each history stays on the inner side of its fixed top/bottom station. */
export function environmentHistoryLayout(item: ZoneItem) {
  return { x: item.anchor.x - 83, top: item.band === 'top' ? 280 : 424, width: 166, height: 65 };
}

export function environmentFocusConnection(state: ZoneEnvironmentState): EnvironmentPoint[] {
  const item = state.selected;
  if (!item) return [];
  const upper = item.band === 'top';
  const start = environmentCardPoint(item, item.anchor.x <= 640 ? 78 : -78, upper ? 38 : -43);
  const frameX = start.x <= 640 ? Math.max(246, Math.min(570, start.x)) : Math.max(710, Math.min(1034, start.x));
  const end = environmentFocusLayout(state.focus).point(frameX, upper ? 282 : 496);
  const bendY = (start.y + end.y) / 2;
  return [start, { x: start.x, y: bendY }, { x: end.x, y: bendY }, end];
}
