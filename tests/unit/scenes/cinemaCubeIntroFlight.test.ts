import { describe, expect, it } from 'vitest';
import { CUBE_INTRO_FLIGHT_MS, CUBE_INTRO_SCALE, CUBE_INTRO_SNAP_MS, cubeIntroFlight } from '@/cinema/cubeIntroFlight';

const from = { x: 700, y: 400 }, to = { x: 120, y: 80 };

describe('cube intro flight', () => {
  it('starts on stage at intro scale and lands exactly on the dock at scale 1', () => {
    expect(cubeIntroFlight(0, from, to, 'return')).toMatchObject({ x: 700, y: 400, scale: CUBE_INTRO_SCALE, bank: 0, yaw: 0, done: false });
    expect(cubeIntroFlight(CUBE_INTRO_FLIGHT_MS, from, to, 'return')).toMatchObject({ x: 120, y: 80, scale: 1, bank: 0, yaw: 0, done: true });
  });
  it('arcs upward and banks within eight degrees mid-flight', () => {
    const mid = cubeIntroFlight(CUBE_INTRO_FLIGHT_MS / 2, from, to, 'return');
    expect(mid.y).toBeLessThan((from.y + to.y) / 2);
    expect(Math.abs(mid.bank)).toBeLessThanOrEqual(8);
    expect(Math.abs(mid.bank)).toBeGreaterThan(2);
    expect(mid.scale).toBeGreaterThan(1);
    expect(mid.scale).toBeLessThan(CUBE_INTRO_SCALE);
  });
  it('snaps straight home in 300 ms', () => {
    expect(cubeIntroFlight(CUBE_INTRO_SNAP_MS / 2, from, to, 'snap')).toMatchObject({ bank: 0, yaw: 0, done: false });
    expect(cubeIntroFlight(CUBE_INTRO_SNAP_MS, from, to, 'snap')).toMatchObject({ x: 120, y: 80, scale: 1, done: true });
  });
  it('clamps bad input to the endpoints', () => {
    expect(cubeIntroFlight(-5, from, to, 'return').done).toBe(false);
    expect(cubeIntroFlight(Number.NaN, from, to, 'return')).toMatchObject({ x: 700, y: 400 });
    expect(cubeIntroFlight(1e9, from, to, 'return')).toMatchObject({ x: 120, y: 80, done: true });
  });
});
