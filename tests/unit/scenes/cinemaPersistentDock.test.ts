import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FilmDock } from '@/cinema/FilmDock';
import { FILM_CHAPTERS } from '@/cinema/filmProgram';
import type { FilmPlayback } from '@/cinema/useFilmPlayback';
import type { FilmCameraMode } from '@/cinema/FilmCameraControls';

describe('persistent mobile scene dock', () => {
  it.each([true, false])('renders the ring without a reveal button in preview=%s', preview => {
    const player = { position: { chapter: FILM_CHAPTERS[0], localTime: 0 }, ready: true,
      playing: true, factory: { manual: false } } as FilmPlayback;
    const camera = { preview } as FilmCameraMode;
    const html = renderToStaticMarkup(createElement(FilmDock, { player, camera }));
    expect(html).not.toContain('하단 메뉴 펼치기');
    expect(html).not.toContain('하단 메뉴 닫기');
    expect(html).not.toContain('data-menu-open');
    expect(html).toContain('연출 장면 선택');
    expect(html).toContain('메인 메뉴');
    expect(html).toContain('연출 설정');
    for (const chapter of FILM_CHAPTERS) expect(html).toContain(chapter.title);
  });
});
