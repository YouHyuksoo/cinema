import { filmText, signalColor, type FilmFonts } from '../filmDrawing';
import { factoryProject, factoryWorld, SMT_FACTORY_DEPTH, type FactoryStation, type FactoryState } from '../smtFactory';
import { fillSpatialPolygon, strokeSpatialPath, type InspectionCamera } from '../inspectionSpace';

/** Conveyor-entry faces become visible when looking into the start of a production line. */
export function drawSmtEntrance(ctx:CanvasRenderingContext2D, fonts:FilmFonts, station:FactoryStation,
  state:FactoryState,camera:InspectionCamera) {
  const x=station.x-station.width/2-.3, left=station.z-SMT_FACTORY_DEPTH, right=station.z;
  if(state.cameraX>=x) return;
  const point=(z:number,y:number)=>factoryWorld({x,y,z});
  const edge=signalColor(0,.55);
  const rect=(z:number,y:number,w:number,h:number,fill:string)=>fillSpatialPolygon(ctx,camera,
    [point(z,y),point(z+w,y),point(z+w,y+h),point(z,y+h)],fill,edge);
  rect(left,0,SMT_FACTORY_DEPTH,station.height,'#16333f');
  if(station.id==='loader'||station.id==='unloader') {
    rect(left+15,30,100,station.height-44,'#071c26');
    rect(left+24,37,80,station.height-62,'#28414a');
    for(let slot=0;slot<12;slot++) strokeSpatialPath(ctx,camera,[point(left+30,46+slot*10),point(right-32,46+slot*10)],signalColor(0,.7),1.2);
    rect(right-20,88,9,58,'#1d5562');
  } else {
    // Common PCB transfer aperture, with equipment-specific covers and service details.
    rect(left+12,65,106,29,'#06141b');
    rect(left+15,66,100,5,'#669899');
    rect(left+48,72,32,5,'#28765f');
    rect(left+20,109,90,station.height-124,'#294651');
    const vents=station.id==='reflow'?9:4;
    for(let i=0;i<vents;i++) strokeSpatialPath(ctx,camera,[point(left+25+i*9,20),point(left+25+i*9,49)],signalColor(0,.35),1);
  }
  const label=factoryProject({x,y:station.height+10,z:station.z-SMT_FACTORY_DEPTH/2},state);
  if(label.visible&&label.scale>.42) filmText(ctx,fonts,`${station.order.toString().padStart(2,'0')} ${station.label}`,
    label.x,label.y,Math.max(9,Math.min(13,10*label.scale)),ctx.globalAlpha*.88,false,'center');
}
