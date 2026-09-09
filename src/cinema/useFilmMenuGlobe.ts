'use client';

import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { clampGlobeCenter, drawSoccerSphere, globeDiameter, globeFaceSize, globeMomentumStep, globePose, globeRestingCenter,
  globeRestScale, globeRestStep, isGlobeDrag, mixMenuPose, soccerHexScreenPoses, type MenuPose,
  type Point } from './filmMenuGlobe';
import { orbitPose, orbitRadius, ringPose, type MenuLayout } from './filmMenuRing';
import { shockEnvelope, SHOCK_ATTRIBUTE } from './reactorMenuShock';

type Phase = 'open' | 'closed' | 'morphing';
type Input = { menuOpen: boolean; turn: number };
type GlobeActions = {
  start(pointerId: number, point: Point, time: number): boolean;
  move(pointerId: number, point: Point, time: number): void;
  end(pointerId: number, time: number): void;
  cancel(pointerId: number): void;
  blockClick(): boolean;
};
const DURATION = 650;

/** RAF owns transforms; React only changes accessibility at phase boundaries. */
export function useFilmMenuGlobe(menuOpen: boolean, turn: number, count: number,
  stage: RefObject<HTMLDivElement | null>, buttons: RefObject<(HTMLButtonElement | null)[]>, layout: MenuLayout = 'dock') {
  const layer = useRef<HTMLDivElement>(null);
  const float = useRef<HTMLDivElement>(null);
  const control = useRef<HTMLButtonElement>(null);
  const faces = useRef<(HTMLSpanElement | null)[]>([]);
  const ball = useRef<HTMLCanvasElement>(null);
  const rememberedCenter = useRef<Point | null>(null);
  const [phase, setPhase] = useState<Phase>(menuOpen ? 'open' : 'closed');
  const update = useRef<((next: Input) => void) | null>(null);
  const actions = useRef<GlobeActions | null>(null);
  const initial = useRef({ menuOpen, turn });

  useLayoutEffect(() => {
    const element = stage.current, overlay = layer.current, floating = float.current, button = control.current;
    if (!element || !overlay || !floating || !button) return;
    let input = initial.current;
    const orbit = layout === 'orbit';
    const nav = overlay.closest<HTMLElement>('[data-menu-layout]');
    let currentPhase: Phase = input.menuOpen ? 'open' : 'closed';
    // Orbit layout: where the globe travels to while its ring is open, and where it came from.
    let orbitCenter = { x: 0, y: 0 }, centerFrom = { x: 0, y: 0 }, centerTo = { x: 0, y: 0 };
    // Orbit layout: the sphere settles smaller inside its open ring (the tiles carry the menu), easing during the morph.
    const ORBIT_SPHERE_SCALE = .66;
    let ballScale = 1, ballScaleFrom = 1;
    const sphereScale = () => orbit && (currentPhase !== 'closed' || input.menuOpen) ? ballScale : restScale();
    let raf = 0, previousTime: number | null = null, elapsed = 0, angle = 0, floatTime = 0;
    let current: MenuPose[] = [], from: MenuPose[] = [], ringTarget: MenuPose[] = [];
    let ringOrigin = { x: 0, y: 0 }, rect = element.getBoundingClientRect();
    let viewport = { width: window.innerWidth, height: window.innerHeight };
    let diameter = 240, faceHeight = 50, radius = 0, faceScale = 0, floatingY = 0;
    let globeCenter = globeRestingCenter(viewport, diameter);
    let perspective = { ...globeCenter }, fromPerspective = { ...globeCenter };
    let momentum = { x: 0, y: 0 };
    // Resting size: half when idle; hover, focus or drag grows to 70% of the layout diameter.
    let rest = 0, idleMs = 0, awake = false, dragDirty = false;
    const restScale = () => globeRestScale(rest);
    let pointer: null | { id: number; origin: Point; center: Point; lastCenter: Point;
      lastTime: number; dragged: boolean; velocity: Point } = null;
    let suppressClick = false;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const short = window.matchMedia('(max-height: 500px)');
    const unitFace = globeFaceSize(count, 1);

    const stageCenter = () => ({ x: rect.left + rect.width / 2,
      y: rect.top + rect.height * (short.matches ? .36 : .4) });
    const ringPerspective = () => orbit ? { ...globeCenter } : { x: rect.left + rect.width / 2, y: rect.top + rect.height * .45 };
    /** Pull the globe inward so its orbit ring (plus tiles and the readout below) stays on screen above the dock bar. */
    const orbitCenterFor = (center: Point): Point => {
      const margin = orbitRadius(diameter) + 56;
      return { x: Math.max(margin, Math.min(viewport.width - margin, center.x)),
        y: Math.max(margin, Math.min(viewport.height - 84 - margin - 44, center.y)) };
    };
    const orbitFace = (index: number) => {
      const ringButton = buttons.current[index], hex = ringButton?.firstElementChild as HTMLElement | null;
      const hexHeight = hex?.offsetHeight || faceHeight, buttonHeight = ringButton?.offsetHeight || (short.matches ? 63 : 70);
      return { scale: hexHeight / Math.max(1, faceHeight), localY: (hex?.offsetTop ?? 0) + hexHeight / 2 - buttonHeight / 2 };
    };
    const orbitPoses = (center: Point): MenuPose[] => Array.from({ length: count }, (_, index) => {
      const pose = orbitPose(index, input.turn, count, orbitRadius(diameter)), face = orbitFace(index);
      return { x: center.x + pose.x, y: center.y + pose.y + face.localY * pose.scale, z: 0, yaw: 0, pitch: 0,
        scale: face.scale * pose.scale, opacity: pose.opacity };
    });
    const measure = () => {
      rect = element.getBoundingClientRect();
      const previousViewport = viewport;
      viewport = { width: window.innerWidth, height: window.innerHeight };
      diameter = globeDiameter(viewport.width, viewport.height);
      faceHeight = short.matches ? 43 : 50;
      radius = diameter / (2 + unitFace);
      faceScale = faceHeight > 0 ? unitFace * radius / faceHeight : 0;
      globeCenter = globeRestingCenter(viewport, diameter * restScale(), rememberedCenter.current, previousViewport);
      if (previousViewport.width !== viewport.width || previousViewport.height !== viewport.height) {
        rememberedCenter.current = globeCenter;
        momentum = { x: 0, y: 0 };
      }
      button.style.width = `${diameter}px`; button.style.height = `${diameter}px`;
      if (ball.current) { ball.current.style.width = `${diameter}px`; ball.current.style.height = `${diameter}px`; }
    };
    const globe = () => {
      const sized = restScale();
      const visual = diameter * sized;
      const hexes = soccerHexScreenPoses(visual / 2, angle);
      const tile = faceHeight > 0 ? visual * .155 / faceHeight : 0;
      return Array.from({ length: count }, (_, index) => {
        const pose = hexes[index] ?? globePose(index, count, radius * sized, angle);
        return {
          ...pose,
          x: globeCenter.x + pose.x, y: globeCenter.y + pose.y,
          scale: tile * (.55 + .45 * pose.scale),
        };
      });
    };
    const ring = (capture = false) => {
      if (orbit) return orbitPoses(orbitCenter);
      const origin = stageCenter();
      return Array.from({ length: count }, (_, index) => {
        const ringButton = buttons.current[index];
        const hex = ringButton?.firstElementChild as HTMLElement | null;
        const pose = ringPose(index, input.turn, count, Math.max(40, Math.min(430, rect.width / 2 - 36)));
        const buttonHeight = ringButton?.offsetHeight || (short.matches ? 63 : 70);
        const localY = (hex?.offsetTop ?? 0) + faceHeight / 2 - buttonHeight / 2;
        let x = pose.x, y = pose.y, z = pose.z, yaw = pose.yaw, scale = pose.scale, opacity = pose.opacity;
        if (capture && ringButton) {
          const css = getComputedStyle(ringButton), matrix = new DOMMatrixReadOnly(css.transform);
          scale = Math.hypot(matrix.m11, matrix.m13);
          yaw = Math.atan2(-matrix.m13, matrix.m11) * 180 / Math.PI;
          x = matrix.m41 + ringButton.offsetWidth / 2; y = matrix.m42 + buttonHeight / 2;
          z = matrix.m43; opacity = Number(css.opacity);
        }
        const inner = hex ? new DOMMatrixReadOnly(getComputedStyle(hex).transform) : new DOMMatrixReadOnly();
        const radians = yaw * Math.PI / 180;
        return { x: origin.x + x + Math.sin(radians) * inner.m43 * scale,
          y: origin.y + y + (localY + inner.m42) * scale,
          z: z + Math.cos(radians) * inner.m43 * scale, yaw, pitch: 0, scale, opacity };
      });
    };
    const publish = (value: Phase) => {
      currentPhase = value; setPhase(value); overlay.dataset.phase = value; button.dataset.phase = value;
    };
    const setDragging = (value: boolean) => {
      overlay.dataset.dragging = String(value); button.dataset.dragging = String(value);
    };
    const cacheRing = () => { ringTarget = ring(); ringOrigin = stageCenter(); };
    const targetRing = () => {
      if (orbit) return orbitPoses(orbitCenter);
      const origin = stageCenter();
      return ringTarget.map(pose => ({ ...pose, x: pose.x + origin.x - ringOrigin.x,
        y: pose.y + origin.y - ringOrigin.y }));
    };
    const draw = () => {
      current.forEach((pose, index) => {
        const face = faces.current[index]; if (!face) return;
        face.style.transform = `translate(-50%,-50%) translate3d(${pose.x}px,${pose.y}px,${pose.z}px) rotateY(${pose.yaw}deg) rotateX(${pose.pitch ?? 0}deg) scale(${pose.scale})`;
        face.style.opacity = String(pose.opacity);
      });
      if (nav) {
        nav.style.setProperty('--orbit-cx', `${globeCenter.x}px`); nav.style.setProperty('--orbit-cy', `${globeCenter.y}px`);
        nav.style.setProperty('--orbit-r', `${orbitRadius(diameter)}px`);
      }
      if ((currentPhase === 'closed' || orbit) && ball.current) {
        // Raster the sphere at its full size and scale it with the same factor as the tiles, so both
        // shrink in lockstep and the per-frame raster cost does not change with the rest size.
        ball.current.style.transform = `translate3d(${globeCenter.x}px,${globeCenter.y}px,0) translate(-50%,-50%) scale(${sphereScale()})`;
        drawSoccerSphere(ball.current, diameter, angle);
      }
      dragDirty = false;
      floating.style.transform = `translateY(${floatingY}px)`;
      const visualY = currentPhase === 'closed' ? floatingY : 0;
      overlay.style.perspectiveOrigin = `${perspective.x}px ${perspective.y + visualY}px`;
      button.style.transform = `translate3d(${globeCenter.x}px,${globeCenter.y + floatingY}px,0) translate(-50%,-50%) scale(${sphereScale()})`;
    };
    const stopFrame = () => { if (raf) cancelAnimationFrame(raf); raf = 0; previousTime = null; };
    const releaseActivePointer = () => {
      const pointerId = pointer?.id;
      pointer = null; setDragging(false);
      if (pointerId !== undefined && button.hasPointerCapture(pointerId)) button.releasePointerCapture(pointerId);
    };
    const schedule = () => {
      if (!raf && !document.hidden && !reduced.matches && (currentPhase !== 'open' || orbit)) {
        raf = requestAnimationFrame(frame);
      }
    };
    const finish = () => {
      rest = input.menuOpen || awake ? 0 : 1; idleMs = 0;
      current = input.menuOpen ? targetRing() : globe(); floatingY = 0; elapsed = 0; floatTime = 0;
      perspective = input.menuOpen ? ringPerspective() : { ...globeCenter };
      publish(input.menuOpen ? 'open' : 'closed'); draw();
    };
    const frame = (time: number) => {
      raf = 0;
      const raw = previousTime === null ? 0 : time - previousTime, delta = Math.min(64, raw); previousTime = time;
      rect = element.getBoundingClientRect();
      if (pointer) {
        // Held or dragging: no spin, float or momentum. Grow to the hover size while pressed and
        // redraw once per frame instead of once per pointermove event.
        const before = rest;
        rest = globeRestStep(rest, 0, delta, true);
        if (dragDirty || rest !== before) { perspective = { ...globeCenter }; current = globe(); draw(); }
      } else if (currentPhase === 'morphing') {
        elapsed += delta;
        const progress = Math.min(1, elapsed / DURATION), eased = progress * progress * (3 - 2 * progress);
        if (orbit) {
          // The globe itself travels between its corner and the orbit centre while the faces fly, growing to full size.
          globeCenter = { x: centerFrom.x + (centerTo.x - centerFrom.x) * eased, y: centerFrom.y + (centerTo.y - centerFrom.y) * eased };
          ballScale = ballScaleFrom + ((input.menuOpen ? ORBIT_SPHERE_SCALE : restScale()) - ballScaleFrom) * eased;
          rememberedCenter.current = input.menuOpen ? globeCenter : null;
        }
        const target = input.menuOpen ? targetRing() : globe();
        const targetPerspective = input.menuOpen ? ringPerspective() : globeCenter;
        current = from.map((pose, index) => mixMenuPose(pose, target[index], eased));
        perspective = { x: fromPerspective.x * (1 - eased) + targetPerspective.x * eased,
          y: fromPerspective.y * (1 - eased) + targetPerspective.y * eased };
        if (progress >= 1) finish(); else draw();
      } else {
        const shockedAt = button.getAttribute(SHOCK_ATTRIBUTE);
        const shock = shockedAt === null ? 0 : shockEnvelope(time - Number(shockedAt));
        angle = (angle + delta * Math.PI * 2 / 30000 * (1 + shock * 95)) % (Math.PI * 2);
        if (momentum.x || momentum.y) {
          const next = globeMomentumStep({ center: globeCenter, velocity: momentum }, delta, viewport, diameter * restScale(), false);
          globeCenter = next.center; momentum = next.velocity; rememberedCenter.current = globeCenter;
        }
        const orbitOpen = orbit && input.menuOpen;
        // While the orbit ring is open the globe stays put at full size (the real tiles do not float).
        if (!orbitOpen) { floatTime += delta; floatingY = 4 * Math.sin(floatTime * Math.PI * 2 / 4800); }
        // Idle time is wall-clock: a slow frame must not postpone the rest.
        idleMs += raw;
        const before = restScale();
        rest = globeRestStep(rest, idleMs, delta, awake || orbitOpen);
        // Rest about the globe's bottom-right corner: shift the center by the radius change so that
        // tangent point stays put while the globe shrinks toward, or grows out of, the corner.
        const shift = diameter / 2 * (before - restScale());
        if (shift) { globeCenter = { x: globeCenter.x + shift, y: globeCenter.y + shift }; rememberedCenter.current = globeCenter; }
        perspective = { ...globeCenter }; current = globe(); draw();
      }
      schedule();
    };

    actions.current = {
      start(pointerId, point, time) {
        if (currentPhase !== 'closed' || pointer) return false;
        stopFrame(); momentum = { x: 0, y: 0 }; suppressClick = false; awake = true; idleMs = 0;
        globeCenter = clampGlobeCenter({ x: globeCenter.x, y: globeCenter.y + floatingY }, viewport, diameter * restScale());
        rememberedCenter.current = globeCenter; floatingY = 0; perspective = { ...globeCenter };
        pointer = { id: pointerId, origin: point, center: globeCenter, lastCenter: globeCenter,
          lastTime: time, dragged: false, velocity: { x: 0, y: 0 } };
        setDragging(true); current = globe(); draw(); schedule(); return true;
      },
      move(pointerId, point, time) {
        if (!pointer || pointer.id !== pointerId) return;
        globeCenter = clampGlobeCenter({ x: pointer.center.x + point.x - pointer.origin.x,
          y: pointer.center.y + point.y - pointer.origin.y }, viewport, diameter * restScale());
        const delta = Math.max(1, time - pointer.lastTime);
        const instant = { x: (globeCenter.x - pointer.lastCenter.x) / delta,
          y: (globeCenter.y - pointer.lastCenter.y) / delta };
        pointer.velocity = { x: pointer.velocity.x * .55 + instant.x * .45,
          y: pointer.velocity.y * .55 + instant.y * .45 };
        pointer.dragged ||= isGlobeDrag(pointer.origin, point);
        pointer.lastCenter = globeCenter; pointer.lastTime = time;
        rememberedCenter.current = globeCenter; dragDirty = true; schedule();
      },
      end(pointerId, time) {
        if (!pointer || pointer.id !== pointerId) return;
        const wasDrag = pointer.dragged;
        if (wasDrag && !reduced.matches && time - pointer.lastTime <= 80) {
          const speed = Math.hypot(pointer.velocity.x, pointer.velocity.y), scale = speed > .55 ? .55 / speed : 1;
          momentum = { x: pointer.velocity.x * scale, y: pointer.velocity.y * scale };
        } else momentum = { x: 0, y: 0 };
        suppressClick = wasDrag; pointer = null; idleMs = 0; setDragging(false); schedule();
      },
      cancel(pointerId) {
        if (!pointer || pointer.id !== pointerId) return;
        pointer = null; momentum = { x: 0, y: 0 }; suppressClick = false; idleMs = 0; setDragging(false); schedule();
      },
      blockClick() { const blocked = suppressClick; suppressClick = false; return blocked; },
    };

    update.current = next => {
      if (next.menuOpen === input.menuOpen) {
        const turnChanged = next.turn !== input.turn; input = next;
        // The cached ring target only feeds a morph in progress. While the ring is open, every
        // pointermove changes `turn`; re-measuring 16 tiles there forces layout on each mouse event
        // and made dragging stutter. The close transition re-measures from the live tiles anyway.
        if (!turnChanged || currentPhase !== 'morphing') return;
        measure(); cacheRing();
        if (next.menuOpen) {
          from = current.map(pose => ({ ...pose })); fromPerspective = { ...perspective };
          elapsed = 0; previousTime = null;
        }
        return;
      }
      stopFrame(); momentum = { x: 0, y: 0 }; releaseActivePointer();
      if (currentPhase === 'open') current = ring(true);
      from = current.map(pose => ({ ...pose, y: pose.y + floatingY }));
      fromPerspective = { x: perspective.x, y: perspective.y + floatingY };
      floatingY = 0; input = next; elapsed = 0;
      if (orbit) {
        // Open: settle the globe at full size and slide it to where the ring fits; close: back to the corner.
        centerFrom = { x: globeCenter.x, y: globeCenter.y + floatingY };
        ballScaleFrom = currentPhase === 'open' ? ORBIT_SPHERE_SCALE : restScale(); ballScale = ballScaleFrom;
        rest = 0; awake = next.menuOpen;
        orbitCenter = next.menuOpen ? orbitCenterFor(centerFrom) : orbitCenter;
        centerTo = next.menuOpen ? orbitCenter : globeRestingCenter(viewport, diameter, null);
        rememberedCenter.current = next.menuOpen ? orbitCenter : null;
        measure(); globeCenter = centerFrom; cacheRing();
        if (reduced.matches) { globeCenter = centerTo; finish(); } else { publish('morphing'); draw(); schedule(); }
        return;
      }
      if (!next.menuOpen) rememberedCenter.current = null;
      measure(); cacheRing();
      if (reduced.matches) finish(); else { publish('morphing'); draw(); schedule(); }
    };
    const resize = () => {
      const viewportChanged = viewport.width !== window.innerWidth || viewport.height !== window.innerHeight;
      if (viewportChanged) releaseActivePointer();
      measure();
      if (orbit && viewportChanged) {
        orbitCenter = orbitCenterFor(globeRestingCenter(viewport, diameter * restScale()));
        if (input.menuOpen) globeCenter = { ...orbitCenter };
        centerFrom = { ...globeCenter };
        centerTo = input.menuOpen ? orbitCenter : globeRestingCenter(viewport, diameter * restScale());
        rememberedCenter.current = { ...globeCenter };
      }
      cacheRing();
      if (currentPhase === 'closed') {
        momentum = { x: 0, y: 0 }; perspective = { ...globeCenter }; current = globe(); draw();
      } else if (currentPhase === 'open') {
        perspective = ringPerspective(); current = targetRing(); draw();
      } else {
        from = current.map(pose => ({ ...pose })); fromPerspective = { ...perspective };
        elapsed = 0; previousTime = null; schedule();
      }
    };
    const visibility = () => {
      stopFrame();
      if (document.hidden) { momentum = { x: 0, y: 0 }; releaseActivePointer(); }
      else schedule();
    };
    const wake = () => { awake = true; idleMs = 0; schedule(); };
    const sleep = () => { awake = button.matches(':hover') || button.matches(':focus-visible'); idleMs = 0; };
    const preference = () => {
      stopFrame(); momentum = { x: 0, y: 0 }; floatingY = 0; rest = 0;
      if (reduced.matches) finish(); else schedule();
    };
    measure(); cacheRing(); current = input.menuOpen ? targetRing() : globe();
    perspective = input.menuOpen ? ringPerspective() : { ...globeCenter };
    draw(); overlay.dataset.phase = currentPhase; button.dataset.phase = currentPhase; setDragging(false);
    const observer = new ResizeObserver(resize); observer.observe(element);
    window.addEventListener('resize', resize); document.addEventListener('visibilitychange', visibility);
    reduced.addEventListener('change', preference); short.addEventListener('change', resize); schedule();
    button.addEventListener('pointerenter', wake); button.addEventListener('pointerleave', sleep);
    button.addEventListener('focus', wake); button.addEventListener('blur', sleep);
    return () => {
      stopFrame(); releaseActivePointer(); observer.disconnect(); update.current = null; actions.current = null;
      button.removeEventListener('pointerenter', wake); button.removeEventListener('pointerleave', sleep);
      button.removeEventListener('focus', wake); button.removeEventListener('blur', sleep);
      window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', visibility);
      reduced.removeEventListener('change', preference); short.removeEventListener('change', resize);
    };
  }, [buttons, count, stage, layout]);

  useLayoutEffect(() => { update.current?.({ menuOpen, turn }); }, [menuOpen, turn]);
  const events = {
    onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
      event.stopPropagation();
      if (!event.isPrimary || event.button !== 0) return;
      if (actions.current?.start(event.pointerId, { x: event.clientX, y: event.clientY }, event.timeStamp)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    },
    onPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
      event.stopPropagation(); actions.current?.move(event.pointerId,
        { x: event.clientX, y: event.clientY }, event.timeStamp);
    },
    onPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
      event.stopPropagation(); actions.current?.end(event.pointerId, event.timeStamp);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    },
    onPointerCancel(event: ReactPointerEvent<HTMLButtonElement>) {
      event.stopPropagation(); actions.current?.cancel(event.pointerId);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    },
    onLostPointerCapture(event: ReactPointerEvent<HTMLButtonElement>) {
      event.stopPropagation(); actions.current?.cancel(event.pointerId);
    },
  };
  return { phase, layer, float, control, faces, ball, events,
    blockClick: () => actions.current?.blockClick() ?? false };
}
