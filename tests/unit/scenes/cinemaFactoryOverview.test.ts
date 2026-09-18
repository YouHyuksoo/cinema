import { expect, it } from 'vitest';
import { factoryProject, smtFactoryState, SMT_FACTORY_STATIONS, SMT_FACTORY_DEPTH } from '@/cinema/smtFactory';
it('keeps every machine inside the overview throughout the final full rotation', () => {
  for (let time = 50; time <= 62; time += .5) {
    const state = smtFactoryState(time);
    for (const station of SMT_FACTORY_STATIONS) {
      for (const x of [station.x - station.width / 2, station.x + station.width / 2])
        for (const z of [station.z - SMT_FACTORY_DEPTH, station.z])
          for (const y of [0, station.height + 45]) {
            const p = factoryProject({x,y,z}, state);
            expect(p.visible).toBe(true);
            expect(p.x).toBeGreaterThan(50); expect(p.x).toBeLessThan(1230);
            expect(p.y).toBeGreaterThan(110); expect(p.y).toBeLessThan(640);
          }
    }
  }
});
