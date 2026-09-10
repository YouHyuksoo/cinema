'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createIntroTimeline, shouldPlayIntro, type IntroFrame } from './hatcheryIntroTimeline';
import { createFrameLoop, watchReducedMotion } from './filmMotion';
import styles from './hatcheryIntro.module.css';

/** Root dataset key (`data-hatchery-intro`) the cube view reads for its cue. */
const INTRO_DATASET_KEY = 'hatcheryIntro';
/** Event the cube view dispatches on `document` with detail `'solved'` or `'docked'`. */
export const INTRO_CUBE_EVENT = 'hatchery-intro-cube';

/**
 * The boot gate: a cockpit-style HUD rig seen from inside, built from five layers at different depths
 * (far depth lines, the outer frame, the wing brackets, the reticle ring, the floating labels). The
 * cube solves itself inside the ring; when the HUD behind is ready the whole rig passes through the
 * camera and the real interface is left standing. Monochrome accent, no fills beyond faint washes.
 */
const SEGMENTS = [0, 1, 2, 3, 4];
/**
 * Decided once per document: React's dev-mode double effect (and a hydration-recovery remount) must
 * not turn the first run's session flag into "already played" for the second run.
 */
let playDecision: boolean | null = null;

function DepthLines() {
  return <svg className={styles.layer} data-hud-layer="depth" viewBox="0 0 1600 900" aria-hidden="true" focusable="false">
    <path className={styles.hair} d="M470 300 60 40M1130 300 1540 40M470 600 60 860M1130 600 1540 860M300 450H60M1300 450H1540" />
    <path className={styles.dots} d="M120 450H1480" />
    <path className={styles.hair} d="M60 120V40H140M1460 40H1540V120M60 780V860H140M1460 860H1540V780" />
    <path className={styles.speck} d="M200 200h2M240 640h2M1380 220h2M1360 700h2M760 80h2M840 830h2M110 450h2M1490 450h2" />
  </svg>;
}

function OuterFrame() {
  return <svg className={styles.layer} data-hud-layer="frame" viewBox="0 0 1600 900" aria-hidden="true" focusable="false">
    <path className={styles.wash} d="M300 180H1300L1360 240V660L1300 720H300L240 660V240Z" />
    <path className={styles.line} d="M300 180H1300L1360 240V660L1300 720H300L240 660V240Z" />
    <path className={styles.hair} d="M320 200H1280L1340 250V650L1280 700H320L260 650V250Z" />
    <path className={styles.line} d="M640 150H750L775 175L800 160L825 175L850 150H960" />
    <path className={styles.heavy} d="M300 180H420M1180 180H1300M300 720H420M1180 720H1300" />
    <path className={styles.heavy} d="M420 720 520 620H600M1180 720 1080 620H1000" />
    <path className={styles.hair} d="M240 300V240L300 180M1360 300V240L1300 180M240 600V660L300 720M1360 600V660L1300 720" />
    <path className={styles.dots} d="M700 740H900" />
    <path className={styles.line} d="M770 760V790M800 752V800M830 760V790" />
  </svg>;
}

function Wings() {
  const bars = (x: number) => SEGMENTS.map(i => <rect key={i} className={styles.bar} x={x + i * 24} y="430" width="14" height="40" />);
  return <svg className={styles.layer} data-hud-layer="wings" viewBox="0 0 1600 900" aria-hidden="true" focusable="false">
    <path className={styles.line} d="M380 340H560L600 380V520L560 560H380ZM1220 340H1040L1000 380V520L1040 560H1220Z" />
    <path className={styles.heavy} d="M600 380V520M1000 380V520" />
    <path className={styles.hair} d="M400 360H540M400 540H540M1060 360H1200M1060 540H1200" />
    {bars(430)}{bars(1050)}
    <path className={styles.hair} d="M430 400h96M1050 400h96M430 500h60M1086 500h60" />
    <path className={styles.line} d="M330 450H370M1230 450H1270" />
    <path className={styles.speck} d="M345 470h2M345 430h2M1253 470h2M1253 430h2" />
    <path className={styles.hair} d="M330 640a28 28 0 1 0 56 0M1214 640a28 28 0 1 1 56 0" />
  </svg>;
}

function Reticle() {
  return <svg className={styles.layer} data-hud-layer="ring" viewBox="0 0 1600 900" aria-hidden="true" focusable="false">
    <circle className={styles.ringSoft} cx="800" cy="450" r="215" />
    <circle className={styles.ringTicks} cx="800" cy="450" r="185" pathLength="360" />
    <circle className={styles.ringArcs} cx="800" cy="450" r="150" pathLength="360" />
    <circle className={styles.hair} cx="800" cy="450" r="110" fill="none" />
    <path className={styles.line} d="M800 300v22M800 578v22M650 450h22M928 450h22" />
    <path className={styles.hair} d="M786 450h28M800 436v28" />
  </svg>;
}

function Labels({ online }: { online: boolean }) {
  return <div className={styles.layer} data-hud-layer="labels" aria-hidden="true">
    <span className={styles.label} style={{ left: '17%', top: '14%' }}>SYS.BOOT 01 // HATCHERY</span>
    <span className={styles.label} style={{ right: '17%', top: '14%' }}>LINK · 4 CH</span>
    <span className={styles.label} style={{ left: '17%', bottom: '14%' }}>SEAL 0.00 · Z −1200</span>
    <span className={styles.label} data-intro-state={online ? 'online' : 'standby'} style={{ right: '17%', bottom: '14%' }}>
      GATE // {online ? 'ONLINE' : 'STANDBY'}
    </span>
    <span className={styles.label} style={{ left: '50%', top: '9%', transform: 'translateX(-50%)' }}>▲ AXIS 00</span>
  </div>;
}

/** Pure presentation of the gate. `pass` 0..1 drives the rig through the camera via a CSS variable. */
export function HatcheryIntroGate({ pass, skipped, onSkip }: { pass: number; skipped: boolean; onSkip: () => void }) {
  const online = pass > 0;
  return <div className={styles.stage} role="dialog" aria-label="HATCHERY 시작" tabIndex={-1} data-intro-stage
    data-gate-open={pass >= 1} data-online={online} data-skipped={skipped} style={{ '--pass': pass } as CSSProperties}>
    <div className={styles.veil} aria-hidden="true" />
    <div className={styles.rig}>
      <div className={styles.breath}>
        <DepthLines /><OuterFrame /><Wings /><Reticle /><Labels online={online} />
      </div>
    </div>
    <button type="button" className={styles.skip} data-intro-skip onClick={onSkip}>건너뛰기</button>
  </div>;
}

/**
 * Once-per-session entry sequence. Mounted beside the film: the HUD renders behind the gate, the cube
 * (told through the root attribute) solves itself inside the reticle, and the rig passes through the
 * camera once both are ready.
 */
export function HatcheryIntro() {
  const [frame, setFrame] = useState<IntroFrame | null>(null);
  const timeline = useRef<ReturnType<typeof createIntroTimeline> | null>(null);

  useEffect(() => {
    const motion = watchReducedMotion();
    let storage: Storage | null = null;
    try { storage = window.sessionStorage; } catch { storage = null; }
    playDecision ??= shouldPlayIntro(storage, motion.reduced);
    if (!playDecision) { motion.stop(); return; }
    const intro = createIntroTimeline(performance.now());
    timeline.current = intro;
    const root = document.documentElement;
    let cue: string | null = null, published: IntroFrame | null = null;
    const apply = (next: IntroFrame) => {
      const nextCue = next.cube ?? '';
      if (nextCue !== cue) { cue = nextCue; if (nextCue) root.dataset[INTRO_DATASET_KEY] = nextCue; else delete root.dataset[INTRO_DATASET_KEY]; }
      if (!published || published.phase !== next.phase || published.door !== next.door || published.skipped !== next.skipped) {
        published = next; setFrame(next);
      }
    };
    // The HUD counts as ready once fonts are in, the film main element exists and one more frame has painted.
    let readyTimer = 0;
    const fontsReady: Promise<unknown> = document.fonts?.ready ?? Promise.resolve();
    void fontsReady.then(() => {
      const check = () => {
        if (document.querySelector('main[data-film-theme]')) requestAnimationFrame(() => intro.ready(performance.now()));
        else readyTimer = window.setTimeout(check, 50);
      };
      check();
    });
    const onCube = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail === 'solved') intro.solved(performance.now());
      if (detail === 'docked') intro.docked(performance.now());
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') intro.skip(performance.now()); };
    document.addEventListener(INTRO_CUBE_EVENT, onCube);
    document.addEventListener('keydown', onKey);
    const loop = createFrameLoop(now => {
      const next = intro.at(now);
      apply(next);
      if (next.phase === 'done') loop.stop();
    });
    apply(intro.at(performance.now()));
    loop.start();
    return () => {
      loop.stop(); motion.stop(); window.clearTimeout(readyTimer);
      delete root.dataset[INTRO_DATASET_KEY];
      document.removeEventListener(INTRO_CUBE_EVENT, onCube);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // While the gate is up the HUD behind it is inert and focus rests on the skip control.
  const active = !!frame && frame.phase !== 'done';
  useEffect(() => {
    if (!active) return;
    const film = document.querySelector('main[data-film-theme]');
    film?.setAttribute('inert', '');
    const previous = document.activeElement as HTMLElement | null;
    // Focus the dialog itself (no ring); the skip button stays one Tab away for keyboard users.
    document.querySelector<HTMLElement>('[data-intro-stage]')?.focus({ preventScroll: true });
    return () => { film?.removeAttribute('inert'); previous?.focus?.({ preventScroll: true }); };
  }, [active]);

  if (!active || !frame) return null;
  return <HatcheryIntroGate pass={frame.door} skipped={frame.skipped} onSkip={() => timeline.current?.skip(performance.now())} />;
}
