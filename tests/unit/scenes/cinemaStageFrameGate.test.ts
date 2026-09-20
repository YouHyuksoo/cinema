import { describe, expect, it } from 'vitest';
import { filmFrameChanged, type FilmFrameKey } from '@/cinema/filmFrameGate';
import { DEFAULT_FILM_TEXTURE } from '@/cinema/filmTexture';
import { DEFAULT_FILM_CHARTS } from '@/cinema/chartPresentation';
import { DEFAULT_FILM_THEME } from '@/cinema/filmThemes';
import { DEFAULT_MACHINE_SUBJECT } from '@/cinema/machinePresentation';

const base: FilmFrameKey = {
  camera: false, time: 12, width: 800, height: 450, inset: 0,
  theme: DEFAULT_FILM_THEME, texture: DEFAULT_FILM_TEXTURE, charts: DEFAULT_FILM_CHARTS,
  subject: DEFAULT_MACHINE_SUBJECT, factory: null, cctvManual: false,
  selectedZone: null, data: null, provenance: null, stagePose: 'a',
};

describe('무대 포즈와 프레임 게이트', () => {
  it('포즈가 같으면 다시 그리지 않는다', () => {
    expect(filmFrameChanged(base, { ...base })).toBe(false);
  });
  it('포즈가 바뀌면 다시 그린다', () => {
    expect(filmFrameChanged(base, { ...base, stagePose: 'b' })).toBe(true);
  });
  it('무대가 없는 상태끼리도 다시 그리지 않는다', () => {
    const off = { ...base, stagePose: null };
    expect(filmFrameChanged(off, { ...off })).toBe(false);
  });
});
