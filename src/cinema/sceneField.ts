/**
 * Field descriptors: the expected format of one value on a scene object. Format (kind, unit,
 * range, decimals) lives here; per-object numbers such as targets and ranges live in the data.
 */
export type SceneFieldKind = 'number' | 'number[]' | 'text';
export interface SceneFieldDescriptor {
  field: string;
  label: string;
  kind: SceneFieldKind;
  unit?: string;
  min?: number;
  max?: number;
  /** Fraction digits when formatting numbers. */
  decimals?: number;
  /** Fixed length for number lists. */
  length?: number;
  /** May be changed through object patches (HATCHERY, push feeds). */
  patchable?: boolean;
  /** Spoken aliases for HATCHERY command resolution. */
  aliases?: RegExp;
  /** Field assumed when a command names the object but no field. */
  default?: boolean;
  /** May be absent from documents (contract columns marked 선택). */
  optional?: boolean;
  /** Column description for the generated contract tables. */
  description?: string;
  /** Accepted text codes and their display names, shared by validation and consumers. */
  allowedValues?: readonly string[];
  valueLabels?: Readonly<Record<string, string>>;
}
export type SceneFieldResult = { ok: true; value: unknown } | { ok: false; reason: string };

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const fail = (reason: string): SceneFieldResult => ({ ok: false, reason });

export function validateSceneField(descriptor: SceneFieldDescriptor, value: unknown): SceneFieldResult {
  const { label, kind, min, max, length } = descriptor;
  if (kind === 'text') {
    if (descriptor.allowedValues && (typeof value !== 'string' || !descriptor.allowedValues.includes(value))) return fail(`${label}은 ${descriptor.allowedValues.join(', ')} 중 하나여야 합니다.`);
    return typeof value === 'string' && value.trim() ? { ok: true, value } : fail(`${label}은 비어 있지 않은 문자열이어야 합니다.`);
  }
  if (kind === 'number[]') {
    if (!Array.isArray(value) || !value.length || !value.every(finite)) return fail(`${label}은 숫자 목록이어야 합니다.`);
    if (length !== undefined && value.length !== length) return fail(`${label}은 숫자 ${length}개여야 합니다.`);
    if (min !== undefined && value.some(item => item < min)) return fail(`${label}은 ${min} 이상이어야 합니다.`);
    if (max !== undefined && value.some(item => item > max)) return fail(`${label}은 ${max} 이하여야 합니다.`);
    return { ok: true, value };
  }
  if (!finite(value)) return fail(`${label}은 숫자여야 합니다.`);
  if (min !== undefined && value < min) return fail(`${label}은 ${min} 이상이어야 합니다.`);
  if (max !== undefined && value > max) return fail(`${label}은 ${max} 이하여야 합니다.`);
  return { ok: true, value };
}

export function formatSceneField(descriptor: SceneFieldDescriptor, value: unknown): string {
  const unit = descriptor.unit ?? '';
  const number = (item: number) => item.toLocaleString('en-US', { minimumFractionDigits: descriptor.decimals ?? 0, maximumFractionDigits: descriptor.decimals ?? 3 });
  if (descriptor.kind === 'number[]') return Array.isArray(value) ? value.filter(finite).map(number).join(', ') : '—';
  if (descriptor.kind === 'text') return typeof value === 'string' ? descriptor.valueLabels?.[value] ?? value : '—';
  return finite(value) ? `${number(value)}${unit}` : '—';
}

/** Checks the declared fields present on an object; undeclared keys are left alone. */
export function validateSceneObjectFields(descriptors: readonly SceneFieldDescriptor[], raw: Record<string, unknown>,
  options: { required?: boolean } = {}): { ok: true } | { ok: false; reason: string } {
  for (const descriptor of descriptors) {
    const present = Object.prototype.hasOwnProperty.call(raw, descriptor.field);
    if (!present) {
      if (options.required && !descriptor.optional) return { ok: false, reason: `${descriptor.label}(${descriptor.field}) 값이 없습니다.` };
      continue;
    }
    const result = validateSceneField(descriptor, raw[descriptor.field]);
    if (!result.ok) return result;
  }
  return { ok: true };
}
