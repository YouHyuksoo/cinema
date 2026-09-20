'use client';
import { useEffect, useRef } from 'react';
import type { FilmPlayback } from './useFilmPlayback';
import type { FilmCamera } from './useFilmCamera';
import { centerBackgroundPreference, type CenterBackground } from './jarvisCenterBackground';
import { menuLayoutPreference } from './filmMenuPreference';
import { SCREEN_SETTINGS, describeScreenState, validateScreenCommand, type ScreenCommand, type ScreenExecutor } from './screenCommands';
import type { FilmThemeId } from './filmThemes';
import type { FilmTextureStyle } from './filmTexture';
import type { FilmId } from './filmProgram';
import type { ScreenObjectRegistry, ScreenObjectResult } from './screenObjectRegistry';
import { sceneOpenMessage } from './jarvisCommands';

interface Context {
  registry: ScreenObjectRegistry;
  player: FilmPlayback; camera: FilmCamera; menuOpen: boolean; settingsOpen: boolean; preview: boolean;
  menu(value: boolean): void; settings(value: boolean): void; home(value: boolean): void; stopAll(): void;
}
const completed = (message: string): ScreenObjectResult => ({ ok:true, message });
const stateOf = <T,>(registry: ScreenObjectRegistry, id: string) => registry.getState(id) as T | undefined;
const parameter = {
  boolean:(name:string)=>({[name]:{type:'boolean' as const}}),
  number:(name:string)=>({[name]:{type:'number' as const}}),
  string:(name:string,values?:readonly string[])=>({[name]:{type:'string' as const,...(values?{enum:values}:{})}}),
};

export function useScreenCommands(context: Context) {
  const latest = useRef(context); latest.current = context;
  const { registry } = context;
  useEffect(() => {
    const remove = [
      registry.register({ id:'screen', description:'HATCHERY 화면과 기본 메뉴', getState:() => { const c=latest.current; return { menu:c.menuOpen,settings:c.settingsOpen,home:c.preview }; }, methods:{
        setMenu:{description:'작업 메뉴를 열거나 닫습니다.',parameters:parameter.boolean('open'),execute:args=>{latest.current.menu(Boolean(args.open));return completed('작업 메뉴 상태를 변경했습니다.');}},
        setSettings:{description:'연출 설정을 열거나 닫습니다.',parameters:parameter.boolean('open'),execute:args=>{latest.current.settings(Boolean(args.open));return completed('연출 설정 상태를 변경했습니다.');}},
        setHome:{description:'메인 화면을 표시하거나 닫습니다.',parameters:parameter.boolean('open'),execute:args=>{latest.current.home(Boolean(args.open));return completed('메인 화면 상태를 변경했습니다.');}},
        stopAndHome:{description:'모든 재생·연결·메뉴를 중지하고 메인 화면으로 돌아갑니다.',execute:()=>{latest.current.stopAll();return completed('모든 동작을 중지하고 메인 화면으로 돌아갔습니다.');}},
      } }),
      registry.register({ id:'player', description:'연출 재생기와 화면 스타일', getState:() => { const p=latest.current.player; return {
        menuLayout:menuLayoutPreference.getSnapshot(),scene:p.position.chapter.id,theme:p.theme,background:centerBackgroundPreference.getSnapshot(),
        texture:p.texture.style,intensity:p.texture.intensity*100,speed:p.speed,playing:p.playing,mode:p.mode,seek:p.position.localTime,machine:p.machineSubject,
        pieStyle:p.charts.pie.style ?? 'auto',pieDimension:p.charts.pie.dimension,pieDepth:p.charts.pie.depthScale*100 }; }, methods:{
        setMenuLayout:{description:'메뉴 배치를 변경합니다.',parameters:parameter.string('layout',['dock','orbit']),execute:args=>{latest.current.player.changeMenuLayout(args.layout as 'dock'|'orbit');return completed('메뉴 배치를 변경했습니다.');}},
        selectScene:{description:'연출 장면으로 이동합니다.',parameters:parameter.string('id'),execute:args=>{const c=latest.current;c.home(false);c.player.selectChapter(args.id as FilmId);return completed('연출 장면으로 이동했습니다.');}},
        setTheme:{description:'색상 테마를 변경합니다.',parameters:parameter.string('id'),execute:args=>{latest.current.player.changeTheme(args.id as FilmThemeId);return completed('테마를 변경했습니다.');}},
        setBackground:{description:'중앙 배경을 변경합니다.',parameters:parameter.string('id'),execute:args=>{centerBackgroundPreference.set(args.id as CenterBackground);return completed('중앙 배경을 변경했습니다.');}},
        setTexture:{description:'화면 질감을 변경합니다.',parameters:parameter.string('id'),execute:args=>{latest.current.player.changeTextureStyle(args.id as FilmTextureStyle);return completed('화면 질감을 변경했습니다.');}},
        setIntensity:{description:'화면 질감 강도를 변경합니다.',parameters:parameter.number('percent'),execute:args=>{latest.current.player.changeTextureIntensity(Number(args.percent)/100);return completed('질감 강도를 변경했습니다.');}},
        setSpeed:{description:'재생 속도를 변경합니다.',parameters:parameter.number('value'),execute:args=>{latest.current.player.changeSpeed(Number(args.value));return completed('재생 속도를 변경했습니다.');}},
        setPlaying:{description:'재생하거나 일시정지합니다.',parameters:parameter.boolean('playing'),execute:args=>{const p=latest.current.player;args.playing?p.play():p.pause();return completed('재생 상태를 변경했습니다.');}},
        restart:{description:'현재 연출을 처음부터 다시 시작합니다.',execute:()=>{latest.current.player.restart();return completed('연출을 다시 시작했습니다.');}},
        setMode:{description:'현재 장면 반복 또는 전체 연속 재생으로 변경합니다.',parameters:parameter.string('mode',['chapter','sequence']),execute:args=>{latest.current.player.changeMode(args.mode as 'chapter'|'sequence');return completed('재생 방식을 변경했습니다.');}},
        seek:{description:'현재 장면의 지정 초로 이동합니다.',parameters:parameter.number('seconds'),execute:args=>{const p=latest.current.player,n=Number(args.seconds);if(n>p.position.chapter.duration)return {ok:false,message:`현재 장면은 ${p.position.chapter.duration}초까지입니다.`};p.seek(n);return completed('재생 위치를 이동했습니다.');}},
        setMachine:{description:'검사 대상을 변경합니다.',parameters:parameter.string('subject',['pcb','car']),execute:args=>{latest.current.player.changeMachineSubject(args.subject as 'pcb'|'car');return completed('검사 대상을 변경했습니다.');}},
        setChart:{description:'차트 형식, 2D/3D 형태 또는 깊이를 변경합니다.',parameters:{chart:{type:'string',enum:['bars','pie']},patch:{type:'object'}},execute:args=>{latest.current.player.changeChartPresentation(args.chart as 'bars'|'pie',args.patch as {style?:'auto'|'bar'|'line'|'area'|'scatter'|'pie';dimension?:'2d'|'3d';depthScale?:number});return completed('차트 표시를 변경했습니다.');}},
      } }),
      registry.register({ id:'camera', description:'카메라 연결과 영상 효과', getState:() => {const c=latest.current.camera;return {enabled:c.status==='on',mirror:c.mirror,zoom:c.zoom,blur:c.blur};}, methods:{
        setEnabled:{description:'카메라를 연결하거나 끕니다.',parameters:parameter.boolean('enabled'),execute:async args=>{const c=latest.current.camera;if(args.enabled){const popup=await registry.execute('camera.popup','setOpen',{open:true});if(!popup.ok)return popup;await c.start();}else c.stop();return completed('카메라 연결 상태를 변경했습니다.');}},
        setMirror:{description:'미러 표시를 변경합니다.',parameters:parameter.boolean('enabled'),execute:args=>{latest.current.camera.setMirror(Boolean(args.enabled));return completed('미러 표시를 변경했습니다.');}},
        setZoom:{description:'카메라 확대 배율을 변경합니다.',parameters:parameter.number('value'),execute:args=>{latest.current.camera.setZoom(Number(args.value));return completed('카메라 확대를 변경했습니다.');}},
        setBlur:{description:'카메라 블러 강도를 변경합니다.',parameters:parameter.number('value'),execute:args=>{latest.current.camera.setBlur(Number(args.value));return completed('카메라 블러를 변경했습니다.');}},
      } }),
      registry.register({ id:'cctv', description:'CCTV 카메라 탐색', getState:()=>{const p=latest.current.player;return {mode:p.cctv.manual?'manual':'auto',camera:p.cctv.camera===null?undefined:String(p.cctv.camera+1)};}, methods:{
        setMode:{description:'자동 순찰 또는 직접 감시로 변경합니다.',parameters:parameter.string('mode',['auto','manual']),execute:args=>{const p=latest.current.player;args.mode==='manual'?p.cctv.begin():p.resumeTour();return completed('CCTV 모드를 변경했습니다.');}},
        select:{description:'번호로 CCTV 카메라를 선택합니다.',parameters:parameter.number('number'),execute:args=>{const c=latest.current;c.home(false);c.player.selectChapter('cctv');c.player.cctv.select(Number(args.number)-1);return completed('CCTV 카메라를 선택했습니다.');}},
        step:{description:'이전 또는 다음 CCTV로 이동합니다.',parameters:parameter.string('direction',['previous','next']),execute:args=>{const c=latest.current;c.home(false);c.player.selectChapter('cctv');c.player.cctv.step(args.direction==='previous'?-1:1);return completed('CCTV 카메라를 이동했습니다.');}},
      } }),
      registry.register({ id:'factory', description:'3D SMT 설비 탐색', getState:()=>{const p=latest.current.player;return {mode:p.factory.manual?'manual':'auto',station:p.factory.selectedKey??undefined};}, methods:{
        setMode:{description:'자동 투어 또는 직접 탐색으로 변경합니다.',parameters:parameter.string('mode',['auto','manual']),execute:args=>{const p=latest.current.player;args.mode==='manual'?p.factory.begin():p.resumeTour();return completed('설비 탐색 모드를 변경했습니다.');}},
        select:{description:'설비를 선택합니다.',parameters:parameter.string('key'),execute:args=>{const c=latest.current;c.home(false);c.player.selectChapter('visor');c.player.factory.select(String(args.key));return completed('설비를 선택했습니다.');}},
        focus:{description:'선택 설비로 이동합니다.',execute:()=>{latest.current.player.factory.focus();return completed('선택 설비로 이동했습니다.');}},
        reset:{description:'설비 화면을 입구 시점으로 되돌립니다.',execute:()=>{const c=latest.current;c.home(false);c.player.selectChapter('visor');c.player.factory.reset();return completed('설비 화면을 초기화했습니다.');}},
        zoom:{description:'3D 설비 화면을 확대하거나 축소합니다.',parameters:parameter.string('direction',['in','out']),execute:args=>{const c=latest.current;c.home(false);c.player.selectChapter('visor');c.player.factory.zoom(args.direction==='in'?-120:120);return completed('설비 화면 배율을 변경했습니다.');}},
        deselect:{description:'선택 설비를 해제합니다.',execute:()=>{latest.current.player.factory.deselect();return completed('설비 선택을 해제했습니다.');}},
      } }),
      registry.register({ id:'environment', description:'온습도 구역 탐색', getState:()=>({zone:latest.current.player.environment.selectedId??'auto'}), methods:{
        select:{description:'온습도 구역을 선택하거나 자동 순회합니다.',parameters:parameter.string('zone'),execute:args=>{const c=latest.current;c.home(false);c.player.selectChapter('wave');if(args.zone==='auto')c.player.environment.clear();else{c.player.seek(10);c.player.environment.select(String(args.zone));}return completed('온습도 구역을 변경했습니다.');}},
        step:{description:'이전 또는 다음 온습도 구역으로 이동합니다.',parameters:parameter.string('direction',['previous','next']),execute:args=>{const c=latest.current;c.home(false);c.player.selectChapter('wave');c.player.seek(10);c.player.environment.step(args.direction==='previous'?-1:1);return completed('온습도 구역을 이동했습니다.');}},
        clear:{description:'온습도 구역 선택을 해제합니다.',execute:()=>{latest.current.player.environment.clear();return completed('온습도 구역 선택을 해제했습니다.');}},
      } }),
    ];
    return () => remove.reverse().forEach(dispose => dispose());
  }, [registry]);

  const snapshot = () => {
    const screen=stateOf<{menu:boolean;settings:boolean;home:boolean}>(registry,'screen'),player=stateOf<Record<string,unknown>>(registry,'player')??{};
    const camera=stateOf<{enabled:boolean;mirror:boolean;zoom:number;blur:number}>(registry,'camera'),cctv=stateOf<{mode:string;camera?:string}>(registry,'cctv');
    const factory=stateOf<{mode:string;station?:string}>(registry,'factory'),environment=stateOf<{zone:string}>(registry,'environment');
    return {menu:screen?.menu,settings:screen?.settings,home:screen?.home,...player,
      turbineMenu:stateOf<{open:boolean}>(registry,'menu.turbine')?.open,cubeMenu:stateOf<{open:boolean}>(registry,'menu.cube')?.open,
      camera:camera?.enabled,cameraPopup:stateOf<{open:boolean}>(registry,'camera.popup')?.open,mirror:camera?.mirror,zoom:camera?.zoom,blur:camera?.blur,
      cctvMode:cctv?.mode,cctvCamera:cctv?.camera,factoryMode:factory?.mode,factoryStation:factory?.station,environmentZone:environment?.zone,
      metricsScroll:stateOf<{autoScroll:boolean}>(registry,'metrics')?.autoScroll,leftScroll:stateOf<{autoScroll:boolean}>(registry,'stream.left')?.autoScroll,
      rightScroll:stateOf<{autoScroll:boolean}>(registry,'stream.right')?.autoScroll,cardFocus:stateOf<{open:boolean}>(registry,'card.focus')?.open};
  };
  const target = (command: ScreenCommand): [string,string,Record<string,unknown>] | null => {
    const {key,value}=command,n=Number(value),on=value==='true';
    const map:Record<string,[string,string,Record<string,unknown>]>={
      menu:['screen','setMenu',{open:on}],turbineMenu:['menu.turbine','setOpen',{open:on}],cubeMenu:['menu.cube','setOpen',{open:on}],menuLayout:['player','setMenuLayout',{layout:value}],
      settings:['screen','setSettings',{open:on}],home:['screen','setHome',{open:on}],scene:['player','selectScene',{id:value}],theme:['player','setTheme',{id:value}],
      background:['player','setBackground',{id:value}],texture:['player','setTexture',{id:value}],intensity:['player','setIntensity',{percent:n}],speed:['player','setSpeed',{value:n}],
      playing:['player','setPlaying',{playing:on}],restart:['player','restart',{}],mode:['player','setMode',{mode:value}],seek:['player','seek',{seconds:n}],machine:['player','setMachine',{subject:value}],
      pieStyle:['player','setChart',{chart:'pie',patch:{style:value}}],pieDimension:['player','setChart',{chart:'pie',patch:{dimension:value}}],
      pieDepth:['player','setChart',{chart:'pie',patch:{depthScale:n/100}}],
      camera:['camera','setEnabled',{enabled:on}],cameraPopup:['camera.popup','setOpen',{open:on}],mirror:['camera','setMirror',{enabled:on}],zoom:['camera','setZoom',{value:n}],blur:['camera','setBlur',{value:n}],
      cctvMode:['cctv','setMode',{mode:value}],cctvCamera:['cctv','select',{number:n}],cctvStep:['cctv','step',{direction:value}],factoryMode:['factory','setMode',{mode:value}],
      factoryStation:['factory','select',{key:value}],factoryFocus:['factory','focus',{}],factoryReset:['factory','reset',{}],factoryZoom:['factory','zoom',{direction:value}],factoryDeselect:['factory','deselect',{}],
      environmentZone:['environment','select',{zone:value}],environmentStep:['environment','step',{direction:value}],environmentClear:['environment','clear',{}],
      metricsScroll:['metrics','setAutoScroll',{enabled:on}],leftScroll:['stream.left','setAutoScroll',{enabled:on}],rightScroll:['stream.right','setAutoScroll',{enabled:on}],
      cardFocus:['card.focus','close',{}],scannerEffect:['scanner','playEffect',{}],reactorEffect:['reactor','playEffect',{}],
    };
    if(key==='focusCard'&&value){const [side,id]=value.split(':');return [`stream.${side}`,'focusCard',{id}];}
    return map[key]??null;
  };
  const actionOnly=new Set(['restart','focusCard','scannerEffect','reactorEffect','cctvStep','factoryFocus','factoryReset','factoryZoom','factoryDeselect','environmentStep','environmentClear']);
  const execute: ScreenExecutor = async input => {
    const command=validateScreenCommand(input);if(!command)return {ok:false,message:'지원하지 않는 설정이나 범위 밖의 값입니다.'};
    if(command.action==='get')return {ok:true,message:describeScreenState(snapshot(),command.key),state:snapshot()};
    if(!latest.current.player.ready)return {ok:false,message:'화면을 준비 중입니다. 잠시 후 다시 요청해주세요.'};
    if(command.key==='cardFocus'&&command.value==='true')return {ok:false,message:'확대할 카드 이름을 말해주세요.'};
    const call=target(command);if(!call)return {ok:false,message:'이 설정은 현재 화면 객체에 연결되지 않았습니다.'};
    const result=await registry.execute(...call);if(!result.ok)return {...result,state:snapshot()};
    if(actionOnly.has(command.key))return {...result,state:snapshot()};
    await new Promise(resolve=>window.setTimeout(resolve,220));
    const state=snapshot(),actual=state[command.key as keyof typeof state],n=Number(command.value);
    const matches=typeof actual==='number'?Math.abs(actual-n)<(command.key==='seek'?1.5:.01):String(actual)===command.value;
    const setting=SCREEN_SETTINGS.find(item=>item.key===command.key),label=setting?.label??command.key,display=setting?.options?.find(option=>option.value===String(actual))?.label??actual;
    const successMessage = command.key === 'scene' ? sceneOpenMessage(command.value as FilmId) : `${label}: ${display} 적용을 확인했습니다.`;
    return {ok:matches,message:matches?successMessage:`${label} 변경을 확인하지 못했습니다. 현재 값: ${display}`,state};
  };
  return execute;
}
