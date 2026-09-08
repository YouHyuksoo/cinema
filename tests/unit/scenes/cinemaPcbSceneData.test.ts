import { describe, expect, it } from 'vitest';
import { DEFAULT_FILM_SCENE_DATA } from '@/cinema/filmSceneData';
import { createSceneDataStore } from '@/cinema/sceneDataStore';
import { DEFAULT_PCB_INSPECTION_DATA } from '@/cinema/pcbInspectionData';
import { SCENE_FIELDS } from '@/cinema/sceneFields';
import { formatSceneField, validateSceneField } from '@/cinema/sceneField';
import { hatcheryObjects, resolveHatcheryValueCommand, toolCallToPatch, hatcheryObjectCatalog } from '@/cinema/hatcheryTargets';

const envelope = { scene: 'machine', source: 'demo', at: '2026-09-08T12:00:00Z' };
describe('PCB machine data contract', () => {
  it('replaces geometry and list while keeping car data separate and last good data on invalid input', () => {
    const store = createSceneDataStore();
    const data = { ...DEFAULT_PCB_INSPECTION_DATA, width: 240, components: [] };
    expect(store.replace({ ...envelope, version: 1, data }).ok).toBe(true);
    expect(store.get().pcb).toEqual(data);
    expect(store.get().product).toBe(DEFAULT_FILM_SCENE_DATA.product);
    const good = store.get();
    expect(store.replace({ ...envelope, version: 1, data: { ...data, height: -1 } }).ok).toBe(false);
    expect(store.get()).toBe(good);
  });
  it('patches only defect/process atomically and protects identity and label', () => {
    const store = createSceneDataStore();
    const first = store.get().pcb.components[0];
    expect(store.patch({ ...envelope, objects: [{ id: first.id, defect: 'offset', process: 'maoi', label: 'changed' }] }).ok).toBe(true);
    expect(store.get().pcb.components[0]).toEqual({ ...first, defect: 'offset', process: 'maoi' });
    for (const illegal of [{ x: 0 }, { defect: 'bogus' }, { process: 'bad' }]) {
      const good = store.get();
      expect(store.patch({ ...envelope, objects: [{ id: first.id, defect: 'none' }, { id: first.id, ...illegal }] }).ok).toBe(false);
      expect(store.get()).toBe(good);
    }
  });
  it('shares enum validation, labels, natural refdes commands and tool values', () => {
    const data = DEFAULT_FILM_SCENE_DATA;
    const first = data.pcb.components[0];
    expect(hatcheryObjects(data, 'machine')[0].id).toBe(first.id);
    const field = SCENE_FIELDS.machine.find(f => f.field === 'defect')!;
    expect(validateSceneField(field, 'wrong').ok).toBe(false);
    expect(formatSceneField(field, 'none')).toBe('정상');
    expect(toolCallToPatch({ scene: 'machine', objects: [{ id: first.id.toLowerCase(), field: 'defect', value: 'bridge' }] }, data)).toMatchObject({ ok: true, patch: { objects: [{ id: first.id, defect: 'bridge' }] } });
    expect(resolveHatcheryValueCommand(`${first.id} 불량을 납땜 브리지로 변경`, data)).toMatchObject({ kind: 'patch', patch: { scene: 'machine', objects: [{ id: first.id, defect: 'bridge' }] } });
    expect(resolveHatcheryValueCommand(`${first.id} 검사공정 AOI로 변경`, data)).toMatchObject({ kind: 'patch', patch: { objects: [{ id: first.id, process: 'aoi' }] } });
    expect(resolveHatcheryValueCommand(`${first.id} 검사공정 MAOIX로 변경`, data)).toBeNull();
    expect(hatcheryObjectCatalog(data)).toContain('insufficient_solder');
    // C1 must not accidentally address C10.
    const injected = { ...data, pcb: { ...data.pcb, components: [{ ...first, id: 'C1', label: 'C1' }, { ...first, id: 'C10', label: 'C10' }] } };
    expect(resolveHatcheryValueCommand('C10 불량 정상', injected)).toMatchObject({ kind: 'patch', patch: { objects: [{ id: 'C10', defect: 'none' }] } });
  });
  it('does not convert unsupported or negated labels into a normal verdict', () => {
    for (const verdict of ['비정상', '미정상', '정상아님', '정상이 아님', '정상으로 변경하지 마', '정상으로 바꾸지 마', '정상으로 바꾸지마', '정상 또는 미검사']) {
      expect(resolveHatcheryValueCommand(`U1 불량을 ${verdict}`, DEFAULT_FILM_SCENE_DATA)).toBeNull();
    }
    expect(resolveHatcheryValueCommand('U1 불량을 정상으로 변경', DEFAULT_FILM_SCENE_DATA)).toMatchObject({ kind: 'patch', patch: { objects: [{ id: 'U1', defect: 'none' }] } });
    expect(resolveHatcheryValueCommand('U1 불량을 미검사로 변경', DEFAULT_FILM_SCENE_DATA)).toMatchObject({ kind: 'patch', patch: { objects: [{ id: 'U1', defect: 'uninspected' }] } });
  });
});
