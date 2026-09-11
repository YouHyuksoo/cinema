import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FilmDock } from '@/cinema/FilmDock';
import { SignalFilm } from '@/cinema/SignalFilm';
import { FILM_CHAPTERS } from '@/cinema/filmProgram';
import type { FilmPlayback } from '@/cinema/useFilmPlayback';
import type { FilmCameraMode } from '@/cinema/FilmCameraControls';

function renderDock(preview: boolean, menuOpen: boolean) {
  const player = { position: { chapter: FILM_CHAPTERS[0], localTime: 0 }, ready: true,
    playing: true, factory: { manual: false } } as FilmPlayback;
  const camera = { preview } as FilmCameraMode;
  return renderToStaticMarkup(createElement(FilmDock, { player, camera, menuOpen, onMenuOpenChange() {} }));
}

describe('auto-collapsing scene dock', () => {
  it('starts the main page with the floating globe and collapsed ring', () => {
    const html = renderToStaticMarkup(createElement(SignalFilm));
    const main = html.match(/<main[^>]*>/)?.[0] ?? '';
    const globe = html.match(/<button[^>]*aria-label="하단 메뉴 펼치기"[^>]*>/)?.[0] ?? '';
    const actions = html.match(/<div[^>]*data-dock-actions="true"[^>]*>/)?.[0] ?? '';
    expect(main).toContain('data-preview="true"');
    expect(main).toContain('data-menu-open="false"');
    expect(html).toContain('data-menu-phase="closed"');
    expect(globe).toContain('aria-expanded="false"');
    expect(globe).not.toContain('hidden=');
    expect(globe).not.toContain('inert=');
    expect(actions).toContain('inert=""');
  });

  it.each([
    { preview: true, menuOpen: true }, { preview: true, menuOpen: false },
    { preview: false, menuOpen: true }, { preview: false, menuOpen: false },
  ])('keeps one accessible dock in preview=$preview menuOpen=$menuOpen', ({ preview, menuOpen }) => {
    const html = renderDock(preview, menuOpen);
    const actions = html.match(/<div[^>]*data-dock-actions="true"[^>]*>/)?.[0] ?? '';
    const globe = html.match(/<button[^>]*aria-label="하단 메뉴 펼치기"[^>]*>/)?.[0] ?? '';
    expect(actions).not.toBe('');
    expect(globe).not.toBe('');
    if (menuOpen) {
      expect(actions).toContain('aria-hidden="false"');
      expect(actions).not.toContain('inert=""');
    } else {
      expect(globe).toContain('aria-expanded="false"');
      expect(actions).toContain('aria-hidden="true"');
      expect(actions).toContain('inert=""');
      expect(globe).not.toContain('inert=""');
    }
    expect(html).toContain('연출 장면 선택');
    expect(html).not.toContain('aria-label="메뉴 축소"');
    if (preview) expect(html).toContain('HATCHERY 메인 메뉴');
    if (preview) expect(html).not.toContain('연출 설정');
    else expect(html).toContain('연출 설정');
    for (const chapter of FILM_CHAPTERS) expect(html).toContain(chapter.title);
  });

  it('folds by choosing a scene or Escape instead of a dedicated collapse control', () => {
    const html = renderDock(false, true);
    expect(html).not.toContain('aria-label="메뉴 축소"');
    expect(html).not.toContain('하단 메뉴 닫기');
    expect(html).toContain('aria-expanded="true"');
  });

  it('registers one resolvable dock length for open, closed, mobile, short, and safe-area layouts', () => {
    const css = readFileSync(new URL('../../../src/cinema/film.module.css', import.meta.url), 'utf8')
      .replace(/\s+/g, ' ');
    expect(css).toMatch(/@property --film-dock-space\s*{[^}]*syntax:\s*["']<length>["'][^}]*inherits:\s*true/);
    expect(css).toMatch(/\.page\s*{[^}]*--film-safe-extra:\s*max\(0px, calc\(env\(safe-area-inset-bottom\) - 10px\)\)[^}]*--film-dock-space:\s*calc\(208px \+ var\(--film-safe-extra\)\)/);
    expect(css).toMatch(/\.page\[data-menu-open=false\]\s*{[^}]*--film-dock-space:\s*calc\(32px \+ var\(--film-safe-extra\)\)/);
    expect(css).not.toMatch(/@media\s*\(max-width:\s*680px\)[^{]*{[^}]*\.page\[data-menu-open=false\][^{]*{[^}]*--film-dock-space/);
    expect(css).toMatch(/@media\s*\(max-height:\s*500px\)[^{]*{[^}]*\.page[^{]*{[^}]*--film-dock-space:\s*calc\(172px \+ var\(--film-safe-extra\)\)/);
    expect(css).not.toMatch(/@media\s*\(max-height:\s*500px\)[^{]*{[^}]*\.page\[data-menu-open=false\][^{]*{[^}]*--film-dock-space/);
  });
});
