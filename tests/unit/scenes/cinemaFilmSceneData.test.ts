import { describe, expect, it, vi } from 'vitest';
import { drawSignalFilm } from '@/cinema/drawSignalFilm';
import { DEFAULT_FILM_SCENE_DATA, mergeFilmSceneData, type FilmSceneData } from '@/cinema/filmSceneData';
import { chapterStart } from '@/cinema/filmProgram';
import { canvasFixture } from '../support/canvasFixture';

vi.mock('@/cinema/components/drawProjectedFilmSurface', () => ({ drawProjectedFilmSurface: () => undefined }));

describe('film scene data injection', () => {
  it('merges partial updates over the defaults without touching untouched scenes', () => {
    const merged = mergeFilmSceneData(DEFAULT_FILM_SCENE_DATA, { production: { unit: 'PCS', target: 10, lines: [] } });
    expect(merged.production.unit).toBe('PCS');
    expect(mergeFilmSceneData(DEFAULT_FILM_SCENE_DATA, {})).toEqual(DEFAULT_FILM_SCENE_DATA);
    expect(DEFAULT_FILM_SCENE_DATA.production.lines).toHaveLength(5);
  });

  it('routes injected line and mounter metrics into the mounter analysis scene', () => {
    const data: FilmSceneData = mergeFilmSceneData(DEFAULT_FILM_SCENE_DATA, { mounter: { name: 'MOUNTER X', metrics: [
      { id: 'MX-pickup', label: '픽업률 TEST', machineId: 'MX', machineLabel: 'MOUNTER X1', value: 98.5, target: 99.5, unit: '%', direction: 'higher' },
      { id: 'MX-loss', label: '로스율 TEST', machineId: 'MX', machineLabel: 'MOUNTER X1', value: .4, target: .5, unit: '%', direction: 'lower' }] } });
    const fixture = canvasFixture();
    drawSignalFilm(fixture.ctx, 1280, 720, chapterStart('bars') + 8, undefined, undefined, undefined, null, null, data);
    const drawn = fixture.texts.map(text => text.value);
    expect(drawn).toContain('픽업률 TEST');
    expect(drawn).toContain('MOUNTER X1');
    expect(drawn).toContain('로스율 TEST');
    expect(drawn).not.toContain('LINE 01');
    expect(fixture.stack).toHaveLength(0);
  });

  it('draws the default snapshot when no data is passed', () => {
    const fixture = canvasFixture();
    drawSignalFilm(fixture.ctx, 1280, 720, chapterStart('bars') + 8);
    expect(fixture.texts.map(text => text.value)).toContain('SMT LINE 03 / MOUNTER ANALYSIS');
  });
});

describe('scene data routing for the other data-driven scenes', () => {
  const drawn = (time: number, change: Partial<FilmSceneData>) => {
    const fixture = canvasFixture();
    drawSignalFilm(fixture.ctx, 1280, 720, time, undefined, undefined, undefined, null, null, mergeFilmSceneData(DEFAULT_FILM_SCENE_DATA, change));
    expect(fixture.stack).toHaveLength(0);
    return fixture.texts.map(text => text.value);
  };
  const base = DEFAULT_FILM_SCENE_DATA;

  it('energy reads the injected document name', () => {
    expect(drawn(chapterStart('energy') + 15, { energy: { ...base.energy, name: 'INJECTED ENERGY' } })).toContain('INJECTED ENERGY');
  });

  it('network reads the injected title', () => {
    expect(drawn(chapterStart('network') + 15, { network: { ...base.network, title: 'INJECTED NETWORK' } })).toContain('INJECTED NETWORK');
  });

  it('product reads the injected serial', () => {
    expect(drawn(chapterStart('product') + 17, { product: { ...base.product, serial: 'SN-INJECTED' } })).toContain('SN-INJECTED');
  });

  it('spc reads the injected unit', () => {
    expect(drawn(chapterStart('spc') + 10, { spc: { ...base.spc, unit: 'INCH' } }).some(value => value.includes('INCH'))).toBe(true);
  });

  it('wave draws injected zone ids even without a precomputed frame', () => {
    const zones = base.environment.zones.map((zone, index) => index === 0 ? { ...zone, id: 'ZONE 77' } : zone);
    expect(drawn(chapterStart('wave') + 8, { environment: { ...base.environment, zones } })).toContain('ZONE 77');
  });
});
