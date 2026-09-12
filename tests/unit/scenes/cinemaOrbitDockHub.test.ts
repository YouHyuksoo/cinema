import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FilmDock } from '@/cinema/FilmDock';
import { FILM_CHAPTERS } from '@/cinema/filmProgram';

const read = (path: string) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const player = {
  ready: true, playing: true, menuLayout: 'orbit', machineSubject: 'pcb', factory: { manual: false }, cctv: { manual: false },
  position: { chapter: FILM_CHAPTERS[2], localTime: 4.2, index: 2, start: 80 }, togglePlay: vi.fn(), selectChapter: vi.fn(),
} as never;
const camera = { preview: false, error: '', openPreview: vi.fn(), closePreview: vi.fn() } as never;

/** With the globe's orbit ring open, the dock bar lives inside the globe, not at the page bottom. */
describe('orbit layout dock hub', () => {
  it('marks the dock bar, status, buttons and settings so the orbit stylesheet can relocate them', () => {
    const html = renderToStaticMarkup(createElement(FilmDock, { player, camera, menuOpen: true, onMenuOpenChange: vi.fn() }));
    expect(html).toMatch(/<div[^>]*data-menu-layout="orbit"/);
    expect(html).toContain('data-dock-bar="true"'); expect(html).toContain('data-dock-status="true"'); expect(html).toContain('data-dock-buttons="true"');
    expect(html).not.toContain('aria-label="메인 메뉴"');
    expect(html).not.toContain('aria-label="메뉴 축소"');
  });
  it('hides the centre hub in orbit because a tile click already folds the menu', () => {
    const css = read('src/cinema/filmDock.module.css');
    expect(css).toContain('.dock[data-menu-layout=orbit] .panel { display:none; }');
    expect(css).toContain('.dock[data-menu-layout=orbit][data-menu-open=true] { background:none; padding-top:0; padding-bottom:0; }');
  });
  it('publishes the orbit centre and radius on the root for the dock to use', () => {
    const hook = read('src/cinema/useFilmMenuGlobe.ts');
    expect(hook).toContain("document.documentElement.style.setProperty(name, value)");
    expect(hook).toMatch(/\['--orbit-cx', `\$\{globeCenter\.x\}px`\], \['--orbit-cy', `\$\{globeCenter\.y\}px`\], \['--orbit-r'/);
  });
  it('does not carve the old bottom ring slot when the orbit is open', () => {
    const page = read('src/cinema/film.module.css');
    expect(page).toContain('.page[data-menu-layout=orbit][data-menu-open=true] { --film-dock-space: calc(32px + var(--film-safe-extra)); }');
    const hook = read('src/cinema/useFilmMenuGlobe.ts');
    expect(hook).not.toContain('viewport.height - 84 - margin - 44');
    expect(hook).toContain('viewport.height - marginY - 44');
  });
});
