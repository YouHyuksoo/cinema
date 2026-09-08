import { describe, expect, it } from 'vitest';
import {
  environmentHeatmap, environmentHeatmapDomain, environmentTemperatureAt, environmentTemperatureColor,
} from '@/cinema/environmentHeatmap';
import { DEFAULT_ENVIRONMENT_DATA, type EnvironmentZone } from '@/cinema/zoneEnvironment';

const source = DEFAULT_ENVIRONMENT_DATA.zones;
const zone = (changes: Partial<EnvironmentZone> = {}): EnvironmentZone => ({ ...source[0], ...changes });
const overlaps = (a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

describe('sensor installation space temperature heatmap', () => {
  it('keeps the same ten zones in two rows of five unique rooms', () => {
    const model = environmentHeatmap(source);
    expect(model.rooms.map(room => room.zone.id)).toEqual(source.map(item => item.id));
    expect(model.rooms.map(room => room.zone.name)).toEqual(source.map(item => item.name));
    expect(new Set(model.rooms.map(room => room.key)).size).toBe(10);
    expect(model.rooms.filter(room => room.row === 0)).toHaveLength(5);
    expect(model.rooms.filter(room => room.row === 1)).toHaveLength(5);
    expect(model.rooms.map(room => room.column)).toEqual([0, 1, 2, 3, 4, 0, 1, 2, 3, 4]);
  });

  it('places each room and its sensor inside the map without crossing rooms or the aisle', () => {
    const model = environmentHeatmap(source), outer = model.bounds;
    for (const [index, room] of model.rooms.entries()) {
      const b = room.bounds;
      expect(b.x).toBeGreaterThan(outer.x);
      expect(b.y).toBeGreaterThan(outer.y);
      expect(b.x + b.width).toBeLessThan(outer.x + outer.width);
      expect(b.y + b.height).toBeLessThan(outer.y + outer.height);
      expect(room.pin.x).toBeGreaterThan(b.x);
      expect(room.pin.x).toBeLessThan(b.x + b.width);
      expect(room.pin.y).toBeGreaterThan(b.y);
      expect(room.pin.y).toBeLessThan(b.y + b.height);
      expect(overlaps(b, model.aisle)).toBe(false);
      for (const other of model.rooms.slice(index + 1)) expect(overlaps(b, other.bounds)).toBe(false);
    }
  });

  it('highlights the 29.4 degree temperature alert without making the humidity alert a hot room', () => {
    const rooms = environmentHeatmap(source).rooms;
    expect(rooms[5]).toMatchObject({ temperature: 29.4, reading: '29.4', status: 'outside' });
    expect(rooms[7]).toMatchObject({ temperature: 23.9, reading: '23.9', status: 'normal' });
    expect(rooms[5].fraction!).toBeGreaterThan(rooms[7].fraction!);
    expect(environmentHeatmap([zone({ humidity: null })]).rooms[0].status).toBe('normal');
  });

  it('uses each temperature range for its status but one absolute palette for all rooms', () => {
    const rooms = environmentHeatmap([
      zone({ temperature: 26, temperatureRange: { min: 20, max: 28 } }),
      zone({ temperature: 26, temperatureRange: { min: 10, max: 24 } }),
      zone({ temperature: 26, temperatureRange: { min: 26, max: 26 } }),
    ]).rooms;
    expect(rooms.map(room => room.status)).toEqual(['normal', 'outside', 'normal']);
    expect(new Set(rooms.map(room => room.color)).size).toBe(1);
    expect(new Set(rooms.map(room => room.fraction)).size).toBe(1);
  });

  it.each([null, NaN, Infinity, -Infinity])('keeps an unknown reading %s neutral and explicit', temperature => {
    const room = environmentHeatmap([zone({ temperature })]).rooms[0];
    expect(room).toMatchObject({ status: 'missing', temperature: null, fraction: null, reading: '--' });
    expect(room.color).toBe(environmentTemperatureColor(null, { min: 18, max: 32 }).color);
  });

  it.each([
    { min: NaN, max: 28 }, { min: 20, max: Infinity }, { min: 28, max: 20 },
  ])('does not report a valid temperature status for malformed limits %j', temperatureRange => {
    const room = environmentHeatmap([zone({ temperatureRange })]).rooms[0];
    expect(room).toMatchObject({ status: 'missing', reading: '--', fraction: null });
    expect(environmentHeatmapDomain([zone({ temperatureRange })])).toEqual({ min: 18, max: 32 });
  });

  it('includes all valid current readings and custom limits in a rounded Celsius domain', () => {
    const domain = environmentHeatmapDomain([
      zone({ temperature: -5.3, temperatureRange: { min: 10, max: 40 } }),
      zone({ temperature: 44.8, temperatureRange: { min: 20, max: 30 } }),
    ]);
    expect(domain.min).toBeLessThan(-5.3);
    expect(domain.max).toBeGreaterThan(44.8);
    expect(domain.min % 2).toBeCloseTo(0);
    expect(domain.max % 2).toBeCloseTo(0);
    const constant = environmentHeatmapDomain([zone({ temperature: 24, temperatureRange: { min: 24, max: 24 } })]);
    expect(constant.min).toBeLessThan(24);
    expect(constant.max).toBeGreaterThan(24);
  });

  it('advances from cool to warm monotonically and clamps out of domain values', () => {
    const domain = { min: 18, max: 32 };
    let previousFraction = -1, previousHue = 360;
    for (let degree = 18; degree <= 32; degree += .25) {
      const result = environmentTemperatureColor(degree, domain);
      const hue = Number(/^hsl\(([\d.]+)/.exec(result.color)![1]);
      expect(result.fraction!).toBeGreaterThan(previousFraction);
      expect(hue).toBeLessThan(previousHue);
      previousFraction = result.fraction!; previousHue = hue;
    }
    expect(environmentTemperatureColor(-10, domain).fraction).toBe(0);
    expect(environmentTemperatureColor(100, domain).fraction).toBe(1);
    expect(environmentTemperatureColor(25, { min: 30, max: 20 }).fraction).toBeNull();
  });

  it('reads cool zones as cyan and hot zones as red within a blue to red thermal legend', () => {
    const domain = environmentHeatmapDomain(source);
    const hue = (value: number) =>
      Number(/^hsl\(([\d.]+)/.exec(environmentTemperatureColor(value, domain).color)![1]);
    const colorBands = [
      { value: domain.min, min: 210, max: 250 },
      { value: 22.6, min: 170, max: 205 },
      { value: 24.5, min: 90, max: 150 },
      { value: 26.4, min: 40, max: 75 },
      { value: 29.4, min: 0, max: 15 },
      { value: domain.max, min: 0, max: 15 },
    ];
    for (const band of colorBands) {
      expect(hue(band.value)).toBeGreaterThanOrEqual(band.min);
      expect(hue(band.value)).toBeLessThanOrEqual(band.max);
    }
  });

  it('accepts short and empty input and caps the illustrative layout at ten rooms', () => {
    expect(environmentHeatmap([]).rooms).toEqual([]);
    expect(environmentHeatmap(source.slice(0, 3)).rooms).toHaveLength(3);
    expect(environmentHeatmap([...source, zone()]).rooms).toHaveLength(10);
  });

  it('does not mutate the supplied zones, readings, or ranges', () => {
    const values = source.map(item => Object.freeze({ ...item,
      temperatureRange: Object.freeze({ ...item.temperatureRange }),
      humidityRange: Object.freeze({ ...item.humidityRange }),
    }));
    const before = JSON.stringify(values);
    expect(() => environmentHeatmap(Object.freeze(values))).not.toThrow();
    expect(JSON.stringify(values)).toBe(before);
  });
});

describe('continuous illustrative sensor temperature field', () => {
  const sample = (x: number, y: number, temperature: number | null) => ({ pin: { x, y }, temperature });

  it('reproduces every installed sensor temperature exactly at its position', () => {
    const rooms = environmentHeatmap(source).rooms;
    for (const room of rooms) {
      expect(environmentTemperatureAt(rooms, room.pin.x, room.pin.y)).toBe(room.temperature);
    }
  });

  it('forms a smooth local hotspot around the hotter sensor and respects symmetric averages', () => {
    const samples = [sample(0, 0, 20), sample(100, 0, 30)];
    expect(environmentTemperatureAt(samples, 50, 0)).toBeCloseTo(25);
    expect(environmentTemperatureAt(samples, 20, 0)).toBeLessThan(21);
    expect(environmentTemperatureAt(samples, 80, 0)).toBeGreaterThan(29);
    const points = Array.from({ length: 101 }, (_, x) => environmentTemperatureAt(samples, x, 0)!);
    for (let index = 1; index < points.length; index++) {
      expect(points[index]).toBeGreaterThan(points[index - 1]);
      expect(points[index] - points[index - 1]).toBeLessThan(.31);
    }
    expect(environmentTemperatureAt(samples, 100 - .000001, 0)).toBeCloseTo(30, 10);
    expect(environmentTemperatureAt(samples, 100 + .000001, 0)).toBeCloseTo(30, 10);
  });

  it('stays within the measured temperature range across the floor and outside its perimeter', () => {
    const rooms = environmentHeatmap(source).rooms;
    const values = rooms.map(room => room.temperature!), minimum = Math.min(...values), maximum = Math.max(...values);
    for (let x = -100; x <= 1400; x += 47) for (let y = -100; y <= 800; y += 41) {
      const value = environmentTemperatureAt(rooms, x, y)!;
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(minimum);
      expect(value).toBeLessThanOrEqual(maximum);
    }
  });

  it('excludes missing temperatures and invalid coordinates instead of assigning cold zero readings', () => {
    const valid = sample(10, 10, 26);
    const samples = [sample(0, 0, null), sample(0, 0, NaN), sample(0, 0, Infinity),
      sample(0, 0, -Infinity), sample(NaN, 0, 10), sample(0, Infinity, 40), valid];
    expect(environmentTemperatureAt(samples, 0, 0)).toBe(26);
    expect(environmentTemperatureAt(samples, 500, 300)).toBe(26);
    expect(environmentTemperatureAt(samples.slice(0, -1), 0, 0)).toBeNull();
    expect(environmentTemperatureAt([], 0, 0)).toBeNull();
    expect(environmentTemperatureAt([valid], NaN, 0)).toBeNull();
    expect(environmentTemperatureAt([valid], 0, Infinity)).toBeNull();
  });

  it('keeps a constant field and does not mutate or reorder sensor samples', () => {
    const samples = Object.freeze([Object.freeze(sample(0, 0, 24)), Object.freeze(sample(100, 0, 24))]);
    const before = JSON.stringify(samples);
    expect(environmentTemperatureAt(samples, 40, 23)).toBeCloseTo(24, 12);
    expect(environmentTemperatureAt(samples, 1e9, 1e9)).toBeCloseTo(24, 12);
    expect(JSON.stringify(samples)).toBe(before);
  });
});
