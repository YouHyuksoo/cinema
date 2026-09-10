import { describe, expect, it } from 'vitest';
import { createIntroTimeline, INTRO_SESSION_KEY, INTRO_TIMING, shouldPlayIntro } from '@/cinema/hatcheryIntroTimeline';

const memoryStorage = () => {
  const map = new Map<string, string>();
  return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); }, map };
};

describe('intro session gate', () => {
  it('plays once per session and records the flag when it starts', () => {
    const storage = memoryStorage();
    expect(shouldPlayIntro(storage, false)).toBe(true);
    expect(storage.map.get(INTRO_SESSION_KEY)).toBe('1');
    expect(shouldPlayIntro(storage, false)).toBe(false);
  });
  it('skips under reduced motion but still marks the session', () => {
    const storage = memoryStorage();
    expect(shouldPlayIntro(storage, true)).toBe(false);
    expect(storage.map.get(INTRO_SESSION_KEY)).toBe('1');
  });
  it('plays when storage is unavailable or throws', () => {
    expect(shouldPlayIntro(null, false)).toBe(true);
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(shouldPlayIntro(broken, false)).toBe(true);
  });
});

describe('intro timeline', () => {
  it('stays closed with the cube staged until both the cube and the HUD are ready', () => {
    const intro = createIntroTimeline(1000);
    expect(intro.at(1000)).toEqual({ phase: 'closed', door: 0, cube: 'stage', skipped: false });
    intro.solved(6900);
    expect(intro.at(7000).phase).toBe('closed');
    intro.ready(7200);
    expect(intro.at(7200)).toMatchObject({ phase: 'opening', door: 0, cube: 'stage' });
  });
  it('opens over doorMs, sends the cube home after returnDelayMs, and finishes when docked', () => {
    const intro = createIntroTimeline(0);
    intro.ready(0); intro.solved(5900);
    expect(intro.at(5900 + INTRO_TIMING.doorMs / 2).door).toBeCloseTo(.5, 5);
    expect(intro.at(5900 + INTRO_TIMING.returnDelayMs - 1).cube).toBe('stage');
    expect(intro.at(5900 + INTRO_TIMING.returnDelayMs).cube).toBe('return');
    expect(intro.at(5900 + INTRO_TIMING.doorMs + 10)).toMatchObject({ phase: 'opening', door: 1 });
    intro.docked(8000);
    expect(intro.at(8000)).toEqual({ phase: 'done', door: 1, cube: null, skipped: false });
  });
  it('skip opens at once and snaps the cube', () => {
    const intro = createIntroTimeline(0);
    intro.skip(2000);
    expect(intro.at(2000)).toMatchObject({ phase: 'opening', door: 0, cube: 'snap', skipped: true });
    expect(intro.at(2000 + INTRO_TIMING.doorMs).door).toBe(1);
    intro.docked(2300);
    expect(intro.at(2300 + INTRO_TIMING.doorMs).phase).toBe('done');
  });
  it('does not wait forever for a cube that never reports', () => {
    const intro = createIntroTimeline(0);
    intro.ready(100);
    expect(intro.at(INTRO_TIMING.cubeTimeoutMs - 1).phase).toBe('closed');
    expect(intro.at(INTRO_TIMING.cubeTimeoutMs).phase).toBe('opening');
    expect(intro.at(INTRO_TIMING.cubeTimeoutMs + INTRO_TIMING.doorMs).phase).toBe('done');
  });
  it('is deterministic for the same clock', () => {
    const a = createIntroTimeline(0), b = createIntroTimeline(0);
    for (const intro of [a, b]) { intro.ready(0); intro.solved(5900); }
    expect(a.at(6400)).toEqual(b.at(6400));
  });
});

describe('intro timeline safety', () => {
  it('opens after the cube timeout even when the HUD never reports ready', () => {
    const intro = createIntroTimeline(0);
    expect(intro.at(INTRO_TIMING.cubeTimeoutMs - 1).phase).toBe('closed');
    expect(intro.at(INTRO_TIMING.cubeTimeoutMs).phase).toBe('opening');
    expect(intro.at(INTRO_TIMING.cubeTimeoutMs + INTRO_TIMING.doorMs).phase).toBe('done');
  });
});
