import type { useJarvisSpeechProfile } from './useJarvisSpeechProfile';
import { isKnownMaleVoice } from './jarvisSpeechProfile';
import styles from './jarvis.module.css';

export function JarvisVoiceSettings({ profile }: { profile: ReturnType<typeof useJarvisSpeechProfile> }) {
  return <details className={styles.voiceSettings}>
    <summary>목소리 설정 · 저음 로봇</summary>
    <label>응답 목소리
      <select value={profile.voiceURI} onChange={event => profile.select(event.target.value)}>
        <option value="">자동 · 한국어 남성 우선</option>
        {profile.voices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name}</option>)}
      </select>
    </label>
    <p>현재 음성: {profile.selected?.name ?? '브라우저 기본 한국어'} · 음높이 0.72 · 속도 0.94</p>
    {!profile.voiceURI && !profile.voices.some(isKnownMaleVoice) && <p>목록에서 한국어 남성 음성을 확인하지 못했습니다. 현재 한국어 음성에 저음 설정을 적용합니다.</p>}
  </details>;
}
