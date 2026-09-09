import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JarvisMain } from '@/cinema/JarvisMain';
import { SignalFilm } from '@/cinema/SignalFilm';
import type { FilmCamera } from '@/cinema/useFilmCamera';

describe('main stream responsibilities', () => {
  it('hosts the existing scene controls only in the left stream on the main page', () => {
    const html = renderToStaticMarkup(createElement(SignalFilm));
    const left = html.match(/<aside\b[^>]*data-side="left"[^>]*>[\s\S]*?<\/aside>/)?.[0];
    expect(left).toContain('aria-label="연출 설정"');
    expect(left).toContain('<summary>SCENE / 연출 설정</summary>');
    for (const label of ['색상 테마', '화면 질감', '질감 강도', '재생 속도', '거울 모드', '얼굴 확대']) expect(left).toContain(label);
    expect(html.match(/aria-label="연출 설정"/g)).toHaveLength(1);
    expect(html).not.toContain('aria-controls="film-playback-settings"');
  });
  it('keeps guidance/settings left and every operational analysis card right without duplicates', () => {
    const html = renderToStaticMarkup(createElement(JarvisMain, {
      camera: { status: 'off', frameRef: { current: null }, stop() {}, start: async () => {} } as unknown as FilmCamera,
      onChapter() {},
    }));
    const left = html.match(/<aside\b[^>]*data-side="left"[^>]*>[\s\S]*?<\/aside>/)?.[0];
    const right = html.match(/<aside\b[^>]*data-side="right"[^>]*>[\s\S]*?<\/aside>/)?.[0];
    expect(left).toBeDefined(); expect(right).toBeDefined();
    for (const title of ['SESSION / CONNECTIONS', 'AI / 모델 선택', 'VOICE / 대화 설정', 'GUIDE / 화면 안내', 'HELP / 조작 도움말']) {
      expect(left).toContain(title); expect(right).not.toContain(title);
    }
    expect(left!.indexOf('AI / 모델 선택')).toBeLessThan(left!.indexOf('VOICE / 대화 설정'));
    // Before the status arrives the AI block only points at the settings screen; the voice choice is male/female and nothing else.
    expect(left).toContain('href="/cinema/ai"');
    expect(left).toContain('data-voice-gender-toggle'); expect(left).toContain('>남성</button>'); expect(left).toContain('>여성</button>');
    for (const legacy of ['목소리 스타일', '기본 음색', '안드로이드형', 'CEDAR']) expect(html).not.toContain(legacy);
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
