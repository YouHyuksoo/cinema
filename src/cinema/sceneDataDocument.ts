import { FILM_CHAPTERS, type FilmId } from './filmProgram';

/** Contract version accepted by replacement documents. */
export const SCENE_DATA_VERSION = 1 as const;
export const SCENE_DATA_SOURCES = ['mes', 'push', 'hatchery', 'static', 'demo'] as const;
export type SceneDataSource = typeof SCENE_DATA_SOURCES[number];

export interface SceneDataEnvelope { scene: FilmId; source: SceneDataSource; at: string }
export interface SceneDataDocument<T = unknown> extends SceneDataEnvelope { version: typeof SCENE_DATA_VERSION; data: T }
export type SceneObjectChange = { id: string } & Record<string, unknown>;
export interface SceneObjectPatch extends SceneDataEnvelope { objects: readonly SceneObjectChange[] }
export type SceneDataResult =
  | { ok: true; scene: FilmId; applied: number; ignored: string[] }
  | { ok: false; scene?: string; reason: string };

const SCENE_IDS = new Set<string>(FILM_CHAPTERS.map(chapter => chapter.id));
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export const isSceneId = (value: unknown): value is FilmId => typeof value === 'string' && SCENE_IDS.has(value);
const isSource = (value: unknown): value is SceneDataSource => typeof value === 'string' && (SCENE_DATA_SOURCES as readonly string[]).includes(value);

function parseEnvelope(input: unknown): { ok: true; envelope: SceneDataEnvelope; body: Record<string, unknown> } | { ok: false; reason: string } {
  if (!isRecord(input)) return { ok: false, reason: '문서는 객체여야 합니다.' };
  if (!isSceneId(input.scene)) return { ok: false, reason: `등록되지 않은 장면입니다: ${String(input.scene)}` };
  if (!isSource(input.source)) return { ok: false, reason: `알 수 없는 원천입니다: ${String(input.source)}` };
  if (typeof input.at !== 'string' || !Number.isFinite(Date.parse(input.at))) return { ok: false, reason: 'at은 ISO 8601 시각 문자열이어야 합니다.' };
  return { ok: true, envelope: { scene: input.scene, source: input.source, at: input.at }, body: input };
}

/** Validates the envelope of a full replacement document; scene-specific shape is the registry's job. */
export function parseSceneDataDocument(input: unknown): { ok: true; document: SceneDataDocument } | { ok: false; reason: string } {
  const parsed = parseEnvelope(input);
  if (!parsed.ok) return parsed;
  if (parsed.body.version !== SCENE_DATA_VERSION) return { ok: false, reason: `지원하지 않는 계약 버전입니다: ${String(parsed.body.version)}` };
  if (!isRecord(parsed.body.data)) return { ok: false, reason: 'data는 객체여야 합니다.' };
  return { ok: true, document: { ...parsed.envelope, version: SCENE_DATA_VERSION, data: parsed.body.data } };
}

/** Validates an object patch: at least one change, each carrying a non-blank id. */
export function parseSceneObjectPatch(input: unknown): { ok: true; patch: SceneObjectPatch } | { ok: false; reason: string } {
  const parsed = parseEnvelope(input);
  if (!parsed.ok) return parsed;
  const objects = parsed.body.objects;
  if (!Array.isArray(objects) || objects.length === 0) return { ok: false, reason: 'objects는 비어 있지 않은 배열이어야 합니다.' };
  const changes: SceneObjectChange[] = [];
  for (const object of objects) {
    if (!isRecord(object) || typeof object.id !== 'string' || !object.id.trim()) return { ok: false, reason: '모든 객체 변경에는 비어 있지 않은 id가 필요합니다.' };
    changes.push({ ...object, id: object.id.trim() });
  }
  return { ok: true, patch: { ...parsed.envelope, objects: changes } };
}

/** Applies changes by id, protecting id and label; unknown ids are reported, never thrown. */
export function patchObjectsById<T extends { id: string }>(items: readonly T[], objects: readonly SceneObjectChange[]) {
  const next = [...items];
  const ignored: string[] = [];
  let applied = 0;
  for (const change of objects) {
    const id = change.id.trim();
    const index = next.findIndex(item => item.id === id);
    if (index < 0) { ignored.push(id); continue; }
    const { id: _id, label: _label, ...fields } = change as SceneObjectChange & { label?: unknown };
    void _id; void _label;
    next[index] = { ...next[index], ...fields };
    applied++;
  }
  return { items: next, applied, ignored };
}
