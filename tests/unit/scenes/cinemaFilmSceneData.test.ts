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

  it('routes injected production lines into the bar scene', () => {
    const data: FilmSceneData = mergeFilmSceneData(DEFAULT_FILM_SCENE_DATA, { production: { unit: 'EA', target: 800,
      lines: [{ id: 'SMT-A', label: 'SMT A', value: 640 }, { id: 'SMT-B', label: 'SMT B', value: 910 }] } });
    const fixture = canvasFixture();
    drawSignalFilm(fixture.ctx, 1280, 720, chapterStart('bars') + 8, undefined, undefined, undefined, null, null, data);
    const drawn = fixture.texts.map(text => text.value);
    expect(drawn).toContain('SMT A');
    expect(drawn).toContain('02 CHANNELS');
    expect(drawn).not.toContain('LINE 01');
    expect(fixture.stack).toHaveLength(0);
  });

  it('draws the default snapshot when no data is passed', () => {
    const fixture = canvasFixture();
    drawSignalFilm(fixture.ctx, 1280, 720, chapterStart('bars') + 8);
    expect(fixture.texts.map(text => text.value)).toContain('05 CHANNELS');
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
