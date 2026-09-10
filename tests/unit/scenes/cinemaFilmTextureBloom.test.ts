import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFilmTextureRenderer } from '@/cinema/filmTexture';
import { recordingCanvas } from '../support/recordingCanvas';

type Recorder = ReturnType<typeof recordingCanvas>;
let surfaces: Recorder[];
beforeEach(() => {
  surfaces = [];
  vi.stubGlobal('document', { createElement: () => {
    const recorder = recordingCanvas(); const id = `surface-${surfaces.length}`; surfaces.push(recorder);
    // Pixel APIs the seeded noise surface needs; everything else is recorded as a call.
    const pixels = { getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      createImageData: (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }) };
    const ctx = new Proxy(recorder.ctx, { get: (target, key) => key in pixels ? pixels[key as keyof typeof pixels] : Reflect.get(target, key) });
    return { id, width: 0, height: 0, getContext: () => ctx };
  } });
});
afterEach(() => vi.unstubAllGlobals());

const blurSurface = () => surfaces.findIndex(surface => surface.calls.some(call => call[0] === 'set' && call[1] === 'filter' && call[2] === 'blur(3px)'));
const drawImages = (recorder: Recorder) => recorder.calls.filter(call => call[0] === 'drawImage').length;

describe('film texture bloom pass', () => {
  it('blurs a downscaled copy of the frame by default', () => {
    const draw = createFilmTextureRenderer('cyan'), frame = recordingCanvas();
    draw(frame.ctx, 1280, 720, 3, { style: 'glass', intensity: .55 });
    const bloom = blurSurface();
    expect(bloom).toBeGreaterThanOrEqual(0);
    expect(drawImages(surfaces[bloom])).toBe(1);
  });
  it('skips the bloom copy and blur when the caller turns it off', () => {
    const withBloom = createFilmTextureRenderer('cyan'), reference = recordingCanvas();
    withBloom(reference.ctx, 1280, 720, 3, { style: 'glass', intensity: .55 });
    const bloom = blurSurface(), referenceDraws = drawImages(reference);
    surfaces = [];
    const withoutBloom = createFilmTextureRenderer('cyan'), frame = recordingCanvas();
    withoutBloom(frame.ctx, 1280, 720, 3, { style: 'glass', intensity: .55 }, { bloom: false });
    expect(blurSurface()).toBe(-1);
    expect(surfaces[bloom].calls).toEqual([]);
    expect(drawImages(frame)).toBe(referenceDraws - 1);
  });
  it('is turned off for the main backdrop only', () => {
    const source = readFileSync('src/cinema/useFilmPlayback.ts', 'utf8');
    expect(source).toContain('current.texture, { bloom: !cameraView.current });');
  });
});
