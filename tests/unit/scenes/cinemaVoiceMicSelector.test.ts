import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JarvisChatTools } from '@/cinema/JarvisChatTools';
import type { FilmCamera } from '@/cinema/useFilmCamera';

const camera = { status: 'off', frameRef: { current: null }, stop() {}, start: async () => {} } as unknown as FilmCamera;

describe('selector-driven center microphone', () => {
  it('renders the exact Realtime action supplied by the selected mode', () => {
    const html = renderToStaticMarkup(createElement(JarvisChatTools, {
      camera, input: '', onInput() {},
      mic: { active: false, disabled: false, label: 'OpenAI Realtime 대화 시작', title: 'OpenAI Realtime 대화 시작', toggle() {} },
    }));
    expect(html).toContain('aria-label="OpenAI Realtime 대화 시작"');
    expect(html).toContain('aria-pressed="false"');
  });

  it('renders local dictation state without owning dictation policy', () => {
    const html = renderToStaticMarkup(createElement(JarvisChatTools, {
      camera, input: '', onInput() {},
      mic: { active: true, disabled: false, label: '로컬 음성입력 종료', title: '로컬 음성입력 종료', toggle() {} },
    }));
    expect(html).toContain('aria-label="로컬 음성입력 종료"');
    expect(html).toContain('aria-pressed="true"');
  });
});
