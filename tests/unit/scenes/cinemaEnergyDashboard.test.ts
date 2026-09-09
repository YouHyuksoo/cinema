import { describe, expect, it } from 'vitest';
import { DEFAULT_ENERGY_DATA, ENERGY_CORE_SECONDS, type EnergyCoreData } from '@/cinema/energyCore';
import { ENERGY_BOARD_BLEND_SECONDS, ENERGY_BOARD_SWITCH, ENERGY_PALETTE, HUD_PANELS, INFO_PANELS, RING_CENTER, RING_RADIUS,
  checkGrid, dotMatrix, energyBoardState, energyHistory, gaugeAngle, litSegments, sevenSegment } from '@/cinema/energyDashboard';
import { drawEnergyCoreFilm } from '@/cinema/drawEnergyCoreFilm';
import { canvasFixture } from '../support/canvasFixture';
import { recordingCanvas } from '../support/recordingCanvas';

const zero: EnergyCoreData = { name: 'ZERO', power: { value: 0, capacity: 0, unit: 'kW' }, production: { value: 0, capacity: 0, unit: 'EA' }, efficiency: { value: 0, capacity: 0, unit: '%' } };
const overloaded: EnergyCoreData = { ...DEFAULT_ENERGY_DATA, power: { value: 210, capacity: 140, unit: 'kW' } };

describe('energy dashboard timeline', () => {
  it('plays the HUD act first, morphs at the switch and settles into the infographic act, fading out at the end', () => {
    expect(energyBoardState(0)).toMatchObject({ opacity: 0, assembly: 0, blend: 0, board: 'hud', activeIndex: 0 });
    expect(energyBoardState(4).assembly).toBe(1);
    expect(energyBoardState(ENERGY_BOARD_SWITCH - .1).blend).toBe(0);
    const mid = energyBoardState(ENERGY_BOARD_SWITCH + ENERGY_BOARD_BLEND_SECONDS / 2);
    expect(mid.blend).toBeGreaterThan(.3); expect(mid.blend).toBeLessThan(.7);
    expect(energyBoardState(ENERGY_BOARD_SWITCH + ENERGY_BOARD_BLEND_SECONDS + 2)).toMatchObject({ blend: 1, board: 'infographic', settle: 1 });
    expect(energyBoardState(ENERGY_CORE_SECONDS).opacity).toBe(0);
    expect(energyBoardState(NaN).elapsed).toBe(0);
  });
  it('cycles the focused channel every four seconds after the assembly beat', () => {
    expect([2.5, 6.5, 10.5, 14.5].map(t => energyBoardState(t).activeIndex)).toEqual([0, 1, 2, 0]);
    expect(energyBoardState(3).channelProgress).toBeCloseTo(.25);
  });
  it('keeps every panel inside the content region and clear of the ring', () => {
    for (const rect of [...Object.values(HUD_PANELS), ...Object.values(INFO_PANELS)]) {
      expect(rect.x).toBeGreaterThanOrEqual(72); expect(rect.x + rect.width).toBeLessThanOrEqual(1208);
      expect(rect.y).toBeGreaterThanOrEqual(60); expect(rect.y + rect.height).toBeLessThanOrEqual(650);
      const clear = rect.x + rect.width <= RING_CENTER.x - RING_RADIUS * 1.3 || rect.x >= RING_CENTER.x + RING_RADIUS * 1.3;
      expect(clear).toBe(true);
    }
    expect(ENERGY_PALETTE.hud.channels).toHaveLength(3); expect(ENERGY_PALETTE.infographic.channels).toHaveLength(3);
  });
});

describe('energy dashboard derived data', () => {
  it('derives deterministic, bounded histories and matrices from a reading', () => {
    const history = energyHistory(DEFAULT_ENERGY_DATA.power, 8, 1);
    expect(history).toHaveLength(8);
    expect(history).toEqual(energyHistory(DEFAULT_ENERGY_DATA.power, 8, 1));
    for (const value of history) { expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(1); }
    expect(energyHistory(zero.power, 5).every(value => value === 0)).toBe(true);
    const grid = dotMatrix(8, 14, .66, 0);
    expect(grid).toHaveLength(8); expect(grid[0]).toHaveLength(14);
    expect(grid[7].filter(level => level > 0).length).toBeGreaterThan(0);
    expect(dotMatrix(8, 14, 0).flat().every(level => level === 0)).toBe(true);
  });
  it('maps ratios to gauge angles, lit segments, checks and seven-segment digits', () => {
    expect(gaugeAngle(0)).toBeCloseTo(Math.PI * .75); expect(gaugeAngle(1)).toBeCloseTo(Math.PI * 2.25); expect(gaugeAngle(2)).toBeCloseTo(Math.PI * 2.25);
    expect(litSegments(48, .5)).toBe(24); expect(litSegments(48, 1.7)).toBe(48);
    expect(checkGrid(DEFAULT_ENERGY_DATA).map(cell => cell.ok)).toEqual([false, true, true, true, true, true]);
    expect(checkGrid(zero).every(cell => !cell.ok)).toBe(true);
    expect(sevenSegment('8')).toBe(0b1111111); expect(sevenSegment('1')).toBe(0b0110000); expect(sevenSegment('x')).toBe(0);
  });
});

describe('energy scene as a two-act dashboard', () => {
  it('draws every phase without leaking canvas state, for default, zero and overloaded data', () => {
    for (const data of [DEFAULT_ENERGY_DATA, zero, overloaded]) {
      for (const time of [.5, 4, 12, ENERGY_BOARD_SWITCH + 1, 20, 31]) {
        const fixture = canvasFixture();
        expect(() => drawEnergyCoreFilm(fixture.ctx, 1280, 720, time, { label: 'L', mono: 'M' }, undefined, data)).not.toThrow();
        expect(fixture.stack).toHaveLength(0);
      }
    }
  });
  it('shows both acts: HUD panel labels before the switch and infographic labels after it', () => {
    const before = canvasFixture(); drawEnergyCoreFilm(before.ctx, 1280, 720, 8, { label: 'L', mono: 'M' });
    const after = canvasFixture(); drawEnergyCoreFilm(after.ctx, 1280, 720, 24, { label: 'L', mono: 'M' });
    const textsBefore = before.texts.map(t => t.value).join(' '), textsAfter = after.texts.map(t => t.value).join(' ');
    expect(textsBefore).toContain('GAUGE'); expect(textsBefore).toContain('READOUT / VALUES'); expect(textsBefore).toContain('HUD DASHBOARD');
    expect(textsAfter).toContain('MATRIX'); expect(textsAfter).toContain('CHECKS'); expect(textsAfter).toContain('INFOGRAPHIC');
    expect(textsAfter).toMatch(/Round \d+% proximity/);
  });
  it('is deterministic for the same input', () => {
    const a = recordingCanvas(), b = recordingCanvas();
    drawEnergyCoreFilm(a.ctx, 1280, 720, 16.2); drawEnergyCoreFilm(b.ctx, 1280, 720, 16.2);
    expect(a.fingerprint()).toBe(b.fingerprint());
  });
});
