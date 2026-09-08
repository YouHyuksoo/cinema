'use client';

import { useEffect, useRef, useState } from 'react';

/** A single DOM copy, reversible horizontal feed; manual reading takes priority. */
export function useMetricStripScroll() {
  const stripRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const strip = stripRef.current, viewport = viewportRef.current;
    if (!strip || !viewport) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let hovered = strip.matches(':hover'), focused = strip.contains(document.activeElement);
    let manualUntil = 0, holdUntil = performance.now() + 1500, frame = 0, last = 0;
    let position = viewport.scrollLeft, direction = 1;
    const enter = () => { hovered = true; };
    const leave = () => { hovered = false; };
    const focus = () => { focused = true; };
    const blur = (event: FocusEvent) => { if (!strip.contains(event.relatedTarget as Node | null)) focused = false; };
    const manual = () => { manualUntil = performance.now() + 4000; };
    const tick = (now: number) => {
      const delta = last ? Math.min((now - last) / 1000, .05) : 0;
      last = now;
      const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      if (paused || hovered || focused || reduced.matches || document.hidden || now < manualUntil || !max) {
        position = viewport.scrollLeft; holdUntil = now + 1000;
      } else if (now >= holdUntil) {
        position = Math.max(0, Math.min(max, position + direction * delta * 20));
        viewport.scrollLeft = position;
        if (position === 0 || position === max) { direction *= -1; holdUntil = now + 1800; }
      }
      frame = requestAnimationFrame(tick);
    };
    strip.addEventListener('mouseenter', enter);
    strip.addEventListener('mouseleave', leave);
    strip.addEventListener('focusin', focus);
    strip.addEventListener('focusout', blur);
    for (const type of ['wheel', 'touchstart', 'touchmove', 'keydown']) viewport.addEventListener(type, manual, { passive: true });
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      strip.removeEventListener('mouseenter', enter);
      strip.removeEventListener('mouseleave', leave);
      strip.removeEventListener('focusin', focus);
      strip.removeEventListener('focusout', blur);
      for (const type of ['wheel', 'touchstart', 'touchmove', 'keydown']) viewport.removeEventListener(type, manual);
    };
  }, [paused]);
  return { stripRef, viewportRef, paused, toggle: () => setPaused(value => !value) };
}
