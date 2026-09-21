import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { FilmQuickMenu } from '@/cinema/FilmQuickMenu';

describe('scene quick menu', () => {
  it('exposes the shared stop, start, restart and speed actions in the upper-right menu', () => {
    const player = { ready: true, playing: true, speed: 1, position: { chapter: { id: 'wave' } }, pause: vi.fn(), play: vi.fn(), restart: vi.fn(), changeSpeed: vi.fn(), selectChapter: vi.fn() } as never;
    const html = renderToStaticMarkup(createElement(FilmQuickMenu, { player }));
    expect(html).toContain('aria-label="공통메뉴"');
    expect(html).toContain('중지');
    expect(html).toContain('시작');
    expect(html).toContain('새로고침');
    expect(html).toContain('빠르게');
    expect(html).toContain('느리게');
    expect(html).toContain('이전 연출');
    expect(html).toContain('다음 연출');
    expect(html).toContain('data-scene-navigation="previous"');
    expect(html).toContain('data-scene-navigation="next"');
    const css = readFileSync(new URL('../../../src/cinema/filmQuickMenu.module.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.menu\s*{[\s\S]*?position:fixed[\s\S]*?top:/);
    expect(css).toMatch(/\.menu\s*{[\s\S]*?right:/);
  });
});
