export const MACHINE_SUBJECTS = ['pcb', 'car'] as const;
export type MachineSubject = typeof MACHINE_SUBJECTS[number];
export const DEFAULT_MACHINE_SUBJECT: MachineSubject = 'pcb';

export const MACHINE_PRESENTATIONS = {
  pcb: { title: 'PCB 불량 분석', subtitle: '고정 투명 기판 · 불량 부품 포커스 · 검사 정보' },
  car: { title: '자동차 분석', subtitle: '레이싱카 · 파워유닛 · 서스펜션 · 브레이크' },
} as const;
export const isMachineSubject = (value: unknown): value is MachineSubject => value === 'pcb' || value === 'car';
