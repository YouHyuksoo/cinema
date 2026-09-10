import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { scannerOrbFlight, SCANNER_ORB_FLIGHT_MS } from './scannerOrbFlight';
import { drawScannerFlight, drawScannerTesla, type FlightSphere } from './drawScannerFlight';
import { CONNECTION_LABELS, type ConnectionState } from './scannerConnectionStatus';
import styles from './scannerTeslaEffect.module.css';

/** Hover discharges in place; clicking launches the independent full-screen flight. */
export function ScannerTeslaEffect({still,details}:{still:boolean;details:string}) {
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const triggerRef=useRef<HTMLButtonElement>(null);
  const [playing,setPlaying]=useState(false);
  const [hovered,setHovered]=useState(false);
  const mode=playing?'flight':hovered&&!still?'hover':'idle';
  useEffect(()=>{
    const canvas=canvasRef.current,ctx=canvas?.getContext('2d');
    if(!canvas||!ctx||mode==='idle') return;
    const scanner=triggerRef.current?.closest('[data-signal-scanner]');
    const plane=scanner?.querySelector<HTMLElement>('[data-status-orbits]');
    const sources=Array.from(scanner?.querySelectorAll<HTMLElement>('[data-status-orb]')??[]);
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    const initialBox=canvas.getBoundingClientRect();
    const homes=()=>sources.map(node=>{const rect=node.getBoundingClientRect();return {x:rect.left+rect.width/2,y:rect.top+rect.height/2,r:rect.width/2};});
    const launches=homes();
    // RAF timestamps can predate an effect's performance.now() within the same frame.
    let started:number|null=null,frame=0;
    const clear=()=>{
      cancelAnimationFrame(frame);ctx.clearRect(0,0,canvas.width,canvas.height);canvas.dataset.active='false';
      delete canvas.dataset.flightPhase;
      delete canvas.dataset.inspectedOrb;
      if(plane)delete plane.dataset.flight;
    };
    const finish=(cancelHover=false)=>{clear();setPlaying(false);if(cancelHover)setHovered(false);};
    const draw=(time:number)=>{
      started??=time;
      const elapsed=Math.max(0,time-started),box=canvas.getBoundingClientRect();
      const dock=homes();
      if(document.hidden||motion.matches||!box.width||!box.height||!initialBox.width||!initialBox.height||dock.length!==4||dock.some(p=>!p.r)){finish(true);return;}
      if(mode==='flight'&&elapsed>=SCANNER_ORB_FLIGHT_MS){finish();return;}
      const dpr=Math.min(window.devicePixelRatio||1,2);
      const width=Math.round(box.width*dpr),height=Math.round(box.height*dpr);
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,box.width,box.height);
      if(mode==='hover'){
        drawScannerTesla(ctx,dock.map(orb=>({...orb,x:orb.x-box.left,y:orb.y-box.top})),elapsed);
        canvas.dataset.active='true';canvas.dataset.flightPhase='hover';
        frame=requestAnimationFrame(draw);return;
      }
      const rect=scanner?.closest('main')?.querySelector('[data-reactor-trigger]')?.getBoundingClientRect();
      const reactor=rect?.width?{x:rect.left+rect.width/2,y:rect.top+rect.height/2,r:rect.width*.44}:{x:box.width*.5,y:box.height*.42,r:0};
      const orbs:FlightSphere[]=dock.map((home,index)=>{
        const launch={x:launches[index].x*box.width/initialBox.width,y:launches[index].y*box.height/initialBox.height,r:launches[index].r*box.width/initialBox.width};
        const pose=scannerOrbFlight(elapsed,index,launch,home,reactor,{width:box.width,height:box.height})!;
        const state=sources[index].dataset.state as ConnectionState;
        return {...pose,color:getComputedStyle(sources[index]).getPropertyValue('--orb-color').trim()||'#8b9cab',
          label:sources[index].dataset.statusOrb?.toUpperCase()??'',status:CONNECTION_LABELS[state]??'미확인',
          detail:sources[index].title.split(' · ').slice(1).join(' · ')};
      });
      try { drawScannerFlight(ctx,orbs,elapsed,SCANNER_ORB_FLIGHT_MS,reactor); }
      catch(error) { finish(true);console.error('Scanner flight rendering failed',error);return; }
      if(plane)plane.dataset.flight='true';
      const inspected=orbs.find(orb=>orb.phase==='inspect');
      canvas.dataset.active='true';canvas.dataset.flightPhase=inspected?'inspect':orbs[0].phase;
      canvas.dataset.inspectedOrb=inspected?.label??'';
      frame=requestAnimationFrame(draw);
    };
    const visibility=()=>{if(document.hidden)finish(true);};
    const reduce=()=>{if(motion.matches)finish(true);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')finish(true);};
    document.addEventListener('visibilitychange',visibility);
    document.addEventListener('keydown',escape);motion.addEventListener('change',reduce);
    frame=requestAnimationFrame(draw);
    return ()=>{clear();document.removeEventListener('visibilitychange',visibility);document.removeEventListener('keydown',escape);motion.removeEventListener('change',reduce);};
  },[mode]);
  const canvas=<canvas ref={canvasRef} className={playing?styles.flyby:styles.arcs} data-scanner-tesla="true" data-active="false" aria-hidden="true" />;
  return <>
    <button ref={triggerRef} type="button" className={styles.trigger} aria-label="신호 구체 테슬라 방전" aria-busy={playing} disabled={still||playing}
      title={`${still?'동작 줄이기 설정으로 연출 정지':'호버: 테슬라 전기 · 클릭: 구체별 확대 및 2초 상태 확인 후 복귀 · Escape: 취소'}\n${details}`}
      onPointerEnter={event=>{if(event.pointerType!=='touch')setHovered(true);}}
      onPointerLeave={()=>setHovered(false)}
      onFocus={event=>{if(event.currentTarget.matches(':focus-visible'))setHovered(true);}}
      onBlur={()=>setHovered(false)}
      onClick={event=>{event.stopPropagation();setPlaying(true);}} />
    {playing?createPortal(canvas,document.body):canvas}
  </>;
}
