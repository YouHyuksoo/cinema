'use client';
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { TURBINE_COMMANDS, type TurbineCommand } from './turbineCommands';
import { TurbineBlade, TurbineCommandIcon } from './TurbineBlade';
import styles from './filmTurbineMenu.module.css';
import { useScreenObject } from './ScreenObjectContext';
import { playFilmTransitionSound } from './filmTransitionSound';

export function FilmTurbineMenu({ ready, voiceActive, onCommand }: {
  ready: boolean; playing: boolean; voiceActive: boolean; onCommand(command: TurbineCommand): void;
}) {
  const [open, setOpen] = useState(false);
  const hub = useRef<HTMLButtonElement>(null);
  const controls = useId();
  const setMenuOpen = useCallback((next: boolean) => setOpen(current => {
    if (next && !current) playFilmTransitionSound();
    return next;
  }), []);
  useEffect(() => {
    const control = (event: Event) => setMenuOpen(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener('cinema-turbine-menu', control);
    return () => window.removeEventListener('cinema-turbine-menu', control);
  }, [setMenuOpen]);
  useScreenObject(() => ({ id:'menu.turbine', description:'좌측 하단 터빈 명령 메뉴', getState:() => ({ open }), methods:{
    setOpen:{ description:'터빈 메뉴를 펼치거나 접습니다.', parameters:{open:{type:'boolean'}}, execute:args => {
      if(typeof args.open!=='boolean')return {ok:false,message:'open 값이 필요합니다.'};
      setMenuOpen(args.open);return {ok:true,message:'터빈 메뉴 상태를 변경했습니다.'};
    } },
  } }), [open, setMenuOpen]);
  // The other corner instruments need client-side placement before their first paint.
  if (!ready) return null;
  return <nav className={styles.menu} data-turbine-open={open} aria-label="터빈 명령 메뉴"
    onClick={event => {
      // Folded, the whole instrument opens it, not just the hub: the rotor is the affordance people aim at.
      if (open || !(event.target instanceof Element) || event.target.closest('button')) return;
      hub.current?.focus({ preventScroll: true });
      setMenuOpen(true);
    }}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false); }}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); hub.current?.focus(); setMenuOpen(false); } }}>
    <span className={styles.hoverTarget} aria-hidden="true"/>
    <div className={styles.art}>
      <div className={styles.pose}>
      <div className={styles.float}>
        <div className={styles.shadow} aria-hidden="true"/>
        <div className={styles.rotor}>
        <div id={controls} className={styles.blades} inert={!open} aria-hidden={!open}>
          {TURBINE_COMMANDS.map((command, index) => <div key={command.id} className={styles.bladeMount}
            style={{ '--blade-angle': `${command.angle}deg`, '--blade-delay': `${index * 35}ms` } as CSSProperties}>
            <button type="button" data-turbine-command={command.id} className={styles.blade}
            aria-label={command.label} title={command.id === 'conversation' ? 'AI 음성 대화 시작 · 마이크 사용' : command.label}
            disabled={!ready || (command.id === 'conversation' && voiceActive)}
            aria-pressed={command.id === 'conversation' ? voiceActive : undefined}
            onClick={() => {
              setMenuOpen(false);
              hub.current?.focus({preventScroll:true});
              onCommand(command.id);
            }}>
            <TurbineBlade/>
            <span className={styles.legend}><span className={styles.legendContent}><TurbineCommandIcon command={command.id}/><span>{command.label}</span></span></span>
          </button></div>)}
        </div>
        <button ref={hub} data-turbine-hub className={styles.hub} type="button" aria-label="터빈 메뉴 펼치기/접기" aria-expanded={open} aria-controls={controls}
          onClick={() => setMenuOpen(!open)}><span/><i aria-hidden="true"/></button>
        </div>
      </div>
      </div>
    </div>
  </nav>;
}
