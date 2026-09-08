import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FilmDock } from '@/cinema/FilmDock';
import { FILM_CHAPTERS } from '@/cinema/filmProgram';
import type { FilmPlayback } from '@/cinema/useFilmPlayback';
import type { FilmCameraMode } from '@/cinema/FilmCameraControls';

describe('auto-collapsing scene dock', () => {
  it.each([true, false])('keeps the main menu available in preview=%s', preview => {
    const player = { position: { chapter: FILM_CHAPTERS[0], localTime: 0 }, ready: true,
      playing: true, factory: { manual: false } } as FilmPlayback;
    const camera = { preview } as FilmCameraMode;
    const html = renderToStaticMarkup(createElement(FilmDock, { player, camera, menuOpen: preview, onMenuOpenChange() {} }));
    if (preview) expect(html).not.toContain('하단 메뉴 펼치기');
    else {
      expect(html).toContain('하단 메뉴 펼치기');
      expect(html).toContain('aria-expanded="false"');
      expect(html).toContain('inert=""');
    }
    expect(html).toContain('연출 장면 선택');
    expect(html).toContain('메인 메뉴');
    expect(html).toContain('연출 설정');
    for (const chapter of FILM_CHAPTERS) expect(html).toContain(chapter.title);
  });
  it('reopens the scene menu with a collapse anchor and interactive content', () => {
    const player = { position: { chapter: FILM_CHAPTERS[0], localTime: 0 }, ready: true,
      playing: true, factory: { manual: false } } as FilmPlayback;
    const html = renderToStaticMarkup(createElement(FilmDock, {
      player, camera: { preview: false } as FilmCameraMode, menuOpen: true, onMenuOpenChange() {},
    }));
    expect(html).toContain('하단 메뉴 닫기');
    expect(html).toContain('aria-expanded="true"');
    expect(html).not.toContain('inert=""');
    expect(html).toContain('aria-hidden="false"');
  });
});
