'use client';

import { useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { CUBE_CUBIES, CUBE_FACES, CUBE_IDENTITY, CUBE_MOVE_MS, CUBE_TWIST_DELAY_MS, clampCubeCenter,
  cubeApplyMove, cubeComposeTurn, cubeCubieStickers, cubeCubieTransform, cubeInLayer,
  cubeInvertSequence, cubeRestingCenter, cubeScramble, cubeSize, isCubeDrag,
  type CubeMove, type Point } from './filmMenuCube';
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
const FACE_BY_AXIS = Object.fromEntries(CUBE_FACES.map(face => [face.axis, face])) as Record<(typeof CUBE_FACES)[number]['axis'], (typeof CUBE_FACES)[number]>;

export function FilmMenuCube() {
  const layer = useRef<HTMLDivElement>(null);
  const float = useRef<HTMLDivElement>(null);
  const cube = useRef<HTMLDivElement>(null);
  const control = useRef<HTMLButtonElement>(null);
  const actions = useRef<{
    start(pointerId: number, point: Point): boolean;
    move(pointerId: number, point: Point): void;
    end(pointerId: number): void;
    cancel(pointerId: number): void;
    blockClick(): boolean;
  } | null>(null);

  useLayoutEffect(() => {
    const overlay = layer.current, floating = float.current, body = cube.current, button = control.current;
    if (!overlay || !floating || !body || !button) return;
    let raf = 0, previousTime: number | null = null, floatTime = 0, floatingY = 0, size = 108;
    let viewport = { width: window.innerWidth, height: window.innerHeight };
    let center = cubeRestingCenter(viewport, size);
    let remembered: Point | null = null;
    let pointer: null | { id: number; origin: Point; center: Point; dragged: boolean } = null;
    let suppressClick = false, hovering = false, hoverMs = 0;
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
      center = cubeRestingCenter(viewport, size, remembered);
      overlay.style.setProperty('--cube-size', `${size}px`);
      button.style.width = `${size}px`; button.style.height = `${size}px`;
    };
    const draw = () => {
      const visualY = reduced.matches ? 0 : floatingY;
      const step = size / 3;
      floating.style.transform = `translateY(${visualY}px)`;
      overlay.style.perspectiveOrigin = `${center.x}px ${center.y + visualY}px`;
      overlay.dataset.twisting = String(!!turning || queue.length > 0);
      body.style.transform = `translate3d(${center.x}px,${center.y}px,0) translate(-50%,-50%) rotateX(${TILT}deg) rotateY(${YAW}deg)`;
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
    const setDragging = (value: boolean) => {
      overlay.dataset.dragging = String(value); button.dataset.dragging = String(value);
    };
    const releaseActivePointer = () => {
      const pointerId = pointer?.id;
      pointer = null; setDragging(false);
      if (pointerId !== undefined && button.hasPointerCapture(pointerId)) button.releasePointerCapture(pointerId);
    };
    const schedule = () => {
      if (!raf && !document.hidden && !reduced.matches && !pointer) raf = requestAnimationFrame(frame);
    };
    const finishTurn = () => {
      if (!turning) return;
      if (!turning.reverse) {
        orients = cubeApplyMove(orients, turning.move);
        if (phase === 'mix') applied.push(turning.move);
      }
      turning = null;
    };
    const frame = (time: number) => {
      raf = 0;
      const delta = previousTime === null ? 0 : Math.min(64, time - previousTime); previousTime = time;
      floatTime += delta; floatingY = 4 * Math.sin(floatTime * Math.PI * 2 / FLOAT_MS);
      if (hovering && !pointer) hoverMs += delta; else if (!hovering) hoverMs = 0;
      if (hovering && !pointer && hoverMs >= CUBE_TWIST_DELAY_MS && phase === 'idle' && !turning && !cycled) startMix();
      if (turning) {
        if (!hovering && phase === 'mix' && !turning.reverse) {
          turning.reverse = true; turning.t = 1 - Math.min(1, turning.t);
        }
        turning.t += delta / CUBE_MOVE_MS;
        if (turning.t >= 1) finishTurn();
      } else if (queue.length && !pointer) {
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

    actions.current = {
      start(pointerId, point) {
        if (pointer) return false;
        stopFrame(); suppressClick = false;
        center = clampCubeCenter({ x: center.x, y: center.y + floatingY }, viewport, size);
        remembered = center; floatingY = 0; floatTime = 0; hoverMs = 0;
        resetCube();
        pointer = { id: pointerId, origin: point, center, dragged: false };
        setDragging(true); draw(); return true;
      },
      move(pointerId, point) {
        if (!pointer || pointer.id !== pointerId) return;
        center = clampCubeCenter({ x: pointer.center.x + point.x - pointer.origin.x,
          y: pointer.center.y + point.y - pointer.origin.y }, viewport, size);
        pointer.dragged ||= isCubeDrag(pointer.origin, point);
        remembered = center; draw();
      },
      end(pointerId) {
        if (!pointer || pointer.id !== pointerId) return;
        suppressClick = pointer.dragged; pointer = null; setDragging(false); schedule();
      },
      cancel(pointerId) {
        if (!pointer || pointer.id !== pointerId) return;
        pointer = null; suppressClick = false; setDragging(false); schedule();
      },
      blockClick() { const blocked = suppressClick; suppressClick = false; return blocked; },
    };

    const resize = () => { measure(); draw(); };
    const visibility = () => {
      stopFrame();
      if (document.hidden) releaseActivePointer();
      else schedule();
    };
    const preference = () => {
      stopFrame(); floatingY = 0; floatTime = 0; hoverMs = 0; resetCube();
      draw(); if (!reduced.matches) schedule();
    };
    const enter = () => { hovering = true; schedule(); };
    const leave = () => {
      hovering = false; hoverMs = 0; cycled = false;
      if (phase === 'mix') queue = [];
      schedule();
    };
    measure(); draw(); setDragging(false);
    window.addEventListener('resize', resize); document.addEventListener('visibilitychange', visibility);
    reduced.addEventListener('change', preference); schedule();
    button.addEventListener('pointerenter', enter); button.addEventListener('pointerleave', leave);
    return () => {
      stopFrame(); releaseActivePointer(); actions.current = null;
      button.removeEventListener('pointerenter', enter); button.removeEventListener('pointerleave', leave);
      window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', visibility);
      reduced.removeEventListener('change', preference);
    };
  }, []);

  return <div className={styles.shell}>
    <div ref={layer} className={styles.layer} aria-hidden="true" data-cube-layer="true">
      <div ref={float} className={styles.float}>
        <div ref={cube} className={styles.cube}>
          {CUBE_CUBIES.map(home => <span key={`${home.x},${home.y},${home.z}`} data-cube-cubie={`${home.x},${home.y},${home.z}`}
            className={styles.cubie}>
            {cubeCubieStickers(home).map(axis => {
              const face = FACE_BY_AXIS[axis];
              const center = Math.abs(home.x) + Math.abs(home.y) + Math.abs(home.z) === 1;
              return <span key={axis} data-cube-face={face.id} data-cube-axis={axis} data-cube-sticker={axis}
                className={styles.tile}>
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
      aria-label="메뉴 관리"
      onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (!event.isPrimary || event.button !== 0) return;
        if (actions.current?.start(event.pointerId, { x: event.clientX, y: event.clientY })) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      }}
      onPointerMove={event => {
        event.stopPropagation();
        actions.current?.move(event.pointerId, { x: event.clientX, y: event.clientY });
      }}
      onPointerUp={event => {
        event.stopPropagation(); actions.current?.end(event.pointerId);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={event => {
        event.stopPropagation(); actions.current?.cancel(event.pointerId);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onLostPointerCapture={event => { event.stopPropagation(); actions.current?.cancel(event.pointerId); }}
      onClick={event => {
        event.stopPropagation();
        if (event.detail > 0 && actions.current?.blockClick()) event.preventDefault();
      }} />
  </div>;
}
