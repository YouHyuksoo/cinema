import { describe, expect, it } from 'vitest';
import { formatSceneField, validateSceneField, validateSceneObjectFields, type SceneFieldDescriptor } from '@/cinema/sceneField';

const output: SceneFieldDescriptor = { field: 'value', label: '생산량', kind: 'number', min: 0, decimals: 0, patchable: true };
const humidity: SceneFieldDescriptor = { field: 'humidity', label: '습도', kind: 'number', unit: '%', min: 0, max: 100, decimals: 0 };
const temperature: SceneFieldDescriptor = { field: 'temperature', label: '온도', kind: 'number', unit: '°C', decimals: 1 };
const samples: SceneFieldDescriptor = { field: 'values', label: '측정값', kind: 'number[]', length: 5 };
const name: SceneFieldDescriptor = { field: 'name', label: '이름', kind: 'text' };

describe('scene field validation', () => {
  it('accepts finite numbers inside the declared range and rejects everything else', () => {
    expect(validateSceneField(output, 470)).toEqual({ ok: true, value: 470 });
    expect(validateSceneField(output, 0)).toEqual({ ok: true, value: 0 });
    for (const bad of [-1, NaN, Infinity, '470', null, undefined, [470]]) expect(validateSceneField(output, bad).ok).toBe(false);
    expect(validateSceneField(humidity, 101).ok).toBe(false);
    expect(validateSceneField(humidity, 100).ok).toBe(true);
    expect(validateSceneField(temperature, -12.5).ok).toBe(true);
  });

  it('accepts number lists of the declared length only', () => {
    expect(validateSceneField(samples, [1, 2, 3, 4, 5]).ok).toBe(true);
    expect(validateSceneField(samples, [1, 2, 3]).ok).toBe(false);
    expect(validateSceneField(samples, [1, 2, 3, 4, 'x']).ok).toBe(false);
    expect(validateSceneField(samples, 5).ok).toBe(false);
    expect(validateSceneField({ ...samples, length: undefined }, [1]).ok).toBe(true);
    expect(validateSceneField({ ...samples, length: undefined }, []).ok).toBe(false);
  });

  it('accepts non-blank text', () => {
    expect(validateSceneField(name, 'LINE 02')).toEqual({ ok: true, value: 'LINE 02' });
    expect(validateSceneField(name, '   ').ok).toBe(false);
    expect(validateSceneField(name, 3).ok).toBe(false);
  });

  it('names the field and the rule in the reason', () => {
    const result = validateSceneField(humidity, 120);
    expect(result.ok).toBe(false);
    if (!result.ok) { expect(result.reason).toContain('습도'); expect(result.reason).toContain('100'); }
  });
});

describe('scene field formatting', () => {
  it('applies decimals and units, and joins lists', () => {
    expect(formatSceneField(output, 1234.6)).toBe('1,235');
    expect(formatSceneField(temperature, 31.55)).toBe('31.6°C');
    expect(formatSceneField(humidity, 55)).toBe('55%');
    expect(formatSceneField(samples, [10.01, 10.02])).toBe('10.01, 10.02');
    expect(formatSceneField(name, 'X')).toBe('X');
    expect(formatSceneField(output, undefined)).toBe('—');
  });
});

describe('scene object field validation', () => {
  const fields = [output, humidity];
  it('checks only declared fields that are present and ignores undeclared keys', () => {
    expect(validateSceneObjectFields(fields, { id: 'A', value: 10, color: '#fff' })).toEqual({ ok: true });
    expect(validateSceneObjectFields(fields, { id: 'A' })).toEqual({ ok: true });
    expect(validateSceneObjectFields(fields, { id: 'A', humidity: 120 }).ok).toBe(false);
    expect(validateSceneObjectFields(fields, { id: 'A', value: 'x' }).ok).toBe(false);
  });
  it('can require every declared field to be present', () => {
    expect(validateSceneObjectFields(fields, { id: 'A', value: 1 }, { required: true }).ok).toBe(false);
    expect(validateSceneObjectFields(fields, { id: 'A', value: 1, humidity: 50 }, { required: true }).ok).toBe(true);
  });
});
