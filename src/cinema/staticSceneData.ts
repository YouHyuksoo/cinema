import type { SceneDataStore } from './sceneDataStore';

/** Optional static feed: an array (or one) of scene data documents served with the site. */
export const STATIC_SCENE_DATA_PATH = '/cinema/data/scenes.json';

export interface StaticSceneDataOptions {
  fetch: typeof globalThis.fetch | undefined;
  basePath: string;
}
export type StaticSceneDataResult =
  | { ok: true; applied: number; rejected: { scene: string; reason: string }[] }
  | { ok: false; reason: string };

/**
 * Static JSON adapter (contract §4): reads scenes.json once and hands every document to the store.
 * A missing or unreadable file is not an error for the screen; the demo defaults simply stay.
 */
export async function loadStaticSceneData(store: SceneDataStore, options: StaticSceneDataOptions): Promise<StaticSceneDataResult> {
  if (!options.fetch) return { ok: false, reason: 'fetch를 사용할 수 없습니다.' };
  let body: unknown;
  try {
    const response = await options.fetch(`${options.basePath}${STATIC_SCENE_DATA_PATH}`, { cache: 'no-store' });
    if (!response.ok) return { ok: false, reason: `정적 장면 데이터가 없습니다 (${response.status}).` };
    body = await response.json();
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : '정적 장면 데이터를 읽지 못했습니다.' };
  }
  const documents = Array.isArray(body) ? body : body && typeof body === 'object' ? [body] : [];
  if (!documents.length) return { ok: false, reason: '정적 장면 데이터는 문서 배열이어야 합니다.' };
  const rejected: { scene: string; reason: string }[] = [];
  let applied = 0;
  for (const document of documents) {
    const result = store.replace(document);
    if (result.ok) applied++;
    else rejected.push({ scene: result.scene ?? String((document as { scene?: unknown })?.scene ?? '?'), reason: result.reason });
  }
  return { ok: true, applied, rejected };
}

/** Browser defaults: global fetch and the Next.js base path baked in at build time. */
export function browserStaticSceneDataOptions(): StaticSceneDataOptions {
  return { fetch: typeof fetch === 'function' ? fetch.bind(globalThis) : undefined, basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '' };
}
