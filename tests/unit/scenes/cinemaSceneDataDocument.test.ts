import { describe, expect, it } from 'vitest';
import { parseSceneDataDocument, parseSceneObjectPatch, patchObjectsById, SCENE_DATA_SOURCES, SCENE_DATA_VERSION } from '@/cinema/sceneDataDocument';

const document = { scene: 'bars', version: 1, source: 'mes', at: '2026-09-08T14:00:00+09:00', data: { unit: 'EA', target: 800, lines: [] } };
const patch = { scene: 'bars', source: 'hatchery', at: '2026-09-08T14:00:05+09:00', objects: [{ id: 'SMT-01', value: 900 }] };

describe('scene data document envelope', () => {
  it('accepts a well-formed replacement document', () => {
    const result = parseSceneDataDocument(document);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.scene).toBe('bars');
      expect(result.document.version).toBe(SCENE_DATA_VERSION);
      expect(result.document.data).toEqual(document.data);
    }
    expect(SCENE_DATA_SOURCES).toContain('static');
  });

  it('rejects unknown scenes, other versions, unknown sources, bad timestamps and non-object data', () => {
    const reasons = [
      { ...document, scene: 'nope' }, { ...document, version: 2 }, { ...document, source: 'excel' },
      { ...document, at: 'yesterday' }, { ...document, data: 42 }, null, 'text',
    ].map(input => parseSceneDataDocument(input));
    expect(reasons.every(result => !result.ok)).toBe(true);
    expect(new Set(reasons.map(result => (result as { reason: string }).reason)).size).toBeGreaterThanOrEqual(5);
  });
});

describe('scene object patch envelope', () => {
  it('accepts a patch with at least one identified object', () => {
    const result = parseSceneObjectPatch(patch);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.patch.objects).toHaveLength(1);
  });

  it('rejects empty object lists, objects without ids and bad envelopes', () => {
    for (const input of [
      { ...patch, objects: [] }, { ...patch, objects: [{ value: 1 }] }, { ...patch, objects: [{ id: '  ', value: 1 }] },
      { ...patch, objects: 'SMT-01' }, { ...patch, scene: 'nope' }, { ...patch, source: 'excel' }, { ...patch, at: '' },
    ]) {
      expect(parseSceneObjectPatch(input).ok).toBe(false);
    }
  });
});

describe('patchObjectsById', () => {
  const items = [{ id: 'A', label: 'Line A', value: 1, note: 'x' }, { id: 'B', label: 'Line B', value: 2 }];

  it('merges only the changed fields of matching ids, never id or label, and leaves the source array untouched', () => {
    const result = patchObjectsById(items, [{ id: 'B', value: 20, label: 'HACK', extra: true }, { id: 'A', id2: 1 } as never]);
    expect(result.applied).toBe(2);
    expect(result.ignored).toEqual([]);
    expect(result.items[1]).toEqual({ id: 'B', label: 'Line B', value: 20, extra: true });
    expect(result.items[0]).toEqual({ id: 'A', label: 'Line A', value: 1, note: 'x', id2: 1 });
    expect(items[1].value).toBe(2);
    expect(result.items).not.toBe(items);
  });

  it('reports unknown ids and trims lookups', () => {
    const result = patchObjectsById(items, [{ id: ' A ', value: 5 }, { id: 'Z', value: 9 }]);
    expect(result.applied).toBe(1);
    expect(result.ignored).toEqual(['Z']);
    expect(result.items[0].value).toBe(5);
  });
});
