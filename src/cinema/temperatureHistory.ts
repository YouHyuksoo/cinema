import type { EnvironmentRange } from './zoneEnvironment';

export interface TemperatureSample { at: number; value: number | null }
export const TEMPERATURE_HOUR_MS = 3600000;
export const TEMPERATURE_WINDOW_MS = 24 * TEMPERATURE_HOUR_MS;

/** Keep real timestamps, the last duplicate reading, and explicit gaps; never interpolate missing readings. */
export function temperatureHistoryPoints(samples: readonly TemperatureSample[] | undefined, end: number | undefined) {
  if (!samples || !Number.isFinite(end)) return [];
  const readings = new Map<number, number | null>();
  for (const sample of samples) {
    if (!Number.isFinite(sample.at) || sample.at < end! - TEMPERATURE_WINDOW_MS || sample.at > end!) continue;
    readings.set(sample.at, sample.value !== null && Number.isFinite(sample.value) ? sample.value : null);
  }
  return [...readings].sort(([a], [b]) => a - b).map(([at, value]) => ({
    at, value, position: (at - (end! - TEMPERATURE_WINDOW_MS)) / TEMPERATURE_WINDOW_MS,
  }));
}

export function temperatureHistoryDomain(values: readonly (number | null)[], ranges: readonly EnvironmentRange[]) {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  for (const range of ranges) if (Number.isFinite(range.min) && Number.isFinite(range.max) && range.min <= range.max)
    valid.push(range.min, range.max);
  if (!valid.length) return { min: 0, max: 40 };
  return { min: Math.floor(Math.min(...valid) - 1), max: Math.ceil(Math.max(...valid) + 1) };
}
