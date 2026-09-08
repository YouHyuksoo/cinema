import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FilmChapterMenu } from '@/cinema/FilmChapterMenu';
import { FILM_CHAPTERS } from '@/cinema/filmProgram';

const render = (menuOpen: boolean) => renderToStaticMarkup(createElement(FilmChapterMenu, {
  active: null, disabled: false, onSelect() {}, menuOpen, onExpand() {},
}));

describe('collapsed chapter globe accessibility', () => {
  it('shares the Dracula pink palette between the open ring and collapsed globe', () => {
    const css = readFileSync(new URL('../../../src/cinema/filmMenuRing.module.css', import.meta.url), 'utf8');
    const globeCss = readFileSync(new URL('../../../src/cinema/filmMenuGlobe.module.css', import.meta.url), 'utf8');
    const palette = css.match(/\.menu\s*\{([^}]+)\}/)?.[1];
    expect(globeCss).not.toMatch(/--film-[\w-]+\s*:/);
    expect(palette).toBeDefined();
    expect(palette).toContain('--film-accent:#ff79c6');
    expect(palette).toContain('--film-accent-soft:#ffc2e5');
    expect(palette).toContain('--film-panel:#282a36');
    expect(palette).toContain('--film-muted:#d7b5d8');
    expect(palette).toContain('--film-bg:#191a21');
  });

  it('keeps one decorative globe face per chapter and only one expand button', () => {
    const html = render(false);
    for (const chapter of FILM_CHAPTERS) {
      expect(html.match(new RegExp(`data-globe-face="${chapter.id}"`, 'g'))).toHaveLength(1);
    }
    expect(html.match(/aria-label="하단 메뉴 펼치기"/g)).toHaveLength(1);
    expect(html).toMatch(/<button[^>]*aria-label="하단 메뉴 펼치기"[^>]*aria-expanded="false"[^>]*aria-controls="film-dock-panel"/);
    expect(html).toContain('드래그로 이동 · 눌러서 메뉴 펼치기');
    expect(html).toContain('data-globe-control="true"');
    expect(html).toMatch(/data-ring-controls="true"[^>]*inert=""[^>]*aria-hidden="true"/);
  });

  it('retains the existing chapter buttons and default open ring behavior', () => {
    const html = render(true);
    expect(html.match(/aria-describedby="film-ring-hint"/g)).toHaveLength(16);
    expect(html).toContain('aria-label="이전 메뉴로 회전"');
    expect(html).toContain('aria-label="다음 메뉴로 회전"');
    expect(html).toMatch(/data-ring-controls="true"[^>]*aria-hidden="false"/);
    expect(html).toMatch(/aria-label="하단 메뉴 펼치기"[^>]*aria-expanded="true"[^>]*aria-controls="film-dock-panel"[^>]*hidden=""/);
  });

  it('keeps only the sphere interactive while the closed dock occupies no nav tile', () => {
    const globeCss = readFileSync(new URL('../../../src/cinema/filmMenuGlobe.module.css', import.meta.url), 'utf8')
      .replace(/\s+/g, ' ');
    const ringCss = readFileSync(new URL('../../../src/cinema/filmMenuRing.module.css', import.meta.url), 'utf8')
      .replace(/\s+/g, ' ');
    expect(globeCss).toMatch(/\.layer\s*{[^}]*position:fixed[^}]*pointer-events:none/);
    expect(globeCss).toMatch(/\.expand\s*{[^}]*position:fixed[^}]*width:240px[^}]*touch-action:none/);
    expect(ringCss).toMatch(/\.menu\[data-menu-open=false\]\s*{[^}]*height:0[^}]*pointer-events:none/);
    expect(globeCss).toMatch(/\.expand\s*{[^}]*pointer-events:auto/);
  });
});
