'use client';
import { useId, useRef, useState, type CSSProperties } from 'react';
import { TURBINE_COMMANDS, type TurbineCommand } from './turbineCommands';
import { TurbineBlade, TurbineCommandIcon } from './TurbineBlade';
import styles from './filmTurbineMenu.module.css';

export function FilmTurbineMenu({ ready, voiceActive, onCommand }: {
  ready: boolean; playing: boolean; voiceActive: boolean; onCommand(command: TurbineCommand): void;
}) {
  const [open, setOpen] = useState(false);
  const hub = useRef<HTMLButtonElement>(null);
  const suppressOpen = useRef(false);
  const controls = useId();
  // The other corner instruments need client-side placement before their first paint.
  if (!ready) return null;
  return <nav className={styles.menu} data-turbine-open={open} aria-label="터빈 명령 메뉴"
    onPointerEnter={event => { if (event.pointerType !== 'touch' && !suppressOpen.current) setOpen(true); }}
    onPointerLeave={event => { if (event.pointerType !== 'touch') { suppressOpen.current=false;setOpen(false); } }}
    onFocusCapture={event => { if (!suppressOpen.current && event.target.matches(':focus-visible')) setOpen(true); }}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); hub.current?.focus(); setOpen(false); } }}>
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
              suppressOpen.current=true;setOpen(false);
              hub.current?.focus({preventScroll:true});
              onCommand(command.id);
            }}>
            <TurbineBlade/>
            <span className={styles.legend}><TurbineCommandIcon command={command.id}/><span>{command.label}</span></span>
          </button></div>)}
        </div>
        <button ref={hub} data-turbine-hub className={styles.hub} type="button" aria-label="터빈 메뉴 펼치기/접기" aria-expanded={open} aria-controls={controls}
          onClick={() => { suppressOpen.current=false;setOpen(value => !value); }}><span/><i aria-hidden="true"/></button>
        </div>
      </div>
      </div>
    </div>
  </nav>;
}
