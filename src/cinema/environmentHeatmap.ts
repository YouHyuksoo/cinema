import {
  environmentReadingStatus, type EnvironmentZone, type ReadingStatus,
} from './zoneEnvironment';

export interface HeatmapDomain { min: number; max: number }
export interface HeatmapBounds { x: number; y: number; width: number; height: number }
export const ENVIRONMENT_HEATMAP_BOUNDS: HeatmapBounds = { x: 154, y: 198, width: 972, height: 402 };
export const ENVIRONMENT_HEATMAP_AISLE: HeatmapBounds = { x: 166, y: 365, width: 948, height: 68 };

/** One absolute Celsius domain is shared by every room, regardless of its limits. */
export function environmentHeatmapDomain(zones: readonly EnvironmentZone[]): HeatmapDomain {
  const values: number[] = [];
  for (const zone of zones) {
    const range = zone.temperatureRange;
    if (!Number.isFinite(range.min) || !Number.isFinite(range.max) || range.min > range.max) continue;
    values.push(range.min, range.max);
    if (zone.temperature !== null && Number.isFinite(zone.temperature)) values.push(zone.temperature);
  }
  if (!values.length) return { min: 18, max: 32 };
  const minimum = Math.min(...values), maximum = Math.max(...values);
  const step = 2 * Math.max(1, 10 ** Math.floor(Math.log10(Math.max(2, maximum - minimum) / 20)));
  return { min: Math.floor((minimum - step / 2) / step) * step,
    max: Math.ceil((maximum + step / 2) / step) * step };
}

export function environmentTemperatureColor(value: number | null, domain: HeatmapDomain) {
  if (value === null || !Number.isFinite(value) || !Number.isFinite(domain.min)
    || !Number.isFinite(domain.max) || domain.min >= domain.max) {
    return { color: 'hsl(215 9% 45%)', fraction: null };
  }
  const fraction = Math.max(0, Math.min(1, (value - domain.min) / (domain.max - domain.min)));
  const stops = [[0, 235], [.20, 210], [.35, 185], [.46, 125], [.60, 60], [.70, 25], [.82, 4], [1, 0]];
  const end = stops.findIndex(([position]) => position > fraction);
  const segment = end < 0 ? stops.length - 2 : Math.max(0, end - 1);
  const [startAt, startHue] = stops[segment], [endAt, endHue] = stops[segment + 1];
  const blend = (fraction - startAt) / (endAt - startAt);
  const hue = startHue + (endHue - startHue) * blend;
  // HSL preserves the semantic temperature palette through the RGB/HEX theme mapper.
  return { color: `hsl(${hue.toFixed(2)} 88% 55%)`, fraction };
}

export interface EnvironmentHeatmapRoom {
  key: string; zone: EnvironmentZone; bounds: HeatmapBounds;
  pin: { x: number; y: number }; row: number; column: number;
  temperature: number | null; reading: string; status: ReadingStatus;
  color: string; fraction: number | null;
}

/** Estimate a field from sensor samples; this is interpolation, not another measurement. */
export function environmentTemperatureAt(
  rooms: readonly Pick<EnvironmentHeatmapRoom, 'pin' | 'temperature'>[], x: number, y: number,
): number | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  let nearest = Infinity;
  const samples: { distance: number; value: number }[] = [];
  for (const room of rooms) {
    if (room.temperature === null || !Number.isFinite(room.temperature)
      || !Number.isFinite(room.pin.x) || !Number.isFinite(room.pin.y)) continue;
    const distance = Math.hypot(x - room.pin.x, y - room.pin.y);
    if (distance === 0) return room.temperature;
    if (!Number.isFinite(distance)) continue;
    nearest = Math.min(nearest, distance);
    samples.push({ distance, value: room.temperature });
  }
  if (!samples.length) return null;
  // Rescaling every distance by the nearest keeps weights finite even beside a sensor.
  const valueScale = Math.max(1, ...samples.map(sample => Math.abs(sample.value)));
  let weighted = 0, total = 0, minimum = Infinity, maximum = -Infinity;
  for (const sample of samples) {
    const weight = (nearest / sample.distance) ** 3;
    weighted += weight * (sample.value / valueScale);
    total += weight;
    minimum = Math.min(minimum, sample.value); maximum = Math.max(maximum, sample.value);
  }
  return Math.max(minimum, Math.min(maximum, weighted / total * valueScale));
}

/** Coordinates describe an illustrative installation layout, not a surveyed factory. */
export function environmentHeatmap(zones: readonly EnvironmentZone[]) {
  const source = zones.slice(0, 10), domain = environmentHeatmapDomain(source);
  const rooms: EnvironmentHeatmapRoom[] = source.map((zone, index) => {
    const row = Math.floor(index / 5), column = index % 5;
    const bounds = { x: 166 + column * 192, y: row ? 433 : 210, width: 180, height: 155 };
    const status = environmentReadingStatus(zone.temperature, zone.temperatureRange);
    const temperature = status === 'missing' ? null : zone.temperature;
    return { key: `${index}:${zone.id}`, zone, row, column, bounds,
      pin: { x: bounds.x + 136, y: bounds.y + 118 }, temperature,
      reading: temperature === null ? '--' : temperature.toFixed(1), status,
      ...environmentTemperatureColor(temperature, domain) };
  });
  return { domain, rooms, bounds: ENVIRONMENT_HEATMAP_BOUNDS, aisle: ENVIRONMENT_HEATMAP_AISLE };
}
