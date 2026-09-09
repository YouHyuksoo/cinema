import { isMachineSubject, type MachineSubject } from './machinePresentation';
import { SelectField } from './FilmFields';
import styles from './film.module.css';

const SUBJECTS = [
  { value: 'pcb', label: 'PCB 불량 분석 (기본)' },
  { value: 'car', label: '자동차' },
] as const satisfies readonly { value: MachineSubject; label: string }[];

export function FilmMachineControls({ subject, disabled, onChange }: {
  subject: MachineSubject; disabled: boolean; onChange: (subject: MachineSubject) => void;
}) {
  return <fieldset className={styles.textureRow}>
    <legend>분석 대상</legend>
    <SelectField label="장면 선택" value={subject} options={SUBJECTS} disabled={disabled}
      onChange={value => { if (isMachineSubject(value)) onChange(value); }} />
    <span className={styles.textureDescription}>자동 전환 없음 · 선택한 대상만 재생</span>
  </fieldset>;
}
