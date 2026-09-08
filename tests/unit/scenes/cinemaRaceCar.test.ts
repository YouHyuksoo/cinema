import { describe, expect, it } from 'vitest';
import { raceCarState, raceProject, RACE_CAR_SECONDS } from '@/cinema/raceCar';
import { FILM_CHAPTERS } from '@/cinema/filmProgram';

describe('transparent racing car scene',()=>{
  it('keeps the machine menu and duration while replacing the handset description',()=>{
    const chapter=FILM_CHAPTERS.find(item=>item.id==='machine')!;
    expect(chapter.duration).toBe(RACE_CAR_SECONDS);
    expect(chapter.subtitle).toContain('레이싱카');
    expect(chapter.subtitle).not.toContain('핸드폰');
  });
  it('keeps the chassis, wings and wheels between the diagnostic columns',()=>{
    for(const x of [-130,0,130])for(const y of [-290,0,258])for(const z of [0,60,127]) {
      const point=raceProject([x,y,z]);
      expect(point.x).toBeGreaterThan(237);
      expect(point.x).toBeLessThan(1043);
      expect(Number.isFinite(point.y)).toBe(true);
    }
  });
  it('replays each diagnostic phase deterministically with bounded opacity',()=>{
    for(const time of [0,5,11,17,23,29,36,Infinity,NaN,-1]) {
      const state=raceCarState(time);
      expect(state.presence).toBeGreaterThanOrEqual(0);expect(state.presence).toBeLessThanOrEqual(1);
      expect(state.system).toBeGreaterThanOrEqual(0);expect(state.system).toBeLessThan(5);
      expect(raceCarState(time)).toEqual(state);
    }
    expect([5,11,17,23,29].map(t=>raceCarState(t).system)).toEqual([0,1,2,3,4]);
    expect(raceCarState(36).presence).toBe(0);
  });
});
