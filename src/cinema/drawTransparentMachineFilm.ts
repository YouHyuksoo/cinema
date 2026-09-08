import { drawRaceCar } from './components/drawRaceCar';
import { drawRaceDiagnostics } from './components/drawRaceDiagnostics';
import { DEFAULT_FONTS, filmText, type FilmFonts } from './filmDrawing';
import { beginFilmViewport, type FilmViewportInsets } from './filmViewport';
import { raceCarState, raceProject, RACE_SYSTEMS } from './raceCar';

/** Transparent racing chassis with synchronized flow paths and six diagnostic panels. */
export function drawTransparentMachineFilm(ctx: CanvasRenderingContext2D, width: number, height: number, time: number,
  fonts: FilmFonts = DEFAULT_FONTS, insets?: FilmViewportInsets) {
  const view=beginFilmViewport(ctx,width,height,insets),state=raceCarState(time);
  ctx.fillStyle='#02070b';ctx.fillRect(view.left,view.top,view.right-view.left,view.bottom-view.top);
  const halo=ctx.createRadialGradient(650,365,20,650,365,420);
  halo.addColorStop(0,'#123246');halo.addColorStop(.65,'#071622');halo.addColorStop(1,'#02070b');
  ctx.fillStyle=halo;ctx.fillRect(view.left,view.top,view.right-view.left,view.bottom-view.top);
  drawRaceCar(ctx,state);
  drawRaceDiagnostics(ctx,fonts,state);
  const text=(value:string,x:number,y:number,size:number,alpha=.75)=>filmText(ctx,fonts,value,x,y,size,state.presence*alpha,true);
  text('AERO / X-RAY',32,69,22,1);text('RACING CHASSIS · STRUCTURAL TELEMETRY',33,88,8);
  text('LAP  44 / 57',1044,70,14);text('SIMULATED VEHICLE DATA',1044,89,8);
  const annotations=[
    {point:[0,-267,26] as const,x:293,y:605,label:'FRONT WING / AIRFLOW'},
    {point:[0,-60,85] as const,x:308,y:183,label:'MONOCOQUE / HALO'},
    {point:[15,113,73] as const,x:805,y:165,label:'V6 / HYBRID POWER UNIT'},
    {point:[0,237,112] as const,x:772,y:119,label:'REAR WING / DRS'},
  ];
  ctx.save();
  for(const item of annotations) {
    const p=raceProject(item.point);
    ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(item.x,item.y+9);ctx.lineTo(item.x+120,item.y+9);
    ctx.strokeStyle='rgba(150,210,232,.34)';ctx.lineWidth=.6;ctx.globalAlpha=state.presence;ctx.stroke();
    text(item.label,item.x,item.y,8,.65);
  }
  ctx.restore();
  text('0'+(state.system+1)+' / '+RACE_SYSTEMS[state.system],389,651,12,.9);
  text('TRANSPARENT STRUCTURE / ENGINEERING VISUALIZATION',357,678,9,.48);
}
