import type { JarvisPhase } from './jarvisAudio';
import styles from './jarvisIgnition.module.css';

interface Props {
  compact?: boolean;
  active: boolean;
  disabled: boolean;
  phase: JarvisPhase;
  onToggle(): void;
  onInterrupt(): void;
}

const STATUS: Record<JarvisPhase, string> = {
  idle: 'STANDBY', requesting: 'INITIALIZING', listening: 'LISTENING',
  thinking: 'PROCESSING', speaking: 'VOICE ACTIVE', error: 'CHECK SYSTEM',
};

export function JarvisIgnition({ active, disabled, phase, onToggle, onInterrupt, compact = false }: Props) {
  const busy = phase === 'thinking' || phase === 'speaking';
  return <div className={styles.control} data-active={active} data-phase={phase} data-compact={compact}>
    <div className={styles.socket}>
      <div className={styles.halo} aria-hidden="true" />
      <button type="button" className={styles.ignition} disabled={disabled} onClick={onToggle}
        aria-label={active ? '대화 종료' : '대화 시작'} aria-pressed={active}>
        <svg className={styles.power} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 2v10M6 5a9 9 0 1 0 12 0" />
        </svg>
        <strong>{active ? 'STOP' : 'START'}</strong>
        <small>HATCHERY</small>
        <i aria-hidden="true" />
      </button>
    </div>
    <div className={styles.bridge} aria-hidden="true"><i /><i /><i /></div>
    <svg className={styles.gauge} viewBox="0 0 80 80" aria-hidden="true" focusable="false">
      <circle className={styles.rail} cx="40" cy="40" r="37" />
      <g className={styles.ticks}>{Array.from({ length: 32 }, (_, index) =>
        <path key={index} d={index % 4 === 0 ? 'M40 7v6' : 'M40 7v3'} transform={`rotate(${index * 11.25} 40 40)`} />)}</g>
      <g className={styles.rotor}>
        <circle cx="40" cy="40" r="25" strokeDasharray="54 103" />
        <circle className={styles.counter} cx="40" cy="40" r="19" strokeDasharray="25 94" />
      </g>
      <g className={styles.needle}><path d="M40 44V17" /><circle cx="40" cy="17" r="1.5" /></g>
      <circle className={styles.hub} cx="40" cy="40" r="4" />
    </svg>
    <div className={styles.status}>
      <span><i />{STATUS[phase]}</span>
      <small>{phase === 'listening' ? 'MIC INPUT / 실제 수신 파형' : phase === 'speaking' ? 'VOICE OUTPUT / 응답 연출' : 'HATCHERY / VOICE SYSTEM'}</small>
      {busy && <button type="button" className={styles.interrupt} onClick={onInterrupt}>응답 중지</button>}
    </div>
  </div>;
}
