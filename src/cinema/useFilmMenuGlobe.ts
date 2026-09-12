'use client';

import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { cornerInstrumentCenter, clampGlobeCenter, drawSoccerSphere, GLOBE_REST_SCALE, GLOBE_TIGHT_MAX_WIDTH, globeDiameter, turbineOrbMetrics, globeFaceSize, globeMomentumStep, globePose, globeRestingCenter,
  isGlobeDrag, mixMenuPose, soccerHexScreenPoses, sphereSpinAngle, type MenuPose,
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
    let raf = 0, previousTime: number | null = null, elapsed = 0, angle = 0;
    let current: MenuPose[] = [], from: MenuPose[] = [], ringTarget: MenuPose[] = [];
    let ringOrigin = { x: 0, y: 0 }, rect = element.getBoundingClientRect();
    let viewport = { width: window.innerWidth, height: window.innerHeight };
    let diameter = 240, faceHeight = 50, radius = 0, faceScale = 0;
    let dockX: number | null = null;
    let dockY: number | null = null, manuallyPlaced = false;
    let globeCenter = globeRestingCenter(viewport, diameter);
    let perspective = { ...globeCenter }, fromPerspective = { ...globeCenter };
    let momentum = { x: 0, y: 0 };
    // Resting size: half when idle; hover, focus or drag grows to 70% of the layout diameter.
    let dragDirty = false;
    // Idle-cost guards: the sphere rasters only on a new snapped spin, orbit variables publish only on change.
    let rasterSpin = -1, rasterSize = 0, publishedOrbitVars = '';
    const restScale = () => GLOBE_REST_SCALE;
    let pointer: null | { id: number; origin: Point; center: Point; lastCenter: Point;
      lastTime: number; dragged: boolean; velocity: Point } = null;
    let suppressClick = false;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const short = window.matchMedia('(max-height: 500px)');
    const unitFace = globeFaceSize(count, 1);

    const stageCenter = () => ({ x: rect.left + rect.width / 2,
      y: rect.top + rect.height * (short.matches ? .36 : .4) });
    const ringPerspective = () => orbit ? { ...globeCenter } : { x: rect.left + rect.width / 2, y: rect.top + rect.height * .45 };
    const mobileSpread = () => viewport.width <= 680 ? { x: Math.max(0, Math.min(28, viewport.width / 2 - orbitRadius(diameter) - 46)),
      y: Math.max(0, Math.min(100, viewport.height / 2 - orbitRadius(diameter) - 78)) } : { x: 0, y: 0 };
    /** Pull the globe inward so its orbit ring (plus tiles and the readout below) stays on screen. */
    const orbitCenterFor = (center: Point): Point => {
      const spread = mobileSpread();
      const marginX = orbitRadius(diameter) + spread.x + 46, marginY = orbitRadius(diameter) + spread.y + 56;
      return { x: viewport.width < marginX * 2 ? viewport.width / 2 : Math.max(marginX, Math.min(viewport.width - marginX, center.x)),
        y: viewport.height < marginY * 2 + 44 ? viewport.height / 2 : Math.max(marginY, Math.min(viewport.height - marginY - 44, center.y)) };
    };
    const orbitFace = (index: number) => {
      const ringButton = buttons.current[index], hex = ringButton?.firstElementChild as HTMLElement | null;
      const hexHeight = hex?.offsetHeight || faceHeight, buttonHeight = ringButton?.offsetHeight || (short.matches ? 63 : 70);
      return { scale: hexHeight / Math.max(1, faceHeight), localY: (hex?.offsetTop ?? 0) + hexHeight / 2 - buttonHeight / 2 };
    };
    const orbitPoses = (center: Point): MenuPose[] => Array.from({ length: count }, (_, index) => {
      const pose = orbitPose(index, input.turn, count, orbitRadius(diameter)), face = orbitFace(index);
      if (index % 2 === 0) { const spread = mobileSpread(); pose.x += Math.cos(pose.angle) * spread.x; pose.y += Math.sin(pose.angle) * spread.y; }
      return { x: center.x + pose.x, y: center.y + pose.y + face.localY * pose.scale, z: 0, yaw: 0, pitch: 0,
        scale: face.scale * pose.scale, opacity: pose.opacity };
    });
    const measure = () => {
      rect = element.getBoundingClientRect();
      const previousViewport = viewport;
      viewport = { width: window.innerWidth, height: window.innerHeight };
      // Rest axis: the top signal bay's centerline (FilmMenuCubeView publishes it while the strip
      // is docked). Small screens hide that bay, so the sphere keeps its corner there.
      const signalAxis = Number.parseFloat(document.documentElement.style.getPropertyValue('--hatchery-signal-cx'));
      dockX = viewport.width > GLOBE_TIGHT_MAX_WIDTH && Number.isFinite(signalAxis) ? signalAxis : null;
      const turbine = document.querySelector<HTMLElement>('[data-turbine-hub]')?.getBoundingClientRect();
      dockY = turbine && turbine.height > 0 ? turbine.top + turbine.height / 2 : null;
      diameter = globeDiameter(viewport.width, viewport.height);
      faceHeight = short.matches ? 43 : 50;
      radius = diameter / (2 + unitFace);
      faceScale = faceHeight > 0 ? unitFace * radius / faceHeight : 0;
      globeCenter = manuallyPlaced ? globeRestingCenter(viewport, diameter * restScale(), rememberedCenter.current, previousViewport) : cornerInstrumentCenter(viewport, 'right');
      if (previousViewport.width !== viewport.width || previousViewport.height !== viewport.height) {
        rememberedCenter.current = globeCenter;
        momentum = { x: 0, y: 0 };
      }
      button.style.width = `${diameter}px`; button.style.height = `${diameter}px`;
      if (ball.current) { ball.current.style.width = `${diameter}px`; ball.current.style.height = `${diameter}px`; }
      // Publish the orb size so the turbine in the opposite corner can match it on small screens (filmTurbineMenu.module.css).
      const orb = turbineOrbMetrics(diameter), root = document.documentElement.style;
      root.setProperty('--hatchery-orb-diameter', `${orb.diameter}px`);
      root.setProperty('--hatchery-orb-scale', orb.scale.toFixed(4));
      root.setProperty('--hatchery-orb-open-scale', orb.openScale.toFixed(4));
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
      const spread = mobileSpread();
      const orbitVars = `${globeCenter.x}px ${globeCenter.y}px ${orbitRadius(diameter)}px ${spread.x} ${spread.y}`;
      if (nav && orbitVars !== publishedOrbitVars) {
        publishedOrbitVars = orbitVars;
        // The dock's action hub (a sibling of this menu) centres itself on the same values.
        for (const [name, value] of [['--orbit-cx', `${globeCenter.x}px`], ['--orbit-cy', `${globeCenter.y}px`], ['--orbit-r', `${orbitRadius(diameter)}px`], ['--orbit-spread-x', `${spread.x}px`], ['--orbit-spread-y', `${spread.y}px`]]) {
          nav.style.setProperty(name, value); document.documentElement.style.setProperty(name, value);
        }
      }
      if ((currentPhase === 'closed' || orbit) && ball.current) {
        // Raster the sphere at its full size and scale it with the same factor as the tiles, so both
        // shrink in lockstep and the per-frame raster cost does not change with the rest size.
        ball.current.style.transform = `translate3d(${globeCenter.x}px,${globeCenter.y}px,0) translate(-50%,-50%) scale(${sphereScale()})`;
        const spin = sphereSpinAngle(angle);
        if (spin !== rasterSpin || diameter !== rasterSize) {
          rasterSpin = spin; rasterSize = diameter;
          drawSoccerSphere(ball.current, diameter, spin);
        }
      }
      dragDirty = false;
      overlay.style.perspectiveOrigin = `${perspective.x}px ${perspective.y}px`;
      button.style.transform = `translate3d(${globeCenter.x}px,${globeCenter.y}px,0) translate(-50%,-50%) scale(${sphereScale()})`;
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
      if (orbit) ballScale = input.menuOpen ? ORBIT_SPHERE_SCALE : restScale();
      current = input.menuOpen ? targetRing() : globe(); elapsed = 0;
      perspective = input.menuOpen ? ringPerspective() : { ...globeCenter };
      publish(input.menuOpen ? 'open' : 'closed'); draw();
    };
    const frame = (time: number) => {
      raf = 0;
      const raw = previousTime === null ? 0 : time - previousTime, delta = Math.min(64, raw); previousTime = time;
      // Only the ring morph positions tiles from the stage box; the folded globe and drags use viewport coordinates.
      if (currentPhase === 'morphing') rect = element.getBoundingClientRect();
      if (pointer) {
        // Held or dragging: no spin, float or momentum. Grow to the hover size while pressed and
        // redraw once per frame instead of once per pointermove event.
        if (dragDirty) { perspective = { ...globeCenter }; current = orbit && input.menuOpen ? targetRing() : globe(); draw(); }
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
        perspective = { ...globeCenter }; current = orbit && input.menuOpen ? targetRing() : globe(); draw();
      }
      schedule();
    };

    actions.current = {
      start(pointerId, point, time) {
        if (currentPhase !== 'closed' || pointer) return false;
        stopFrame(); momentum = { x: 0, y: 0 }; suppressClick = false;
        rememberedCenter.current = globeCenter; perspective = { ...globeCenter };
        pointer = { id: pointerId, origin: point, center: globeCenter, lastCenter: globeCenter,
          lastTime: time, dragged: false, velocity: { x: 0, y: 0 } };
        setDragging(true); current = globe(); draw(); schedule(); return true;
      },
      move(pointerId, point, time) {
        if (!pointer || pointer.id !== pointerId) return;
        if (!pointer.dragged && !isGlobeDrag(pointer.origin, point)) return;
        globeCenter = clampGlobeCenter({ x: pointer.center.x + point.x - pointer.origin.x,
          y: pointer.center.y + point.y - pointer.origin.y }, viewport, diameter * restScale());
        const delta = Math.max(1, time - pointer.lastTime);
        const instant = { x: (globeCenter.x - pointer.lastCenter.x) / delta,
          y: (globeCenter.y - pointer.lastCenter.y) / delta };
        pointer.velocity = { x: pointer.velocity.x * .55 + instant.x * .45,
          y: pointer.velocity.y * .55 + instant.y * .45 };
        pointer.dragged ||= isGlobeDrag(pointer.origin, point);
        manuallyPlaced ||= pointer.dragged;
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
        suppressClick = wasDrag; pointer = null; setDragging(false); schedule();
      },
      cancel(pointerId) {
        if (!pointer || pointer.id !== pointerId) return;
        pointer = null; momentum = { x: 0, y: 0 }; suppressClick = false; setDragging(false); schedule();
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
      const bob = Number(new DOMMatrixReadOnly(getComputedStyle(floating).transform).m42) || 0;
      from = current.map(pose => ({ ...pose, y: pose.y + bob }));
      fromPerspective = { x: perspective.x, y: perspective.y + bob };
      input = next; elapsed = 0;
      if (orbit) {
        // Open: settle the globe at full size and slide it to where the ring fits; close: back to the corner.
        centerFrom = { x: globeCenter.x, y: globeCenter.y };
        ballScaleFrom = currentPhase === 'open' ? ORBIT_SPHERE_SCALE : restScale(); ballScale = ballScaleFrom;

        orbitCenter = orbitCenterFor({ x: viewport.width / 2, y: viewport.height / 2 });
        if (!next.menuOpen) manuallyPlaced = false;
        centerTo = next.menuOpen ? orbitCenter : cornerInstrumentCenter(viewport, 'right');
        rememberedCenter.current = next.menuOpen ? orbitCenter : null;
        measure();
        if (next.menuOpen) {
          globeCenter = { ...orbitCenter }; centerFrom = { ...orbitCenter }; centerTo = { ...orbitCenter };
          from = globe(); fromPerspective = { ...orbitCenter };
        } else globeCenter = centerFrom;
        cacheRing();
        if (reduced.matches) { globeCenter = centerTo; finish(); } else { publish('morphing'); draw(); schedule(); }
        return;
      }
      if (!next.menuOpen) { rememberedCenter.current = null; manuallyPlaced = false; }
      measure(); cacheRing();
      if (reduced.matches) finish(); else { publish('morphing'); draw(); schedule(); }
    };
    const resize = () => {
      const viewportChanged = viewport.width !== window.innerWidth || viewport.height !== window.innerHeight;
      if (viewportChanged) releaseActivePointer();
      measure();
      if (orbit && viewportChanged) {
        orbitCenter = orbitCenterFor({ x: viewport.width / 2, y: viewport.height / 2 });
        if (input.menuOpen) globeCenter = { ...orbitCenter };
        centerFrom = { ...globeCenter };
        centerTo = input.menuOpen ? orbitCenter : cornerInstrumentCenter(viewport, 'right');
        rememberedCenter.current = { ...globeCenter };
      }
      cacheRing();
      if (currentPhase === 'closed') {
        momentum = { x: 0, y: 0 }; perspective = { ...globeCenter }; current = orbit && input.menuOpen ? targetRing() : globe(); draw();
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
    const preference = () => {
      stopFrame(); momentum = { x: 0, y: 0 };
      if (reduced.matches) finish(); else schedule();
    };
    measure(); cacheRing(); current = input.menuOpen ? targetRing() : globe();
    perspective = input.menuOpen ? ringPerspective() : { ...globeCenter };
    draw(); overlay.dataset.phase = currentPhase; button.dataset.phase = currentPhase; setDragging(false);
    overlay.dataset.positioned='true';button.dataset.positioned='true';
    const observer = new ResizeObserver(resize); observer.observe(element);
    // Preview toggle mounts/unmounts the strip without a viewport resize: re-dock when the
    // published signal axis appears, disappears or moves. Own orb variables never re-enter
    // (the value guard skips them).
    let seenSignalAxis = document.documentElement.style.getPropertyValue('--hatchery-signal-cx');
    const axisWatch = new MutationObserver(() => {
      const value = document.documentElement.style.getPropertyValue('--hatchery-signal-cx');
      if (value === seenSignalAxis) return;
      seenSignalAxis = value;
      rememberedCenter.current = null;
      resize();
    });
    axisWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', resize); document.addEventListener('visibilitychange', visibility);
    reduced.addEventListener('change', preference); short.addEventListener('change', resize); schedule();
    return () => {
      stopFrame(); releaseActivePointer(); observer.disconnect(); axisWatch.disconnect(); update.current = null; actions.current = null;
      delete overlay.dataset.positioned;delete button.dataset.positioned;
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
