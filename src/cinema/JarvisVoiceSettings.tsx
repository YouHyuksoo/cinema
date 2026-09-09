import type { useJarvisSpeechProfile } from './useJarvisSpeechProfile';
import { JarvisVoiceGenderToggle } from './JarvisVoiceGenderToggle';
import { voiceGenderOption } from './jarvisVoiceGender';
import styles from './jarvis.module.css';

/** Browser voice: male or female; the engine picks a Korean voice by name and applies the matching pitch/rate. */
export function JarvisVoiceSettings({ profile }: { profile: ReturnType<typeof useJarvisSpeechProfile> }) {
  const option = voiceGenderOption(profile.gender);
  return <details className={styles.voiceSettings}>
    <summary>목소리 · {option.label}</summary>
    <JarvisVoiceGenderToggle gender={profile.gender} onChange={profile.setGender} />
  </details>;
}
