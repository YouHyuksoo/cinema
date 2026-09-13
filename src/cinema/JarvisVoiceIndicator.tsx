'use client';

import type { RefObject } from 'react';
import type { JarvisAudioFrame, JarvisPhase } from './jarvisAudio';
import { JARVIS_PHASE_LABELS } from './jarvisAudio';
import type { FilmThemeId } from './filmThemes';
import { JarvisWave } from './JarvisWave';
import styles from './jarvisVoiceIndicator.module.css';

export function JarvisVoiceIndicator({ audio, phase, theme, onStop }: {
  audio: RefObject<JarvisAudioFrame>; phase: JarvisPhase; theme: FilmThemeId; onStop(): void;
}) {
  const label = JARVIS_PHASE_LABELS[phase];
  return <aside className={styles.indicator} data-voice-indicator data-phase={phase} aria-label={`음성 연결 상태: ${label}`}>
    <button type="button" className={styles.control} aria-label={`${label}. 음성 연결 종료`} title="음성 연결 종료" onClick={onStop}>
      <JarvisWave audio={audio} theme={theme} compact />
      <span className={styles.state} role="status"><i aria-hidden="true" />{label}</span>
    </button>
  </aside>;
}
