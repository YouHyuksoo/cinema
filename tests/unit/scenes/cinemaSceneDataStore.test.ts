import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_FILM_SCENE_DATA } from '@/cinema/filmSceneData';
import { createSceneDataStore } from '@/cinema/sceneDataStore';

const lines = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `L-${index + 1}`, label: `L ${index + 1}`, value: 100 * (index + 1) }));
const document = (at: string, count: number, source = 'mes') => ({ scene: 'bars', version: 1, source, at, data: { unit: 'EA', target: 800, lines: lines(count) } });

describe('scene data store', () => {
  it('starts from the defaults with no provenance', () => {
    const store = createSceneDataStore();
    expect(store.get()).toBe(DEFAULT_FILM_SCENE_DATA);
    expect(store.provenance('production')).toBeUndefined();
  });

  it('replaces a scene from a valid document, records provenance and notifies subscribers', () => {
    const store = createSceneDataStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const before = store.get();
    const result = store.replace(document('2026-09-08T09:00:00+09:00', 2));
    expect(result).toEqual({ ok: true, scene: 'bars', applied: 2, ignored: [] });
    expect(store.get()).not.toBe(before);
    expect(store.get().production.lines).toHaveLength(2);
    expect(store.get().environment).toBe(before.environment);
    expect(store.provenance('production')).toEqual({ source: 'mes', at: '2026-09-08T09:00:00+09:00' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(store.get());
    unsubscribe();
    store.replace(document('2026-09-08T09:01:00+09:00', 3));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('leaves the store untouched and silent when a document or patch is rejected', () => {
    const store = createSceneDataStore();
    const listener = vi.fn();
    store.subscribe(listener);
    const before = store.get();
    expect(store.replace({ ...document('2026-09-08T09:00:00+09:00', 1), scene: 'gears' }).ok).toBe(false);
    expect(store.replace({ ...document('2026-09-08T09:00:00+09:00', 1), data: { unit: 'EA' } }).ok).toBe(false);
    expect(store.patch({ scene: 'energy', source: 'push', at: '2026-09-08T09:00:00+09:00', objects: [{ id: 'power', value: 1 }] }).ok).toBe(false);
    expect(store.patch({ scene: 'bars', source: 'push', at: '2026-09-08T09:00:00+09:00', objects: [{ id: 'nope', value: 1 }] }))
      .toEqual({ ok: false, scene: 'bars', reason: expect.stringContaining('nope') });
    expect(store.get()).toBe(before);
    expect(store.provenance('production')).toBeUndefined();
    expect(listener).not.toHaveBeenCalled();
  });

  it('applies object patches by id and reports ignored ids', () => {
    const store = createSceneDataStore();
    const result = store.patch({ scene: 'bars', source: 'hatchery', at: '2026-09-08T09:00:05+09:00', objects: [{ id: 'LINE-02', value: 999 }, { id: 'LINE-42', value: 1 }] });
    expect(result).toEqual({ ok: true, scene: 'bars', applied: 1, ignored: ['LINE-42'] });
    expect(store.get().production.lines[1].value).toBe(999);
    expect(store.get().production.lines[1].label).toBe('LINE 02');
    expect(store.provenance('production')?.source).toBe('hatchery');
  });

  it('lets the latest arrival win regardless of its timestamp', () => {
    const store = createSceneDataStore();
    store.replace(document('2026-09-08T10:00:00+09:00', 4, 'mes'));
    store.replace(document('2026-09-08T08:00:00+09:00', 1, 'static'));
    expect(store.get().production.lines).toHaveLength(1);
    expect(store.provenance('production')).toEqual({ source: 'static', at: '2026-09-08T08:00:00+09:00' });
  });

  it('merges unchecked partial data as a demo source', () => {
    const store = createSceneDataStore();
    store.merge({ spc: { ...DEFAULT_FILM_SCENE_DATA.spc, name: 'MERGED' } });
    expect(store.get().spc.name).toBe('MERGED');
    expect(store.get().production).toBe(DEFAULT_FILM_SCENE_DATA.production);
    expect(store.provenance('spc')?.source).toBe('demo');
    expect(store.provenance('production')).toBeUndefined();
  });
});
