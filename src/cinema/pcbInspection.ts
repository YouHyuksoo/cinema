import { DEFAULT_PCB_INSPECTION_DATA, type PcbInspectionData, type PcbComponent } from './pcbInspectionData';
import { PCB_COMPONENT_FIELDS } from './pcbInspectionFields';
import { validateSceneObjectFields } from './sceneField';
import { clamp01 as clamp, smoothstep as smooth } from './filmMath';

export const PCB_INSPECTION_SECONDS = 36;
export const PCB_INSPECTION_TIMING = { scanEnd: 4, inspectEnd: 28, summaryEnd: 34.5, end: PCB_INSPECTION_SECONDS, approachFraction: 0.25, retreatFraction: 0.25 } as const;
export type PcbInspectionValidation = { valid: true } | { valid: false; reason: string };
export type PcbInspectionState = ReturnType<typeof pcbInspectionState>;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

export function validatePcbInspectionData(data: unknown): PcbInspectionValidation {
  const invalid = (reason: string): PcbInspectionValidation => ({ valid: false, reason });
  if (!record(data)) return invalid('PCB 데이터는 객체여야 합니다.');
  if (!['name', 'serial'].every(key => typeof data[key] === 'string' && (data[key] as string).trim())) return invalid('PCB 이름과 시리얼이 필요합니다.');
  if (![data.width, data.height, data.thickness].every(positive)) return invalid('PCB 치수는 유한한 양수여야 합니다.');
  if (!Array.isArray(data.components)) return invalid('부품 목록이 필요합니다.');
  const ids = new Set<string>();
  for (const raw of data.components) {
    if (!record(raw)) return invalid('부품은 객체여야 합니다.');
    const fields = validateSceneObjectFields(PCB_COMPONENT_FIELDS, raw, { required: true });
    if (!fields.ok) return invalid(fields.reason);
    const component = raw as unknown as PcbComponent;
    if (ids.has(component.id.trim().toUpperCase())) return invalid(`중복 부품 ID: ${component.id}`);
    ids.add(component.id.trim().toUpperCase());
    if (![component.width, component.height, component.depth].every(positive)) return invalid(`부품 치수 오류: ${component.id}`);
    const angle = component.rotation % 360 * Math.PI / 180;
    const halfWidth = (Math.abs(Math.cos(angle)) * component.width + Math.abs(Math.sin(angle)) * component.height) / 2;
    const halfHeight = (Math.abs(Math.sin(angle)) * component.width + Math.abs(Math.cos(angle)) * component.height) / 2;
    if (Math.abs(component.x) + halfWidth > (data.width as number) / 2 + 1e-9 || Math.abs(component.y) + halfHeight > (data.height as number) / 2 + 1e-9) return invalid(`PCB 경계를 벗어난 부품: ${component.id}`);
  }
  return { valid: true };
}

export function pcbInspectionState(time: number, data: PcbInspectionData = DEFAULT_PCB_INSPECTION_DATA) {
  const t = Number.isFinite(time) ? Math.max(0, Math.min(PCB_INSPECTION_SECONDS, time)) : 0;
  const validation = validatePcbInspectionData(data);
  const components = validation.valid ? data.components : [];
  const failedComponents = components.filter(component => component.defect !== 'none' && component.defect !== 'uninspected');
  const counts = { total: components.length, pass: components.filter(component => component.defect === 'none').length,
    fail: failedComponents.length, uninspected: components.filter(component => component.defect === 'uninspected').length };
  const phase: 'scan' | 'inspect' | 'summary' | 'fade' = t < 4 ? 'scan' : t < 28 ? 'inspect' : t < 34.5 ? 'summary' : 'fade';
  let selectedComponent: PcbComponent | null = null;
  let focus = 0;
  if (phase === 'inspect' && failedComponents.length) {
    const slot = (t - 4) / 24 * failedComponents.length;
    selectedComponent = failedComponents[Math.min(Math.floor(slot), failedComponents.length - 1)];
    const progress = slot % 1;
    focus = smooth(progress / PCB_INSPECTION_TIMING.approachFraction) * smooth((1 - progress) / PCB_INSPECTION_TIMING.retreatFraction);
  }
  return { validation, counts, failedComponents, selectedComponent, focus,
    presence: smooth(t / 0.8) * (1 - smooth((t - 34.5) / 1.5)), scan: clamp(t / 4), phase, time: t };
}
