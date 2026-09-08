import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JarvisAiStatus, type JarvisAiConnection } from '@/cinema/JarvisAiStatus';

const base: JarvisAiConnection = { configured: true, connected: false, realtimeActive: false, error: '', statusError: '',
  models: { text: 'configured-text-model', realtime: 'configured-voice-model' } };
const render = (override: Partial<JarvisAiConnection> = {}) => renderToStaticMarkup(createElement(JarvisAiStatus, { connection: { ...base, ...override } }));
describe('AI footer status', () => {
  it('shows server model names without claiming an idle configuration is connected', () => {
    const html = render();
    expect(html).toContain('AI 연결 대기 · 설정됨');
    expect(html).toContain('configured-text-model');
    expect(html).toContain('configured-voice-model');
    expect(html).not.toContain('AI 음성 연결됨');
  });
  it.each([
    [{ configured: null }, 'checking'],
    [{ configured: false }, 'local'],
    [{ statusError: '조회 실패' }, 'unavailable'],
    [{ realtimeActive: true }, 'connecting'],
    [{ realtimeActive: true, connected: true }, 'connected'],
    [{ error: '연결 오류' }, 'error'],
  ] as const)('distinguishes connection states: %s', (props, state) => {
    expect(render(props)).toContain(`data-state="${state}"`);
  });
  it('does not invent missing model names or display unused AI models in local mode', () => {
    expect(render({ models: { text: null, realtime: null } })).toContain('확인되지 않음');
    const html = render({ configured: false, realtimeActive: true });
    expect(html).toContain('AI 모델 미사용');
    expect(html).not.toContain('configured-voice-model');
    expect(html).not.toContain('AI 음성 연결됨');
  });
});
