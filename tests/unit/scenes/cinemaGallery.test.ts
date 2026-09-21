import { describe, expect, it } from 'vitest';
import { FILM_CHAPTERS, FILM_SECONDS, chapterAt, chapterStart, advanceFilm } from '@/cinema/filmProgram';
import { ENVIRONMENT_TIMING } from '@/cinema/zoneEnvironment';

describe('selectable cinema scene collection', () => {
  it('keeps every visualization distinct and ends on the walkable 3D factory', () => {
    expect(FILM_CHAPTERS).toHaveLength(19);
    expect(FILM_CHAPTERS.slice(-5).map(chapter => chapter.id)).toEqual(['energy', 'product', 'spc', 'cctv', 'space3d']);
    // 조작 가능한 3D 공장이 필름의 마지막 장면이다. 중간에 끼면 앞 장면들의 시작 시각이 전부 밀린다.
    expect(FILM_CHAPTERS.at(-1)).toMatchObject({ id: 'space3d', title: '공장 3D', duration: 45, previewAt: 2 });
    expect(new Set(FILM_CHAPTERS.map(chapter => chapter.id)).size).toBe(FILM_CHAPTERS.length);
    expect(FILM_SECONDS).toBe(754);
    expect(chapterStart('spc')).toBe(613);
    expect(chapterStart('space3d')).toBe(FILM_SECONDS - 45);
    for (const chapter of FILM_CHAPTERS) {
      expect(chapter.previewAt).toBeGreaterThan(0);
      expect(chapter.previewAt).toBeLessThan(chapter.duration);
      expect(chapterAt(chapterStart(chapter.id)).chapter.id).toBe(chapter.id);
    }
  });
  it('plays through every boundary in sequence, then wraps from the 3D factory to the first scene', () => {
    FILM_CHAPTERS.forEach((chapter, index) => {
      const end = chapterStart(chapter.id) + chapter.duration - .1;
      const next = chapterAt(advanceFilm(end, .2, 'sequence'));
      expect(next.chapter.id).toBe(FILM_CHAPTERS[(index + 1) % FILM_CHAPTERS.length].id);
      expect(next.localTime).toBeCloseTo(.1);
    });
  });

  it('holds the monitoring view only when a single scene repeats', () => {
    // 온습도는 모니터링 시점에서 시계를 멈춰 대시보드처럼 머문다. 그러나 이 장면이 필름의 첫
    // 장면이라, 연속 재생에서까지 멈추면 뒤의 어떤 장면에도 닿지 못한다.
    const waveEnd = chapterStart('wave') + FILM_CHAPTERS[0].duration - .1;
    const repeated = chapterAt(advanceFilm(waveEnd, .2, 'chapter'));
    expect(repeated.chapter.id).toBe('wave');
    expect(repeated.localTime).toBeCloseTo(ENVIRONMENT_TIMING.monitoringStart);

    const flowing = chapterAt(advanceFilm(waveEnd, .2, 'sequence'));
    expect(flowing.chapter.id).toBe('gears');
  });

  it('repeats a single scene without leaving it', () => {
    for (const chapter of FILM_CHAPTERS) {
      if (chapter.id === 'wave') continue; // 위 테스트가 따로 다룬다
      const end = chapterStart(chapter.id) + chapter.duration - .1;
      const repeated = chapterAt(advanceFilm(end, .2, 'chapter'));
      expect(repeated.chapter.id).toBe(chapter.id);
      expect(repeated.localTime).toBeCloseTo(chapter.id === 'trace' ? 3.5 : .1);
    }
  });
});
