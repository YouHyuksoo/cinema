import { createElement, type RefObject } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { JarvisVoiceIndicator } from '@/cinema/JarvisVoiceIndicator';
import type { JarvisAudioFrame } from '@/cinema/jarvisAudio';

describe('scene voice connection indicator', () => {
  it('shows the live phase in a globe-sized corner reactor with an explicit stop control', () => {
    const audio = { current: { phase: 'listening', analyser: null } } as RefObject<JarvisAudioFrame>;
    const html = renderToStaticMarkup(createElement(JarvisVoiceIndicator, { active: true, mode: 'realtime', audio, phase: 'listening', theme: 'cyan', onStop() {} }));
    expect(html).toContain('data-voice-indicator="true"');
    expect(html).toContain('듣고 있어요. 음성 연결 종료');
    expect(html).toContain('회전하는 아크 리액터');
    const css = readFileSync('src/cinema/jarvisVoiceIndicator.module.css','utf8');
    expect(css).toContain('width:var(--hatchery-orb-diameter,120px)');
    expect(css).toContain('left:max(16px,env(safe-area-inset-left))');
  });
  it('stays mounted outside the main preview regardless of the voice connection', () => {
    const source = readFileSync('src/cinema/SignalFilm.tsx','utf8');
    expect(source).toContain('!preview && <JarvisVoiceIndicator active={turbine.voice.active} mode={turbine.voice.voiceMode}');
    expect(source).not.toContain('!preview && turbine.voice.active && <JarvisVoiceIndicator');
  });
  it('shows a disabled standby reactor when voice recognition is off', () => {
    const audio = { current: { phase: 'idle', analyser: null } } as RefObject<JarvisAudioFrame>;
    const html = renderToStaticMarkup(createElement(JarvisVoiceIndicator, { active: false, mode: 'browser', audio, phase: 'idle', theme: 'cyan', onStop() {} }));
    expect(html).toContain('data-active="false"');
    expect(html).toContain('로컬 음성 대기');
    expect(html).toContain('터빈의 AI대화에서 시작');
    expect(html).toContain('disabled=""');
  });
});
