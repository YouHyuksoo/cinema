import { filmText, signalColor, smooth, type FilmFonts } from '../filmDrawing';
import { factoryProject, SMT_FACTORY_STATIONS, SMT_FACTORY_DEPTH, SMT_FACTORY_LINES, SMT_FACTORY_PITCH,
  type FactoryPoint, type FactoryState } from '../smtFactory';
import { SMT_LINE_WIDTH } from '../smtLine';
import { drawSmtEquipment } from './drawSmtEquipment';
import { factoryCamera, factoryWorld } from '../smtFactory';
import { fillSpatialPolygon, inspectionCameraPoint, strokeSpatialPath } from '../inspectionSpace';
import { drawSmtEntrance } from './drawSmtEntrance';
import { drawProjectedFilmSurface } from './drawProjectedFilmSurface';

/** Draw visible cabinet faces in the same downstream perspective as the camera. */
export function drawSmtFactory(ctx: CanvasRenderingContext2D, fonts: FilmFonts, state: FactoryState,
  options: { ground?: boolean } = {}) {
  const project=(p:FactoryPoint)=>factoryProject(p,state);
  const camera=factoryCamera(state);
  const path=(points:FactoryPoint[],color:string,fill?:string)=>{
    if(fill) fillSpatialPolygon(ctx,camera,points.map(factoryWorld),fill,color);
    else strokeSpatialPath(ctx,camera,points.map(factoryWorld),color,.7);
  };
  ctx.save();ctx.globalAlpha=state.presence;
  if(options.ground !== false) {
    for(let x=-300;x<=SMT_LINE_WIDTH+300;x+=100)path([{x,y:0,z:-380},{x,y:0,z:2300}],signalColor(0,.06));
    for(let z=-400;z<=2300;z+=100)path([{x:-300,y:0,z},{x:SMT_LINE_WIDTH+300,y:0,z}],signalColor(0,.06));
  }
  for(let line=0;line<SMT_FACTORY_LINES;line++) {
    const z=line*SMT_FACTORY_PITCH;
    if(options.ground !== false) path([{x:-25,y:0,z:z+20},{x:SMT_LINE_WIDTH+25,y:0,z:z+20},{x:SMT_LINE_WIDTH+25,y:0,z:z-SMT_FACTORY_DEPTH-25},{x:-25,y:0,z:z-SMT_FACTORY_DEPTH-25}],signalColor(0,.14),'rgba(7,24,32,.65)');
    const label=project({x:-65,y:0,z:z+25});
    if(label.visible) filmText(ctx,fonts,`LINE ${String(line+1).padStart(2,'0')}`,label.x,label.y,12,state.presence*.8,true,'center');
    path([{x:0,y:77,z:z-25},{x:SMT_LINE_WIDTH,y:77,z:z-25}],signalColor(0,.45));
    for(let x=40;x<SMT_LINE_WIDTH;x+=180)path([{x,y:1,z:z+40},{x:x+45,y:1,z:z+40},{x:x+34,y:1,z:z+30}],signalColor(0,.3));
  }
  const cameraDepth=(station:FactoryState['station'])=>inspectionCameraPoint(camera,factoryWorld({x:station.x,y:station.height/2,z:station.z-SMT_FACTORY_DEPTH/2})).z;
  const ordered=[...SMT_FACTORY_STATIONS].sort((a,b)=>cameraDepth(b)-cameraDepth(a));
  for(const station of ordered) {
    const {x,z,width:w,height:h}=station;
    const front=project({x,y:h/2,z});
    const halfDepth=Math.cos(camera.pitch)*(Math.abs(Math.cos(camera.yaw))*w+Math.abs(Math.sin(camera.yaw))*SMT_FACTORY_DEPTH)/2
      +Math.abs(Math.sin(camera.pitch))*h/2;
    if(cameraDepth(station)+halfDepth<camera.near) continue;
    const selected=station.key===(state.manualSelection===undefined?state.station.key:state.manualSelection);
    ctx.globalAlpha=state.presence*(selected?1:(1-state.focus*.70)*(state.manualSelection===undefined?smooth(100,230,front.depth):1));
    const heat=selected&&state.manualSelection===undefined&&state.stop.kind==='thermal'?1:0;
    const edge=signalColor(heat,selected?.9:.48);
    if(camera.y>h) path([{x:x-w/2,y:h,z},{x:x-w/2,y:h,z:z-SMT_FACTORY_DEPTH},{x:x+w/2,y:h,z:z-SMT_FACTORY_DEPTH},{x:x+w/2,y:h,z}],edge,'#29444f');
    if(state.cameraZ<z-SMT_FACTORY_DEPTH) {
      const back=z-SMT_FACTORY_DEPTH;
      path([{x:x-w/2,y:0,z:back},{x:x+w/2,y:0,z:back},{x:x+w/2,y:h,z:back},{x:x-w/2,y:h,z:back}],edge,'#142b36');
      for(let panel=1;panel<4;panel++) path([
        {x:x-w/2+w*panel/4,y:12,z:back},{x:x-w/2+w*panel/4,y:h-12,z:back},
      ],signalColor(0,.2));
    }
    const side=state.cameraX>=x?1:-1;
    path([{x:x+side*w/2,y:0,z},{x:x+side*w/2,y:0,z:z-SMT_FACTORY_DEPTH},{x:x+side*w/2,y:h,z:z-SMT_FACTORY_DEPTH},{x:x+side*w/2,y:h,z}],edge,'#152e3c');
    for(let rib=1;rib<5;rib++)path([{x:x+side*w/2,y:h*.2,z:z-rib*23},{x:x+side*w/2,y:h*.75,z:z-rib*23}],signalColor(0,.17));
    const surfaceWidth=w+24,surfaceHeight=h+100;
    const surfaceProject=(u:number,v:number)=>project({x:x+u,y:h/2-v,z});
    const corners=[-1,1].flatMap(u=>[-1,1].map(v=>surfaceProject(u*surfaceWidth/2,v*surfaceHeight/2)));
    if(state.cameraZ>z&&corners.every(p=>p.visible)) drawProjectedFilmSurface(ctx,{
      width:surfaceWidth,height:surfaceHeight,project:surfaceProject,
      draw:surface=>{surface.translate(0,h/2);drawSmtEquipment(surface,fonts,station,state.time,heat);},
    });
    else if(state.cameraZ>z) path([
      {x:x-w/2,y:0,z},{x:x+w/2,y:0,z},{x:x+w/2,y:h,z},{x:x-w/2,y:h,z},
    ],edge,'#26404a');
    drawSmtEntrance(ctx,fonts,station,state,camera);
  }
  ctx.restore();
}
