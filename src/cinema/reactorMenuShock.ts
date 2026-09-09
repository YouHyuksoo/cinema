export type ShockTarget = 'globe' | 'turbine' | 'cube';
export const SHOCK_DURATION_MS = 2600;
export const SHOCK_ATTRIBUTE = 'data-reactor-shock';
type Point = { x: number; y: number };
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function chooseShockTarget(available: ShockTarget[], previous: ShockTarget | null, random: number): ShockTarget | null {
  const other = available.filter(target => target !== previous);
  const choices = other.length ? other : available;
  return choices[Math.min(choices.length - 1, Math.floor(clamp(random) * choices.length))] ?? null;
}
export function shockWaitMs(random: number) { return 14000 + clamp(random) * 12000; }
export function shockEnvelope(elapsed: number) {
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= SHOCK_DURATION_MS) return 0;
  return clamp(elapsed / 90) * (1 - clamp((elapsed - 1200) / 1400)) ** 2;
}
function lightningChannel(from:Point,to:Point,seed:number,levels:number):Point[] {
  let state=(seed+1)>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296-.5;};
  const points:Point[]=[from];
  const split=(a:Point,b:Point,depth:number,spread:number) => {
    if (!depth) {points.push(b);return;}
    const dx=b.x-a.x,dy=b.y-a.y,length=Math.max(1,Math.hypot(dx,dy));
    const offset=random()*spread, along=.42+random()*.2;
    const mid={x:a.x+dx*along-dy/length*offset,y:a.y+dy*along+dx/length*offset};
    split(a,mid,depth-1,spread*.48);split(mid,b,depth-1,spread*.48);
  };
  split(from,to,levels,Math.min(95,Math.hypot(to.x-from.x,to.y-from.y)*.23));
  return points;
}
/** Irregular multi-scale channels, not a periodic sawtooth; endpoints stay pinned. */
export function shockLightning(from: Point, to: Point, elapsed: number): Point[] {
  return lightningChannel(from,to,Math.floor(elapsed/90)*977+31,6);
}

/** Six leaders and their finer forks strike together, attached to the live trunk geometry. */
export function shockLightningBranches(trunk: Point[], elapsed: number): Point[][] {
  if (trunk.length < 65) return [];
  const a = trunk[0], b = trunk[trunk.length-1];
  const direction = Math.atan2(b.y-a.y,b.x-a.x), distance = Math.hypot(b.x-a.x,b.y-a.y);
  const branches: Point[][] = [];
  for (let i=0;i<6;i++) {
    const fork = trunk[9+i*9], side = i%2 ? 1 : -1;
    const phase = Math.floor(elapsed/90)*.7+i*2.1;
    const length = Math.min(150,distance*.26) * (.45+.55*Math.sin(phase)**2);
    const angle = direction+side*(.45+.55*Math.sin(phase)**2);
    const end = {x:fork.x+Math.cos(angle)*length,y:fork.y+Math.sin(angle)*length};
    const branch = lightningChannel(fork,end,Math.floor(elapsed/90)*911+i*47,4);
    const twigStart = branch[9], twigAngle = angle-side*.85;
    const twigEnd = {x:twigStart.x+Math.cos(twigAngle)*length*.45,y:twigStart.y+Math.sin(twigAngle)*length*.45};
    branches.push(branch,lightningChannel(twigStart,twigEnd,Math.floor(elapsed/90)*613+i*97,3));
  }
  return branches;
}
