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
