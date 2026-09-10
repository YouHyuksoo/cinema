import { shockLightning, shockLightningBranches } from './reactorMenuShock';
export const SCANNER_TESLA_MS=2400;
export type TeslaOrb={x:number;y:number;r:number};
type Arc={from:number;to:number;trunk:{x:number;y:number}[];branches:{x:number;y:number}[][]};
export function scannerTeslaArcs(orbs:TeslaOrb[],elapsed:number):Arc[] {
  if(orbs.length!==4||!Number.isFinite(elapsed)||elapsed<0||elapsed>=SCANNER_TESLA_MS) return [];
  const arcs:Arc[]=[];
  for(let from=0;from<4;from++) for(let to=from+1;to<4;to++) {
    const a=orbs[from],b=orbs[to],distance=Math.hypot(b.x-a.x,b.y-a.y);
    if(distance<=a.r+b.r) continue;
    const dx=(b.x-a.x)/distance,dy=(b.y-a.y)/distance;
    const seedTime=elapsed+(from*4+to)*270;
    const trunk=shockLightning({x:a.x+dx*a.r,y:a.y+dy*a.r},{x:b.x-dx*b.r,y:b.y-dy*b.r},seedTime);
    arcs.push({from,to,trunk,branches:shockLightningBranches(trunk,seedTime)});
  }
  return arcs;
}
