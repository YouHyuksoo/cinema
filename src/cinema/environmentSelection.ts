import { zoneEnvironmentState, type ZoneEnvironmentState } from './zoneEnvironment';
import { environmentSceneObjects, pickEnvironmentZone } from './environmentSceneObjects';
import type { EnvironmentPoint } from './environmentLayout';

/** Picks use the last painted frame, not the throttled React playback position. */
export function createEnvironmentSelection() {
  let selectedId: string | null = null;
  let frame: ZoneEnvironmentState | null = null;
  return {
    get selectedId() { return selectedId; },
    update(time: number | null) {
      frame = time === null ? null : zoneEnvironmentState(time, undefined, selectedId);
      selectedId = frame?.manualSelectedId ?? null;
      return frame;
    },
    clear() { selectedId = null; frame = null; },
    select(id: string | null) {
      selectedId = frame && environmentSceneObjects(frame).some(object => object.id === id) ? id : null;
    },
    pick(point: EnvironmentPoint | null) {
      selectedId = frame && point ? pickEnvironmentZone(frame, point)?.id ?? null : null;
    },
    step(direction: number) {
      const objects = frame ? environmentSceneObjects(frame).sort((a, b) => a.id.localeCompare(b.id)) : [];
      if (!objects.length) { selectedId = null; return; }
      const index = objects.findIndex(object => object.id === selectedId);
      selectedId = objects[(index < 0 ? direction > 0 ? 0 : objects.length - 1
        : (index + direction + objects.length) % objects.length)].id;
    },
  };
}
