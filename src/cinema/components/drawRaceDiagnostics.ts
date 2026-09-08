import { filmText, type FilmFonts } from '../filmDrawing';
import { RACE_DIAGNOSTICS as data, type RaceCarState } from '../raceCar';

/** Fixed demonstration readings; animated tracers never change the displayed measurements. */
export function drawRaceDiagnostics(ctx: CanvasRenderingContext2D, fonts: FilmFonts, state: RaceCarState) {
  const cyan='#48d8e0',amber='#f4b16e';
  const text=(value:string,x:number,y:number,size=10,color='#b7d0d3')=>filmText(ctx,fonts,value,x,y,size,state.presence*.9,true,'left',color);
  const line=(x:number,y:number,tx:number,ty:number,color=cyan)=>{
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(tx,ty);ctx.strokeStyle=color;ctx.lineWidth=.8;ctx.stroke();
  };
  const panel=(x:number,y:number,title:string,selected:boolean)=>{
    ctx.fillStyle='rgba(0,7,11,.72)';ctx.fillRect(x,y,207,172);
    line(x,y+1,x+207,y+1,selected?cyan:'#294149');text(title,x+10,y+21,10,'#e1eeed');
  };
  const bar=(x:number,y:number,ratio:number,color=cyan)=>{
    ctx.fillStyle='#163039';ctx.fillRect(x,y,108,4);ctx.fillStyle=color;ctx.fillRect(x,y,108*Math.min(1,ratio),4);
  };
  ctx.save();ctx.globalAlpha=state.presence;
  panel(30,123,'LIQUID ERS / HYBRID',state.system===1);
  ctx.fillStyle='rgba(36,208,218,.15)';ctx.fillRect(43,165,48,84);ctx.strokeStyle=cyan;ctx.strokeRect(43,158,48,91);
  for(let i=0;i<7;i++) {
    line(47+i*6,163,47+i*6,244,'#38797d');
    const y=245-((state.time*13+i*11)%73);ctx.fillStyle=cyan;ctx.fillRect(48+i*5,y,2,3);
  }
  text('CHARGE',104,165,8);text(data.battery.toFixed(1)+'%',104,189,23,cyan);bar(104,201,data.battery/100);
  text('COOLANT',104,221,8);text(data.coolant+'%',104,243,21,cyan);bar(104,254,data.coolant/100);
  text('FLOW  '+data.flow+' kW  /  DEMO',43,279,9);

  panel(30,307,'AERO LOAD / BALANCE',state.system===0);
  line(47,441,218,441,'#36515a');line(47,350,47,441,'#36515a');
  for(let i=0;i<5;i++)line(47,352+i*20,218,352+i*20,'#142c34');
  ctx.fillStyle='rgba(55,202,217,.2)';ctx.fillRect(72,391,44,50);line(72,391,116,391);
  ctx.fillStyle='rgba(231,159,90,.2)';ctx.fillRect(145,383,44,58);line(145,383,189,383,amber);
  text('FRONT',65,368,8);text('REAR',151,368,8);text('46.5%',67,462,12,cyan);text('53.5%',145,462,12,amber);

  panel(30,491,'DOWNFORCE / DISTRIBUTION',state.system===0);
  const cx=133,cy=581;
  for(const r of [32,39,45,49]) {ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.strokeStyle='#2d6979';ctx.stroke();}
  for(let i=0;i<40;i++) {const a=i/40*Math.PI*2;line(cx+Math.cos(a)*43,cy+Math.sin(a)*43,cx+Math.cos(a)*48,cy+Math.sin(a)*48,i<19?cyan:amber);}
  line(cx,548,cx,611);line(cx-18,561,cx+18,561);line(cx-20,600,cx+20,600);
  text('LIFT',43,634,8);text('-3.45',43,651,12,cyan);text('DRAG',172,634,8);text('0.92',172,651,12,amber);

  panel(1043,123,'POWER UNIT DIAGNOSTICS',state.system===2);
  text('CYL 1–3',1055,159,8);text(data.engine+'°C',1055,182,22,cyan);
  text('CYL 4–6',1055,208,8);text(data.exhaust+'°C',1055,229,22,amber);
  text('TURBINE PRESSURE',1055,254,8);text(data.pressure.toFixed(1)+' BAR',1055,277,18,cyan);
  // Compact engine bank schematic.
  for(let i=0;i<3;i++) {
    ctx.strokeStyle=cyan;ctx.strokeRect(1150+i*22,163+i*9,18,45);
    ctx.strokeStyle=amber;ctx.strokeRect(1150+i*22,216+i*5,18,22);
    line(1159+i*22,207+i*9,1159+i*22,216+i*5,amber);
  }

  panel(1043,307,'SUSPENSION / DAMPER LOAD',state.system===3);
  data.suspension.forEach((value,i)=>{
    const y=350+i*26;colorRow(['FL','FR','RL','RR'][i],value,y,i<2?cyan:amber);
  });
  function colorRow(label:string,value:number,y:number,color:string) {
    text(label,1055,y,9);text(value+' mm',1080,y,10,color);bar(1129,y-5,value/30,color);
  }
  text('FRONT 8.4 kN   REAR 12.2 kN',1055,462,9);

  panel(1043,491,'CARBON BRAKES / THERMAL',state.system===4);
  const bx=1148,by=582;
  for(const radius of [18,30,38,43]) {ctx.beginPath();ctx.arc(bx,by,radius,0,Math.PI*2);ctx.strokeStyle='#398295';ctx.stroke();}
  for(let i=0;i<24;i++) {
    const a=i/24*Math.PI*2;ctx.beginPath();ctx.arc(bx+Math.cos(a)*34,by+Math.sin(a)*34,1.7,0,Math.PI*2);ctx.stroke();
  }
  text('FL '+data.brakes[0]+'°',1054,539,11,cyan);text('FR '+data.brakes[1]+'°',1180,539,11,cyan);
  text('RL '+data.brakes[2]+'°',1054,643,11,amber);text('RR '+data.brakes[3]+'°',1180,643,11,amber);
  ctx.restore();
}
