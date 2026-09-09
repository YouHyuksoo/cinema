import { JarvisVoiceGenderToggle } from './JarvisVoiceGenderToggle';
import { voiceGenderOption, type VoiceGender } from './jarvisVoiceGender';
import styles from './jarvis.module.css';

interface Props {
  gender: VoiceGender; active: boolean;
  onGender(value: VoiceGender): void;
}
/** Keep the voice panel limited to the two shared voice presets. */
export function JarvisAiVoiceSettings({ gender, active, onGender }: Props) {
  return <details className={styles.voiceSettings} open>
    <summary>목소리 · {voiceGenderOption(gender).label}</summary>
    <JarvisVoiceGenderToggle gender={gender} disabled={active} onChange={onGender} />
  </details>;
}
