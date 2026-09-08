import { describe, expect, it } from 'vitest';
import { DEFAULT_FILM_SCENE_DATA, mergeFilmSceneData } from '@/cinema/filmSceneData';
import { HATCHERY_FIELDS, HATCHERY_PATCH_SCENES, hatcheryObjectCatalog, resolveHatcheryTarget, resolveHatcheryValueCommand,
  SET_SCENE_OBJECT_VALUES_TOOL, toolCallToPatch } from '@/cinema/hatcheryTargets';
import { parseSceneObjectPatch } from '@/cinema/sceneDataDocument';
import { SCENE_FIELDS } from '@/cinema/sceneFields';

const data = DEFAULT_FILM_SCENE_DATA;
const patchOf = (input: string, source = data) => {
  const command = resolveHatcheryValueCommand(input, source);
  if (!command || command.kind !== 'patch') throw new Error(`no patch for: ${input} (${command?.kind ?? 'null'})`);
  return command;
};

describe('HATCHERY target resolution', () => {
  it('finds objects by id, label, code or number reference ignoring case, spaces and hyphens', () => {
    expect(resolveHatcheryTarget(data, 'bars', 'line-02')?.id).toBe('LINE-02');
    expect(resolveHatcheryTarget(data, 'bars', 'LINE 02')?.id).toBe('LINE-02');
    expect(resolveHatcheryTarget(data, 'bars', 'line02')?.id).toBe('LINE-02');
    expect(resolveHatcheryTarget(data, 'wave', 'zone 3')?.id).toBe('ZONE 03');
    expect(resolveHatcheryTarget(data, 'wave', '리플로우')?.id).toBe('ZONE 05');
    expect(resolveHatcheryTarget(data, 'network', 'REFLOW')?.id).toBe('reflow');
    expect(resolveHatcheryTarget(data, 'network', '광학 검사')?.id).toBe('aoi');
    expect(resolveHatcheryTarget(data, 'spc', 'sg 18')?.id).toBe('SG-18');
    expect(resolveHatcheryTarget(data, 'bars', 'LINE-42')).toBeUndefined();
  });

  it('resolves against injected data, not the defaults', () => {
    const injected = mergeFilmSceneData(data, { production: { unit: 'EA', target: 500,
      lines: [{ id: 'SMT-A', label: 'SMT A', value: 420 }, { id: 'SMT-B', label: 'SMT B', value: 510 }] } });
    expect(resolveHatcheryTarget(injected, 'bars', 'smt b')?.id).toBe('SMT-B');
    expect(resolveHatcheryTarget(injected, 'bars', 'LINE-02')).toBeUndefined();
    expect(patchOf('SMT B 470으로', injected).patch.objects[0]).toEqual({ id: 'SMT-B', value: 470 });
  });
});

describe('HATCHERY value commands (local, client side)', () => {
  it('changes a production line value from spoken forms and opens the bar scene', () => {
    for (const input of ['라인 2 470으로', '2번 라인 생산량 470', 'LINE 02 실적을 470개로 바꿔', 'line-02 470']) {
      const command = patchOf(input);
      expect(command.patch).toMatchObject({ scene: 'bars', source: 'hatchery', objects: [{ id: 'LINE-02', value: 470 }] });
      expect(parseSceneObjectPatch(command.patch).ok).toBe(true);
      expect(command.chapter).toBe('bars');
      expect(command.reply).toContain('LINE 02');
      expect(command.reply).toContain('470');
    }
  });

  it('changes zone temperature and humidity', () => {
    expect(patchOf('존 3 온도 31.5로').patch).toMatchObject({ scene: 'wave', objects: [{ id: 'ZONE 03', temperature: 31.5 }] });
    expect(patchOf('3번 구역 습도 55퍼센트').patch).toMatchObject({ scene: 'wave', objects: [{ id: 'ZONE 03', humidity: 55 }] });
    expect(patchOf('ZONE 10 온도 22').patch.objects[0]).toEqual({ id: 'ZONE 10', temperature: 22 });
  });

  it('changes process node readings by field alias', () => {
    expect(patchOf('리플로우 대기 3').patch).toMatchObject({ scene: 'network', objects: [{ id: 'reflow', queue: 3 }] });
    expect(patchOf('광학 검사 처리능력 400으로').patch).toMatchObject({ scene: 'network', objects: [{ id: 'aoi', capacityPerHour: 400 }] });
    expect(patchOf('MOUNT 사이클 6.5초').patch).toMatchObject({ scene: 'network', objects: [{ id: 'mount', cycleSeconds: 6.5 }] });
  });

  it('changes an SPC subgroup with a list of numbers', () => {
    const command = patchOf('부분군 18 측정값 10.01 10.02 10.03 10.04 10.05');
    expect(command.patch).toMatchObject({ scene: 'spc', objects: [{ id: 'SG-18', values: [10.01, 10.02, 10.03, 10.04, 10.05] }] });
  });

  it('disambiguates 리플로우 by field and asks back when it cannot', () => {
    expect(patchOf('리플로우 온도 240').patch.scene).toBe('wave');
    expect(patchOf('리플로우 대기량 12').patch.scene).toBe('network');
    const command = resolveHatcheryValueCommand('리플로우 12로', data);
    expect(command?.kind).toBe('clarify');
    expect(command && command.kind === 'clarify' ? command.reply : '').toContain('리플로우');
  });

  it('leaves questions, unknown targets and commands without a number to the other handlers', () => {
    expect(resolveHatcheryValueCommand('ZONE 6 온도 얼마야?', data)).toBeNull();
    expect(resolveHatcheryValueCommand('3번 구역 온도 알려줘', data)).toBeNull();
    expect(resolveHatcheryValueCommand('라인 9 470으로', data)).toBeNull();
    expect(resolveHatcheryValueCommand('라인 2 올려줘', data)).toBeNull();
    expect(resolveHatcheryValueCommand('SPC 분석 보여줘', data)).toBeNull();
    expect(resolveHatcheryValueCommand('현장 요약', data)).toBeNull();
  });
});

describe('HATCHERY tool contract', () => {
  it('defines one function tool over the patchable scenes and their fields', () => {
    expect(SET_SCENE_OBJECT_VALUES_TOOL.name).toBe('set_scene_object_values');
    expect(SET_SCENE_OBJECT_VALUES_TOOL.parameters.properties.scene.enum).toEqual([...HATCHERY_PATCH_SCENES]);
    const fields = SET_SCENE_OBJECT_VALUES_TOOL.parameters.properties.objects.items.properties.field.enum;
    for (const scene of HATCHERY_PATCH_SCENES) for (const field of HATCHERY_FIELDS[scene]) expect(fields).toContain(field.field);
  });

  it('turns valid tool arguments into a patch, resolving labels to ids', () => {
    const result = toolCallToPatch({ scene: 'bars', objects: [{ id: 'LINE 02', field: 'value', value: 470 }, { id: 'LINE-03', field: 'value', value: 900 }] }, data);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.patch.objects).toEqual([{ id: 'LINE-02', value: 470 }, { id: 'LINE-03', value: 900 }]);
    const list = toolCallToPatch({ scene: 'spc', objects: [{ id: 'SG-01', field: 'values', values: [1, 2, 3, 4, 5] }] }, data);
    expect(list.ok && list.patch.objects[0]).toEqual({ id: 'SG-01', values: [1, 2, 3, 4, 5] });
  });

  it('rejects unknown scenes, fields, ids and non-numeric values', () => {
    expect(toolCallToPatch({ scene: 'energy', objects: [{ id: 'power', field: 'value', value: 1 }] }, data).ok).toBe(false);
    expect(toolCallToPatch({ scene: 'bars', objects: [{ id: 'LINE-01', field: 'humidity', value: 1 }] }, data).ok).toBe(false);
    expect(toolCallToPatch({ scene: 'bars', objects: [{ id: 'LINE-99', field: 'value', value: 1 }] }, data).ok).toBe(false);
    expect(toolCallToPatch({ scene: 'bars', objects: [{ id: 'LINE-01', field: 'value', value: 'high' }] }, data).ok).toBe(false);
    expect(toolCallToPatch({ scene: 'bars', objects: [] }, data).ok).toBe(false);
    expect(toolCallToPatch(null, data).ok).toBe(false);
  });

  it('lists ids, labels and fields for the assistant instructions', () => {
    const catalog = hatcheryObjectCatalog(data);
    expect(catalog).toContain('bars');
    expect(catalog).toContain('LINE-02');
    expect(catalog).toContain('ZONE 05');
    expect(catalog).toContain('reflow');
    expect(catalog).toContain('capacityPerHour');
    expect(catalog).not.toContain('SG-25 ');
  });
});

describe('HATCHERY fields derive from scene field descriptors', () => {
  it('lists exactly the patchable fields that have spoken aliases', () => {
    for (const scene of HATCHERY_PATCH_SCENES) {
      expect(HATCHERY_FIELDS[scene].map(field => field.field))
        .toEqual(SCENE_FIELDS[scene].filter(field => field.patchable && field.aliases).map(field => field.field));
    }
  });
  it('formats replies and the catalog with descriptor units and ranges', () => {
    expect(patchOf('존 3 온도 31.5로').reply).toContain('31.5°C');
    expect(patchOf('라인 2 470으로').reply).toContain('470EA');
    expect(hatcheryObjectCatalog(data)).toContain('°C');
    expect(hatcheryObjectCatalog(data)).toContain('범위 0~100');
  });
  it('rejects tool values outside the declared range', () => {
    expect(toolCallToPatch({ scene: 'wave', objects: [{ id: 'ZONE 01', field: 'humidity', value: 120 }] }, data).ok).toBe(false);
    expect(toolCallToPatch({ scene: 'bars', objects: [{ id: 'LINE-01', field: 'value', value: -1 }] }, data).ok).toBe(false);
  });
});
