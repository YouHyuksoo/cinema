import { JARVIS_REALTIME_VOICES } from './jarvisAudio';
import { ROBOT_VOICE_STYLES, type RobotVoiceSettings, type RobotVoiceStyle } from './robotVoice';
import styles from './jarvis.module.css';

interface Props {
  voice: string; active: boolean; effect: RobotVoiceSettings;
  onVoice(value: string): void; onEffect(value: RobotVoiceSettings): void;
}
export function JarvisAiVoiceSettings({ voice, active, effect, onVoice, onEffect }: Props) {
  const selected = ROBOT_VOICE_STYLES.find(style => style.id === effect.style)!;
  return <details className={styles.voiceSettings} open>
    <summary>목소리 선택 · {selected.label}</summary>
    <label>목소리 스타일<select value={effect.style} onChange={event => onEffect({ ...effect, style: event.target.value as RobotVoiceStyle })}>
      {ROBOT_VOICE_STYLES.map(style => <option key={style.id} value={style.id}>{style.label}</option>)}
    </select></label>
    <p>{selected.description}</p>
    <label className={styles.effectStrength}>로봇 효과 강도
      <input type="range" min={0} max={100} step={5} value={Math.round(effect.strength * 100)} disabled={effect.style === 'natural'}
        aria-valuetext={`${Math.round(effect.strength * 100)}%`} onChange={event => onEffect({ ...effect, strength: Number(event.target.value) / 100 })} />
      <output>{Math.round(effect.strength * 100)}%</output>
    </label>
    <label>기본 음색<select value={voice} disabled={active} onChange={event => onVoice(event.target.value)}>
      {JARVIS_REALTIME_VOICES.map(name => <option key={name} value={name}>{name.toUpperCase()}</option>)}
    </select></label>
    <p>스타일·강도는 대화 중 즉시 적용됩니다. 기본 음색은 대화 종료 후 바꿀 수 있습니다.</p>
  </details>;
}
