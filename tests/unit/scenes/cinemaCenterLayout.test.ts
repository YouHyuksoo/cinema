import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JarvisCenterLayoutView } from '@/cinema/JarvisCenterLayout';
import { JarvisAiStatus } from '@/cinema/JarvisAiStatus';
import type { FilmCamera } from '@/cinema/useFilmCamera';

const camera = { status: 'off', start: async () => {}, stop() {} } as unknown as FilmCamera;
const render = (background: 'classic' | 'neon-hud') => renderToStaticMarkup(createElement(JarvisCenterLayoutView, {
  camera, background, onBackgroundChange() {}, ignition: createElement('button', null, 'START'),
  heading: '대화 준비', visual: createElement('canvas', { 'aria-label': 'test-reactor' }),
  form: createElement('input', { 'aria-label': '질문' }), aiStatus: createElement(JarvisAiStatus, { connection: {
    configured: true, connected: false, realtimeActive: false, error: '', statusError: '',
    models: { text: 'text-model', realtime: 'voice-model' },
  } }),
}, '답변'));

describe('central background layouts', () => {
  it.each(['classic', 'neon-hud'] as const)('offers both styles and exactly one reactor/camera/START in %s', background => {
    const html = render(background);
    expect(html).toContain('중앙 배경');
    expect(html).toContain('value="classic"'); expect(html).toContain('value="neon-hud"');
    expect(html.match(/aria-label="test-reactor"/g)).toHaveLength(1);
    expect(html.match(/aria-label="운영자 카메라 대기"/g)).toHaveLength(1);
    expect(html.match(/>START</g)).toHaveLength(1);
    expect(html.match(/<select\b/g)).toHaveLength(1);
    expect(html).toContain('text-model'); expect(html).toContain('voice-model');
    expect(html).toContain('aria-label="질문"');
  });
  it('preserves the original placement and has no neon backdrop in classic', () => {
    const html = render('classic');
    expect(html).toContain('aria-label="중앙 좌측 상단 음성 제어"');
    expect(html).not.toContain('data-center-backdrop="neon-hud"');
    expect(html).not.toContain('data-hud-surface=');
    expect(html).toContain('aria-label="중앙 상단 배경 선택"');
  });
  it('places models upper-left, camera upper-right, START lower-left and background options lower-right', () => {
    const html = render('neon-hud');
    expect(html.match(/data-hud-surface="800x400"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="중앙 좌측 상단 AI 연결정보"');
    expect(html).toContain('aria-label="중앙 우측 상단 카메라"');
    expect(html).toContain('aria-label="중앙 좌측 하단 음성 제어"');
    expect(html).toContain('data-center-backdrop="neon-hud"');
    expect(html).toContain('aria-label="중앙 우측 하단 배경 선택"');
    expect(html).toContain('data-slot="options"');
    expect(html).not.toContain('data-slot="reserved"');
  });
});
