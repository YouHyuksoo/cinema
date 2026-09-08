import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JarvisMainHeader } from '@/cinema/JarvisMainHeader';
import { JarvisIgnition } from '@/cinema/JarvisIgnition';
import { JarvisMain } from '@/cinema/JarvisMain';
import type { FilmCamera } from '@/cinema/useFilmCamera';

describe('full-width metrics and center controls', () => {
  it('reserves the header for metrics only', () => {
    const html = renderToStaticMarkup(createElement(JarvisMainHeader));
    expect(html.includes('START TEST')).toBe(false);
    expect(html.match(/<article /g)).toHaveLength(8);
    expect(html.includes('HATCHERY 핑크 네온 로고')).toBe(false);
    expect(html.includes('내 영상 연결')).toBe(false);
    expect(html.includes('움직이는 나침반과 방위각 눈금')).toBe(false);
    expect(html.includes('AZIMUTH / DEMO')).toBe(false);
  });
  it('keeps a single start, camera and logo within the central conversation', () => {
    const html = renderToStaticMarkup(createElement(JarvisMain, {
      camera: { status: 'off', frameRef: { current: null }, stop() {}, start: async () => {} } as unknown as FilmCamera,
      onChapter() {},
    }));
    expect(html.match(/aria-label="대화 시작"/g)).toHaveLength(1);
    expect(html.match(/aria-label="HATCHERY 핑크 네온 로고"/g)).toHaveLength(1);
    expect(html.match(/내 영상 연결/g)).toHaveLength(1);
    expect(html.includes('aria-label="중앙 좌측 하단 HATCHERY 로고"')).toBe(true);
    expect(html.includes('aria-label="AI 연결 상태와 모델"')).toBe(true);
    expect(html.includes('aria-label="중앙 상태 메시지"')).toBe(true);
    expect(html.indexOf('aria-label="대화 시작"')).toBeGreaterThan(html.indexOf('aria-label="중앙 음성 대화"'));
    expect(html.indexOf('내 영상 연결')).toBeGreaterThan(html.indexOf('aria-label="중앙 음성 대화"'));
  });
  it('keeps compact start, stop and interrupt semantics', () => {
    const props = { compact: true, active: false, disabled: true, phase: 'idle' as const, onToggle() {}, onInterrupt() {} };
    const idle = renderToStaticMarkup(createElement(JarvisIgnition, props));
    expect(idle).toContain('data-compact="true"');
    expect(idle).toContain('aria-label="대화 시작"');
    expect(idle).toContain('disabled=""');
    const busy = renderToStaticMarkup(createElement(JarvisIgnition, { ...props, active: true, disabled: false, phase: 'speaking' }));
    expect(busy).toContain('aria-label="대화 종료"');
    expect(busy).toContain('응답 중지');
  });
});
