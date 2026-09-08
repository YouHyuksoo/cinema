import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JarvisMainHeader } from '@/cinema/JarvisMainHeader';
import { JarvisIgnition } from '@/cinema/JarvisIgnition';
import type { FilmCamera } from '@/cinema/useFilmCamera';

describe('header voice ignition', () => {
  it('renders the HATCHERY logo after START in the voice control, before metrics', () => {
    const html = renderToStaticMarkup(createElement(JarvisMainHeader, {
      camera: { status: 'off', frameRef: { current: null }, stop() {}, start: async () => {} } as unknown as FilmCamera,
      ignition: createElement('button', null, 'START TEST'),
    }));
    expect(html.match(/START TEST/g)).toHaveLength(1);
    expect(html).toContain('aria-label="START 아래 HATCHERY 로고"');
    expect(html.includes('움직이는 나침반과 방위각 눈금')).toBe(false);
    expect(html.includes('AZIMUTH / DEMO')).toBe(false);
    expect(html.indexOf('HATCHERY 핑크 네온 로고')).toBeGreaterThan(html.indexOf('HATCHERY 음성 제어'));
    expect(html.indexOf('START TEST')).toBeLessThan(html.indexOf('HATCHERY 핑크 네온 로고'));
    expect(html.indexOf('HATCHERY 핑크 네온 로고')).toBeLessThan(html.indexOf('상단 주요 지표'));
    expect(html.indexOf('START TEST')).toBeLessThan(html.indexOf('상단 주요 지표'));
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
