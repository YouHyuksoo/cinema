import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_ENERGY_DATA, energyCoreState, type EnergyCoreData } from '@/cinema/energyCore';
import { coilIgnition, coilSegment, energyReactorProjection, reactorArcs, reactorCore, reactorLayerPoint, REACTOR_ARC_MAX, REACTOR_COILS, REACTOR_SEGMENTS, ringCharge } from '@/cinema/energyReactor';
import { drawEnergyCoreFilm } from '@/cinema/drawEnergyCoreFilm';
import { canvasFixture } from '../support/canvasFixture';

vi.mock('@/cinema/components/drawProjectedFilmSurface', () => ({ drawProjectedFilmSurface: () => undefined }));

const zero: EnergyCoreData = { name: 'ZERO', power: { value: 0, capacity: 140, unit: 'kW' }, production: { value: 0, capacity: 1450, unit: 'EA' }, efficiency: { value: 0, capacity: 0, unit: '%' } };
const overloaded: EnergyCoreData = { ...DEFAULT_ENERGY_DATA, power: { value: 180, capacity: 140, unit: 'kW' } };
const TAU = Math.PI * 2;

describe('arc reactor geometry', () => {
  it('ignites coils clockwise during assembly and has every coil lit once assembled', () => {
    const early = energyCoreState(.6), done = energyCoreState(5);
    const ignition = Array.from({ length: REACTOR_COILS }, (_, index) => coilIgnition(index, early));
    for (let index = 1; index < ignition.length; index++) expect(ignition[index]).toBeLessThanOrEqual(ignition[index - 1]);
    expect(ignition[0]).toBeGreaterThan(0);
    expect(ignition[REACTOR_COILS - 1]).toBe(0);
    expect(Array.from({ length: REACTOR_COILS }, (_, index) => coilIgnition(index, done)).every(value => value === 1)).toBe(true);
    expect(coilIgnition(0, energyCoreState(0))).toBe(0);
  });

  it('charges each ring by its own metric and shows nothing for empty data', () => {
    const state = energyCoreState(6);
    expect(ringCharge(0, DEFAULT_ENERGY_DATA, state).lit).toBe(Math.round(92.4 / 140 * REACTOR_SEGMENTS));
    expect(ringCharge(1, DEFAULT_ENERGY_DATA, state).lit).toBe(Math.round(1267 / 1450 * REACTOR_SEGMENTS));
    expect(ringCharge(2, DEFAULT_ENERGY_DATA, state).lit).toBe(Math.round(.948 * REACTOR_SEGMENTS));
    for (let index = 0; index < 3; index++) expect(ringCharge(index, zero, state).lit).toBe(0);
    expect(ringCharge(0, overloaded, state)).toMatchObject({ lit: REACTOR_SEGMENTS, over: true, heat: 1 });
    expect(ringCharge(0, DEFAULT_ENERGY_DATA, energyCoreState(.5)).lit).toBeLessThan(ringCharge(0, DEFAULT_ENERGY_DATA, state).lit);
  });

  it('lights the core from efficiency, warns on overload and stays dark for empty data', () => {
    const state = energyCoreState(6);
    const core = reactorCore(DEFAULT_ENERGY_DATA, state, 6);
    expect(core.intensity).toBeCloseTo(.948);
    expect(core.heat).toBe(0);
    expect(core.breathing).toBeGreaterThan(.6);
    expect(reactorCore(zero, state, 6).intensity).toBe(0);
    expect(reactorCore(overloaded, state, 6).heat).toBe(1);
  });

  it('scales arc count with power, none at zero input or before assembly, deterministic per frame', () => {
    const state = energyCoreState(6);
    const arcs = reactorArcs(DEFAULT_ENERGY_DATA, state, 6);
    expect(arcs).toHaveLength(Math.round(92.4 / 140 * REACTOR_ARC_MAX));
    expect(arcs.every(arc => arc.points.length === 10)).toBe(true);
    expect(reactorArcs(zero, state, 6)).toEqual([]);
    expect(reactorArcs(DEFAULT_ENERGY_DATA, energyCoreState(1), 1)).toEqual([]);
    expect(reactorArcs(overloaded, state, 6)).toHaveLength(REACTOR_ARC_MAX);
    expect(JSON.stringify(reactorArcs(DEFAULT_ENERGY_DATA, state, 6.01))).toBe(JSON.stringify(arcs));
    expect(JSON.stringify(reactorArcs(DEFAULT_ENERGY_DATA, state, 6.2))).not.toBe(JSON.stringify(arcs));
  });

  it('keeps rings, coils and the core inside the object region beside the readout and above the gauges', () => {
    for (const time of [1, 5, 11, 19, 27]) {
      const state = energyCoreState(time), project = energyReactorProjection(time, state);
      const points = [];
      for (let index = 0; index < 3; index++) for (let tick = 0; tick < 48; tick++) points.push(project(reactorLayerPoint(index, state, time, 0, tick / 48 * TAU)));
      for (let index = 0; index < REACTOR_COILS; index++) points.push(project(coilSegment(index, state, time).tip));
      for (const point of points) {
        expect(point.x).toBeGreaterThan(470);
        expect(point.x).toBeLessThan(1120);
        expect(point.y).toBeGreaterThan(30);
        expect(point.y).toBeLessThan(405);
      }
    }
  });
});

describe('energy scene with the arc reactor', () => {
  it('draws every phase without leaking canvas state, for default, zero and overloaded data', () => {
    for (const data of [DEFAULT_ENERGY_DATA, zero, overloaded]) {
      for (const time of [.5, 4, 12, 20, 31]) {
        const fixture = canvasFixture();
        expect(() => drawEnergyCoreFilm(fixture.ctx, 1280, 720, time, { label: 'L', mono: 'M' }, undefined, data)).not.toThrow();
        expect(fixture.stack).toHaveLength(0);
      }
    }
  });
});
