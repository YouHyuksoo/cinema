import { describe, expect, it } from 'vitest';
import { ENVIRONMENT_GAUGES, environmentGaugeState } from '@/cinema/environmentGauge';
import { environmentCardPoint, environmentFocusConnection } from '@/cinema/environmentLayout';
import { DEFAULT_ENVIRONMENT_DATA, ENVIRONMENT_TIMING, zoneEnvironmentState } from '@/cinema/zoneEnvironment';

describe('fixed central environment gauges', () => {
  it('assembles once and keeps the housing visible between every sensor selection', () => {
    const { tourStart, tourEnd } = ENVIRONMENT_TIMING;
    expect(environmentGaugeState(zoneEnvironmentState(tourStart)).assembly).toBe(0);
    const assembling = environmentGaugeState(zoneEnvironmentState(tourStart + .45));
    expect(assembling.assembly).toBeGreaterThan(0);
    expect(assembling.assembly).toBeLessThan(1);
    expect(environmentGaugeState(zoneEnvironmentState(tourStart + .9)).assembly).toBeCloseTo(1);
    for (let index = 1; index < 10; index++) {
      const atSwitch = environmentGaugeState(zoneEnvironmentState(tourStart + index * 1.9));
      expect(atSwitch.assembly).toBe(1);
      expect(atSwitch.opacity).toBe(1);
      expect(atSwitch.readingOpacity).toBeGreaterThanOrEqual(.7);
    }
    for (const time of [0, tourEnd, 30, 38, 52]) {
      expect(environmentGaugeState(zoneEnvironmentState(time)).opacity).toBe(0);
    }
    expect(environmentGaugeState(zoneEnvironmentState(tourEnd - .325)).opacity).toBeCloseTo(.5);
    expect(environmentGaugeState(zoneEnvironmentState(8, { title: 'empty', zones: [] })).opacity).toBe(0);
  });

  it('keeps both ring angles continuous at selection boundaries for different zone counts', () => {
    for (const count of [1, 3, 10]) {
      const data = { ...DEFAULT_ENVIRONMENT_DATA, zones: DEFAULT_ENVIRONMENT_DATA.zones.slice(0, count) };
      const dwell = (ENVIRONMENT_TIMING.tourEnd - ENVIRONMENT_TIMING.tourStart) / count;
      for (let index = 0; index <= count; index++) {
        const boundary = ENVIRONMENT_TIMING.tourStart + index * dwell;
        const before = environmentGaugeState(zoneEnvironmentState(boundary - .0001, data));
        const after = environmentGaugeState(zoneEnvironmentState(boundary + .0001, data));
        expect(after.outerRotation).toBeGreaterThan(before.outerRotation);
        expect(after.innerRotation).toBeLessThan(before.innerRotation);
        expect(after.outerRotation - before.outerRotation).toBeLessThan(.001);
        expect(before.innerRotation - after.innerRotation).toBeLessThan(.001);
      }
    }
  });

  it('attaches level card rows to the compact central gauge rim', () => {
    for (let time = 2.51; time < 21.5; time += .071) {
      const state = zoneEnvironmentState(time);
      const item = state.selected!;
      const original = item.side === 'left' ? ENVIRONMENT_GAUGES.temperature : ENVIRONMENT_GAUGES.humidity;
      const gauge = { x: 640 * .35 + original.x * .65, y: 390 * .35 + original.y * .65, radius: original.radius * .65 };
      const path = environmentFocusConnection(state);
      const start = path[0], end = path.at(-1)!;
      expect(Math.hypot(end.x - gauge.x, end.y - gauge.y)).toBeCloseTo(gauge.radius, 9);
      expect(start).toEqual(environmentCardPoint(item, item.side === 'left' ? 84 : -84, 0));
      expect(path[1].y).toBe(start.y);
      expect(path[2].y).toBe(end.y);
      expect(path[1].x).toBe(path[2].x);
      expect(path.every(point => point.x >= Math.min(start.x, end.x) && point.x <= Math.max(start.x, end.x))).toBe(true);
    }
  });

  it('reproduces paused and reversed seeks without accumulating rotation or changing measurements', () => {
    for (const time of [3, 4.4, 13, 16.7, 21.2]) {
      const state = zoneEnvironmentState(time);
      const motion = environmentGaugeState(state);
      const path = environmentFocusConnection(state);
      environmentGaugeState(zoneEnvironmentState(40));
      environmentGaugeState(zoneEnvironmentState(1));
      expect(environmentGaugeState(zoneEnvironmentState(time))).toEqual(motion);
      expect(environmentFocusConnection(zoneEnvironmentState(time))).toEqual(path);
      expect(state.selected?.zone).toEqual(DEFAULT_ENVIRONMENT_DATA.zones[state.selected!.index]);
    }
  });

  it('keeps zone cards anchored instead of floating during the scene', () => {
    const early = zoneEnvironmentState(4, DEFAULT_ENVIRONMENT_DATA, 'ZONE 01');
    const later = zoneEnvironmentState(12, DEFAULT_ENVIRONMENT_DATA, 'ZONE 01');
    expect(later.zones.map(item => item.anchor)).toEqual(early.zones.map(item => item.anchor));
    expect(later.zones.map(item => item.tilt)).toEqual(early.zones.map(item => item.tilt));
  });
});
