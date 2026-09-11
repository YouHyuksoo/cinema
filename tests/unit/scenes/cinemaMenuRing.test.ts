import { readFileSync } from 'node:fs';
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

describe('orbit layout around the globe', () => {
  it('places tiles in a sawtooth around a tighter ring, front slot at twelve o\'clock', async () => {
    const { MENU_LAYOUTS, isMenuLayout, orbitPose, orbitRadius, ORBIT_INNER_SCALE, menuPoseStyle } = await import('@/cinema/filmMenuRing');
    expect(MENU_LAYOUTS.map(item => item.value)).toEqual(['dock', 'orbit']);
    expect(isMenuLayout('orbit')).toBe(true); expect(isMenuLayout('grid')).toBe(false);
    expect(orbitRadius(240)).toBe(168); expect(orbitRadius(NaN)).toBe(48);
    expect(ORBIT_INNER_SCALE).toBe(0.74);
    const front = orbitPose(3, 3, 16, 100);
    expect(front.x).toBeCloseTo(0); expect(front.y).toBeCloseTo(-74); expect(front.scale).toBeCloseTo(1.32); expect(front.opacity).toBe(1);
    const even = orbitPose(4, 3, 16, 100);
    expect(Math.hypot(even.x, even.y)).toBeCloseTo(100);
    const odd = orbitPose(5, 3, 16, 100);
    expect(Math.hypot(odd.x, odd.y)).toBeCloseTo(74);
    const opposite = orbitPose(11, 3, 16, 100);
    expect(opposite.y).toBeCloseTo(74); expect(opposite.scale).toBeCloseTo(1.02); expect(opposite.opacity).toBeCloseTo(.82);
    const quarter = orbitPose(7, 3, 16, 100);
    expect(quarter.x).toBeCloseTo(74); expect(quarter.y).toBeCloseTo(0);
    for (let index = 0; index < 16; index++) {
      const pose = orbitPose(index, 3, 16, 100);
      expect(Math.hypot(pose.x, pose.y)).toBeCloseTo(index % 2 === 0 ? 100 : 74);
      expect(pose.z).toBe(0); expect(pose.yaw).toBe(0);
      expect(pose.radius).toBeCloseTo(index % 2 === 0 ? 100 : 74);
    }
    expect(orbitPose(3, 3 + 16, 16, 100)).toEqual(front);
    // Live tiles pass radius 1; CSS must scale --orbit-r by a unitless tooth, not a 1px radius.
    const live = menuPoseStyle(orbitPose(3, 3, 16, 1));
    expect('--orbit-tooth' in live && live['--orbit-tooth']).toBe('0.74');
    expect('--orbit-radius' in live).toBe(false);
    const css = readFileSync('src/cinema/filmMenuRing.module.css', 'utf8');
    expect(css).toContain('var(--orbit-r,180px) * var(--orbit-tooth,1)');
  });
});

describe('clicking any scene tile launches it', () => {
  it('runs onSelect on click without requiring the 12 o\'clock slot, for both layouts', () => {
    const source = readFileSync('src/cinema/FilmChapterMenu.tsx', 'utf8');
    expect(source).toContain('onClick={() => { if (ringBlocked) return; onSelect(chapter.id); }}');
    expect(source).not.toContain('if (index === front) onSelect');
    expect(source).toContain("event.currentTarget.matches(':focus-visible')");
    expect(source).toContain('클릭 · Enter로 실행');
    expect(source).toContain('클릭 또는 Enter로 실행');
  });
});
