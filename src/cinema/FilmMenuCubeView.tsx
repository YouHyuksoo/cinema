'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { CUBE_CUBIES, CUBE_FACES, CUBE_HUD_HOLD_MS, CUBE_IDENTITY, CUBE_MOVE_MS, CUBE_SHOWCASE_EVERY_MS,
  CUBE_MENU_GAP, CUBE_SHOWCASE_TURN_MS, CUBE_TWIST_DELAY_MS, cubeApplyMove, cubeBayWidth,
  cubeComposeTurn, cubeCubieStickers, cubeCubieTransform, cubeDockCenter, cubeInLayer, cubeInvertSequence, cubeMenuOrigin,
  cubeMenuSlots, cubeMenuTileSize, cubeScramble, cubeShowcaseFace, cubeSize, cubeStickerDelay, cubeStripSpace,
  type CubeMove } from './filmMenuCube';

export type CubeMenuId = (typeof CUBE_FACES)[number]['id'];
const MENU_SLOTS = cubeMenuSlots();
import styles from './filmMenuCube.module.css';
import { SHOCK_ATTRIBUTE } from './reactorMenuShock';
import { cubeReactorFlight, CUBE_FLIGHT_PERSPECTIVE } from './cubeReactorFlight';

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

/** Management cube: click to unfold its six faces into a 3 × 2 menu; Escape, outside click or a tile folds it back. */
export function FilmMenuCube({ onSelect, links = {} }: {
  onSelect?: (id: CubeMenuId) => void;
  /** Tiles with a route render as links (basePath applied by Next); the rest call onSelect. */
  links?: Partial<Record<CubeMenuId, string>>;
} = {}) {
  const layer = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
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
    let shockMix = false, lastShock: string | null = null;
    let flightElapsed:number|null = null, flightPending = false;
    let flightPose:ReturnType<typeof cubeReactorFlight> = null;
    let reactorMask = '';
    const root = overlay.closest('main');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cubieNodes = [...body.querySelectorAll<HTMLElement>('[data-cube-cubie]')];

    const resetCube = () => {
      orients = CUBE_CUBIES.map(() => CUBE_IDENTITY);
      queue = []; applied = []; turning = null; phase = 'idle'; cycled = false; shockMix = false;
      flightElapsed = null; flightPending = false; flightPose = null;
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
      const panel = menu.current;
      if (panel) {
        const origin = cubeMenuOrigin(center, size, viewport);
        panel.style.setProperty('--menu-x', `${origin.x}px`); panel.style.setProperty('--menu-y', `${origin.y}px`);
        panel.style.setProperty('--tile', `${cubeMenuTileSize(size)}px`);
        panel.style.setProperty('--cube-cx', `${center.x}px`); panel.style.setProperty('--cube-cy', `${center.y}px`);
      }
      document.documentElement.dataset.cubeDocked = 'true';
      overlay.style.setProperty('--cube-size', `${size}px`);
      button.style.width = `${size}px`; button.style.height = `${size}px`;
    };
    const draw = () => {
      const visualY = reduced.matches || flightPose ? 0 : floatingY;
      const position = flightPose ?? center;
      const step = size / 3;
      floating.style.transform = `translateY(${visualY}px)`;
      const camera = flightPose?.camera ?? position;
      const projected = flightPose?.projected ?? { ...center, scale:1 };
      overlay.style.perspective = `${flightPose?.perspective ?? CUBE_FLIGHT_PERSPECTIVE}px`;
      overlay.style.perspectiveOrigin = `${camera.x}px ${camera.y + visualY}px`;
      overlay.style.maskImage = flightPose && flightPose.z < -1 ? reactorMask : '';
      overlay.dataset.twisting = String(!!turning || queue.length > 0);
      if (flightPose) { overlay.dataset.cubeFlight = flightPose.phase; overlay.dataset.flightDepth = String(flightPose.z); }
      else { delete overlay.dataset.cubeFlight; delete overlay.dataset.flightDepth; }
      body.style.transform = `translate3d(${position.x}px,${position.y}px,${flightPose?.z ?? 0}px) translate(-50%,-50%) rotateX(${TILT}deg) rotateY(${YAW + showcaseYaw + (flightPose?.yaw ?? 0)}deg) rotateZ(${flightPose?.bank ?? 0}deg)`;
      button.style.transform = `translate3d(${projected.x}px,${projected.y + visualY}px,0) translate(-50%,-50%) scale(${projected.scale})`;
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
      if (hovering || turning || queue.length || phase !== 'idle' || reduced.matches || overlay.dataset.menuOpen === 'true') { sinceSpin = 0; return; }
      sinceSpin += delta;
      if (sinceSpin < CUBE_SHOWCASE_EVERY_MS) return;
      sinceSpin = 0;
      hudFace(cubeShowcaseFace(quarterTurns + 1), true);
      spin = { from: showcaseYaw, to: showcaseYaw + 90, t: 0, revealed: false };
    };
    const frame = (time: number) => {
      raf = 0;
      const delta = previousTime === null ? 0 : Math.min(64, time - previousTime); previousTime = time;
      const shock = button.getAttribute(SHOCK_ATTRIBUTE);
      if (shock !== null && shock !== lastShock && phase === 'idle' && !turning && !queue.length && flightElapsed === null && overlay.dataset.menuOpen !== 'true') {
        queue = cubeScramble(5, Math.floor(Number(shock))); applied = []; phase = 'mix'; shockMix = true; flightPending = true;
      }
      lastShock = shock;
      if (time - measuredAt >= MEASURE_MS) { measuredAt = time; measure(); }
      floatTime += delta; floatingY = 4 * Math.sin(floatTime * Math.PI * 2 / FLOAT_MS);
      if (overlay.dataset.hud === 'true' && time >= hudUntil) overlay.dataset.hud = 'false';
      if (flightElapsed === null && !flightPending) showcase(delta);
      if (hovering) hoverMs += delta; else hoverMs = 0;
      if (hovering && hoverMs >= CUBE_TWIST_DELAY_MS && phase === 'idle' && !turning && !cycled && flightElapsed === null) startMix();
      if (turning) {
        if (!hovering && !shockMix && phase === 'mix' && !turning.reverse) {
          turning.reverse = true; turning.t = 1 - Math.min(1, turning.t);
        }
        turning.t += delta / (shockMix ? 110 : CUBE_MOVE_MS);
        if (turning.t >= 1) finishTurn();
      } else if (queue.length) {
        const move = queue.shift();
        if (move) turning = { move, t: 0, reverse: false };
      } else if (phase === 'mix' && applied.length) {
        queue = cubeInvertSequence(applied);
        phase = 'solve';
      } else if (phase === 'solve') {
        applied = [];
        if (shockMix && flightPending) { flightElapsed = 0; flightPending = false; }
        phase = 'idle'; shockMix = false;
      }
      if (flightElapsed !== null) {
        const reactor = root?.querySelector<HTMLElement>('[data-reactor-trigger]');
        const rect = reactor?.getBoundingClientRect();
        if (!rect || !rect.width || !rect.height || reactor?.getAttribute('aria-disabled') === 'true' || overlay.dataset.menuOpen === 'true') {
          flightElapsed = null; flightPose = null;
        } else {
          flightPose = cubeReactorFlight(flightElapsed,center,{x:rect.x+rect.width/2,y:rect.y+rect.height/2,radius:Math.min(180,rect.width*.85+size*.4)});
          reactorMask = `radial-gradient(ellipse ${rect.width*.53}px ${rect.height*.53}px at ${rect.x+rect.width/2}px ${rect.y+rect.height/2}px,transparent 97%,black 100%)`;
          if (flightPose) flightElapsed += delta; else { flightElapsed = null; sinceSpin = 0; hoverMs = 0; }
        }
      }
      draw(); schedule();
    };

    const resize = () => { measure(); draw(); };
    const cancelFlight = () => { flightPending = false; flightElapsed = null; flightPose = null; measure(); draw(); };
    const cancelOnInteraction = (event:Event) => {
      // Let a click on the flying cube reach its existing menu toggle before it docks.
      if (event.type === 'pointerdown' && event.target instanceof Node && button.contains(event.target)) return;
      cancelFlight();
    };
    const visibility = () => { stopFrame(); cancelFlight(); if (!document.hidden) schedule(); };
    const preference = () => {
      stopFrame(); floatingY = 0; floatTime = 0; hoverMs = 0; resetCube();
      draw(); if (!reduced.matches) schedule();
    };
    const enter = () => { hovering = true; sinceSpin = 0; schedule(); };
    const leave = () => {
      hovering = false; hoverMs = 0; cycled = false;
      if (phase === 'mix' && !shockMix) queue = [];
      schedule();
    };
    measure(); draw();
    window.addEventListener('resize', resize); document.addEventListener('visibilitychange', visibility);
    reduced.addEventListener('change', preference); schedule();
    button.addEventListener('pointerenter', enter); button.addEventListener('pointerleave', leave);
    root?.addEventListener('pointerdown',cancelOnInteraction,true); root?.addEventListener('keydown',cancelOnInteraction,true);
    return () => {
      stopFrame(); document.documentElement.style.removeProperty(STRIP_SPACE_PROPERTY); document.documentElement.style.removeProperty(BAY_WIDTH_PROPERTY); delete document.documentElement.dataset.cubeDocked;
      button.removeEventListener('pointerenter', enter); button.removeEventListener('pointerleave', leave);
      window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', visibility);
      reduced.removeEventListener('change', preference);
      root?.removeEventListener('pointerdown',cancelOnInteraction,true); root?.removeEventListener('keydown',cancelOnInteraction,true);
    };
  }, []);

  // Menu open/close: mirror the state onto the overlay for CSS and the frame loop, move focus, and close on Escape or an outside press.
  useEffect(() => {
    if (layer.current) layer.current.dataset.menuOpen = String(open);
    if (!open) return;
    const first = requestAnimationFrame(() => menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus({ preventScroll: true }));
    const outside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (menu.current?.contains(target) || control.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', outside, true);
    return () => { cancelAnimationFrame(first); document.removeEventListener('pointerdown', outside, true); };
  }, [open]);
  const closeMenu = () => { setOpen(false); control.current?.focus({ preventScroll: true }); };
  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenu(); return; }
    const step: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
    const move = step[event.key];
    if (!move) return;
    event.preventDefault();
    // Items are ordered fold -> right arm -> down arm; Right/Down walk forward, Left/Up walk back, wrapping.
    const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const index = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement));
    const forward = move[0] > 0 || move[1] > 0;
    items[(index + (forward ? 1 : -1) + items.length) % items.length]?.focus({ preventScroll: true });
  };

  return <div className={styles.shell}>
    <div ref={layer} className={styles.layer} aria-hidden="true" data-cube-layer="true" data-hud="true" data-menu-open="false">
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
    <div ref={menu} id="hatchery-cube-menu" className={styles.menu} role="menu" aria-label="관리 메뉴" data-cube-menu-layer="true" data-open={open}
      inert={!open} onKeyDown={onMenuKeyDown} onPointerDown={event => event.stopPropagation()}
      style={{ '--gap': `${CUBE_MENU_GAP}px` } as CSSProperties}>
      <button type="button" role="menuitem" className={`${styles.panel} ${styles.fold}`} data-cube-menu="fold" tabIndex={open ? 0 : -1}
        style={{ '--col': 0, '--row': 0, '--order': 0, '--peel': 'none' } as CSSProperties}
        onClick={event => { event.stopPropagation(); closeMenu(); }}>
        <svg className={styles.foldIcon} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M16 4 27 10v12l-11 6-11-6V10Z" /><path d="M5 10l11 6 11-6M16 16v12" /><path d="M20 20h5v5" />
        </svg>
        <span className={styles.panelLabel}>접기</span>
      </button>
      {MENU_SLOTS.map(slot => {
        const shared = {
          role: 'menuitem', className: styles.panel, 'data-cube-menu': slot.id, 'data-cube-axis': slot.axis, tabIndex: open ? 0 : -1,
          style: { '--col': slot.column, '--row': slot.row, '--order': slot.order, '--peel': slot.peel, '--cube-sticker': slot.sticker } as CSSProperties,
        } as const;
        const face = <>
          <span className={styles.mosaic} aria-hidden="true">
            {Array.from({ length: 9 }, (_, index) => <i key={index}>{index === 4
              ? <svg className={styles.panelIcon} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7"
                strokeLinecap="round" strokeLinejoin="round" focusable="false">{CUBE_ICONS[slot.id]}</svg> : null}</i>)}
          </span>
          <span className={styles.panelLabel}>{slot.label}</span>
        </>;
        const href = links[slot.id];
        return href
          ? <Link key={slot.id} href={href} prefetch={false} {...shared}
            onClick={event => { event.stopPropagation(); setOpen(false); onSelect?.(slot.id); }}>{face}</Link>
          : <button key={slot.id} type="button" {...shared}
            onClick={event => { event.stopPropagation(); setOpen(false); onSelect?.(slot.id); }}>{face}</button>;
      })}
    </div>
    <button ref={control} type="button" className={styles.control} data-cube-control="true"
      aria-label="메뉴 관리" aria-haspopup="menu" aria-expanded={open} aria-controls="hatchery-cube-menu"
      onPointerDown={event => event.stopPropagation()}
      onClick={event => { event.stopPropagation(); setOpen(value => !value); }} />
  </div>;
}
