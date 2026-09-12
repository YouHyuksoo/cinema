import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createCenterBackgroundPreference, CENTER_BACKGROUND_KEY, CENTER_BACKGROUNDS } from '@/cinema/jarvisCenterBackground';
import { FilmCenterControls } from '@/cinema/FilmCenterControls';

describe('main center background preference', () => {
  it('includes the default neon HUD artwork in the settings choices', () => {
    expect(CENTER_BACKGROUNDS).toContainEqual({ id: 'neon-hud', label: '네온 HUD' });
    expect(renderToStaticMarkup(createElement(FilmCenterControls))).toContain('중앙 배경 네온 HUD');
  });

  it('shows the central pattern by default, including SSR and unknown saved options', () => {
    expect(createCenterBackgroundPreference().getSnapshot()).toBe('neon-hud');
    expect(createCenterBackgroundPreference().getServerSnapshot()).toBe('neon-hud');
    expect(createCenterBackgroundPreference(() => ({ getItem: () => 'invalid', setItem() {} })).getSnapshot()).toBe('neon-hud');
  });
  it('respects an explicitly saved classic style', () => {
    expect(createCenterBackgroundPreference(() => ({ getItem: () => 'classic', setItem() {} })).getSnapshot()).toBe('classic');
  });
  it('persists a choice and restores it without enabling any devices', () => {
    const values = new Map<string, string>([[CENTER_BACKGROUND_KEY, 'classic']]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const preference = createCenterBackgroundPreference(() => storage);
    let changes = 0;
    const unsubscribe = preference.subscribe(() => changes++);
    preference.set('neon-hud');
    expect(values.get(CENTER_BACKGROUND_KEY)).toBe('neon-hud');
    expect(preference.getSnapshot()).toBe('neon-hud');
    expect(createCenterBackgroundPreference(() => storage).getSnapshot()).toBe('neon-hud');
    expect(changes).toBe(1);
    preference.set('neon-hud');
    expect(changes).toBe(1);
    unsubscribe(); preference.set('classic');
    expect(changes).toBe(1);
  });
  it('remains usable if browser storage is unavailable', () => {
    const preference = createCenterBackgroundPreference(() => { throw new Error('storage blocked'); });
    expect(preference.getSnapshot()).toBe('neon-hud');
    preference.set('classic');
    expect(preference.getSnapshot()).toBe('classic');
    expect(preference.getServerSnapshot()).toBe('neon-hud');
  });
  it('migrates the initial red preview selection to neon without adding a third option', () => {
    const preference = createCenterBackgroundPreference(() => ({ getItem: () => 'red-hud', setItem() {} }));
    expect(preference.getSnapshot()).toBe('neon-hud');
  });
});
