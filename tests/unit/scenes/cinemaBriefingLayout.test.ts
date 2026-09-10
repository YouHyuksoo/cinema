import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FilmBriefing } from '@/cinema/FilmBriefing';

describe('persistent lower-center briefing', () => {
  it('reserves one briefing panel with an honest waiting state', () => {
    const html = renderToStaticMarkup(createElement(FilmBriefing, { text: '', source: '' }));
    expect(html).toContain('aria-label="텍스트 브리핑"');
    expect(html).toContain('브리핑 대기 중');
  });
  it('shows one header line: the title left and the state right, with the dialogue heading hidden', () => {
    const waiting = renderToStaticMarkup(createElement(FilmBriefing, { text: '', source: '' }));
    expect(waiting).toContain('<header><span>TEXT / BRIEFING</span><span data-briefing-status');
    expect(waiting).toContain('role="status">브리핑 대기</span></header>');
    expect(waiting).not.toContain('<span>텍스트 브리핑</span>');
    const summary = renderToStaticMarkup(createElement(FilmBriefing, { text: '라인 정상.', source: '현장 요약' }));
    expect(summary).toContain('role="status">현장 요약</span>');
    const css = readFileSync('src/cinema/filmBriefing.module.css', 'utf8');
    expect(css).toContain('.panel small { display:none; }');
  });
  it('reuses the paged reply without generating or fetching content', () => {
    const html = renderToStaticMarkup(createElement(FilmBriefing, { text: '현장 분석 '.repeat(70), source: '현장 요약' }));
    expect(html).toContain('현장 분석');
    expect(html).toContain('다음 응답 페이지');
  });
  it('uses the same reserved inset for canvas rendering and pointer picking', () => {
    for (const file of ['useFilmPlayback.ts', 'SmtFactoryExplorer.tsx', 'EnvironmentZoneInteraction.tsx']) {
      expect(readFileSync(`src/cinema/${file}`, 'utf8')).toContain("getPropertyValue('--film-content-inset')");
    }
    const css = readFileSync('src/cinema/film.module.css', 'utf8');
    expect(css).toContain('@property --film-content-inset');
    expect(css).toContain('--film-content-inset:calc(var(--film-briefing-offset) + var(--film-briefing-height) + 28px)');
  });
});
