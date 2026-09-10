'use client';

import { useEffect, useRef, useState } from 'react';
import { createFrameLoop, watchReducedMotion } from './filmMotion';

export interface DriftScrollOptions {
  /** Scroll axis of the viewport element. */
  axis: 'x' | 'y';
  /** Drift speed in CSS pixels per second. */
  speed: number;
  /** Rest at either end before reversing direction (ms). */
  holdMs?: number;
  /** Rest after a hover, focus, manual scroll or pause ends before drifting again (ms). */
  resumeMs?: number;
  /** Rest before the very first drift (ms). */
  initialHoldMs?: number;
  /** Manual wheel/touch/keyboard input suppresses drifting for this long (ms). */
  manualMs?: number;
  /** Runs every animation frame, before the scroll write, e.g. to pose panels by scroll position. */
  onFrame?: (now: number, viewport: HTMLElement) => void;
}

/**
 * Reversible auto-scroll for a feed the operator can still read and scroll by hand. A single DOM
 * copy of the content drifts between its ends; hovering, focusing, manual scrolling, the pause
 * toggle, a hidden tab or a reduced-motion preference all stop it, and reading always wins.
 *
 * Attach `hostRef` to the element whose hover/focus should pause drifting (defaults to the
 * viewport) and `viewportRef` to the scrolling element.
 */
export function useDriftScroll<Host extends HTMLElement = HTMLDivElement, Viewport extends HTMLElement = HTMLDivElement>(
  { axis, speed, holdMs = 1800, resumeMs = 800, initialHoldMs = 0, manualMs = 4000, onFrame }: DriftScrollOptions) {
  const hostRef = useRef<Host>(null);
  const viewportRef = useRef<Viewport>(null);
  const [paused, setPaused] = useState(false);
  const frameCallback = useRef(onFrame);
  useEffect(() => { frameCallback.current = onFrame; }, [onFrame]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const host: HTMLElement | null = hostRef.current ?? viewport;
    if (!viewport || !host) return;
    const reduced = watchReducedMotion();
    const scrollKey = axis === 'x' ? 'scrollLeft' : 'scrollTop';
    const extent = () => axis === 'x' ? viewport.scrollWidth - viewport.clientWidth : viewport.scrollHeight - viewport.clientHeight;
    let hovered = host.matches(':hover'), focused = host.contains(document.activeElement);
    let manualUntil = 0, holdUntil = performance.now() + initialHoldMs, last = 0;
    let position = viewport[scrollKey], direction = 1;
    const enter = () => { hovered = true; };
    const leave = () => { hovered = false; };
    const focus = () => { focused = true; };
    const blur = (event: FocusEvent) => { if (!host.contains(event.relatedTarget as Node | null)) focused = false; };
    const manual = () => { manualUntil = performance.now() + manualMs; };
    const tick = (now: number) => {
      const delta = last ? Math.min((now - last) / 1000, .05) : 0;
      last = now;
      frameCallback.current?.(now, viewport);
      const max = Math.max(0, extent());
      const stopped = paused || hovered || focused || reduced.reduced || document.hidden || now < manualUntil;
      if (stopped || !max) { position = viewport[scrollKey]; holdUntil = now + resumeMs; }
      else if (now >= holdUntil) {
        position = Math.max(0, Math.min(max, position + direction * delta * speed));
        viewport[scrollKey] = position;
        if (position >= max || position <= 0) { direction *= -1; holdUntil = now + holdMs; }
      }
    };
    const loop = createFrameLoop(tick);
    host.addEventListener('pointerenter', enter);
    host.addEventListener('pointerleave', leave);
    host.addEventListener('focusin', focus);
    host.addEventListener('focusout', blur);
    const manualEvents = ['wheel', 'touchstart', 'touchmove', 'touchend', 'keydown'] as const;
    for (const type of manualEvents) viewport.addEventListener(type, manual, { passive: true });
    loop.start();
    return () => {
      loop.stop(); reduced.stop();
      host.removeEventListener('pointerenter', enter);
      host.removeEventListener('pointerleave', leave);
      host.removeEventListener('focusin', focus);
      host.removeEventListener('focusout', blur);
      for (const type of manualEvents) viewport.removeEventListener(type, manual);
    };
  }, [axis, speed, paused, holdMs, resumeMs, initialHoldMs, manualMs]);

  return { hostRef, viewportRef, paused, toggle: () => setPaused(value => !value) };
}
