import { describe, expect, it } from 'vitest';
import { createLensProjection, lensScale } from '@/cinema/filmLens';
import { createCoreProjection } from '@/cinema/cornerCoreGeometry';
import { cornerReadingProjection } from '@/cinema/cornerProjection';
import { cornerSequenceState } from '@/cinema/cornerSequence';
import { projectReactor } from '@/cinema/voiceReactorGeometry';
import { cubeReactorFlight } from '@/cinema/cubeReactorFlight';
import { focusProjection } from '@/cinema/filmFocus';

/** Values captured before the lens kernel was shared; the refactor must reproduce them bit for bit. */
describe('lens projection keeps the pre-refactor pixels', () => {
  it('corner finale core', () => {
    const projection = createCoreProjection(5);
    expect([projection.point(120, -60, 10), projection.ring(1, 190, 22), projection.ring(4.2, 190, -18)]).toMatchInlineSnapshot(`
      [
        {
          "depth": -15.394803996457767,
          "x": 121.77135736899953,
          "y": -62.224370408625134,
        },
        {
          "depth": 38.53015022377061,
          "x": 102.1838927142989,
          "y": 144.89477036467827,
        },
        {
          "depth": -36.79554660562762,
          "x": -103.80929104830098,
          "y": -168.5852033172358,
        },
      ]
    `);
  });
  it('corner reading planes', () => {
    const readings = cornerSequenceState(36).items;
    expect(readings.map(reading => cornerReadingProjection(reading).point(120, -60, 10))).toMatchInlineSnapshot(`
      [
        {
          "depth": 358.272684822968,
          "x": 1119.4233197835604,
          "y": 134.65393280091678,
        },
        {
          "depth": 379.8083928556051,
          "x": 1112.1264087377795,
          "y": 487.4611057820759,
        },
        {
          "depth": 494.8307067065611,
          "x": 321.25928640550006,
          "y": 160.68495041226834,
        },
        {
          "depth": 508.84237586961586,
          "x": 324.9545844571907,
          "y": 475.06346069920704,
        },
      ]
    `);
    expect(cornerReadingProjection(cornerSequenceState(6.5).items[0]).point(-150, 90)).toMatchInlineSnapshot(`
      {
        "depth": 158.4837085587467,
        "x": 689.2354916510552,
        "y": 307.4100576620657,
      }
    `);
  });
  it('voice reactor', () => {
    expect([projectReactor({ x: 40, y: 30, z: 20 }), projectReactor({ x: -80, y: 12, z: -40 }, .31), projectReactor({ x: 0, y: 0, z: 0 }, Number.NaN)]).toMatchInlineSnapshot(`
      [
        {
          "x": 258.8233354042962,
          "y": 156.88489855716395,
          "z": 27.277361027982746,
        },
        {
          "x": 136.81756584493976,
          "y": 158.57037364029537,
          "z": -34.432639158107214,
        },
        {
          "x": 220,
          "y": 134,
          "z": 0,
        },
      ]
    `);
  });
  it('cube reactor flight', () => {
    expect(cubeReactorFlight(3000, { x: 100, y: 80 }, { x: 400, y: 300, radius: 60 })!.projected).toMatchInlineSnapshot(`
      {
        "scale": 1.2777369318061054,
        "x": 431.0675075918686,
        "y": 321.6581278836238,
      }
    `);
    expect(cubeReactorFlight(600, { x: 100, y: 80 }, { x: 400, y: 300, radius: 60 })!.projected).toMatchInlineSnapshot(`
      {
        "scale": 1,
        "x": 220,
        "y": 155,
      }
    `);
  });
  it('focus projection', () => {
    expect([focusProjection({ x: 955, y: 385, focus: .6, depth: 85, lift: 10 }), focusProjection({ x: 640, y: 360, focus: 1, depth: -2000 })]).toMatchInlineSnapshot(`
      [
        {
          "anchorX": 955,
          "anchorY": 385,
          "depth": 51,
          "scale": 1.053740779768177,
          "x": 955,
          "y": 379,
        },
        {
          "anchorX": 640,
          "anchorY": 360,
          "depth": -1000,
          "scale": 0.5,
          "x": 640,
          "y": 340,
        },
      ]
    `);
  });
});

describe('lens projection kernel', () => {
  it('scales by lens / (lens + depth)', () => {
    expect(lensScale(800, 0)).toBe(1);
    expect(lensScale(800, 800)).toBe(.5);
    expect(lensScale(800, -400)).toBe(2);
  });
  it('is the identity on the screen plane', () => {
    const project = createLensProjection({ lens: 800, centerX: 640, centerY: 360 });
    expect(project(100, -50)).toEqual({ x: 740, y: 310, depth: 0 });
  });
  it('shrinks toward the centre behind the plane and grows in front', () => {
    const project = createLensProjection({ lens: 800, centerX: 640, centerY: 360 });
    expect(project(100, 0, 800)).toEqual({ x: 690, y: 360, depth: 800 });
    expect(project(100, 0, -400)).toEqual({ x: 840, y: 360, depth: -400 });
  });
  it('applies pitch about x, then yaw about y, then roll about z', () => {
    const half = Math.PI / 2;
    const pitched = createLensProjection({ lens: 1e9, pitch: half })(0, 10, 0);
    expect(pitched.depth).toBeCloseTo(10); expect(pitched.y).toBeCloseTo(0);
    const yawed = createLensProjection({ lens: 1e9, yaw: half })(10, 0, 0);
    expect(yawed.depth).toBeCloseTo(-10); expect(yawed.x).toBeCloseTo(0);
    const rolled = createLensProjection({ lens: 1e9, roll: half })(10, 0, 0);
    expect(rolled.x).toBeCloseTo(0); expect(rolled.y).toBeCloseTo(10); expect(rolled.depth).toBe(0);
  });
  it('offsets the plane by depth and origin before perspective', () => {
    const project = createLensProjection({ lens: 800, depth: 800, originX: 100, originY: -20, centerX: 640, centerY: 360 });
    expect(project(0, 0)).toEqual({ x: 690, y: 350, depth: 800 });
  });
});
