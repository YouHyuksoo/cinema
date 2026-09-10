'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createIntroTimeline, INTRO_TIMING, shouldPlayIntro, type IntroCubeCue, type IntroFrame } from './hatcheryIntroTimeline';
import { CUBE_INTRO_SCALE, cubeIntroFlight } from './cubeIntroFlight';
import { CUBE_CUBIES, CUBE_FACES, CUBE_IDENTITY, CUBE_MOVE_MS, cubeApplyMove, cubeComposeTurn, cubeCubieStickers, cubeCubieTransform,
  cubeInLayer, cubeInvertSequence, cubeScramble, type CubeMove } from './filmMenuCube';
import { createFrameLoop, watchReducedMotion } from './filmMotion';
import styles from './hatcheryIntro.module.css';

/** Root dataset key (`data-hatchery-intro`) other views may read for the intro cue. */
const INTRO_DATASET_KEY = 'hatcheryIntro';
const STICKER = Object.fromEntries(CUBE_FACES.map(face => [face.axis, face.sticker])) as Record<(typeof CUBE_FACES)[number]['axis'], string>;
/** Scramble seed: a fixed sequence, so the intro reads the same every session. */
const SCRAMBLE_SEED = 11;
/**
 * Decided once per document: React's dev-mode double effect (and a hydration-recovery remount) must
 * not turn the first run's session flag into "already played" for the second run.
 */
let playDecision: boolean | null = null;

/**
 * The intro cube: the management Rubik's cube, large and alone on a dark stage, tumbling in 3D while
 * its layers scramble and solve (the same move engine as the docked cube). On the `return` / `snap`
 * cue it flies to the docked cube's real position and scale, so the hand-off is seamless.
 */
function IntroCube({ cue, onSolved, onDocked }: { cue: IntroCubeCue; onSolved: () => void; onDocked: () => void }) {
  const flight = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);

  // Layer moves: hold, scramble, solve, then report.
  useEffect(() => {
    const container = body.current;
    if (!container) return;
    const nodes = [...container.querySelectorAll<HTMLElement>('[data-intro-cubie]')];
    let orients = CUBE_CUBIES.map(() => CUBE_IDENTITY);
    const scramble = cubeScramble(8, SCRAMBLE_SEED);
    const queue: CubeMove[] = [...scramble, ...cubeInvertSequence(scramble)];
    let turning: { move: CubeMove; started: number } | null = null;
    let startAt = performance.now() + INTRO_TIMING.holdMs;
    const paint = (progress: number) => {
      const step = container.clientWidth / 3;
      nodes.forEach((node, index) => {
        const orient = turning && cubeInLayer(CUBE_CUBIES[index], orients[index], turning.move)
          ? cubeComposeTurn(orients[index], turning.move, progress) : orients[index];
        node.style.transform = cubeCubieTransform(orient, CUBE_CUBIES[index], step);
      });
    };
    const loop = createFrameLoop(now => {
      if (now < startAt) return;
      if (!turning) {
        const move = queue.shift();
        if (!move) { loop.stop(); onSolved(); return; }
        turning = { move, started: now };
      }
      const progress = Math.min(1, (now - turning.started) / CUBE_MOVE_MS);
      paint(progress);
      if (progress >= 1) { orients = cubeApplyMove(orients, turning.move); turning = null; startAt = now + 40; }
    });
    paint(0);
    loop.start();
    return () => loop.stop();
  }, [onSolved]);

  // Return flight to the docked cube.
  useEffect(() => {
    const node = flight.current;
    if (!node || (cue !== 'return' && cue !== 'snap')) return;
    const from = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const dock = document.querySelector('[data-cube-control]')?.getBoundingClientRect();
    const to = dock && dock.width ? { x: dock.left + dock.width / 2, y: dock.top + dock.height / 2 } : { x: 16 + 43, y: 16 + 43 };
    const stageSize = node.getBoundingClientRect().width || 1;
    const targetScale = (dock && dock.width ? dock.width : 86) / stageSize;
    node.dataset.flight = cue;
    const started = performance.now();
    const loop = createFrameLoop(now => {
      const pose = cubeIntroFlight(now - started, from, to, cue);
      const travelled = (CUBE_INTRO_SCALE - pose.scale) / (CUBE_INTRO_SCALE - 1);
      const scale = 1 + (targetScale - 1) * travelled;
      node.style.transform = `translate(${pose.x - from.x}px, ${pose.y - from.y}px) scale(${scale}) rotateZ(${pose.bank}deg)`;
      if (pose.done) { loop.stop(); onDocked(); }
    });
    loop.start();
    return () => loop.stop();
  }, [cue, onDocked]);

  return <div ref={flight} className={styles.flight} data-hud-object="cube">
    <div className={styles.tilt}><div className={styles.spin}>
      <div ref={body} className={styles.cube}>
        {CUBE_CUBIES.map(home => <span key={`${home.x},${home.y},${home.z}`} className={styles.cubie} data-intro-cubie
          style={{ '--cx': home.x, '--cy': home.y, '--cz': home.z } as CSSProperties}>
          {cubeCubieStickers(home).map(axis => <i key={axis} className={styles.tile} data-intro-sticker={axis} style={{ '--sticker': STICKER[axis] } as CSSProperties} />)}
        </span>)}
      </div>
    </div></div>
  </div>;
}

/** Pure presentation of the stage. `pass` 0..1 thins the backdrop as the cube leaves. */
export function HatcheryIntroGate({ pass, skipped, cue, onSkip, onSolved, onDocked }: {
  pass: number; skipped: boolean; cue: IntroCubeCue; onSkip: () => void; onSolved: () => void; onDocked: () => void;
}) {
  return <div className={styles.stage} role="dialog" aria-label="HATCHERY 시작" tabIndex={-1} data-intro-stage
    data-gate-open={pass >= 1} data-online={pass > 0} data-skipped={skipped} style={{ '--pass': pass } as CSSProperties}>
    <div className={styles.veil} aria-hidden="true" />
    <svg className={styles.reticle} viewBox="0 0 200 200" aria-hidden="true" focusable="false" data-hud-object="reticle">
      <circle className={styles.reticleTicks} cx="100" cy="100" r="96" pathLength="360" />
      <circle className={styles.reticleArcs} cx="100" cy="100" r="86" pathLength="360" />
      <path className={styles.reticleCross} d="M100 2v10M100 188v10M2 100h10M188 100h10" />
    </svg>
    {(["tl", "tr", "bl", "br"] as const).map(corner => <i key={corner} className={styles.bracket} data-corner={corner} aria-hidden="true" />)}
    <IntroCube cue={cue} onSolved={onSolved} onDocked={onDocked} />
    <p className={styles.caption} data-intro-caption role="status" aria-live="polite">
      <span className={styles.captionBrand}>HATCHERY</span>
      <span className={styles.captionState}>{pass > 0 ? '준비 완료' : '로딩중'}</span>
      {pass > 0 ? null : <span className={styles.captionDots} aria-hidden="true"><i /><i /><i /></span>}
    </p>
    <button type="button" className={styles.skip} data-intro-skip onClick={onSkip}>건너뛰기</button>
  </div>;
}

/** The stage is in the server HTML so it covers the HUD from the first paint, before any script runs. */
const FIRST_FRAME: IntroFrame = { phase: 'closed', door: 0, cube: 'stage', skipped: false };
const noop = () => {};

/**
 * Once-per-session entry sequence. Mounted beside the film: the HUD renders behind the stage, the cube
 * scrambles and solves itself, and once the HUD is ready the backdrop thins while the cube flies to
 * its dock.
 */
export function HatcheryIntro() {
  const [frame, setFrame] = useState<IntroFrame | null>(FIRST_FRAME);
  const timeline = useRef<ReturnType<typeof createIntroTimeline> | null>(null);
  const [handlers] = useState(() => ({
    solved: () => timeline.current?.solved(performance.now()),
    docked: () => timeline.current?.docked(performance.now()),
    skip: () => timeline.current?.skip(performance.now()),
  }));

  useEffect(() => {
    const motion = watchReducedMotion();
    let storage: Storage | null = null;
    try { storage = window.sessionStorage; } catch { storage = null; }
    // ?intro=1 replays on demand (design review, demos); otherwise once per tab session.
    const forced = new URLSearchParams(window.location.search).has('intro');
    playDecision ??= forced || shouldPlayIntro(storage, motion.reduced);
    // Already seen this session (or reduced motion): the layout's inline script hid the stage before paint; drop it now.
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
      if (!published || published.phase !== next.phase || published.door !== next.door || published.skipped !== next.skipped || published.cube !== next.cube) {
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
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') intro.skip(performance.now()); };
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
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // While the stage is up the HUD behind it is inert and focus rests on the dialog.
  const active = !!frame && frame.phase !== 'done';
  useEffect(() => {
    if (!active) return;
    const film = document.querySelector('main[data-film-theme]');
    film?.setAttribute('inert', '');
    const previous = document.activeElement as HTMLElement | null;
    document.querySelector<HTMLElement>('[data-intro-stage]')?.focus({ preventScroll: true });
    return () => { film?.removeAttribute('inert'); previous?.focus?.({ preventScroll: true }); };
  }, [active]);

  if (!active || !frame) return null;
  return <HatcheryIntroGate pass={frame.door} skipped={frame.skipped} cue={frame.cube} onSkip={handlers.skip}
    onSolved={handlers.solved} onDocked={handlers.docked} />;
}
