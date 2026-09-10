import { lensScale } from './filmLens';

export const CUBE_REACTOR_FLIGHT_MS = 7300;
export const CUBE_FLIGHT_PERSPECTIVE = 900;
type Point = { x:number; y:number };
const smooth = (t:number) => t*t*(3-2*t);
const project = (x:number,y:number,z:number,center:Point,perspective:number) => {
  const scale=lensScale(perspective,-z);
  return {x:center.x+(x-center.x)*scale,y:center.y+(y-center.y)*scale,scale};
};

/** Live screen coordinates keep the flight anchored while the viewport or reactor moves. */
export function cubeReactorFlight(elapsed:number, dock:Point, reactor:Point & { radius:number }) {
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= CUBE_REACTOR_FLIGHT_MS) return null;
  const radius=reactor.radius, tilt=18*Math.PI/180;
  // Near-camera depth makes the orbit visibly approach and recede, not trace a flat loop.
  const orbitPerspective=Math.max(240,radius*1.8);
  const entry={x:reactor.x-radius,y:reactor.y};
  const pose=(phase:'approach'|'orbit'|'return',x:number,y:number,z:number,bank:number,yaw:number,blend=1) => {
    const camera={x:x+(reactor.x-x)*blend,y:y+(reactor.y-y)*blend};
    const perspective=CUBE_FLIGHT_PERSPECTIVE+(orbitPerspective-CUBE_FLIGHT_PERSPECTIVE)*blend;
    return {phase,x,y,z,scale:1,bank,yaw,camera,perspective,projected:project(x,y,z,camera,perspective)};
  };
  if (elapsed < 1200) {
    const t=smooth(elapsed/1200);
    return pose('approach',dock.x+(entry.x-dock.x)*t,dock.y+(entry.y-dock.y)*t-Math.sin(Math.PI*t)*35,0,-12*Math.sin(Math.PI*t),90*t,t);
  }
  if (elapsed < 6000) {
    const t=smooth((elapsed-1200)/4800), angle=Math.PI-t*Math.PI*2;
    // Rotate a radius vector in XYZ space around the reactor, then tilt the orbit plane.
    const depth=radius*Math.sin(angle);
    return pose('orbit',reactor.x+Math.cos(angle)*radius,reactor.y+depth*Math.sin(tilt),depth*Math.cos(tilt),10*Math.sin(t*Math.PI*2),90+180*t);
  }
  const t=smooth((elapsed-6000)/1300);
  return pose('return',entry.x+(dock.x-entry.x)*t,entry.y+(dock.y-entry.y)*t-Math.sin(Math.PI*t)*45,0,12*Math.sin(Math.PI*t),270+90*t,1-t);
}
