import { describe, expect, it } from 'vitest';
import { ringIndex, nearestRingTurn, ringPose, dragRingTurn } from '@/cinema/filmMenuRing';

describe('3D scene menu ring', () => {
  it('wraps both directions and repeated revolutions', () => {
    expect(ringIndex(-1, 16)).toBe(15);
    expect(ringIndex(32, 16)).toBe(0);
    expect(ringIndex(15.6, 16)).toBe(0);
  });
  it('aligns a target by the shortest path across the seam', () => {
    expect(nearestRingTurn(15, 0, 16)).toBe(16);
    expect(nearestRingTurn(0, 15, 16)).toBe(-1);
    expect(nearestRingTurn(32, 3, 16)).toBe(35);
  });
  it('places the front centrally, closer and larger than the rear', () => {
    const front = ringPose(0, 0, 16, 300);
    const back = ringPose(8, 0, 16, 300);
    expect(front.x).toBeCloseTo(0);
    expect(front.z).toBeGreaterThan(back.z);
    expect(front.scale).toBeGreaterThan(back.scale);
    expect(front.opacity).toBeGreaterThan(back.opacity);
    expect(front.y).toBeGreaterThan(back.y);
    expect(front.y).toBe(36);
    expect(back.y).toBe(-36);
    expect(ringPose(1, 0, 16, 300).x).toBeGreaterThan(0);
  });
  it('preserves geometry across full turns and bounds narrow layouts', () => {
    expect(ringPose(4, 0, 16, 300)).toEqual(ringPose(4, 16, 16, 300));
    for (let i = 0; i < 16; i++) expect(Math.abs(ringPose(i, 0, 16, 90).x)).toBeLessThanOrEqual(90);
  });
  it('leftward swipes advance and released positions snap by rounding', () => {
    expect(dragRingTurn(0, -100, 400, 16)).toBe(4);
    expect(ringIndex(dragRingTurn(0, -36, 400, 16), 16)).toBe(1);
    expect(dragRingTurn(5, 100, 400, 16)).toBe(1);
    expect(Number.isFinite(dragRingTurn(0, 10, 0, 16))).toBe(true);
  });
});
