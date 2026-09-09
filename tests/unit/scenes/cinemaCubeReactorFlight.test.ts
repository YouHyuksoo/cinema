import { describe, expect, it } from 'vitest';
import { cubeReactorFlight, CUBE_REACTOR_FLIGHT_MS } from '@/cinema/cubeReactorFlight';

const dock = { x:100,y:80 }, reactor = { x:600,y:350,radius:160 };
describe('shocked cube reactor flyby', () => {
  it('takes off at the dock and lands exactly at the dock', () => {
    expect(cubeReactorFlight(0,dock,reactor)).toMatchObject({x:dock.x,y:dock.y,scale:1,phase:'approach'});
    const landing = cubeReactorFlight(CUBE_REACTOR_FLIGHT_MS-1,dock,reactor)!;
    expect(landing.x).toBeCloseTo(dock.x,2);
    expect(landing.y).toBeCloseTo(dock.y,2);
    expect(cubeReactorFlight(CUBE_REACTOR_FLIGHT_MS,dock,reactor)).toBeNull();
  });
  it('orbits in three dimensions around the reactor and crosses front and back', () => {
    for (const t of [1200,6000]) {
      const before=cubeReactorFlight(t-.01,dock,reactor)!, after=cubeReactorFlight(t,dock,reactor)!;
      expect(Math.hypot(before.x-after.x,before.y-after.y)).toBeLessThan(.02);
    }
    for (const t of [1200,2400,3600,4800,5999]) {
      const p=cubeReactorFlight(t,dock,reactor)!;
      expect((p.x-reactor.x)**2+(p.y-reactor.y)**2+p.z**2).toBeCloseTo(160**2);
      expect(p.phase).toBe('orbit');
    }
    const front=cubeReactorFlight(2766,dock,reactor)!, back=cubeReactorFlight(4434,dock,reactor)!;
    expect(back.z).toBeLessThan(0);
    expect(front.z).toBeGreaterThan(0);
    expect(back.projected.scale).toBeLessThan(.7);
    expect(front.projected.scale).toBeGreaterThan(2);
    expect(front.projected.scale/back.projected.scale).toBeGreaterThan(3);
    expect(front.projected.y).toBeGreaterThan(reactor.y);
    expect(back.projected.y).toBeLessThan(reactor.y);
    expect(front.projected.x).not.toBe(front.x);
  });
  it('follows a moved reactor and a resized dock without storing old viewport pixels', () => {
    const delta={x:120,y:50};
    const old=cubeReactorFlight(2500,dock,reactor)!;
    const next=cubeReactorFlight(2500,{x:dock.x+delta.x,y:dock.y+delta.y},{x:reactor.x+delta.x,y:reactor.y+delta.y,radius:160})!;
    expect(next.x-old.x).toBeCloseTo(delta.x);
    expect(next.y-old.y).toBeCloseTo(delta.y);
    expect(cubeReactorFlight(NaN,dock,reactor)).toBeNull();
  });
});
