'use client';

import type { RefObject } from 'react';
import type { JarvisAudioFrame, JarvisPhase } from './jarvisAudio';
import { JARVIS_PHASE_LABELS } from './jarvisAudio';
import type { FilmThemeId } from './filmThemes';
import type { AiVoiceMode } from './aiConfig';
import { JarvisWave } from './JarvisWave';
import styles from './jarvisVoiceIndicator.module.css';

export function JarvisVoiceIndicator({ active, mode, audio, phase, theme, onStop }: {
  active: boolean; mode: AiVoiceMode | null; audio: RefObject<JarvisAudioFrame>; phase: JarvisPhase; theme: FilmThemeId; onStop(): void;
}) {
  const modeLabel = mode === 'realtime' ? 'AI 음성' : mode === 'browser' ? '로컬 음성' : '음성';
  const label = active ? JARVIS_PHASE_LABELS[phase] : `${modeLabel} 대기`;
  return <aside className={styles.indicator} data-voice-indicator data-active={active} data-phase={active ? phase : 'idle'} aria-label={`음성 연결 상태: ${label}`}>
    <button type="button" className={styles.control} aria-label={active ? `${label}. 음성 연결 종료` : `${label}. 터빈의 AI대화에서 시작`} title={active ? '음성 연결 종료' : '터빈의 AI대화에서 음성인식 시작'} disabled={!active} onClick={onStop}>
      <JarvisWave audio={audio} theme={theme} compact />
      <span className={styles.state} role="status"><i aria-hidden="true" />{label}</span>
    </button>
  </aside>;
}
