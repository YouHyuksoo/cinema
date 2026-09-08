import { describe, expect, it } from 'vitest';
import { TEMPERATURE_HOUR_MS as HOUR, temperatureHistoryDomain, temperatureHistoryPoints } from '@/cinema/temperatureHistory';
import { DEFAULT_ENVIRONMENT_DATA, zoneEnvironmentState } from '@/cinema/zoneEnvironment';

describe('24-hour zone temperature histories', () => {
  it('uses timestamps, sorts samples and keeps the last duplicate within the inclusive window', () => {
    const points = temperatureHistoryPoints([
      { at: 24 * HOUR, value: 23 }, { at: -1, value: 99 }, { at: 0, value: 20 },
      { at: 12 * HOUR, value: 21 }, { at: 12 * HOUR, value: 22 },
      { at: 25 * HOUR, value: 99 }, { at: NaN, value: 99 },
    ], 24 * HOUR);
    expect(points.map(p => p.value)).toEqual([20, 22, 23]);
    expect(points.map(p => p.position)).toEqual([0, .5, 1]);
  });
  it('preserves explicit missing readings and never manufactures unavailable history', () => {
    expect(temperatureHistoryPoints([{ at: 0, value: null }, { at: HOUR, value: NaN }], 24 * HOUR)
      .map(p => p.value)).toEqual([null, null]);
    expect(temperatureHistoryPoints(undefined, 24 * HOUR)).toEqual([]);
    expect(temperatureHistoryPoints([{ at: 0, value: 24 }], undefined)).toEqual([]);
    const state = zoneEnvironmentState(16, { title: 'No history', zones: [
      { ...DEFAULT_ENVIRONMENT_DATA.zones[0], temperatureHistory: undefined },
    ] });
    expect(state.zones[0].history).toEqual([]);
    expect(state.historyEnd).toBeUndefined();
  });
  it('shares one scale including readings and management limits, even for constant or absent data', () => {
    expect(temperatureHistoryDomain([22, 32, null, NaN], [{ min: 20, max: 28 }])).toEqual({ min: 19, max: 33 });
    expect(temperatureHistoryDomain([24, 24], [])).toEqual({ min: 23, max: 25 });
    expect(temperatureHistoryDomain([], [])).toEqual({ min: 0, max: 40 });
  });
  it('supplies ten distinct demonstration histories ending at the displayed reading', () => {
    const state = zoneEnvironmentState(16);
    for (const item of state.zones) {
      expect(item.history).toHaveLength(25);
      expect(item.history[0].position).toBe(0);
      expect(item.history.at(-1)?.position).toBe(1);
      expect(item.history.at(-1)?.value).toBe(item.zone.temperature);
    }
    expect(new Set(state.zones.map(z => JSON.stringify(z.history))).size).toBe(10);
  });
  it('uses a common latest timestamp when callers omit the window end', () => {
    const state = zoneEnvironmentState(16, { title: 'Measured', zones: [
      { ...DEFAULT_ENVIRONMENT_DATA.zones[0], temperatureHistory: [{ at: 24 * HOUR, value: 21 }] },
      { ...DEFAULT_ENVIRONMENT_DATA.zones[1], temperatureHistory: [{ at: 23 * HOUR, value: 22 }] },
    ] });
    expect(state.historyEnd).toBe(24 * HOUR);
    expect(state.zones[1].history[0].position).toBeCloseTo(23 / 24);
  });
});
