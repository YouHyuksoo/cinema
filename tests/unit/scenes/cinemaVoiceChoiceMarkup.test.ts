import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JarvisAiVoiceSettings } from '@/cinema/JarvisAiVoiceSettings';
import { JarvisVoiceSettings } from '@/cinema/JarvisVoiceSettings';
import type { useJarvisSpeechProfile } from '@/cinema/useJarvisSpeechProfile';

function onlyGenderChoices(html: string) {
  expect(html.match(/<button\b/g)).toHaveLength(2);
  expect(html).toContain('남성');
  expect(html).toContain('여성');
  expect(html).not.toMatch(/<input|<select|로봇 효과|음높이|현재 음성|기본 음색/);
}

describe('minimal voice choice panel', () => {
  it('shows only gender choices for realtime audio', () => {
    onlyGenderChoices(renderToStaticMarkup(createElement(JarvisAiVoiceSettings, {
      gender: 'male', active: false, onGender() {},
    })));
  });
  it('keeps realtime gender locked during a session', () => {
    const html = renderToStaticMarkup(createElement(JarvisAiVoiceSettings, {
      gender: 'female', active: true, onGender() {},
    }));
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
  it('shows only gender choices for browser audio', () => {
    const profile = { gender: 'male', voices: [], selected: null, recognized: false, setGender() {} } as unknown as ReturnType<typeof useJarvisSpeechProfile>;
    onlyGenderChoices(renderToStaticMarkup(createElement(JarvisVoiceSettings, { profile })));
  });
});
