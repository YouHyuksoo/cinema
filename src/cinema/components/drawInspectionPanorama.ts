import { filmText, signalColor, type FilmFonts } from '../filmDrawing';
import { SMT_LINE_WIDTH, SMT_STATIONS, SMT_THERMAL_TARGET } from '../smtLine';
import { drawSmtEquipment } from './drawSmtEquipment';

export interface PanoramaViewport { left: number; top: number; right: number; bottom: number }

/** Shared transform for the line, target box and cooling-fan annotation. */
export function smtPanoramaLayout(time: number, focus: number) {
  const amount = Math.max(0, Math.min(1, focus));
  const driftX = Math.sin(time * .36 - .45) * 12 * (1 - amount);
  const driftY = Math.sin(time * .31) * 2 * (1 - amount);
  const scale = 1080 / SMT_LINE_WIDTH * (1 - amount) + 1.05 * amount;
  const centerX = SMT_LINE_WIDTH / 2 * (1 - amount) + SMT_THERMAL_TARGET.x * amount;
  const screenX = 640 * (1 - amount) + 450 * amount;
  const floorY = 447 - amount * 17;
  const point = (x: number, y: number) => ({ x: screenX + (x - centerX) * scale + driftX, y: floorY + y * scale + driftY });
  return { amount, driftX, driftY, scale, centerX, screenX, floorY,
    target: { ...point(SMT_THERMAL_TARGET.x, -88), width: (SMT_THERMAL_TARGET.width + 22) * scale, height: 214 * scale },
    detail: { ...point(SMT_THERMAL_TARGET.x + SMT_THERMAL_TARGET.width * .34, -105), scale },
  };
}

/** Eight distinct machines, never repeated to fill the viewport. */
export function drawInspectionPanorama(ctx: CanvasRenderingContext2D, fonts: FilmFonts,
  time: number, focus: number, heat: number, view: PanoramaViewport) {
  const layout = smtPanoramaLayout(time, focus);
  const { amount, scale, driftX, driftY, centerX, screenX, floorY } = layout;
  ctx.save();
  const ambient = ctx.createLinearGradient(0, view.top, 0, view.bottom);
  ambient.addColorStop(0, '#071821'); ambient.addColorStop(.5, '#18343e'); ambient.addColorStop(1, '#06141e');
  ctx.fillStyle = ambient; ctx.fillRect(view.left, view.top, view.right-view.left, view.bottom-view.top);
  ctx.strokeStyle=signalColor(0,.075); ctx.lineWidth=1;
  for(let x=Math.floor(view.left/160)*160;x<view.right;x+=160) {
    ctx.beginPath();ctx.moveTo(x,view.top);ctx.lineTo(x,view.bottom);ctx.stroke();
  }
  for(const y of [183,199,488,510,540]) {
    ctx.beginPath();ctx.moveTo(view.left,y);ctx.lineTo(view.right,y);ctx.stroke();
  }
  ctx.save();ctx.translate(screenX+driftX,floorY+driftY);ctx.scale(scale,scale);ctx.translate(-centerX,0);
  ctx.fillStyle='#152c34';ctx.fillRect(0,-79,SMT_LINE_WIDTH,9);
  ctx.strokeStyle=signalColor(0,.4);ctx.strokeRect(0,-79,SMT_LINE_WIDTH,9);
  for(const station of SMT_STATIONS) {
    ctx.save();ctx.translate(station.x,0);
    ctx.globalAlpha=station.id==='reflow'?1:1-amount*.55;
    drawSmtEquipment(ctx,fonts,station,time,station.id==='reflow'?heat:0);
    filmText(ctx,fonts,String(station.order).padStart(2,'0'),0,-station.height-55,12,ctx.globalAlpha*.72,true,'center');
    ctx.restore();
  }
  ctx.restore();
  const stepWidth=134;
  SMT_STATIONS.forEach((station,index)=>{
    const x=640+(index-3.5)*stepWidth;
    const selected=station.id==='reflow'&&amount>.2;
    filmText(ctx,fonts,String(station.order).padStart(2,'0')+' '+station.label,x,660,12,selected?1:.7,false,'center',signalColor(selected?heat:0,1));
    if(index<7) filmText(ctx,fonts,'→',x+stepWidth/2,660,11,.4,true,'center');
  });
  filmText(ctx,fonts,'PCB FLOW  /  LEFT → RIGHT',640,523,10,.45,true,'center');
  ctx.restore();
  return layout;
}
