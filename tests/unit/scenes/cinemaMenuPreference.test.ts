import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createMenuLayoutPreference, MENU_LAYOUT_KEY } from '@/cinema/filmMenuPreference';

describe('menu layout persistence wiring', () => {
  it('restores either menu choice after remount and reload without writing during hydration', () => {
    const saved = new Map<string, string>();
    const storage = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value); } };
    const preference = createMenuLayoutPreference(() => storage);
    let changes = 0;
    const unsubscribe = preference.subscribe(() => changes++);
    for (const layout of ['orbit', 'dock'] as const) {
      preference.set(layout);
      const reloaded = createMenuLayoutPreference(() => storage);
      expect(reloaded.getServerSnapshot()).toBe('dock');
      expect(saved.get(MENU_LAYOUT_KEY)).toBe(layout);
      expect(reloaded.getSnapshot()).toBe(layout);
    }
    expect(changes).toBe(2);
    unsubscribe();
    preference.set('orbit');
    expect(changes).toBe(2);
    preference.set('invalid');
    expect(preference.getSnapshot()).toBe('orbit');
  });
  it('keeps defaults for missing or invalid storage and never resets valid choices', () => {
    expect(createMenuLayoutPreference().getSnapshot()).toBe('dock');
    const preference = createMenuLayoutPreference(() => ({ getItem: () => 'invalid', setItem() {} }));
    expect(preference.getSnapshot()).toBe('dock');
    preference.set('orbit');
    preference.set(null);
    expect(preference.getSnapshot()).toBe('orbit');
  });
  it('retains session choices when storage access or writes are denied', () => {
    for (const getStorage of [
      () => { throw new Error('blocked'); },
      () => ({ getItem: () => 'orbit', setItem() { throw new Error('quota'); } }),
    ]) {
      const preference = createMenuLayoutPreference(getStorage);
      preference.set('orbit');
      expect(preference.getSnapshot()).toBe('orbit');
      expect(preference.getServerSnapshot()).toBe('dock');
    }
  });
  it('uses the saved preference instead of a mount-local default', () => {
    const source = readFileSync('src/cinema/useFilmPlayback.ts', 'utf8');
    expect(source).toContain('menuLayoutPreference.getServerSnapshot');
    expect(source).toContain('menuLayoutPreference.set(value)');
    expect(source).not.toContain("useState<MenuLayout>('dock')");
  });
});
