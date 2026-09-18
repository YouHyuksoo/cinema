import { beforeEach, describe, expect, it } from 'vitest';
import { isFilmPerformanceMode, readPerformanceMode, resolvePerformanceMode } from '@/cinema/filmPerformanceMode';

const storage = (value: string | null) => ({ getItem: () => value });
const blocked = { getItem() { throw new Error('storage blocked'); } };

describe('film performance mode', () => {
  beforeEach(() => { /* module state is exercised through the pure helpers only */ });
  it('accepts only the three known modes', () => {
    expect(isFilmPerformanceMode('auto')).toBe(true);
    expect(isFilmPerformanceMode('low')).toBe(true);
    expect(isFilmPerformanceMode('full')).toBe(true);
    expect(isFilmPerformanceMode('cheap')).toBe(false);
    expect(isFilmPerformanceMode(undefined)).toBe(false);
  });
  it('falls back to auto for missing, invalid or blocked storage', () => {
    expect(readPerformanceMode(storage(null))).toBe('auto');
    expect(readPerformanceMode(storage('turbo'))).toBe('auto');
    expect(readPerformanceMode(blocked)).toBe('auto');
    expect(readPerformanceMode(storage('low'))).toBe('low');
  });
  it('lets an explicit choice override the device guess', () => {
    expect(resolvePerformanceMode('auto', true)).toBe('low');
    expect(resolvePerformanceMode('auto', false)).toBe('full');
    expect(resolvePerformanceMode('full', true)).toBe('full');
    expect(resolvePerformanceMode('low', false)).toBe('low');
  });
});
