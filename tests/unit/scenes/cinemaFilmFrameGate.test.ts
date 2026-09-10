import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { filmFrameChanged, type FilmFrameKey } from '@/cinema/filmFrameGate';
import { DEFAULT_FILM_CHARTS } from '@/cinema/chartPresentation';

const base = (): FilmFrameKey => ({
  camera: false, time: 12.5, width: 1280, height: 720, inset: 96, theme: 'cyan',
  texture: { style: 'glass', intensity: .55 }, charts: DEFAULT_FILM_CHARTS, subject: 'pcb',
  factory: null, cctvManual: false, selectedZone: null, data: { production: 1 }, provenance: 'demo',
});

describe('film frame gate', () => {
  it('always draws the first frame', () => {
    expect(filmFrameChanged(null, base())).toBe(true);
  });
  it('skips a frame whose every input is unchanged', () => {
    const previous = base();
    expect(filmFrameChanged(previous, { ...previous })).toBe(false);
  });
  it.each<[keyof FilmFrameKey, unknown]>([
    ['time', 12.6], ['camera', true], ['width', 1281], ['height', 719], ['inset', 0], ['theme', 'amber'],
    ['subject', 'car'], ['factory', { yaw: 1 }], ['selectedZone', 'ZONE-03'], ['provenance', 'db'],
  ])('redraws when %s changes', (field, value) => {
    expect(filmFrameChanged(base(), { ...base(), [field]: value })).toBe(true);
  });
  it('compares texture by style and intensity, charts and data by identity', () => {
    const previous = base();
    expect(filmFrameChanged(previous, { ...previous, texture: { style: 'glass', intensity: .55 } })).toBe(false);
    expect(filmFrameChanged(previous, { ...previous, texture: { style: 'film', intensity: .55 } })).toBe(true);
    expect(filmFrameChanged(previous, { ...previous, texture: { style: 'glass', intensity: .2 } })).toBe(true);
    expect(filmFrameChanged(previous, { ...previous, charts: { ...DEFAULT_FILM_CHARTS } })).toBe(true);
    expect(filmFrameChanged(previous, { ...previous, data: { production: 1 } })).toBe(true);
  });
  it('never skips while CCTV feeds run on the wall clock', () => {
    const previous = { ...base(), cctvManual: true };
    expect(filmFrameChanged(previous, { ...previous })).toBe(true);
  });
});

describe('film render loop wiring', () => {
  it('skips the scene and texture passes when the frame key is unchanged', () => {
    const source = readFileSync('src/cinema/useFilmPlayback.ts', 'utf8');
    expect(source).toContain("import { filmFrameChanged, type FilmFrameKey } from './filmFrameGate';");
    expect(source).toContain('if (!filmFrameChanged(lastKey, key)) { frame = requestAnimationFrame(render); return; }');
    expect(source).toContain('lastKey = key;');
    expect(source.indexOf('lastKey = key;')).toBeLessThan(source.indexOf('drawSignalFilm(themed.ctx'));
    expect(source.indexOf('lastKey = key;')).toBeLessThan(source.indexOf('drawTexture(ctx,'));
  });
});
