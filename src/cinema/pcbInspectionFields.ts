import type { SceneFieldDescriptor } from './sceneField';
import { PCB_COMPONENT_KINDS, PCB_COMPONENT_KIND_LABELS, PCB_DEFECT_CODES, PCB_DEFECT_LABELS, PCB_INSPECTION_PROCESSES, PCB_INSPECTION_PROCESS_LABELS } from './pcbInspectionData';

export const PCB_COMPONENT_FIELDS: readonly SceneFieldDescriptor[] = [
  { field: 'id', label: '부품 ID', kind: 'text' },
  { field: 'label', label: '부품명', kind: 'text' },
  { field: 'partNumber', label: '품번', kind: 'text' },
  { field: 'kind', label: '부품 종류', kind: 'text', allowedValues: PCB_COMPONENT_KINDS, valueLabels: PCB_COMPONENT_KIND_LABELS },
  ...['x', 'y', 'rotation', 'width', 'height', 'depth'].map(field => ({ field, label: field, kind: 'number' as const, unit: field === 'rotation' ? '°' : 'mm' })),
  { field: 'defect', label: '불량', kind: 'text', allowedValues: PCB_DEFECT_CODES, valueLabels: PCB_DEFECT_LABELS, patchable: true, aliases: /불량|판정|defect/, default: true },
  { field: 'process', label: '검사공정', kind: 'text', allowedValues: PCB_INSPECTION_PROCESSES, valueLabels: PCB_INSPECTION_PROCESS_LABELS, patchable: true, aliases: /검사\s*공정|검사\s*단계|process/ },
];
export const PCB_INSPECTION_FIELDS = PCB_COMPONENT_FIELDS;
