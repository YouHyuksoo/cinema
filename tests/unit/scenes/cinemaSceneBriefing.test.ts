import { describe, expect, it } from 'vitest';
import { sceneBriefing } from '@/cinema/sceneBriefing';
import { DEFAULT_FILM_SCENE_DATA } from '@/cinema/filmSceneData';
import { FILM_CHAPTERS } from '@/cinema/filmProgram';

describe('scene briefing', () => {
  it('uses the selected scene title for every scene', () => {
    for (const chapter of FILM_CHAPTERS)
      expect(sceneBriefing(chapter.id, DEFAULT_FILM_SCENE_DATA)).toContain(chapter.title);
  });
  it('uses injected production values without carrying mounter text over', () => {
    const data = { ...DEFAULT_FILM_SCENE_DATA, production: { unit:'PCS', target:100, lines:[{ id:'A', label:'시험라인', value:42 }] } };
    const text = sceneBriefing('pie', data);
    expect(text).toContain('42 PCS');
    expect(text).toContain('42.0%');
    expect(text).not.toContain('마운터');
  });
});
