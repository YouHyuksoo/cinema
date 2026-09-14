import { describe, expect, it } from 'vitest';
import { DEFAULT_FILM_SCENE_DATA, mergeFilmSceneData } from '@/cinema/filmSceneData';
import { SCENE_DATA_REGISTRY, sceneDataEntry } from '@/cinema/sceneDataRegistry';

describe('scene data registry', () => {
  it('maps the mounter analysis and production pie to their own feed data', () => {
    expect(sceneDataEntry('bars')?.key).toBe('mounter');
    expect(sceneDataEntry('pie')?.key).toBe('production');
    expect(sceneDataEntry('wave')?.key).toBe('environment');
    expect(sceneDataEntry('network')?.key).toBe('network');
    expect(sceneDataEntry('spc')?.key).toBe('spc');
    expect(sceneDataEntry('energy')?.key).toBe('energy');
    expect(sceneDataEntry('product')?.key).toBe('product');
    expect(sceneDataEntry('machine')?.key).toBe('pcb');
    expect(sceneDataEntry('gears')).toBeUndefined();
    expect(sceneDataEntry('nope')).toBeUndefined();
  });

  it('normalizes each default dataset unchanged and rejects structural violations', () => {
    for (const [scene, key] of [['bars', 'mounter'], ['pie', 'production'], ['wave', 'environment'], ['network', 'network'], ['spc', 'spc'], ['energy', 'energy'], ['product', 'product'], ['machine', 'pcb']] as const) {
      const entry = SCENE_DATA_REGISTRY[scene]!;
      expect(entry.normalize(DEFAULT_FILM_SCENE_DATA[key])).toBeDefined();
      expect(entry.normalize(null)).toBeUndefined();
      expect(entry.normalize({})).toBeUndefined();
    }
    expect(sceneDataEntry('bars')!.normalize({ name: 'M', metrics: [{ label: 'no id', machineId: 'M01', machineLabel: 'MOUNTER 01', value: 1, target: 1, unit: '%', direction: 'higher' }] })).toBeUndefined();
    expect(sceneDataEntry('bars')!.normalize({ name: 'M', metrics: [{ id: 'A', label: 'A', machineId: 'M01', machineLabel: 'MOUNTER 01', value: '1', target: 1, unit: '%', direction: 'higher' }] })).toBeUndefined();
    expect(sceneDataEntry('wave')!.normalize({ title: 't', zones: [{ id: 'Z', name: 'z', temperature: 1, humidity: 2 }] })).toBeUndefined();
    expect(sceneDataEntry('spc')!.normalize({ name: 'n', unit: 'mm', nominal: 1, lsl: 0, usl: 2, cpkTarget: 1.33, subgroups: [{ id: 'S', values: 'x' }] })).toBeUndefined();
    expect(sceneDataEntry('energy')!.normalize({ name: 'n', power: { value: 1, capacity: 2, unit: 'kW' } })).toBeUndefined();
  });

  it('patches id-addressed collections for bars, wave, network and spc and reports unknown ids', () => {
    const bars = sceneDataEntry('bars')!;
    const patched = bars.patch!(DEFAULT_FILM_SCENE_DATA.mounter, [{ id: 'M01-loss-rate', value: .4 }, { id: 'unknown', value: 1 }]);
    expect(patched.applied).toBe(1);
    expect(patched.ignored).toEqual(['unknown']);
    expect((patched.data as typeof DEFAULT_FILM_SCENE_DATA.mounter).metrics[1].value).toBe(.4);
    expect(DEFAULT_FILM_SCENE_DATA.mounter.metrics[1].value).toBe(.72);

    const wave = sceneDataEntry('wave')!.patch!(DEFAULT_FILM_SCENE_DATA.environment, [{ id: 'ZONE 03', temperature: 31.5 }]);
    expect((wave.data as typeof DEFAULT_FILM_SCENE_DATA.environment).zones[2].temperature).toBe(31.5);
    const network = sceneDataEntry('network')!.patch!(DEFAULT_FILM_SCENE_DATA.network, [{ id: 'reflow', queue: 3 }]);
    expect((network.data as typeof DEFAULT_FILM_SCENE_DATA.network).nodes.find(node => node.id === 'reflow')?.queue).toBe(3);
    const spc = sceneDataEntry('spc')!.patch!(DEFAULT_FILM_SCENE_DATA.spc, [{ id: 'SG-01', values: [10, 10, 10, 10, 10] }]);
    expect((spc.data as typeof DEFAULT_FILM_SCENE_DATA.spc).subgroups[0].values).toEqual([10, 10, 10, 10, 10]);
  });

  it('offers no patch for fixed-shape scenes (energy, product)', () => {
    expect(sceneDataEntry('energy')!.patch).toBeUndefined();
    expect(sceneDataEntry('product')!.patch).toBeUndefined();
  });

  it('merges only the keys present in a change', () => {
    const merged = mergeFilmSceneData(DEFAULT_FILM_SCENE_DATA, { spc: { ...DEFAULT_FILM_SCENE_DATA.spc, name: 'X' } });
    expect(merged.spc.name).toBe('X');
    expect(merged.production).toBe(DEFAULT_FILM_SCENE_DATA.production);
    expect(mergeFilmSceneData(DEFAULT_FILM_SCENE_DATA, { energy: undefined }).energy).toBe(DEFAULT_FILM_SCENE_DATA.energy);
  });
});

describe('patch validation from field descriptors', () => {
  it('rejects wrong kinds, out-of-range values and undeclared fields before touching the data', () => {
    const bars = sceneDataEntry('bars')!;
    expect(bars.patch!(DEFAULT_FILM_SCENE_DATA.mounter, [{ id: 'M01-pickup-rate', value: 'abc' }]).error).toContain('숫자');
    expect(bars.patch!(DEFAULT_FILM_SCENE_DATA.mounter, [{ id: 'M01-pickup-rate', value: -5 }]).error).toContain('0');
    expect(bars.patch!(DEFAULT_FILM_SCENE_DATA.mounter, [{ id: 'M01-pickup-rate', color: 'red' }]).error).toContain('color');
    expect(sceneDataEntry('wave')!.patch!(DEFAULT_FILM_SCENE_DATA.environment, [{ id: 'ZONE 01', humidity: 120 }]).error).toContain('100');
    expect(sceneDataEntry('spc')!.patch!(DEFAULT_FILM_SCENE_DATA.spc, [{ id: 'SG-01', values: [1, 'x'] }]).error).toBeDefined();
    const good = bars.patch!(DEFAULT_FILM_SCENE_DATA.mounter, [{ id: 'M01-pickup-rate', value: 99.7 }]);
    expect(good.error).toBeUndefined();
    expect(good.applied).toBe(1);
  });
});
