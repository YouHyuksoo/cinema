'use client';

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { CUBE_CUBIES, CUBE_FACES, CUBE_HUD_HOLD_MS, CUBE_IDENTITY, CUBE_MOVE_MS, CUBE_SHOWCASE_EVERY_MS,
  CUBE_SHOWCASE_TURN_MS, CUBE_TWIST_DELAY_MS, cubeApplyMove, cubeBayWidth, cubeComposeTurn, cubeCubieStickers,
  cubeCubieTransform, cubeDockCenter, cubeInLayer, cubeInvertSequence, cubeScramble, cubeShowcaseFace, cubeSize,
  cubeStickerDelay, cubeStripSpace, type CubeMove } from './filmMenuCube';
import styles from './filmMenuCube.module.css';

const CUBE_ICONS: Record<(typeof CUBE_FACES)[number]['id'], ReactNode> = {
  admin: <>
    <circle cx="16" cy="16" r="4.5" />
    <path d="M16 4.2v3m0 17.6v3M4.2 16h3m17.6 0h3m-4.2-8.5-2.1 2.1M10.5 21.5l-2.1 2.1m0-15.2 2.1 2.1m11.6 11.6 2.1 2.1" />
  </>,
  ai: <>
    <circle cx="8" cy="10" r="3" /><circle cx="24" cy="10" r="3" /><circle cx="16" cy="23" r="3" />
    <path d="m10.6 12.2 3.2 8.2m7.6-8.2-3.2 8.2M11 10h10" />
  </>,
  voice: <>
    <rect x="13" y="6" width="6" height="11" rx="3" />
    <path d="M11 15.5a5 5 0 0 0 10 0M16 20.5V25m-3.5 0h7" />
  </>,
  feeds: <>
    <path d="m6 12 10-5 10 5-10 5Z" /><path d="m6 17 10 5 10-5M6 22l10 5 10-5" />
  </>,
  display: <>
    <rect x="5" y="6" width="22" height="14" rx="2" /><path d="M12 26h8M16 20v6" />
  </>,
  system: <>
    <path d="M8 5v22M16 5v22M24 5v22" />
    <circle cx="8" cy="12" r="2.4" /><circle cx="16" cy="20" r="2.4" /><circle cx="24" cy="14" r="2.4" />
  </>,
};

const TILT = -24;
const YAW = 32;
const FLOAT_MS = 4800;
/** How often the dock re-reads the metric strip's position; it moves only on layout changes. */
const MEASURE_MS = 250;
/** Read by jarvisMetricCards.module.css to leave the cube's column free at the strip's left end. */
const STRIP_SPACE_PROPERTY = '--hatchery-cube-space';
const BAY_WIDTH_PROPERTY = '--hatchery-cube-bay';
const FACE_BY_AXIS = Object.fromEntries(CUBE_FACES.map(face => [face.axis, face])) as Record<(typeof CUBE_FACES)[number]['axis'], (typeof CUBE_FACES)[number]>;

export function FilmMenuCube() {
  const layer = useRef<HTMLDivElement>(null);
  const float = useRef<HTMLDivElement>(null);
  const cube = useRef<HTMLDivElement>(null);
  const control = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const overlay = layer.current, floating = float.current, body = cube.current, button = control.current;
    if (!overlay || !floating || !body || !button) return;
    let raf = 0, previousTime: number | null = null, floatTime = 0, floatingY = 0, size = 86, measuredAt = -Infinity;
    let viewport = { width: window.innerWidth, height: window.innerHeight };
    let center = cubeDockCenter(null, viewport, size);
    let hovering = false, hoverMs = 0;
    // Holographic entrance: wireframe stickers fill with colour after a short hold.
    const hudUntil = performance.now() + CUBE_HUD_HOLD_MS;
    // Idle showcase: quarter turns about Y reveal the other faces; the incoming face fills in as HUD.
    let showcaseYaw = 0, spin: { from: number; to: number; t: number; revealed: boolean } | null = null, sinceSpin = 0, quarterTurns = 0;
    let orients = CUBE_CUBIES.map(() => CUBE_IDENTITY);
    let queue: CubeMove[] = [], applied: CubeMove[] = [];
    let turning: { move: CubeMove; t: number; reverse: boolean } | null = null;
    let phase: 'idle' | 'mix' | 'solve' = 'idle';
    let cycled = false;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cubieNodes = [...body.querySelectorAll<HTMLElement>('[data-cube-cubie]')];

    const resetCube = () => {
      orients = CUBE_CUBIES.map(() => CUBE_IDENTITY);
      queue = []; applied = []; turning = null; phase = 'idle'; cycled = false;
    };
    const startMix = () => {
      queue = cubeScramble();
      applied = [];
      phase = 'mix';
      cycled = true;
    };
    const measure = () => {
      viewport = { width: window.innerWidth, height: window.innerHeight };
      size = cubeSize(viewport.width, viewport.height);
      // Dock to the top metric strip when the main screen shows one; the strip leaves the space free.
      const strip = document.querySelector<HTMLElement>('[data-metric-strip]')?.getBoundingClientRect();
      center = cubeDockCenter(strip && strip.width > 0 ? { left: strip.left, top: strip.top, height: strip.height } : null, viewport, size);
      document.documentElement.style.setProperty(STRIP_SPACE_PROPERTY, `${cubeStripSpace(size)}px`);
      document.documentElement.style.setProperty(BAY_WIDTH_PROPERTY, `${cubeBayWidth(size)}px`);
      document.documentElement.dataset.cubeDocked = 'true';
      overlay.style.setProperty('--cube-size', `${size}px`);
      button.style.width = `${size}px`; button.style.height = `${size}px`;
    };
    const draw = () => {
      const visualY = reduced.matches ? 0 : floatingY;
      const step = size / 3;
      floating.style.transform = `translateY(${visualY}px)`;
      overlay.style.perspectiveOrigin = `${center.x}px ${center.y + visualY}px`;
      overlay.dataset.twisting = String(!!turning || queue.length > 0);
      body.style.transform = `translate3d(${center.x}px,${center.y}px,0) translate(-50%,-50%) rotateX(${TILT}deg) rotateY(${YAW + showcaseYaw}deg)`;
      button.style.transform = `translate3d(${center.x}px,${center.y + visualY}px,0) translate(-50%,-50%)`;
      cubieNodes.forEach((node, index) => {
        let matrix = orients[index];
        if (turning && cubeInLayer(CUBE_CUBIES[index], matrix, turning.move)) {
          matrix = cubeComposeTurn(matrix, turning.move, turning.reverse ? 1 - turning.t : turning.t);
        }
        node.style.transform = cubeCubieTransform(matrix, CUBE_CUBIES[index], step);
      });
    };
    const stopFrame = () => { if (raf) cancelAnimationFrame(raf); raf = 0; previousTime = null; };
    const schedule = () => {
      if (!raf && !document.hidden && !reduced.matches) raf = requestAnimationFrame(frame);
    };
    const finishTurn = () => {
      if (!turning) return;
      if (!turning.reverse) {
        orients = cubeApplyMove(orients, turning.move);
        if (phase === 'mix') applied.push(turning.move);
      }
      turning = null;
    };
    const hudFace = (axis: string, on: boolean) => {
      for (const tile of body.querySelectorAll<HTMLElement>(`[data-cube-axis="${axis}"]`)) tile.dataset.hud = String(on);
    };
    const showcase = (delta: number) => {
      if (spin) {
        spin.t = Math.min(1, spin.t + delta / CUBE_SHOWCASE_TURN_MS);
        const eased = spin.t < .5 ? 4 * spin.t ** 3 : 1 - (-2 * spin.t + 2) ** 3 / 2;
        showcaseYaw = spin.from + (spin.to - spin.from) * eased;
        // Half-way through the turn the new face is coming into view: let its colours pour in.
        if (!spin.revealed && spin.t >= .35) { spin.revealed = true; hudFace(cubeShowcaseFace(quarterTurns + 1), false); }
        if (spin.t >= 1) { quarterTurns++; showcaseYaw = spin.to; spin = null; }
        return;
      }
      if (hovering || turning || queue.length || phase !== 'idle' || reduced.matches) { sinceSpin = 0; return; }
      sinceSpin += delta;
      if (sinceSpin < CUBE_SHOWCASE_EVERY_MS) return;
      sinceSpin = 0;
      hudFace(cubeShowcaseFace(quarterTurns + 1), true);
      spin = { from: showcaseYaw, to: showcaseYaw + 90, t: 0, revealed: false };
    };
    const frame = (time: number) => {
      raf = 0;
      const delta = previousTime === null ? 0 : Math.min(64, time - previousTime); previousTime = time;
      if (time - measuredAt >= MEASURE_MS) { measuredAt = time; measure(); }
      floatTime += delta; floatingY = 4 * Math.sin(floatTime * Math.PI * 2 / FLOAT_MS);
      if (overlay.dataset.hud === 'true' && time >= hudUntil) overlay.dataset.hud = 'false';
      showcase(delta);
      if (hovering) hoverMs += delta; else hoverMs = 0;
      if (hovering && hoverMs >= CUBE_TWIST_DELAY_MS && phase === 'idle' && !turning && !cycled) startMix();
      if (turning) {
        if (!hovering && phase === 'mix' && !turning.reverse) {
          turning.reverse = true; turning.t = 1 - Math.min(1, turning.t);
        }
        turning.t += delta / CUBE_MOVE_MS;
        if (turning.t >= 1) finishTurn();
      } else if (queue.length) {
        const move = queue.shift();
        if (move) turning = { move, t: 0, reverse: false };
      } else if (phase === 'mix' && applied.length) {
        queue = cubeInvertSequence(applied);
        phase = 'solve';
      } else if (phase === 'solve') {
        applied = [];
        phase = 'idle';
      }
      draw(); schedule();
    };

    const resize = () => { measure(); draw(); };
    const visibility = () => { stopFrame(); if (!document.hidden) schedule(); };
    const preference = () => {
      stopFrame(); floatingY = 0; floatTime = 0; hoverMs = 0; resetCube();
      draw(); if (!reduced.matches) schedule();
    };
    const enter = () => { hovering = true; sinceSpin = 0; schedule(); };
    const leave = () => {
      hovering = false; hoverMs = 0; cycled = false;
      if (phase === 'mix') queue = [];
      schedule();
    };
    measure(); draw();
    window.addEventListener('resize', resize); document.addEventListener('visibilitychange', visibility);
    reduced.addEventListener('change', preference); schedule();
    button.addEventListener('pointerenter', enter); button.addEventListener('pointerleave', leave);
    return () => {
      stopFrame(); document.documentElement.style.removeProperty(STRIP_SPACE_PROPERTY); document.documentElement.style.removeProperty(BAY_WIDTH_PROPERTY); delete document.documentElement.dataset.cubeDocked;
      button.removeEventListener('pointerenter', enter); button.removeEventListener('pointerleave', leave);
      window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', visibility);
      reduced.removeEventListener('change', preference);
    };
  }, []);

  return <div className={styles.shell}>
    <div ref={layer} className={styles.layer} aria-hidden="true" data-cube-layer="true" data-hud="true">
      <div ref={float} className={styles.float}>
        <div ref={cube} className={styles.cube}>
          {CUBE_CUBIES.map(home => <span key={`${home.x},${home.y},${home.z}`} data-cube-cubie={`${home.x},${home.y},${home.z}`}
            className={styles.cubie}>
            {cubeCubieStickers(home).map(axis => {
              const face = FACE_BY_AXIS[axis];
              const center = Math.abs(home.x) + Math.abs(home.y) + Math.abs(home.z) === 1;
              return <span key={axis} data-cube-face={face.id} data-cube-axis={axis} data-cube-sticker={axis}
                className={styles.tile} style={{ '--sticker-delay': `${cubeStickerDelay(home)}ms` } as CSSProperties}>
                {center ? <svg className={styles.faceIcon} data-cube-icon={face.id}
                  viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7"
                  strokeLinecap="round" strokeLinejoin="round" aria-label={face.label} focusable="false">
                  {CUBE_ICONS[face.id]}
                </svg> : null}
              </span>;
            })}
          </span>)}
        </div>
      </div>
    </div>
    <button ref={control} type="button" className={styles.control} data-cube-control="true"
      aria-label="메뉴 관리" onPointerDown={event => event.stopPropagation()}
      onClick={event => event.stopPropagation()} />
  </div>;
}
