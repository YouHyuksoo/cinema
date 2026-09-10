import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { scannerOrbFlight, SCANNER_ORB_FLIGHT_MS } from '@/cinema/scannerOrbFlight';
const home={x:1090,y:70,r:12},center={x:600,y:350},viewport={width:1200,height:800};
const pose=(time:number,index=0)=>scannerOrbFlight(time,index,home,home,center,viewport);
describe('scanner spheres free flight',()=>{
  it('keeps hover electricity local and gives click flight priority without restarting on pointer leave',()=>{
    const source=readFileSync('src/cinema/ScannerTeslaEffect.tsx','utf8');
    expect(source).toContain("const mode=playing?'flight':hovered&&!still?'hover':'idle'");
    expect(source).toContain('onPointerEnter=');expect(source).toContain('onPointerLeave=');
    expect(source).toContain("if(mode==='hover')");
    expect(source).toContain('drawScannerTesla(ctx,');
    expect(source).toContain('},[mode])');
  });
  it('uses a viewport portal and one RAF clock, restoring the dock on cancellation',()=>{
    const source=readFileSync('src/cinema/ScannerTeslaEffect.tsx','utf8');
    expect(source).toContain('createPortal(canvas,document.body)');
    expect(source).toContain('started??=time');
    expect(source).not.toContain('const started=performance.now()');
    expect(source).toContain('delete plane.dataset.flight');
    expect(source).toContain("event.key==='Escape'");
    expect(source).toContain('disabled={still||playing}');
    expect(source).toContain("document.removeEventListener('visibilitychange',visibility)");
  });
  it('takes off at the actual sphere and returns exactly to its moving dock',()=>{
    expect(pose(0)).toMatchObject({x:home.x,y:home.y,r:home.r,phase:'launch'});
    const moved={x:900,y:95,r:11};
    const landing=scannerOrbFlight(SCANNER_ORB_FLIGHT_MS-.01,0,home,moved,center,viewport)!;
    expect(landing.x).toBeCloseTo(moved.x,3);expect(landing.y).toBeCloseTo(moved.y,3);expect(landing.r).toBeCloseTo(moved.r,3);
    expect(pose(SCANNER_ORB_FLIGHT_MS)).toBeNull();expect(pose(NaN)).toBeNull();expect(pose(-.1)).toBeNull();
  });
  it('separates four trajectories, approaches the camera, and recedes in depth',()=>{
    const points=[0,1,2,3].map(i=>pose(3000,i)!);
    expect(new Set(points.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`)).size).toBe(4);
    const frames=Array.from({length:144},(_,i)=>pose(1100+i*100)!);
    expect(Math.max(...frames.map(p=>p.z))).toBeGreaterThan(100);
    expect(Math.min(...frames.map(p=>p.z))).toBeLessThan(-100);
    expect(Math.max(...frames.map(p=>p.r))).toBeGreaterThan(home.r*3);
    expect(Math.max(...frames.map(p=>p.r))/Math.min(...frames.map(p=>p.r))).toBeGreaterThan(2);
  });
  it('has continuous launch, orbit, regroup and return transitions',()=>{
    for(const boundary of [1100,15500,16500])for(let i=0;i<4;i++){
      const before=pose(boundary-.001,i)!,after=pose(boundary,i)!;
      expect(Math.hypot(before.x-after.x,before.y-after.y,before.r-after.r)).toBeLessThan(.01);
    }
    expect(pose(15800)?.phase).toBe('regroup');expect(pose(17000)?.phase).toBe('return');
  });
  it('presents exactly one sphere at a time, motionless and large for two seconds',()=>{
    for(let index=0;index<4;index++){
      const start=1100+index*3600+800;
      const first=pose(start+1,index)!,last=pose(start+1999,index)!;
      expect(first.phase).toBe('inspect');
      expect(first).toEqual(last);
      expect(first.r).toBeGreaterThanOrEqual(100);
      expect([0,1,2,3].filter(i=>pose(start+1000,i)?.phase==='inspect')).toEqual([index]);
      for(const boundary of [start-800,start,start+2000,start+2800]){
        const a=pose(boundary-.001,index)!,b=pose(boundary,index)!;
        expect(Math.hypot(a.x-b.x,a.y-b.y,a.r-b.r)).toBeLessThan(.02);
      }
    }
  });
});
