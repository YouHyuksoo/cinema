import { describe, expect, it } from 'vitest';
import { chooseShockTarget, shockEnvelope, shockLightning, shockLightningBranches, shockWaitMs } from '@/cinema/reactorMenuShock';
import { cubeApplyMove, cubeInvertSequence, cubeScramble, CUBE_CUBIES, CUBE_IDENTITY } from '@/cinema/filmMenuCube';

describe('reactor menu pranks', () => {
  it('chooses available targets without repeating the previous victim', () => {
    expect(chooseShockTarget(['globe','turbine','cube'], 'globe', 0)).toBe('turbine');
    expect(chooseShockTarget(['globe','turbine','cube'], 'globe', .99)).toBe('cube');
    expect(chooseShockTarget([], null, .5)).toBeNull();
    expect(chooseShockTarget(['cube'], 'cube', .5)).toBe('cube');
  });
  it('limits cadence and smoothly ends the short reaction', () => {
    expect(shockWaitMs(0)).toBe(14000);
    expect(shockWaitMs(1)).toBe(26000);
    expect(shockEnvelope(-1)).toBe(0);
    expect(shockEnvelope(250)).toBeGreaterThan(.8);
    expect(shockEnvelope(2600)).toBe(0);
    expect(shockEnvelope(2300)).toBeLessThan(shockEnvelope(500));
  });
  it('pins the lightning ends to the reactor and moving target', () => {
    const a = {x:20,y:30}, b = {x:800,y:650};
    const points = shockLightning(a, b, 250);
    expect(points[0]).toEqual(a);
    expect(points.at(-1)).toEqual(b);
    expect(points.length).toBe(65);
    expect(points.every(p => Number.isFinite(p.x + p.y))).toBe(true);
    expect(shockLightning(a,b,300)).not.toEqual(points);
  });
  it('draws six simultaneous forks with secondary twigs attached to each fork', () => {
    const trunk = shockLightning({x:10,y:20}, {x:850,y:650}, 240);
    const branches = shockLightningBranches(trunk, 240);
    expect(branches).toHaveLength(12);
    for (let i=0;i<branches.length;i+=2) {
      expect(trunk).toContainEqual(branches[i][0]);
      expect(branches[i]).toContainEqual(branches[i+1][0]);
    }
    expect(branches.flat().every(p=>Number.isFinite(p.x+p.y))).toBe(true);
    expect(shockLightningBranches([],0)).toEqual([]);
  });
  it('restores cube faces after the fast scramble and inverse', () => {
    const moves = cubeScramble(5, 41);
    const original = CUBE_CUBIES.map(() => CUBE_IDENTITY);
    const restored = [...moves, ...cubeInvertSequence(moves)].reduce((state, move) => cubeApplyMove(state, move), original);
    expect(restored).toEqual(original);
  });
});
