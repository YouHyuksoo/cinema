import { describe, expect, it } from 'vitest';
import { findSceneObject, normalizeSceneObjects, type SceneObject } from '@/cinema/sceneObject';

describe('scene object identity', () => {
  it('drops empty or blank ids and keeps the first of duplicate ids', () => {
    const items: SceneObject[] = [
      { id: 'LINE-01', label: 'A' }, { id: '', label: 'empty' }, { id: '   ', label: 'blank' },
      { id: 'LINE-02', label: 'B' }, { id: 'LINE-01', label: 'A duplicate' },
    ];
    expect(normalizeSceneObjects(items).map(item => [item.id, item.label]))
      .toEqual([['LINE-01', 'A'], ['LINE-02', 'B']]);
  });

  it('trims ids, treats ids as case sensitive and falls back to the id when the label is blank', () => {
    const items = normalizeSceneObjects([{ id: ' LINE-01 ', label: '' }, { id: 'line-01', label: '  ' }]);
    expect(items.map(item => item.id)).toEqual(['LINE-01', 'line-01']);
    expect(items.map(item => item.label)).toEqual(['LINE-01', 'line-01']);
  });

  it('keeps extra fields and returns the same object when nothing needed cleaning', () => {
    const line = { id: 'LINE-01', label: 'LINE 01', value: 860 };
    const [kept] = normalizeSceneObjects([line]);
    expect(kept).toBe(line);
    expect(kept.value).toBe(860);
  });

  it('finds objects by trimmed id and returns undefined for missing, empty or null ids', () => {
    const items = normalizeSceneObjects([{ id: 'LINE-01', label: 'A' }, { id: 'LINE-02', label: 'B' }]);
    expect(findSceneObject(items, 'LINE-02')?.label).toBe('B');
    expect(findSceneObject(items, ' LINE-02 ')?.label).toBe('B');
    expect(findSceneObject(items, 'LINE-09')).toBeUndefined();
    expect(findSceneObject(items, '')).toBeUndefined();
    expect(findSceneObject(items, null)).toBeUndefined();
    expect(findSceneObject(items, undefined)).toBeUndefined();
  });

  it('tolerates a missing list', () => {
    expect(normalizeSceneObjects(undefined as unknown as SceneObject[])).toEqual([]);
  });
});
