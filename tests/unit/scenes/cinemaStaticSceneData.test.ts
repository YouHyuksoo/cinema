import { describe, expect, it, vi } from 'vitest';
import { createSceneDataStore } from '@/cinema/sceneDataStore';
import { loadStaticSceneData, STATIC_SCENE_DATA_PATH } from '@/cinema/staticSceneData';

const document = (scene: string, extra: Record<string, unknown>) => ({ scene, version: 1, source: 'static', at: '2026-09-08T09:00:00+09:00', ...extra });
const bars = document('bars', { data: { unit: 'EA', target: 500, lines: [{ id: 'SMT-A', label: 'SMT A', value: 420 }] } });
const response = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 404, json: async () => body }) as Response;

describe('static scene data adapter', () => {
  it('fetches scenes.json under the base path and applies every valid document to the store', async () => {
    const store = createSceneDataStore();
    const fetcher = vi.fn(async () => response([bars, document('gears', { data: {} })]));
    const result = await loadStaticSceneData(store, { fetch: fetcher, basePath: '/cinema' });
    expect(fetcher).toHaveBeenCalledWith('/cinema' + STATIC_SCENE_DATA_PATH, { cache: 'no-store' });
    expect(result).toEqual({ ok: true, applied: 1, rejected: [{ scene: 'gears', reason: expect.stringContaining('gears') }] });
    expect(store.get().production.lines[0].id).toBe('SMT-A');
    expect(store.provenance('production')?.source).toBe('static');
  });

  it('accepts a single document object as well as an array', async () => {
    const store = createSceneDataStore();
    const result = await loadStaticSceneData(store, { fetch: async () => response(bars), basePath: '' });
    expect(result).toEqual({ ok: true, applied: 1, rejected: [] });
  });

  it('keeps the defaults quietly when the file is missing, unreadable or not a document list', async () => {
    for (const fetcher of [
      async () => response(null, false),
      async () => { throw new Error('offline'); },
      async () => ({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } }) as unknown as Response,
      async () => response('text'),
    ]) {
      const store = createSceneDataStore();
      const before = store.get();
      const result = await loadStaticSceneData(store, { fetch: fetcher, basePath: '' });
      expect(result.ok).toBe(false);
      expect(store.get()).toBe(before);
    }
  });

  it('does nothing without a fetch implementation (server render)', async () => {
    const store = createSceneDataStore();
    const result = await loadStaticSceneData(store, { fetch: undefined, basePath: '' });
    expect(result.ok).toBe(false);
  });
});
