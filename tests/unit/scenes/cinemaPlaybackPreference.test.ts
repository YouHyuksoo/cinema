import { describe, expect, it } from 'vitest';
import { normalizePlaybackPreference, readPlaybackPreference } from '@/cinema/filmPlaybackPreference';

describe('playback preferences', () => {
  it('restores saved presentation options without persisting playback or session state', () => {
    const saved = { theme: 'rose', speed: 2, mode: 'chapter', texture: { style: 'space', intensity: .8 },
      charts: { bars: { dimension: '2d', depthScale: .7 }, pie: { dimension: '3d', depthScale: 1.4 } }, paused: true, time: 99 };
    const result = readPlaybackPreference({ getItem: () => JSON.stringify(saved) });
    expect(result).toMatchObject({ theme: 'rose', speed: 2, mode: 'chapter', texture: saved.texture, charts: saved.charts });
    expect(result).not.toHaveProperty('paused'); expect(result).not.toHaveProperty('time');
  });
  it('recovers from unavailable, corrupted or out-of-range storage values', () => {
    const defaults = normalizePlaybackPreference(null);
    expect(readPlaybackPreference({ getItem: () => '{broken' })).toEqual(defaults);
    expect(readPlaybackPreference({ getItem: () => { throw new Error('blocked'); } })).toEqual(defaults);
    expect(normalizePlaybackPreference({ theme: 'bad', speed: -1, texture: { intensity: 9 }, charts: { bars: { depthScale: -2 } } }))
      .toMatchObject({ theme: defaults.theme, speed: 1, texture: { intensity: 1 }, charts: { bars: { depthScale: .4 } } });
  });
});
