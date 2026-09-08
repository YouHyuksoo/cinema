import { describe, expect, it } from 'vitest';
import { DEFAULT_ENERGY_DATA, ENERGY_LAYERS, energyCoreState, energyRatio,
  energyCoreProjection, energyLayerCenter, energyLayerPoint } from '@/cinema/energyCore';

describe('layered energy telemetry', () => {
  it('uses the supplied data for ring charge and safely handles unavailable capacity', () => {
    expect(energyRatio(DEFAULT_ENERGY_DATA.power)).toBeCloseTo(.66);
    expect(energyRatio({ value: 0, capacity: 100, unit: 'EA' })).toBe(0);
    expect(energyRatio({ value: 200, capacity: 100, unit: 'EA' })).toBe(1);
    expect(energyRatio({ value: 40, capacity: 0, unit: 'EA' })).toBe(0);
    expect(energyRatio({ value: NaN, capacity: 100, unit: 'EA' })).toBe(0);
    expect(energyRatio({ ...DEFAULT_ENERGY_DATA.power, value: 46.2 })).toBeCloseTo(.33);
  });
  it.each([7, 15, 23])('separates only the selected shell at %s seconds and returns it afterward', time => {
    const selected = energyCoreState(time), returned = energyCoreState(time + 4);
    expect(selected.index).toBe((time - 7) / 8);
    expect(selected.focus).toBe(1); expect(selected.readout).toBe(1);
    const posed = energyLayerCenter(selected.index, selected);
    const rest = energyLayerCenter(selected.index, { ...selected, focus: 0 });
    expect(posed.z).toBeLessThan(rest.z - 100);
    expect(posed.y).toBeLessThan(rest.y);
    for (let index = 0; index < 3; index++) {
      if (index !== selected.index) expect(energyLayerCenter(index, selected))
        .toEqual(energyLayerCenter(index, { ...selected, focus: 0 }));
    }
    expect(returned.focus).toBe(0);
  });
  it('reassembles, fades out and reconstructs its exact pose on backwards seeking', () => {
    const state = energyCoreState(15);
    const point = energyLayerPoint(1, state, 15, .5, .7);
    energyCoreState(30);
    expect(energyLayerPoint(1, energyCoreState(15), 15, .5, .7)).toEqual(point);
    expect(energyCoreState(29)).toMatchObject({ focus: 0, summary: 1 });
    expect(energyCoreState(32).opacity).toBe(0);
    expect(energyCoreState(0).opacity).toBe(0);
  });
  it('keeps the rotating shells in the object region and out of the readout and menu', () => {
    for (let time = 0; time <= 32; time += .5) {
      const state = energyCoreState(time), project = energyCoreProjection(time, state);
      for (let index = 0; index < ENERGY_LAYERS.length; index++) {
        for (const latitude of [-Math.PI / 2, -.7, 0, .7, Math.PI / 2]) {
          for (let longitude = 0; longitude < Math.PI * 2; longitude += Math.PI / 4) {
            const point = project(energyLayerPoint(index, state, time, latitude, longitude));
            expect(Object.values(point).every(Number.isFinite)).toBe(true);
            expect(point.x).toBeGreaterThan(140); expect(point.x).toBeLessThan(800);
            expect(point.y).toBeGreaterThan(95); expect(point.y).toBeLessThan(575);
          }
        }
      }
    }
  });
});
