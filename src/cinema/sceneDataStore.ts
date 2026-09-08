import { DEFAULT_FILM_SCENE_DATA, mergeFilmSceneData, type FilmSceneData, type FilmSceneDataKey } from './filmSceneData';
import { parseSceneDataDocument, parseSceneObjectPatch, type SceneDataResult, type SceneDataSource } from './sceneDataDocument';
import { sceneDataEntry } from './sceneDataRegistry';

export interface SceneDataProvenance { source: SceneDataSource; at: string }
export type SceneDataListener = (data: FilmSceneData) => void;

/**
 * Holds every scene's data plus who last changed it. Last arrival wins; rejected input
 * changes nothing and notifies nobody. Adapters only ever call replace() or patch().
 */
export function createSceneDataStore(initial: FilmSceneData = DEFAULT_FILM_SCENE_DATA) {
  let data = initial;
  const provenance = new Map<FilmSceneDataKey, SceneDataProvenance>();
  const listeners = new Set<SceneDataListener>();
  const commit = (key: FilmSceneDataKey, value: FilmSceneData[FilmSceneDataKey], stamp: SceneDataProvenance) => {
    data = { ...data, [key]: value };
    provenance.set(key, stamp);
    for (const listener of listeners) listener(data);
  };
  return {
    get: () => data,
    provenance: (key: FilmSceneDataKey) => provenance.get(key),
    replace(input: unknown): SceneDataResult {
      const parsed = parseSceneDataDocument(input);
      if (!parsed.ok) return { ok: false, reason: parsed.reason };
      const { scene, source, at } = parsed.document;
      const entry = sceneDataEntry(scene);
      if (!entry) return { ok: false, scene, reason: `데이터를 받지 않는 장면입니다: ${scene}` };
      const normalized = entry.normalize(parsed.document.data);
      if (normalized === undefined) return { ok: false, scene, reason: `${scene} 장면의 데이터 구조가 맞지 않습니다.` };
      commit(entry.key, normalized, { source, at });
      const collection = Object.values(normalized as unknown as Record<string, unknown>).find(Array.isArray);
      return { ok: true, scene, applied: collection ? collection.length : 1, ignored: [] };
    },
    patch(input: unknown): SceneDataResult {
      const parsed = parseSceneObjectPatch(input);
      if (!parsed.ok) return { ok: false, reason: parsed.reason };
      const { scene, source, at, objects } = parsed.patch;
      const entry = sceneDataEntry(scene);
      if (!entry) return { ok: false, scene, reason: `데이터를 받지 않는 장면입니다: ${scene}` };
      if (!entry.patch) return { ok: false, scene, reason: `${scene} 장면은 객체 패치를 지원하지 않습니다. 전체 교체 문서를 보내 주세요.` };
      const result = entry.patch(data[entry.key], objects);
      if (result.error) return { ok: false, scene, reason: result.error };
      if (result.applied === 0) return { ok: false, scene, reason: `일치하는 객체가 없습니다: ${result.ignored.join(', ')}` };
      commit(entry.key, result.data, { source, at });
      return { ok: true, scene, applied: result.applied, ignored: result.ignored };
    },
    /** Unchecked in-code update; keys absent from the change are kept. */
    merge(change: Partial<FilmSceneData>, stamp: SceneDataProvenance = { source: 'demo', at: new Date().toISOString() }) {
      const next = mergeFilmSceneData(data, change);
      if (next === data) return;
      data = next;
      for (const key of Object.keys(change) as FilmSceneDataKey[]) if (change[key] !== undefined) provenance.set(key, stamp);
      for (const listener of listeners) listener(data);
    },
    subscribe(listener: SceneDataListener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

export type SceneDataStore = ReturnType<typeof createSceneDataStore>;
