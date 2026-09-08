import { describe, expect, it } from 'vitest';
import { FILM_CHAPTERS, FILM_SECONDS, chapterAt, chapterStart, advanceFilm } from '@/cinema/filmProgram';

describe('selectable cinema scene collection', () => {
  it('keeps the sixteen visualizations distinct and gives the SPC finale a usable preview', () => {
    expect(FILM_CHAPTERS).toHaveLength(16);
    expect(FILM_CHAPTERS.slice(-5).map(chapter => chapter.id)).toEqual(['machine', 'network', 'energy', 'product', 'spc']);
    expect(FILM_CHAPTERS.at(-1)).toMatchObject({ id: 'spc', title: 'SPC 분석', duration: 40, previewAt: 30 });
    expect(new Set(FILM_CHAPTERS.map(chapter => chapter.id)).size).toBe(FILM_CHAPTERS.length);
    expect(FILM_SECONDS).toBe(538);
    expect(chapterStart('spc')).toBe(498);
    for (const chapter of FILM_CHAPTERS) {
      expect(chapter.previewAt).toBeGreaterThan(0);
      expect(chapter.previewAt).toBeLessThan(chapter.duration);
      expect(chapterAt(chapterStart(chapter.id)).chapter.id).toBe(chapter.id);
    }
  });
  it('plays through every boundary, then wraps from SPC analysis to the first scene', () => {
    FILM_CHAPTERS.forEach((chapter, index) => {
      const end = chapterStart(chapter.id) + chapter.duration - .1;
      const next = chapterAt(advanceFilm(end, .2, 'sequence'));
      expect(next.chapter.id).toBe(FILM_CHAPTERS[(index + 1) % FILM_CHAPTERS.length].id);
      expect(next.localTime).toBeCloseTo(.1);
      const repeated = chapterAt(advanceFilm(end, .2, 'chapter'));
      expect(repeated.chapter.id).toBe(chapter.id);
      expect(repeated.localTime).toBeCloseTo(chapter.id === 'trace' ? 3.5 : .1);
    });
  });
});
