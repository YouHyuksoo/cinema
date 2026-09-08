import { describe, expect, it } from 'vitest';
import { SMT_LINE_WIDTH, SMT_STATIONS, SMT_THERMAL_TARGET } from '@/cinema/smtLine';
import { smtPanoramaLayout } from '@/cinema/components/drawInspectionPanorama';

describe('planar SMT production line', () => {
  it('follows the operator supplied process order without duplicate equipment', () => {
    expect(SMT_STATIONS.map(station => station.id)).toEqual(['loader','printer','spi','mounter','maoi','reflow','aoi','unloader']);
    expect(SMT_STATIONS[4]).toMatchObject({ label: 'MAOI', english: 'POST-MOUNT AOI' });
    for(let i=1;i<SMT_STATIONS.length;i++) {
      const previous=SMT_STATIONS[i-1], next=SMT_STATIONS[i];
      expect(next.x-next.width/2).toBeGreaterThan(previous.x+previous.width/2);
    }
    expect(SMT_THERMAL_TARGET.order).toBe(6);
  });
  it('fits the full line in the overview and tracks the cooling fan through the entire move', () => {
    for(let time=0;time<=32;time+=.1) {
      const overview=smtPanoramaLayout(time,0);
      const left=overview.screenX-overview.centerX*overview.scale+overview.driftX;
      expect(left).toBeGreaterThan(72);
      expect(left+SMT_LINE_WIDTH*overview.scale).toBeLessThan(1208);
      for(const focus of [0,.25,.5,.75,1]) {
        const {target,detail}=smtPanoramaLayout(time,focus);
        expect(Math.abs(detail.x-target.x)).toBeLessThan(target.width/2);
        expect(Math.abs(detail.y-target.y)).toBeLessThan(target.height/2);
        expect(target.width).toBeGreaterThan(0);
        expect(target.x+target.width/2).toBeLessThan(1208);
      }
    }
  });
});
