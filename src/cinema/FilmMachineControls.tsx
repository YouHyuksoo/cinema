import { isMachineSubject, type MachineSubject } from './machinePresentation';
import styles from './film.module.css';

export function FilmMachineControls({ subject, disabled, onChange }: {
  subject: MachineSubject; disabled: boolean; onChange: (subject: MachineSubject) => void;
}) {
  return <fieldset className={styles.textureRow}>
    <legend>분석 대상</legend>
    <label className={styles.speedControl}>
      <span>장면 선택</span>
      <select value={subject} disabled={disabled} onChange={event => {
        if (isMachineSubject(event.target.value)) onChange(event.target.value);
      }}>
        <option value="pcb">PCB 불량 분석 (기본)</option>
        <option value="car">자동차</option>
      </select>
    </label>
    <span className={styles.textureDescription}>자동 전환 없음 · 선택한 대상만 재생</span>
  </fieldset>;
}
