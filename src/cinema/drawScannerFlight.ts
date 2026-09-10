import { scannerTeslaArcs, SCANNER_TESLA_MS } from './scannerTesla';
import type { FlightPose } from './scannerOrbFlight';
import type { TeslaOrb } from './scannerTesla';

export type FlightSphere=FlightPose&{color:string;label:string;status:string;detail?:string};
/** Same thin Tesla branches as the dock effect, sampled against the live flight projection. */
export function drawScannerTesla(ctx:CanvasRenderingContext2D,orbs:TeslaOrb[],elapsed:number,duration=Infinity) {
  ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
  // Keep the existing 2.4s electrical envelopes, with gentle gaps during the longer flight.
  const sparkTime=elapsed%3000;
  const alpha=Math.max(0,Math.min(1,sparkTime/180,(SCANNER_TESLA_MS-sparkTime)/650,(duration-elapsed)/500));
  ctx.globalAlpha=alpha;
  ctx.beginPath();ctx.rect(0,0,ctx.canvas.width,ctx.canvas.height);
  for(const orb of orbs){ctx.moveTo(orb.x+orb.r,orb.y);ctx.arc(orb.x,orb.y,orb.r,0,Math.PI*2);}
  ctx.clip('evenodd');
  const stroke=(points:{x:number;y:number}[],color:string,width:number,glow=0)=>{
    ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.shadowColor='#87caff';ctx.shadowBlur=glow;ctx.stroke();
  };
  for(const arc of scannerTeslaArcs(orbs,sparkTime)){
    stroke(arc.trunk,'#74baff',1.1,4);stroke(arc.trunk,'#f2faff',.45);
    arc.branches.forEach((branch,i)=>stroke(branch,i%2?'#9dcfff88':'#dceeffbb',i%2?.2:.35));
  }
  ctx.restore();
}

export function drawScannerFlight(ctx:CanvasRenderingContext2D,orbs:FlightSphere[],elapsed:number,duration:number,reactor:TeslaOrb) {
  const attention=Math.max(...orbs.map(orb=>orb.focus??0));
  ctx.save();ctx.globalAlpha=1-attention;
  if(attention<1)drawScannerTesla(ctx,orbs,elapsed,duration);
  ctx.restore();
  // Far objects paint first. Rear passages are hidden by the reactor silhouette.
  for(const orb of [...orbs].sort((a,b)=>a.z-b.z)){
    ctx.save();
    ctx.globalAlpha=1-attention*.72+(orb.focus??0)*.72;
    if(orb.z<0&&reactor.r>0){
      ctx.beginPath();ctx.rect(0,0,ctx.canvas.width,ctx.canvas.height);
      ctx.moveTo(reactor.x+reactor.r,reactor.y);ctx.arc(reactor.x,reactor.y,reactor.r,0,Math.PI*2);ctx.clip('evenodd');
    }
    const {x,y,r,color}=orb;
    const fill=ctx.createRadialGradient(x-r*.4,y-r*.5,r*.02,x,y,r);
    fill.addColorStop(0,'#ffffff');fill.addColorStop(.22,color);fill.addColorStop(.7,color);fill.addColorStop(1,'#020610');
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.shadowColor=color;ctx.shadowBlur=7;ctx.fill();ctx.shadowBlur=0;
    const shade=ctx.createLinearGradient(x-r,y-r,x+r,y+r);shade.addColorStop(0,'#00000000');shade.addColorStop(.45,'#00000000');shade.addColorStop(1,'#000000cc');
    ctx.fillStyle=shade;ctx.fill();
    ctx.strokeStyle='#d9edff66';ctx.lineWidth=.8;ctx.stroke();
    ctx.beginPath();ctx.ellipse(x,y,r*.95,r*.32,-.45+elapsed*.0004*(1-(orb.focus??0)),0,Math.PI*2);ctx.strokeStyle=color;ctx.stroke();
    ctx.beginPath();ctx.ellipse(x-r*.38,y-r*.53,r*.14,r*.07,-.4,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();
    const focus=orb.focus??0;
    if(focus>.5){
      ctx.textAlign='center';ctx.shadowColor='#000';ctx.shadowBlur=7;
      ctx.fillStyle='#f4f8ff';ctx.font=`700 ${Math.min(32,r*.3)}px monospace`;ctx.fillText(orb.label,x,y-5);
      ctx.font=`700 ${Math.min(27,r*.24)}px sans-serif`;ctx.fillText(orb.status,x,y+30);
      if(orb.detail){
        const width=Math.min(400,ctx.canvas.width/(ctx.getTransform().a||1)*.8),font=13;
        ctx.font=`${font}px sans-serif`;
        const lines:string[]=[];let line='';
        for(const char of orb.detail){if(ctx.measureText(line+char).width>width-24){lines.push(line);line=char;}else line+=char;}
        if(line)lines.push(line);
        const shown=lines.slice(0,3),top=y+r+16;
        ctx.shadowBlur=0;ctx.fillStyle='#06101eed';ctx.beginPath();ctx.roundRect(x-width/2,top,width,shown.length*19+20,8);ctx.fill();
        ctx.strokeStyle=color;ctx.lineWidth=.8;ctx.stroke();ctx.fillStyle='#edf4ff';
        shown.forEach((text,i)=>ctx.fillText(text,x,top+22+i*19));
      }
      ctx.restore();continue;
    }
    const size=Math.max(7,Math.min(12,r*.45));
    ctx.textAlign='center';ctx.font=`600 ${size}px monospace`;ctx.shadowColor='#000';ctx.shadowBlur=4;ctx.fillStyle='#e5efff';
    ctx.fillText(orb.label,x,y+r+size+2);ctx.font=`${Math.max(7,size-1)}px sans-serif`;ctx.fillStyle=color;ctx.fillText(orb.status,x,y+r+size*2+4);
    ctx.restore();
  }
}
