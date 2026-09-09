import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { drawSignalFilm } from '@/cinema/drawSignalFilm';
import { chapterStart, FILM_CHAPTERS } from '@/cinema/filmProgram';
import { recordingCanvas } from '../support/recordingCanvas';

/**
 * Pins the exact draw-call sequence of every chapter at several local times. A refactor that only
 * regroups code must leave every fingerprint untouched; a deliberate perf change (e.g. gradient
 * caching) may update a snapshot, but the change must be explained in the commit.
 */
const fonts = { label: 'Label', mono: 'Mono' };
let offscreen = 0;
// Offscreen layers (thermal field, projected HUD surface) need `document`; stub a recording canvas.
const fakeCanvas = () => {
  const id = `canvas#${++offscreen}`;
  const surface = recordingCanvas();
  return { id, width: 0, height: 0, getContext: () => surface.ctx, toJSON: () => id };
};
beforeAll(() => { vi.stubGlobal('document', { createElement: fakeCanvas }); });
afterAll(() => { vi.unstubAllGlobals(); });

const fingerprint = (time: number) => {
  offscreen = 0;
  const canvas = recordingCanvas();
  drawSignalFilm(canvas.ctx, 1280, 720, time, fonts);
  return `${canvas.calls.length} calls · ${canvas.fingerprint()}`;
};

describe('film draw-call fingerprint', () => {
  for (const chapter of FILM_CHAPTERS) {
    const start = chapterStart(chapter.id);
    const samples = [0.6, chapter.previewAt, Math.min(chapter.duration - 0.5, chapter.previewAt + 5)];
    it.each(samples)(`${chapter.id} at %ss`, local => {
      expect(fingerprint(start + local)).toMatchSnapshot();
    });
  }
  it('is deterministic for the same input', () => {
    expect(fingerprint(40)).toBe(fingerprint(40));
  });
});
