import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAmbientTextureRenderer, type AmbientTextureStyle } from '@/cinema/filmAmbientTexture';
import { FILM_TEXTURE_STYLES } from '@/cinema/filmTexture';
import { FilmTextureControls } from '@/cinema/FilmTextureControls';
import { recordingCanvas } from '../support/recordingCanvas';

const createCanvas = vi.fn(() => ({
  width: 0, height: 0, id: `surface-${createCanvas.mock.calls.length}`,
  getContext: () => recordingCanvas().ctx,
}));
beforeEach(() => { createCanvas.mockClear(); vi.stubGlobal('document', { createElement: createCanvas }); });
afterEach(() => vi.unstubAllGlobals());

describe('environmental screen textures', () => {
  it.each(['underwater', 'space'] as const)('exposes %s through the existing texture and intensity controls', style => {
    expect(FILM_TEXTURE_STYLES.some(option => option.value === style)).toBe(true);
    const html = renderToStaticMarkup(createElement(FilmTextureControls, {
      texture: { style, intensity: .55 }, disabled: false, onStyleChange() {}, onIntensityChange() {},
    }));
    expect(html).toContain('물속'); expect(html).toContain('우주');
    expect(html).toContain(`value="${style}" selected=""`);
    expect(html).toContain('질감 강도'); expect(html).toContain('55%');
  });
  it.each(['underwater', 'space'] as const)('caches %s surfaces and freezes at the same playback time', style => {
    const draw = createAmbientTextureRenderer(), frame = recordingCanvas();
    expect(createCanvas).not.toHaveBeenCalled();
    draw(frame.ctx, style, 3, .6);
    const first = frame.fingerprint(), surfaceCount = createCanvas.mock.calls.length;
    expect(surfaceCount).toBe(style === 'underwater' ? 2 : 3);
    frame.calls.length = 0;
    draw(frame.ctx, style, 3, .6);
    expect(frame.fingerprint()).toBe(first);
    frame.calls.length = 0;
    draw(frame.ctx, style, 6, .6);
    expect(frame.fingerprint()).not.toBe(first);
    expect(createCanvas).toHaveBeenCalledTimes(surfaceCount);
  });
  it.each(['underwater', 'space'] as AmbientTextureStyle[])('handles zero/invalid strength and restores canvas state in %s', style => {
    const draw = createAmbientTextureRenderer(), frame = recordingCanvas();
    draw(frame.ctx, style, 0, 0); draw(frame.ctx, style, 0, NaN);
    expect(frame.calls).toHaveLength(0); expect(createCanvas).not.toHaveBeenCalled();
    frame.ctx.globalAlpha = .7; frame.ctx.globalCompositeOperation = 'multiply';
    draw(frame.ctx, style, NaN, 9);
    expect(frame.ctx.globalAlpha).toBe(.7);
    expect(frame.ctx.globalCompositeOperation).toBe('multiply');
    expect(frame.calls.filter(call => call[0] === 'set' && call[1] === 'globalAlpha').every(call => Number(call[2]) <= 1)).toBe(true);
    expect(JSON.stringify(frame.calls)).not.toContain('null');
  });
});
