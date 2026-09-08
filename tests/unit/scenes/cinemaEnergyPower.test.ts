import { describe, expect, it } from 'vitest';
import { DEFAULT_ENERGY_DATA, energyCoreState } from '@/cinema/energyCore';
import { ENERGY_CHANNELS, energyGaugeProjection, energyPowerReading, energyPulsePoint, energyPulseProjection } from '@/cinema/energyPower';
import { projectFocusPoint } from '@/cinema/filmFocus';

describe('energy pulse and power gauges', () => {
  it('keeps the true ratio visible above capacity while limiting physical gauge fill', () => {
    expect(energyPowerReading(DEFAULT_ENERGY_DATA.power)).toMatchObject({ available: true, ratio: .66, fill: .66, over: false });
    expect(energyPowerReading({ value: 175, capacity: 100, unit: 'kW' })).toMatchObject({ ratio: 1.75, fill: 1, over: true });
    for (const reading of [
      { value: NaN, capacity: 100, unit: 'kW' }, { value: -1, capacity: 100, unit: 'kW' },
      { value: 50, capacity: 0, unit: 'kW' }, { value: 50, capacity: Infinity, unit: 'kW' },
    ]) expect(energyPowerReading(reading)).toMatchObject({ available: false, fill: 0, over: false });
  });
  it('has no generated pulse at zero input and scales amplitude with the supplied ratio', () => {
    for (let position = 0; position <= 1; position += .02) {
      const full = energyPulsePoint(position, 2, 7, 1);
      const half = energyPulsePoint(position, 2, 7, .5);
      const zero = energyPulsePoint(position, 2, 7, 0);
      expect(half.y).toBeCloseTo(full.y / 2); expect(half.z).toBeCloseTo(full.z / 2);
      expect(zero.y).toBeCloseTo(0); expect(zero.z).toBeCloseTo(0);
      expect(half.x).toBe(full.x);
    }
  });
  it('approaches each gauge and restores its pose after reading without changing values', () => {
    for (const [index, time] of [7, 15, 23].entries()) {
      const projection = energyGaugeProjection(index, time);
      expect(projection.scale).toBeGreaterThan(1.1);
      expect(projection.y).toBeLessThan(projection.anchorY);
      const restored = energyGaugeProjection(index, time + 4);
      expect(restored.scale).toBe(1);
      for (let other = 0; other < 3; other++) if (other !== index)
        expect(energyGaugeProjection(other, time).scale).toBe(1);
      expect(energyPowerReading(DEFAULT_ENERGY_DATA[ENERGY_CHANNELS[index].key]).available).toBe(true);
    }
  });
  it('keeps gauges, leaders and the full wave within the content region at every focus phase', () => {
    for (let time = 0; time <= 32; time += .25) {
      for (let index = 0; index < 3; index++) {
        const projection = energyGaugeProjection(index, time), y = 426 + index * 82;
        for (const x of [132, 1140]) for (const offset of [-30, 40]) {
          const p = projectFocusPoint(projection, { x, y: y + offset });
          expect(p.x).toBeGreaterThan(72); expect(p.x).toBeLessThan(1208);
          expect(p.y).toBeGreaterThan(350); expect(p.y).toBeLessThan(638);
        }
      }
      const project = energyPulseProjection(time);
      for (let u = 0; u <= 1; u += .05) for (const strand of [0, 6, 11]) {
        const p = project(energyPulsePoint(u, strand, time, 1));
        expect(p.x).toBeGreaterThan(370); expect(p.x).toBeLessThan(1208);
        expect(p.y).toBeGreaterThan(145); expect(p.y).toBeLessThan(350);
      }
    }
  });
  it('reconstructs the same frame after reverse seek and closes the 32-second scene', () => {
    const first = energyPulsePoint(.4, 3, 15, .8);
    energyPulsePoint(.4, 3, 30, .8);
    expect(energyPulsePoint(.4, 3, 15, .8)).toEqual(first);
    expect(energyCoreState(29)).toMatchObject({ focus: 0, summary: 1 });
    expect(energyCoreState(32).opacity).toBe(0);
  });
});
