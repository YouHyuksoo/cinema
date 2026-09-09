import { describe, expect, it } from 'vitest';
import { voiceCoreState } from '@/cinema/jarvisVoiceCore';
import { createReactorEggPlayback, reactorEasterEggFrame, reactorEasterEggPose, reactorLaserOrigin,
  reactorShipPosition, REACTOR_EGG_TARGET, REACTOR_EGG_TIMING } from '@/cinema/reactorEasterEgg';

describe('reactor spaceship easter egg', () => {
  it('tells a twenty-second story with two shoo gestures before the final rage', () => {
    expect([.5, 1.5, 2.6, 3.6, 5, 6.8, 8.2, 9, 10, 11.5, 13.5, 14.6, 15.8, 16.7, 17.3, 19].map(t => reactorEasterEggFrame(t)?.phase))
      .toEqual(['arrive', 'tease', 'shoo', 'retreat', 'return-ship', 'perch', 'shake-off', 'retreat-again', 'return-again', 'taunt', 'rage', 'flee', 'aim', 'fire', 'impact', 'return']);
    expect(REACTOR_EGG_TIMING.end).toBe(20);
    expect(reactorEasterEggFrame(20)).toBeNull();
    expect(reactorEasterEggFrame(-1)).toBeNull();
    expect(reactorEasterEggFrame(NaN)).toBeNull();
  });
  it('reddens and narrows only the central eye during teasing, then restores it', () => {
    const base = voiceCoreState(0, 'idle', 0);
    const angry = reactorEasterEggPose(base, reactorEasterEggFrame(13.5));
    expect(angry.irisColor).toBe('#ff304b');
    expect(angry.blink).toBeGreaterThanOrEqual(.64);
    expect(angry.highlight).toBe(base.highlight);
    expect(angry.rotation).toBe(base.rotation);
    for (const t of [.5, 2.6, 6.8, 8.2, 11]) expect(reactorEasterEggPose(base, reactorEasterEggFrame(t)).irisColor).toBeUndefined();
    expect(reactorEasterEggFrame(19.9)?.anger).toBeLessThan(.03);
    expect(reactorEasterEggPose(base, reactorEasterEggFrame(20))).toBe(base);
  });
  it('shakes from side to side twice without prematurely getting angry', () => {
    const base = voiceCoreState(0, 'idle', 0);
    for (const [from, to] of [[2.2, 3.25], [7.8, 8.8]]) {
      const poses = Array.from({ length: 30 }, (_, i) => reactorEasterEggPose(base, reactorEasterEggFrame(from + (to - from) * i / 30)));
      expect(Math.max(...poses.map(p => p.gazeYaw))).toBeGreaterThan(base.gazeYaw + .25);
      expect(Math.min(...poses.map(p => p.gazeYaw))).toBeLessThan(base.gazeYaw - .25);
      expect(poses.every(p => !p.irisColor)).toBe(true);
    }
  });
  it('maintains continuous flight and puts the ship behind the solid reactor', () => {
    for (const t of [1.2, 2.2, 3.25, 4.1, 4.6, 6, 7.8, 8.8, 9.6, 10.8, 11.45, 12.2, 13.1, 14.1, 14.9, 16.6]) {
      const a = reactorShipPosition(t - .00001), b = reactorShipPosition(t + .00001);
      expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeLessThan(.1);
    }
    expect(reactorEasterEggFrame(2)?.behind).toBe(false);
    expect(reactorEasterEggFrame(14.9)?.behind).toBe(true);
    expect(reactorShipPosition(16.6)).toEqual(REACTOR_EGG_TARGET);
  });
  it('aims the physical emitter toward the distant target before firing', () => {
    const egg = reactorEasterEggFrame(16.7)!;
    const state = reactorEasterEggPose(voiceCoreState(0, 'speaking', 1), egg);
    const muzzle = reactorLaserOrigin(state), target = REACTOR_EGG_TARGET;
    const length = Math.hypot(target.x, target.y, target.z);
    for (const key of ['x', 'y', 'z'] as const) expect(muzzle[key] / 50).toBeCloseTo(target[key] / length, 9);
    expect(Math.cos(state.gazeYaw) * Math.cos(state.pitch)).toBeLessThan(0);
    expect(state.sparkCount).toBe(0);
    expect(egg.laserReach).toBeGreaterThan(0);
    expect(reactorEasterEggFrame(16.84)?.laserReach).toBe(1);
    expect(reactorEasterEggFrame(16.83)?.shipVisible).toBe(true);
    expect(reactorEasterEggFrame(16.84)?.shipVisible).toBe(false);
    expect(reactorEasterEggFrame(16.84)?.impactAge).toBe(0);
  });
  it('ignores repeated clicks, supports cancellation and can replay after completion', () => {
    const playback = createReactorEggPlayback();
    expect(playback.start()).toBe(true);
    playback.advance(2);
    expect(playback.start()).toBe(false);
    expect(playback.advance(0)?.time).toBe(2);
    expect(playback.advance(NaN)?.time).toBe(2);
    expect(playback.advance(-1)?.time).toBe(2);
    expect(playback.advance(18)).toBeNull();
    expect(playback.active).toBe(false);
    expect(playback.start()).toBe(true);
    playback.cancel();
    expect(playback.advance(1)).toBeNull();
    expect(playback.active).toBe(false);
  });
  it('uses a static brief salute without flashes in reduced motion', () => {
    const playback = createReactorEggPlayback();
    playback.start(true);
    const a = playback.advance(.1)!, b = playback.advance(.8)!;
    expect(a).toEqual(b);
    expect(a.phase).toBe('salute');
    expect(a.firing).toBe(false);
    expect(a.impactAge).toBeNull();
    expect(a.anger).toBe(0);
    const base = voiceCoreState(0, 'idle', 0, true);
    expect(reactorEasterEggPose(base, a)).toBe(base);
    expect(playback.advance(.4)).toBeNull();
    playback.start();
    expect(playback.advance(.1, true)).toBeNull();
    expect(playback.active).toBe(false);
  });
});
