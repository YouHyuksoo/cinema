import { filmText, signalColor, type FilmFonts } from '../filmDrawing';
import type { SmtEquipment } from '../smtLine';

/** Front elevations based on equipment references documented in DESIGN.md. */
export function drawSmtEquipment(ctx: CanvasRenderingContext2D, fonts: FilmFonts,
  equipment: SmtEquipment, time: number, heat = 0) {
  const { width: w, height: h, id } = equipment;
  const opacity = ctx.globalAlpha;
  const left = -w / 2;
  const edge = signalColor(heat, .72);
  const rect = (x: number, y: number, width: number, height: number, fill = '#26404a') => {
    ctx.fillStyle = fill; ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = edge; ctx.lineWidth = .85; ctx.strokeRect(x, y, width, height);
  };
  const line = (points: number[][], color = edge, thickness = 1) => {
    ctx.beginPath(); points.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
    ctx.strokeStyle = color; ctx.lineWidth = thickness; ctx.stroke();
  };
  const circle = (x: number, y: number, radius: number, fill = '#10222a') => {
    ctx.beginPath(); ctx.arc(x,y,radius,0,Math.PI*2); ctx.fillStyle=fill; ctx.fill(); ctx.strokeStyle=edge; ctx.stroke();
  };
  const screen = (x: number, y: number) => {
    rect(x,y,27,21,'#05171e'); rect(x+3,y+3,21,12,'#225d69');
    line([[x+13,y+21],[x+13,y+29],[x+4,y+29]]);
  };
  const pcb = (x: number, y: number) => {
    rect(x,y,30,9,'#1c6559');
    for(let i=0;i<4;i++) rect(x+3+i*6,y+2,3,3,'#aac0ac');
  };
  ctx.save();
  // All machines hand off at the same conveyor elevation.
  rect(left-10,-79,w+20,9,'#11232b');
  if(id==='loader'||id==='unloader') {
    rect(left,-h,w,h); rect(left+10,-h+13,w-20,h-49,'#061b24');
    const rackX=id==='loader'?left+15:left+26;
    rect(rackX,-h+22,51,h-68,'#263e46');
    for(let i=0;i<12;i++) {
      line([[rackX+4,-h+29+i*10],[rackX+46,-h+29+i*10]],'#73b9ac',2);
    }
    line([[rackX+2,-h+22],[rackX+2,-47]],edge,2);
    const lift=-74-Math.floor((Math.sin(time*.55)+1)*3)*10;
    rect(left+8,lift,w-16,5,'#619998');
    line([[id==='loader'?w/2-24:left+8,-37],[id==='loader'?w/2-9:left+24,-37]],edge,2);
    screen(w/2-28,-h+19);
  } else if(id==='reflow') {
    rect(left,-h,w,h); rect(left+4,-h+6,w-8,60,'#476068');
    for(let i=0;i<8;i++) {
      const x=left+9+i*31;
      rect(x,-h+13,27,45,'#253f48');
      line([[x+8,-h+48],[x+8,-h+22]],signalColor(.55,.5),2);
    }
    for(let i=0;i<5;i++) rect(left+5+i*65,-65,60,56,'#243d47');
    for(const x of [left+46,left+160]) {rect(x,-h-24,14,24,'#384d55'); rect(x-5,-h-28,24,6);}
    const fanX=w*.34;
    for(const dy of [-105,-35]) {
      circle(fanX,dy,19);
      for(let i=0;i<4;i++) {
        const angle=time*2+i*Math.PI/2;
        line([[fanX,dy],[fanX+Math.cos(angle)*14,dy+Math.sin(angle)*14]],signalColor(heat,.85),3);
      }
    }
    screen(left+9,-h-29);
    if(heat>.001) {
      ctx.beginPath(); ctx.arc(fanX,-105,28,0,Math.PI*2);
      ctx.strokeStyle=signalColor(heat,heat*.8); ctx.lineWidth=2; ctx.stroke();
    }
  } else {
    rect(left,-h,w,h,'#425c64');
    // Printers have a sloped hood; inspection cabinets have taller dark windows.
    const windowBottom=id==='mounter'?-66:-60;
    rect(left+9,-h+20,w-18,h+windowBottom-20,'#071b25');
    if(id==='printer') {
      line([[left+9,-h+20],[left+25,-h+7],[w/2-25,-h+7],[w/2-9,-h+20]],'#8caeb0',2);
      rect(left+22,-94,w-44,11,'#73979b');
      const squeegee=Math.sin(time)*25;
      rect(squeegee-7,-h+48,14,44,'#9ab5b4');
      line([[left+21,-h+47],[w/2-21,-h+47]],edge,3);
    } else if(id==='mounter') {
      line([[left+18,-h+40],[w/2-18,-h+40]],'#819da4',6);
      const head=Math.sin(time*1.8)*55;
      rect(head-19,-h+37,38,30,'#91b4b6');
      for(let i=0;i<5;i++) line([[head-14+i*7,-h+67],[head-14+i*7,-h+77]],edge,2);
      for(let i=0;i<12;i++) {
        const x=left+15+i*16;
        rect(x,-64,10,25,'#64818a'); circle(x+5,-24,10,'#162c36'); circle(x+5,-24,3,'#8eacb2');
      }
      pcb(-15,-83);
    } else {
      const lensY=-h+54;
      rect(-22,-h+26,44,28,id==='spi'?'#496f77':'#617984');
      circle(0,lensY,10,'#2f9eaa');
      if(id==='aoi'||id==='maoi') for(const x of [-28,28]) {circle(x,lensY+9,7);line([[x,lensY+17],[0,-86]],signalColor(0,.23));}
      ctx.fillStyle=signalColor(0,.09); ctx.beginPath();ctx.moveTo(0,lensY+10);ctx.lineTo(-27,-83);ctx.lineTo(27,-83);ctx.closePath();ctx.fill();
      pcb(-15,-86);
      if(id==='spi') for(let i=0;i<6;i++) rect(-22+i*8,-112,4,7+i%3*3,'#3a949c');
    }
    if(id!=='mounter') {rect(left+8,-52,w-16,43,'#29434d'); line([[0,-50],[0,-12]],edge);}
    screen(w/2-34,-h+9);
  }
  for(const x of [left+13,w/2-21]) rect(x,0,8,9,'#0b1920');
  {
    line([[w/2-12,-h],[w/2-12,-h-30]],'#75979e',2);
    for(let i=0;i<3;i++) rect(w/2-16,-h-41+i*6,8,5,i===2?'#66cbaa':'#4c4543');
  }
  filmText(ctx,fonts,equipment.english,0,28,10,opacity,true,'center','#b7d9dc');
  filmText(ctx,fonts,equipment.label,0,45,13,opacity*.9,false,'center','#d8e8e6');
  ctx.restore();
}
