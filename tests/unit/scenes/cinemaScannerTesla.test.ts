import { describe, expect, it } from 'vitest';
import { scannerTeslaArcs, SCANNER_TESLA_MS } from '@/cinema/scannerTesla';

const orbs=[{x:20,y:20,r:5},{x:80,y:20,r:5},{x:80,y:80,r:5},{x:20,y:80,r:5}];
describe('scanner Tesla discharge',()=>{
  it('connects every pair of the four spheres with branched, surface-anchored lightning',()=>{
    const arcs=scannerTeslaArcs(orbs,300);
    expect(arcs).toHaveLength(6);
    for(const arc of arcs){
      expect(arc.trunk).toHaveLength(65);
      expect(arc.branches).toHaveLength(12);
      expect(arc.trunk[0]).not.toEqual(orbs[arc.from]);
      expect(Math.hypot(arc.trunk[0].x-orbs[arc.from].x,arc.trunk[0].y-orbs[arc.from].y)).toBeCloseTo(5);
    }
  });
  it('follows moving spheres, changes the forks, and finishes without persistent lightning',()=>{
    expect(scannerTeslaArcs(orbs,300)).not.toEqual(scannerTeslaArcs(orbs,500));
    expect(scannerTeslaArcs(orbs.map(p=>({...p,x:p.x+15})),300)[0].trunk[0].x).toBeCloseTo(40);
    expect(scannerTeslaArcs(orbs,SCANNER_TESLA_MS)).toEqual([]);
    expect(scannerTeslaArcs(orbs.slice(0,3),300)).toEqual([]);
  });
});
