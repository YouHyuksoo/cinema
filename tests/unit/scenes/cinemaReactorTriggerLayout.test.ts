import { describe, expect, it } from 'vitest';
import { reactorTriggerStyle } from '@/cinema/reactorTriggerLayout';
import { voiceCoreCanvasTransform } from '@/cinema/jarvisVoiceCore';

describe('scaled HUD reactor hit target', () => {
  it.each([1, .7865, .58, 1.5])('keeps the target on the reactor at ancestor scale %s', scale => {
    const layoutWidth = 800, layoutHeight = 400;
    const width = layoutWidth * scale, height = layoutHeight * scale;
    const style = reactorTriggerStyle(width, height);
    const targetWidth = parseFloat(style.width) / 100 * layoutWidth * scale;
    const targetHeight = parseFloat(style.height) / 100 * layoutHeight * scale;
    expect(style.width.endsWith('%')).toBe(true);
    expect(style.height.endsWith('%')).toBe(true);
    expect(style.left).toBe('50%'); expect(style.top).toBe('50%');
    expect(style.transform).toBe('translate(-50%, -50%)');
    expect(targetWidth).toBeCloseTo(targetHeight);
    expect(targetWidth).toBeCloseTo(Math.max(44, 224 * voiceCoreCanvasTransform(width, height).scale));
    expect(parseFloat(style.left) / 100 * layoutWidth * scale).toBeCloseTo(width / 2);
    expect(parseFloat(style.top) / 100 * layoutHeight * scale).toBeCloseTo(height / 2);
  });
  it('keeps a minimum target and finite geometry on tiny or invalid measurements', () => {
    const small = reactorTriggerStyle(40, 20);
    expect(parseFloat(small.width) / 100 * 40).toBe(44);
    expect(JSON.stringify(reactorTriggerStyle(NaN, Infinity))).not.toMatch(/NaN|Infinity/);
  });
});
