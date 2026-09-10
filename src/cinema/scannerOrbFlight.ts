import type { TeslaOrb } from './scannerTesla';
export const SCANNER_ORB_FLIGHT_MS=18000;
export type FlightPose=TeslaOrb&{z:number;focus?:number;phase:'launch'|'orbit'|'inspect'|'regroup'|'return'};
const smooth=(t:number)=>t*t*(3-2*t);
export function scannerOrbFlight(elapsed:number,index:number,launch:TeslaOrb,dock:TeslaOrb,center:{x:number;y:number},viewport:{width:number;height:number}):FlightPose|null {
  if(!Number.isFinite(elapsed)||elapsed<0||elapsed>=SCANNER_ORB_FLIGHT_MS) return null;
  const radius=Math.min(viewport.width*.2,viewport.height*.22,220)*(1-index*.06);
  const tilt=(22+index*10)*Math.PI/180,perspective=radius*1.9;
  const initial=Math.PI+index*Math.PI/2;
  const orbit=(progress:number):FlightPose=>{
    const angle=initial+progress*Math.PI*2*(index%2?-1:1);
    const z=Math.sin(angle)*radius*Math.cos(tilt),projection=perspective/(perspective-z);
    return {phase:'orbit',x:center.x+(index%2?1:-1)*radius*.4+Math.cos(angle)*radius*projection,
      y:center.y+(index<2?-1:1)*radius*.24+Math.sin(angle)*radius*Math.sin(tilt)*projection,
      z,r:dock.r*2.2*projection};
  };
  const mix=(a:TeslaOrb&{z?:number},b:TeslaOrb&{z?:number},t:number,phase:FlightPose['phase'],lift:number):FlightPose=>({
    phase,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t-Math.sin(Math.PI*t)*lift,
    r:a.r+(b.r-a.r)*t,z:(a.z??0)+((b.z??0)-(a.z??0))*t,
  });
  const formation={x:Math.max(65,Math.min(viewport.width-65,dock.x-70))+Math.cos(initial)*32,
    y:Math.min(viewport.height-90,dock.y+95)+Math.sin(initial)*24,r:dock.r*1.4,z:0};
  if(elapsed<1100) return mix(launch,orbit(0),smooth(elapsed/1100),'launch',45);
  if(elapsed<15500){
    const clock=elapsed-1100,base=orbit(clock/7200),local=clock-index*3600;
    if(local<0||local>=3600)return base;
    const focus:FlightPose={phase:'inspect',focus:1,x:viewport.width*.5,y:viewport.height*.4,
      r:Math.min(140,viewport.width*.14,viewport.height*.17),z:radius*3};
    // A literal fixed pose holds for two seconds; even texture rotation stops in the renderer.
    const weight=local<800?smooth(local/800):local<2800?1:1-smooth((local-2800)/800);
    if(weight===1)return focus;
    return {...mix(base,focus,weight,'orbit',0),focus:weight};
  }
  if(elapsed<16500) return mix(orbit(2),formation,smooth((elapsed-15500)/1000),'regroup',25);
  return mix(formation,dock,smooth((elapsed-16500)/1500),'return',30);
}
