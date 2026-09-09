'use client';

import { VOICE_GENDERS, type VoiceGender } from './jarvisVoiceGender';
import styles from './jarvisVoiceMode.module.css';

/** The only voice choice: male or female. Shared by the realtime session and the browser engine. */
export function JarvisVoiceGenderToggle({ gender, disabled, onChange }: { gender: VoiceGender; disabled?: boolean; onChange: (gender: VoiceGender) => void }) {
  return <div className={styles.row} role="group" aria-label="목소리" data-voice-gender-toggle>
    <span className={styles.label}>목소리</span>
    {VOICE_GENDERS.map(option => <button key={option.id} type="button" className={styles.option} aria-pressed={gender === option.id}
      disabled={disabled} data-gender={option.id} title={option.persona}
      onClick={() => { if (gender !== option.id) onChange(option.id); }}>{option.label}</button>)}
  </div>;
}
