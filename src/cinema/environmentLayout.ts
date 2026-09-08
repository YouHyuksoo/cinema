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

/** Matches the mini-card's actual scale and tilted drawing plane. */
export function environmentCardPoint(item: ZoneItem, x: number, y: number): EnvironmentPoint {
  return { x: item.anchor.x + x * item.anchor.scale,
    y: item.anchor.y + (item.tilt * x + .96 * y) * item.anchor.scale };
}

/** Each history stays on the inner side of its fixed top/bottom station. */
export function environmentHistoryLayout(item: ZoneItem) {
  return { x: item.anchor.x - 83, top: item.band === 'top' ? 280 : 424, width: 166, height: 65 };
}

export function environmentFocusConnection(state: ZoneEnvironmentState): EnvironmentPoint[] {
  const item = state.selected;
  if (!item) return [];
  const upper = item.band === 'top';
  // Stable columns prevent a floating middle card from switching between the two gauges.
  const gauge = item.index % 5 <= 2 ? ENVIRONMENT_GAUGES.temperature : ENVIRONMENT_GAUGES.humidity;
  const exitX = item.anchor.x < gauge.x ? 78 : -78;
  // The upper-right card corner is cut from (68,-43) to (84,-29).
  const exitY = upper ? 39 : exitX > 68 ? -43 + (exitX - 68) * 14 / 16 : -43;
  const start = environmentCardPoint(item, exitX, exitY);
  const offset = Math.asin(Math.max(-Math.sin(.35), Math.min(Math.sin(.35), (start.x - gauge.x) / gauge.radius)));
  const angle = upper ? -Math.PI / 2 + offset : Math.PI / 2 - offset;
  const end = { x: gauge.x + Math.cos(angle) * gauge.radius, y: gauge.y + Math.sin(angle) * gauge.radius };
  const bendY = (start.y + end.y) / 2;
  return [start, { x: start.x, y: bendY }, { x: end.x, y: bendY }, end];
}
