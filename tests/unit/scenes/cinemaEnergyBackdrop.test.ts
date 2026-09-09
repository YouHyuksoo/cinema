import { describe, expect, it } from 'vitest';
import { drawEnergyCoreFilm } from '@/cinema/drawEnergyCoreFilm';
import { ENERGY_PALETTE } from '@/cinema/energyDashboard';
import { recordingCanvas } from '../support/recordingCanvas';

const fonts = { label: 'Label', mono: 'Mono' };
const rgb = (color: unknown) => {
  const match = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(String(color));
  return match ? match.slice(1, 4).map(Number) : null;
};
/** The first full-viewport fill after the base is the backdrop gradient; its stops are what the page shows. */
function backdropStops(time: number) {
  const canvas = recordingCanvas();
  drawEnergyCoreFilm(canvas.ctx, 1280, 720, time, fonts);
  const gradient = canvas.calls.find(call => call[0] === 'createLinearGradient')?.[1];
  return canvas.calls.filter(call => call[0] === 'addColorStop' && call[1] === gradient).map(call => rgb(call[3])!);
}

/**
 * The scene's background has to stay the film's dark base tinted with the HUD accent so the theme
 * mapper recolors it like every other chapter. It used to switch to a fixed navy and then violet
 * field, which ignored the theme entirely (and turned brown/purple under the other palettes).
 */
describe('energy scene backdrop follows the theme base', () => {
  it('tints the dark base with the accent line color in both acts, never a violet field', () => {
    for (const time of [1, 8, 16.5, 25]) {
      const stops = backdropStops(time);
      expect(stops).toHaveLength(2);
      for (const [r, g, b] of stops) {
        // Dark: every channel stays near the #040b10 base (max 60) and blue never dominates like the old navy/violet.
        expect(Math.max(r, g, b)).toBeLessThan(60);
        expect(r).toBeLessThanOrEqual(g); expect(g).toBeLessThanOrEqual(b);
        expect(b - r).toBeLessThan(40);
      }
    }
  });
  it('deepens the same tint for the infographic act instead of changing hue', () => {
    const [, hudBottom] = backdropStops(8), [, infoBottom] = backdropStops(25);
    expect(infoBottom[2]).toBeGreaterThan(hudBottom[2]);
    expect(infoBottom[0]).toBeLessThan(infoBottom[2] / 2);
  });
  it('draws the grid and dot matrix in the accent, not the infographic magenta', () => {
    const canvas = recordingCanvas();
    drawEnergyCoreFilm(canvas.ctx, 1280, 720, 25, fonts);
    const styles = canvas.calls.filter(call => call[0] === 'set' && (call[1] === 'fillStyle' || call[1] === 'strokeStyle')).map(call => call[2]);
    expect(styles).toContain(ENERGY_PALETTE.hud.line);
    // The first few style writes belong to the backdrop layer (base, gradient, grid, dots): none may be infographic colors.
    const backdropStyles = styles.slice(0, 6);
    expect(backdropStyles).not.toContain(ENERGY_PALETTE.infographic.channels[1]);
    expect(backdropStyles).not.toContain(ENERGY_PALETTE.infographic.line);
  });
});
