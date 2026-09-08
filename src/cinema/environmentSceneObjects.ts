import { environmentCardVisibility, type ZoneEnvironmentState } from './zoneEnvironment';
import { ENVIRONMENT_CARD_OUTLINE, environmentCardPaintOrder, environmentCardPoint,
  type EnvironmentPoint } from './environmentLayout';
import { filmViewportPoint } from './filmViewport';

export interface ZoneSceneObject {
  id: string;
  type: 'environment-zone';
  bounds: readonly EnvironmentPoint[];
}

/** Returned in actual paint order; values stay in the source ZONE data. */
export function environmentSceneObjects(state: ZoneEnvironmentState): ZoneSceneObject[] {
  return environmentCardPaintOrder(state)
    .filter(item => environmentCardVisibility(state.elapsed, item.index).selectable)
    .map(item => ({ id: item.zone.id, type: 'environment-zone',
      bounds: ENVIRONMENT_CARD_OUTLINE.map(point => environmentCardPoint(item, point.x, point.y)) }));
}

export function pickEnvironmentZone(state: ZoneEnvironmentState, point: EnvironmentPoint): ZoneSceneObject | null {
  if (![point.x, point.y].every(Number.isFinite)) return null;
  for (const object of environmentSceneObjects(state).reverse()) {
    // Convex, clockwise screen-space polygon, including its clipped top-right corner.
    const inside = object.bounds.every((a, index) => {
      const b = object.bounds[(index + 1) % object.bounds.length];
      return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x) >= -1e-7;
    });
    if (inside) return object;
  }
  return null;
}

export interface EnvironmentCanvasSurface {
  left: number; top: number; width: number; height: number;
  pixelWidth: number; pixelHeight: number; bottomInset: number;
}

export function environmentCanvasPoint(surface: EnvironmentCanvasSurface, client: EnvironmentPoint): EnvironmentPoint | null {
  if (![...Object.values(surface), client.x, client.y].every(Number.isFinite)
    || surface.width <= 0 || surface.height <= 0 || surface.pixelWidth <= 0 || surface.pixelHeight <= 0) return null;
  const x = client.x - surface.left, y = client.y - surface.top;
  if (x < 0 || y < 0 || x > surface.width || y > surface.height) return null;
  return filmViewportPoint(x * surface.pixelWidth / surface.width, y * surface.pixelHeight / surface.height,
    surface.pixelWidth, surface.pixelHeight, { bottomInset: surface.bottomInset });
}
