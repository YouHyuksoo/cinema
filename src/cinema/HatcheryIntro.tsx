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
 * The boot gate: a cockpit HUD rig built as real 3D objects (CSS 3D): floor and ceiling grids receding
 * to the horizon, wing panels angled inward like a canopy, an outer frame and a reticle ring extruded
 * from stacked slices, and two gyro rings turning at right angles to the reticle. The camera drifts
 * and follows the pointer, so the objects show true parallax and foreshortening. Monochrome accent.
 */
const SEGMENTS = [0, 1, 2, 3, 4];
const SLICES = [0, 1, 2];
/**
 * Decided once per document: React's dev-mode double effect (and a hydration-recovery remount) must
 * not turn the first run's session flag into "already played" for the second run.
 */
let playDecision: boolean | null = null;

function Wing({ side }: { side: 'left' | 'right' }) {
  const bars = SEGMENTS.map(i => <rect key={i} className={styles.bar} x={150 + i * 30} y="150" width="18" height="46" />);
  return <svg className={styles.plate} viewBox="0 0 520 340" preserveAspectRatio="none" aria-hidden="true" focusable="false"
    style={side === 'right' ? { transform: 'scaleX(-1)' } : undefined}>
    <path className={styles.wash} d="M40 20H440L500 80V260L440 320H40L10 290V50Z" />
    <path className={styles.line} d="M40 20H440L500 80V260L440 320H40L10 290V50Z" />
    <path className={styles.hair} d="M60 40H430L480 90V250L430 300H60L30 270V70Z" />
    <path className={styles.heavy} d="M500 110V230M40 20H130M40 320H130" />
    {bars}
    <path className={styles.hair} d="M150 120h180M150 230h110M150 250h60" />
    <path className={styles.line} d="M60 170h60M400 170h60" />
    <path className={styles.speck} d="M80 60h2M80 280h2M420 60h2M420 280h2" />
    <path className={styles.dots} d="M60 300H460" />
  </svg>;
}

function FrameSlice({ index }: { index: number }) {
  return <svg className={styles.slice} style={{ '--i': index } as CSSProperties} viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path className={styles.wash} d="M300 180H1300L1360 240V660L1300 720H300L240 660V240Z" />
    <path className={styles.line} d="M300 180H1300L1360 240V660L1300 720H300L240 660V240Z" />
    <path className={styles.hair} d="M320 200H1280L1340 250V650L1280 700H320L260 650V250Z" />
    <path className={styles.line} d="M640 150H750L775 175L800 160L825 175L850 150H960" />
    <path className={styles.heavy} d="M300 180H420M1180 180H1300M300 720H420M1180 720H1300" />
    <path className={styles.heavy} d="M420 720 520 620H600M1180 720 1080 620H1000" />
    <path className={styles.dots} d="M700 740H900" />
    <path className={styles.line} d="M770 760V790M800 752V800M830 760V790" />
  </svg>;
}

function RingSlice({ className, index = 0 }: { className: string; index?: number }) {
  return <svg className={className} style={{ '--i': index } as CSSProperties} viewBox="0 0 500 500" aria-hidden="true" focusable="false">
    <circle className={styles.ringSoft} cx="250" cy="250" r="235" />
    <circle className={styles.ringTicks} cx="250" cy="250" r="205" pathLength="360" />
    <circle className={styles.ringArcs} cx="250" cy="250" r="170" pathLength="360" />
    <circle className={styles.hair} cx="250" cy="250" r="128" fill="none" />
    <path className={styles.line} d="M250 8v22M250 470v22M8 250h22M470 250h22" />
  </svg>;
}

function Labels({ online }: { online: boolean }) {
  return <div className={styles.labels}>
    <span className={styles.label} style={{ left: '4%', top: '6%' }}>SYS.BOOT 01 // HATCHERY</span>
    <span className={styles.label} style={{ right: '4%', top: '6%' }}>LINK · 4 CH</span>
    <span className={styles.label} style={{ left: '4%', bottom: '6%' }}>SEAL 0.00 · Z −1200</span>
    <span className={styles.label} data-intro-state={online ? 'online' : 'standby'} style={{ right: '4%', bottom: '6%' }}>
      GATE // {online ? 'ONLINE' : 'STANDBY'}
    </span>
    <span className={styles.label} style={{ left: '50%', top: '2%', transform: 'translateX(-50%)' }}>▲ AXIS 00</span>
  </div>;
}

function Obj({ name, children }: { name: string; children: React.ReactNode }) {
  return <div className={styles.object} data-hud-object={name}><div className={styles.body}>{children}</div></div>;
}

/** Pure presentation of the gate. `pass` 0..1 drives the rig through the camera via a CSS variable. */
export function HatcheryIntroGate({ pass, skipped, onSkip }: { pass: number; skipped: boolean; onSkip: () => void }) {
  const online = pass > 0;
  return <div className={styles.stage} role="dialog" aria-label="HATCHERY 시작" tabIndex={-1} data-intro-stage
    data-gate-open={pass >= 1} data-online={online} data-skipped={skipped} style={{ '--pass': pass } as CSSProperties}>
    <div className={styles.veil} aria-hidden="true" />
    <div className={styles.rig} aria-hidden="true">
      <div className={styles.cameraYaw}><div className={styles.cameraPitch}><div className={styles.cameraDolly}><div className={styles.cameraPointer}>
        <div className={styles.world}>
          <Obj name="floor"><div className={styles.grid} data-plane="floor" /></Obj>
          <Obj name="ceiling"><div className={styles.grid} data-plane="ceiling" /></Obj>
          <Obj name="wing-left"><Wing side="left" /></Obj>
          <Obj name="wing-right"><Wing side="right" /></Obj>
          <Obj name="frame">{SLICES.map(i => <FrameSlice key={i} index={i} />)}</Obj>
          <Obj name="ring">
            {SLICES.map(i => <RingSlice key={i} className={styles.ringSlice} index={i} />)}
            <RingSlice className={styles.gyroA} /><RingSlice className={styles.gyroB} />
          </Obj>
          <Obj name="labels"><Labels online={online} /></Obj>
        </div>
      </div></div></div></div>
    </div>
    <button type="button" className={styles.skip} data-intro-skip onClick={onSkip}>건너뛰기</button>
  </div>;
}

/** The gate is in the server HTML so it covers the HUD from the first paint, before any script runs. */
const FIRST_FRAME: IntroFrame = { phase: 'closed', door: 0, cube: 'stage', skipped: false };

/**
 * Once-per-session entry sequence. Mounted beside the film: the HUD renders behind the gate, the cube
 * (told through the root attribute) solves itself inside the reticle, and the rig passes through the
 * camera once both are ready.
 */
export function HatcheryIntro() {
  const [frame, setFrame] = useState<IntroFrame | null>(FIRST_FRAME);
  const timeline = useRef<ReturnType<typeof createIntroTimeline> | null>(null);

  useEffect(() => {
    const motion = watchReducedMotion();
    let storage: Storage | null = null;
    try { storage = window.sessionStorage; } catch { storage = null; }
    // ?intro=1 replays on demand (design review, demos); otherwise once per tab session.
    const forced = new URLSearchParams(window.location.search).has("intro");
    playDecision ??= forced || shouldPlayIntro(storage, motion.reduced);
    // Already seen this session (or reduced motion): the layout's inline script hid the gate before paint; drop it now.
    if (!playDecision) {
      motion.stop();
      const drop = requestAnimationFrame(() => setFrame(null));
      return () => cancelAnimationFrame(drop);
    }
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
    // Pointer parallax feeds --px/--py on the stage; throttled to one write per frame.
    let pointer = { x: 0, y: 0 }, pointerFrame = 0;
    const onMove = (event: PointerEvent) => {
      pointer = { x: event.clientX / window.innerWidth - .5, y: event.clientY / window.innerHeight - .5 };
      if (pointerFrame) return;
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        const stage = document.querySelector<HTMLElement>('[data-intro-stage]');
        stage?.style.setProperty('--px', pointer.x.toFixed(3)); stage?.style.setProperty('--py', pointer.y.toFixed(3));
      });
    };
    document.addEventListener(INTRO_CUBE_EVENT, onCube);
    document.addEventListener('keydown', onKey);
    window.addEventListener('pointermove', onMove, { passive: true });
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
      window.removeEventListener('pointermove', onMove); cancelAnimationFrame(pointerFrame);
    };
  }, []);

  // While the gate is up the HUD behind it is inert and focus rests on the dialog.
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
