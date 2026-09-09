'use client';

import { AI_VOICE_MODES, type AiVoiceMode } from './aiConfig';
import styles from './jarvisVoiceMode.module.css';

/**
 * Quick switch for how HATCHERY listens and speaks: OpenAI's realtime voice session, or the
 * browser's own recognition and synthesis around the text model. Mirrors the AI settings screen.
 */
export function JarvisVoiceModeToggle({ mode, realtimeAvailable, busy, onChange }: {
  mode: AiVoiceMode | null; realtimeAvailable: boolean; busy: boolean; onChange: (mode: AiVoiceMode) => void;
}) {
  return <div className={styles.row} role="group" aria-label="음성 방식" data-voice-mode-toggle>
    <span className={styles.label}>음성 방식</span>
    {AI_VOICE_MODES.map(option => {
      const unavailable = option.id === 'realtime' && !realtimeAvailable;
      return <button key={option.id} type="button" className={styles.option} aria-pressed={mode === option.id}
        disabled={busy || unavailable || mode === null} data-mode={option.id}
        title={unavailable ? 'OpenAI API 키가 없어 Realtime을 쓸 수 없습니다. AI 설정에서 키를 저장하세요.' : option.hint}
        onClick={() => { if (mode !== option.id) onChange(option.id); }}>
        {option.id === 'realtime' ? 'OpenAI Realtime' : '브라우저 음성'}
      </button>;
    })}
  </div>;
}
