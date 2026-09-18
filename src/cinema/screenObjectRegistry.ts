import type { FilmSceneDataKey } from './filmSceneData';
import type { FilmId } from './filmProgram';
import type { SceneDataProvenance } from './sceneDataStore';

export interface ScreenObjectResult {
  ok: boolean;
  message: string;
  state?: unknown;
}

export interface ScreenObjectMethod {
  description: string;
  parameters?: Record<string, { type: 'boolean' | 'number' | 'string' | 'object'; enum?: readonly unknown[] }>;
  execute(arguments_: Record<string, unknown>): ScreenObjectResult | Promise<ScreenObjectResult>;
}

export interface ScreenObjectRegistration {
  id: string;
  description: string;
  methods: Record<string, ScreenObjectMethod>;
  getState?(): unknown;
  bindings?: ScreenObjectDataBinding[];
  presentation?: { detailChapter: FilmId };
}

export interface ScreenObjectFeedStatus {
  mode: 'server' | 'static' | 'error';
  ok: boolean;
  at?: string;
  error?: string;
  issues: string[];
}

export interface ScreenObjectDataBinding {
  feedId: string;
  sceneKey: FilmSceneDataKey;
  snapshotFields: readonly string[];
  readOnly: true;
  feedSchema?: Record<string, unknown>;
  getSnapshot(): unknown;
  getProvenance?(): SceneDataProvenance | undefined;
  getFeedStatus?(): ScreenObjectFeedStatus | undefined;
}

export interface ScreenObjectCatalogEntry {
  id: string;
  description: string;
  state?: unknown;
  detailChapter?: FilmId;
  bindings: Array<{
    feedId: string;
    sceneKey: FilmSceneDataKey;
    snapshotFields: readonly string[];
    readOnly: true;
    feedSchema?: Record<string, unknown>;
    snapshot: unknown;
    provenance?: SceneDataProvenance;
    feedStatus?: ScreenObjectFeedStatus;
  }>;
  methods: { id: string; description: string; parameters: ScreenObjectMethod['parameters'] }[];
}

export interface ScreenObjectRegistry {
  register(object: ScreenObjectRegistration): () => void;
  execute(objectId: string, methodId: string, arguments_?: Record<string, unknown>): Promise<ScreenObjectResult>;
  getState(objectId: string): unknown;
  catalog(): ScreenObjectCatalogEntry[];
  subscribe(listener: () => void): () => void;
  getRevision(): number;
  notify(): void;
}

export function createScreenObjectRegistry(): ScreenObjectRegistry {
  const objects = new Map<string, ScreenObjectRegistration>();
  const listeners = new Set<() => void>();
  let revision = 0;
  const notify = () => {
    revision += 1;
    listeners.forEach(listener => listener());
  };
  return {
    register(object) {
      if (objects.has(object.id)) throw new Error(`화면 객체 ID가 중복 등록되었습니다: ${object.id}`);
      objects.set(object.id, object);
      notify();
      return () => {
        if (objects.get(object.id) !== object) return;
        objects.delete(object.id);
        notify();
      };
    },
    async execute(objectId, methodId, arguments_ = {}) {
      const object = objects.get(objectId);
      if (!object) return { ok: false, message: `${objectId} 객체는 현재 화면에서 사용할 수 없습니다.` };
      const method = object.methods[methodId];
      if (!method) return { ok: false, message: `${objectId}.${methodId} 메서드는 지원하지 않습니다.` };
      const schema = method.parameters ?? {};
      const valid = Object.keys(arguments_).every(name => name in schema)
        && Object.entries(schema).every(([name, rule]) => {
          const value = arguments_[name];
          return typeof value === rule.type && (!rule.enum || rule.enum.includes(value));
        });
      if (!valid) return { ok:false, message:`${objectId}.${methodId} 인자가 올바르지 않습니다.` };
      try { return await method.execute(arguments_); }
      catch { return { ok: false, message: `${objectId}.${methodId} 실행에 실패했습니다.`, state: object.getState?.() }; }
    },
    getState(objectId) { return objects.get(objectId)?.getState?.(); },
    catalog() {
      return Array.from(objects.values(), object => ({
        id: object.id,
        description: object.description,
        state: object.getState?.(),
        detailChapter: object.presentation?.detailChapter,
        bindings: (object.bindings ?? []).map(binding => ({
          feedId: binding.feedId,
          sceneKey: binding.sceneKey,
          snapshotFields: binding.snapshotFields,
          readOnly: binding.readOnly,
          feedSchema: binding.feedSchema,
          snapshot: binding.getSnapshot(),
          provenance: binding.getProvenance?.(),
          feedStatus: binding.getFeedStatus?.(),
        })),
        methods: Object.entries(object.methods).map(([id, method]) => ({ id, description: method.description, parameters:method.parameters })),
      }));
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getRevision() { return revision; },
    notify,
  };
}
