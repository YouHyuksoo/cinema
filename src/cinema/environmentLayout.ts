import type { ZoneEnvironmentState } from './zoneEnvironment';
import { ENVIRONMENT_GAUGES } from './environmentGauge';

type ZoneItem = ZoneEnvironmentState['zones'][number];
export interface EnvironmentPoint { x: number; y: number }

/** The cut-corner outline and paint order are shared by drawing and picking. */
export const ENVIRONMENT_CARD_OUTLINE: readonly EnvironmentPoint[] = [
  { x: -84, y: -43 }, { x: 68, y: -43 }, { x: 84, y: -29 },
  { x: 84, y: 39 }, { x: -84, y: 39 },
];
export function environmentCardPaintOrder(state: ZoneEnvironmentState) {
  return [...state.zones].sort((a, b) => a.focus - b.focus);
}

/** Matches the level card drawing plane and pointer hit area. */
export function environmentCardPoint(item: ZoneItem, x: number, y: number): EnvironmentPoint {
  return { x: item.anchor.x + x * item.anchor.scale,
    y: item.anchor.y + (item.tilt * x + y) * item.anchor.scale };
}

/** Each history unfolds inward from its sensor row. */
export function environmentHistoryLayout(item: ZoneItem) {
  return { x: item.side === 'left' ? item.anchor.x + 128 : item.anchor.x - 388,
    top: item.anchor.y - 23, width: 260, height: 48 };
}

export function environmentFocusConnection(state: ZoneEnvironmentState): EnvironmentPoint[] {
  const item = state.selected;
  if (!item) return [];
  const left = item.side === 'left';
  const gauge = left ? ENVIRONMENT_GAUGES.temperature : ENVIRONMENT_GAUGES.humidity;
  const start = environmentCardPoint(item, left ? 84 : -84, 0);
  const end = { x: 640 * .35 + (gauge.x + (left ? -gauge.radius : gauge.radius)) * .65,
    y: 390 * .35 + gauge.y * .65 };
  const bendX = (start.x + end.x) / 2;
  return [start, { x: bendX, y: start.y }, { x: bendX, y: end.y }, end];
}
