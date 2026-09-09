import { describe, expect, it } from 'vitest';
import { voiceCoreState } from '@/cinema/jarvisVoiceCore';
import { reactorEyeHeat } from '@/cinema/components/drawReactorEyeHeat';
import { reactorEasterEggFrame, reactorEasterEggPose, reactorPerchedShip } from '@/cinema/reactorEasterEgg';
import { projectReactor } from '@/cinema/voiceReactorGeometry';

describe('reactor irritation and perched ship', () => {
  it('only smolders after the third visit and respects reduced motion', () => {
    const base = voiceCoreState(13.5, 'idle', 0);
    expect(reactorEyeHeat(base)).toEqual([]);
    expect(reactorEyeHeat(reactorEasterEggPose(base, reactorEasterEggFrame(6.5)))).toEqual([]);
    const angry = reactorEasterEggPose(base, reactorEasterEggFrame(13.5));
    const flames = reactorEyeHeat(angry);
    expect(flames.length).toBe(5);
    expect(reactorEyeHeat({ ...angry, reduced: true })).toEqual([]);
    expect(reactorEyeHeat({ ...angry, time: 13.8 })).not.toEqual(flames);
    for (const flame of flames) {
      expect(flame.alpha).toBeGreaterThan(0);
      expect(flame.alpha).toBeLessThanOrEqual(1);
      for (const point of flame.points) expect(Object.values(point).every(Number.isFinite)).toBe(true);
    }
  });
  it('sits above the eye, follows the physical head, and leaves continuously', () => {
    const frame = reactorEasterEggFrame(6.5)!;
    expect(frame.perched).toBe(true);
    const base = voiceCoreState(6.5, 'idle', 0);
    const a = reactorPerchedShip({ ...base, pitch: .3 }, frame);
    const b = reactorPerchedShip({ ...base, pitch: -.2 }, frame);
    expect(a.position).not.toEqual(b.position);
    expect(projectReactor(a.position, 0).y).toBeLessThan(35);
    for (const t of [5.45, 6, 7.8, 8.15]) {
      const before = reactorPerchedShip(base, reactorEasterEggFrame(t - .00001)!).position;
      const after = reactorPerchedShip(base, reactorEasterEggFrame(t + .00001)!).position;
      expect(Math.hypot(before.x - after.x, before.y - after.y, before.z - after.z)).toBeLessThan(.1);
    }
    const free = reactorEasterEggFrame(10)!;
    expect(reactorPerchedShip(base, free)).toBe(free);
  });
});
