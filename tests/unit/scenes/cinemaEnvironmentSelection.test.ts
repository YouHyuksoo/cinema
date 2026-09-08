import { describe, expect, it } from 'vitest';
import { DEFAULT_ENVIRONMENT_DATA, zoneEnvironmentState } from '@/cinema/zoneEnvironment';
import { environmentCardPoint } from '@/cinema/environmentLayout';
import { environmentCanvasPoint, environmentSceneObjects, pickEnvironmentZone } from '@/cinema/environmentSceneObjects';
import { createEnvironmentSelection } from '@/cinema/environmentSelection';
import { environmentGaugeState } from '@/cinema/environmentGauge';
import { filmViewportTransform } from '@/cinema/filmViewport';

// Compare frame data, not the freshly allocated projection function closures.
const snapshot = (state: unknown) => JSON.parse(JSON.stringify(state));

describe('environment ZONE selection', () => {
  it('overrides the automatic tour without changing readings or scene time', () => {
    const automatic = zoneEnvironmentState(8);
    const manual = zoneEnvironmentState(8, DEFAULT_ENVIRONMENT_DATA, 'ZONE 08');
    expect(manual.selected.zone.id).toBe('ZONE 08');
    expect(manual.selected.zone).toBe(DEFAULT_ENVIRONMENT_DATA.zones[7]);
    expect(manual.zones.filter(item => item.selected)).toHaveLength(1);
    expect(manual.focus).toBe(1);
    expect(manual.elapsed).toBe(automatic.elapsed);
    expect(manual.zones.map(item => item.zone)).toEqual(automatic.zones.map(item => item.zone));
    expect(environmentGaugeState(manual).opacity).toBe(environmentGaugeState(automatic).opacity);
    expect(snapshot(zoneEnvironmentState(8, DEFAULT_ENVIRONMENT_DATA, null))).toEqual(snapshot(automatic));
  });

  it.each([0, 35, 35.5, 40, 52])('does not retain manual selection at hidden/map time %s', time => {
    expect(zoneEnvironmentState(time, DEFAULT_ENVIRONMENT_DATA, 'ZONE 08').manualSelectedId).toBeNull();
  });

  it('ignores unknown IDs and has no selectable objects for empty data', () => {
    expect(snapshot(zoneEnvironmentState(8, DEFAULT_ENVIRONMENT_DATA, 'unknown'))).toEqual(snapshot(zoneEnvironmentState(8)));
    expect(environmentSceneObjects(zoneEnvironmentState(8, { title: '', zones: [] }))).toEqual([]);
  });

  it.each([2, 8, 18, 30, 34.5])('picks all visible card centers at time %s', time => {
    const state = zoneEnvironmentState(time);
    expect(environmentSceneObjects(state)).toHaveLength(10);
    for (const item of state.zones) {
      expect(pickEnvironmentZone(state, item.anchor)?.id).toBe(item.zone.id);
    }
  });

  it('matches the transformed cut corner and edges, including a manually enlarged card', () => {
    const state = zoneEnvironmentState(8, DEFAULT_ENVIRONMENT_DATA, 'ZONE 03');
    const item = state.selected;
    for (const point of [[-83, 0], [83, 0], [0, -42], [0, 38], [75, -35]]) {
      expect(pickEnvironmentZone(state, environmentCardPoint(item, ...point as [number, number]))?.id).toBe(item.zone.id);
    }
    for (const point of [[-85, 0], [85, 0], [0, -44], [0, 40], [83, -42]]) {
      expect(pickEnvironmentZone(state, environmentCardPoint(item, ...point as [number, number]))).toBeNull();
    }
  });

  it('picks the last painted card when cards overlap', () => {
    const state = zoneEnvironmentState(8);
    state.zones.forEach(item => { item.anchor = { ...state.zones[0].anchor }; });
    expect(pickEnvironmentZone(state, state.zones[0].anchor)?.id).toBe(state.selected.zone.id);
    state.zones.forEach(item => { item.focus = 0; });
    expect(pickEnvironmentZone(state, state.zones[0].anchor)?.id).toBe('ZONE 10');
  });

  it('rejects blank, nonfinite and invisible targets', () => {
    const state = zoneEnvironmentState(8);
    for (const point of [{ x: 640, y: 360 }, { x: NaN, y: 185 }, { x: 200, y: Infinity }]) {
      expect(pickEnvironmentZone(state, point)).toBeNull();
    }
    expect(environmentSceneObjects(zoneEnvironmentState(0))).toEqual([]);
    expect(environmentSceneObjects(zoneEnvironmentState(35))).toEqual([]);
  });

  it.each([1, 2])('maps CSS coordinates through DPR %s and dock insets', dpr => {
    const surface = { left: 17, top: 23, width: 900, height: 700, pixelWidth: 900 * dpr, pixelHeight: 700 * dpr, bottomInset: 156 * dpr };
    const transform = filmViewportTransform(surface.pixelWidth, surface.pixelHeight, { bottomInset: surface.bottomInset });
    const point = environmentCanvasPoint(surface, {
      x: surface.left + (200 * transform.scale + transform.offsetX) / dpr,
      y: surface.top + (185 * transform.scale + transform.offsetY) / dpr,
    });
    expect(point?.x).toBeCloseTo(200);
    expect(point?.y).toBeCloseTo(185);
    expect(environmentCanvasPoint(surface, { x: 16, y: 50 })).toBeNull();
    expect(environmentCanvasPoint({ ...surface, width: 0 }, { x: 17, y: 23 })).toBeNull();
  });

  it('uses the rendered frame for picks and releases to the current automatic tour', () => {
    const session = createEnvironmentSelection();
    const frame = session.update(8)!;
    session.pick(frame.zones[7].anchor);
    expect(session.selectedId).toBe('ZONE 08');
    expect(session.update(10)!.selected.zone.id).toBe('ZONE 08');
    expect(snapshot(session.update(10))).toEqual(snapshot(session.update(10)));
    session.pick({ x: 640, y: 360 });
    expect(session.selectedId).toBeNull();
    expect(snapshot(session.update(10))).toEqual(snapshot(zoneEnvironmentState(10)));
  });

  it('clears selection on map transition, hidden reverse seek and scene exit, without resurrecting it', () => {
    const session = createEnvironmentSelection();
    for (const end of [35, 0, null]) {
      session.update(8); session.select('ZONE 08');
      session.update(end);
      expect(session.selectedId).toBeNull();
      expect(snapshot(session.update(8))).toEqual(snapshot(zoneEnvironmentState(8)));
    }
    session.update(null); session.select('ZONE 08');
    expect(session.selectedId).toBeNull();
  });

  it('cycles visible ZONEs with the keyboard and clears before another chapter can receive input', () => {
    const session = createEnvironmentSelection();
    session.update(8);
    session.step(-1); expect(session.selectedId).toBe('ZONE 10');
    session.step(1); expect(session.selectedId).toBe('ZONE 01');
    session.step(1); expect(session.selectedId).toBe('ZONE 02');
    session.clear(); session.step(1); expect(session.selectedId).toBeNull();
  });
});
