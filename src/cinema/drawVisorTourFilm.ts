import { drawSmtFactory } from './components/drawSmtFactory';
import { drawTargetReticle } from './components/drawTargetReticle';
import { drawVisorReadout, visorReadoutAnchor } from './components/drawVisorReadout';
import { DEFAULT_FONTS, filmText, signalColor, type FilmFonts } from './filmDrawing';
import { beginFilmViewport, type FilmViewportInsets } from './filmViewport';
import { factoryProject, factoryTarget, smtFactoryState, SMT_FACTORY_STOPS } from './smtFactory';

/** Navigate the aisles at equipment height, then approach each inspection target. */
export function drawVisorTourFilm(ctx: CanvasRenderingContext2D, width: number, height: number, time: number,
  fonts: FilmFonts = DEFAULT_FONTS, insets?: FilmViewportInsets) {
  const view=beginFilmViewport(ctx,width,height,insets),state=smtFactoryState(time);
  const {station,stop,presence,readout,focus}=state;
  const heat=stop.kind==='thermal'?1:0;
  const wash=ctx.createRadialGradient(620,350,40,640,350,950);
  wash.addColorStop(0,'#16313d');wash.addColorStop(.6,'#071720');wash.addColorStop(1,'#02080e');
  ctx.fillStyle=wash;ctx.fillRect(view.left,view.top,view.right-view.left,view.bottom-view.top);
  drawSmtFactory(ctx,fonts,state);
  const target=factoryTarget(state);
  const label=`LINE ${String(station.line).padStart(2,'0')} / ${station.label}`;
  drawTargetReticle(ctx,fonts,{...target,time:state.localTime,reveal:presence*focus,lock:focus,heat,label});
  if(readout>.001) {
    const x=790,y=196;
    const detail=factoryProject({x:station.x+(station.id==='reflow'?station.width*.34:0),y:station.id==='reflow'?105:110,z:station.z},state);
    const edge=visorReadoutAnchor(stop.kind,x,y);
    ctx.save();ctx.globalAlpha=presence*readout;
    ctx.fillStyle='rgba(2,12,19,.92)';ctx.fillRect(x-12,y-38,374,365);
    ctx.beginPath();ctx.moveTo(detail.x,detail.y);ctx.lineTo(edge.x-22,edge.y);ctx.lineTo(edge.x,edge.y);
    ctx.strokeStyle=signalColor(heat,.7);ctx.lineWidth=1.2;ctx.stroke();
    ctx.beginPath();ctx.arc(detail.x,detail.y,4,0,Math.PI*2);ctx.fillStyle=signalColor(heat,.9);ctx.fill();ctx.restore();
    drawVisorReadout(ctx,fonts,{kind:stop.kind,x,y,time:state.localTime-6,opacity:presence*readout,heat,equipmentLabel:label});
  }
  filmText(ctx,fonts,'VISOR / SMT FACTORY',65,72,17,presence*.9,true);
  filmText(ctx,fonts,'05 LINES / 40 MACHINES / DEMO',65,95,10,presence*.6,true);
  const phase=state.localTime<3?'라인 입구 · 로더에서 공정 진행 방향을 바라봅니다.'
    :state.localTime<6?`${label} · 통로를 따라 이동 중`
      :state.localTime<12?label+' · '+stop.title:'입구로 돌아와 다음 라인으로 이동합니다.';
  filmText(ctx,fonts,phase,640,620,13,presence*.9,false,'center');
  SMT_FACTORY_STOPS.forEach((item,i)=>filmText(ctx,fonts,`LINE ${String(item.line).padStart(2,'0')} · ${item.title}`,235+i*310,663,12,
    presence*(state.index===i?.95:.38),false,'left',signalColor(state.index===i?heat:0,1)));
  filmText(ctx,fonts,'5개 라인 · 통로 이동 → 설비 접근 → 진단 → 다음 라인',640,692,10,presence*.48,false,'center');
}
