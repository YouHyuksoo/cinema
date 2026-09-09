import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JarvisMain } from '@/cinema/JarvisMain';
import type { FilmCamera } from '@/cinema/useFilmCamera';

describe('main stream responsibilities', () => {
  it('keeps guidance/settings left and every operational analysis card right without duplicates', () => {
    const html = renderToStaticMarkup(createElement(JarvisMain, {
      camera: { status: 'off', frameRef: { current: null }, stop() {}, start: async () => {} } as unknown as FilmCamera,
      onChapter() {},
    }));
    const left = html.match(/<aside\b[^>]*data-side="left"[^>]*>[\s\S]*?<\/aside>/)?.[0];
    const right = html.match(/<aside\b[^>]*data-side="right"[^>]*>[\s\S]*?<\/aside>/)?.[0];
    expect(left).toBeDefined(); expect(right).toBeDefined();
    for (const title of ['SESSION / CONNECTIONS', 'VOICE / 대화 설정', 'GUIDE / 화면 안내', 'HELP / 조작 도움말']) {
      expect(left).toContain(title); expect(right).not.toContain(title);
    }
    for (const title of ['CHANNELS / 현장 게이지', 'PRODUCTION / 생산 진행', 'PROCESS / 공정 흐름', 'QUEUE / 병목 대기', 'QUALITY / 공정 품질', 'ENERGY / 전력·효율', 'INSPECTION / 제품 검사']) {
      expect(right).toContain(title); expect(left).not.toContain(title);
      expect(html.split(title)).toHaveLength(2);
    }
    expect(right).toContain('온도 이탈 알림');
    expect(left).toContain('현장 요약');
    expect(right).toContain('생산·에너지 연출');
    expect(right).toContain('공정망 살펴보기');
  });
});
