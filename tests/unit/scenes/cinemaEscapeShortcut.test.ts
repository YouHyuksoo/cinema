import { describe, expect, it, vi } from 'vitest';
import { handleFilmEscape } from '@/cinema/useFilmEscapeToHome';

describe('global film Escape shortcut', () => {
  it('prevents the default action and returns home once for Escape', () => {
    const preventDefault=vi.fn(),stopAndHome=vi.fn();
    expect(handleFilmEscape({key:'Escape',repeat:false,preventDefault},stopAndHome)).toBe(true);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(stopAndHome).toHaveBeenCalledOnce();
  });
  it('ignores repeated Escape and other keys', () => {
    const stopAndHome=vi.fn(),preventDefault=vi.fn();
    expect(handleFilmEscape({key:'Escape',repeat:true,preventDefault},stopAndHome)).toBe(false);
    expect(handleFilmEscape({key:'Enter',repeat:false,preventDefault},stopAndHome)).toBe(false);
    expect(stopAndHome).not.toHaveBeenCalled();
  });
});
