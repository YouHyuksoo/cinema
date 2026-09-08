'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './jarvisStream.module.css';

/** A single accessible copy of the content drifts between its ends; reading always takes priority. */
export function JarvisStream({ title, label, speed = 16, side = 'left', children }: {
  title: string; label: string; speed?: number; side?: 'left' | 'right'; children: ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const interacting = useRef({ pointer: false, focus: false, until: 0 });
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const panels = Array.from(el.firstElementChild?.children ?? []) as HTMLElement[];
    let frame = 0, last = 0, direction = 1, position = el.scrollTop, hold = 0, lastPose = -100;
    const tick = (now: number) => {
      const delta = last ? Math.min((now - last) / 1000, .05) : 0;
      last = now;
      const stopped = paused || reduced.matches || document.hidden || interacting.current.pointer
        || interacting.current.focus || now < interacting.current.until;
      const max = Math.max(0, el.scrollHeight - el.clientHeight);
      if (stopped || !max) { position = el.scrollTop; hold = now + 800; }
      else if (now >= hold) {
        position = Math.max(0, Math.min(max, position + direction * delta * speed));
        el.scrollTop = position;
        if (position >= max || position <= 0) { direction *= -1; hold = now + 1800; }
      }
      if (!document.hidden && now - lastPose > 32) {
        lastPose = now;
        // Read layout without transforms, then write one shared pose for every part of each panel.
        const poses = panels.map(panel => {
          const distance = (panel.offsetTop + panel.offsetHeight / 2 - el.scrollTop - el.clientHeight * .48) / Math.max(1, el.clientHeight * .7);
          const focus = Math.max(0, 1 - Math.abs(distance));
          return { panel, distance: Math.max(-1, Math.min(1, distance)), focus };
        });
        for (const { panel, distance, focus } of poses) {
          panel.style.setProperty('--holo-depth', `${reduced.matches ? 0 : -80 + focus * 105}px`);
          panel.style.setProperty('--holo-yaw', `${reduced.matches ? 0 : (side === 'left' ? 1 : -1) * (18 - focus * 12)}deg`);
          panel.style.setProperty('--holo-pitch', `${reduced.matches ? 0 : distance * 7}deg`);
          panel.style.setProperty('--holo-light', `${.5 + focus * .5}`);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused, speed, side]);
  const settle = () => { interacting.current.until = performance.now() + 4000; };
  return <aside className={styles.stream} aria-label={label} data-side={side} data-paused={paused}
    onPointerEnter={() => { interacting.current.pointer = true; }}
    onPointerLeave={() => { interacting.current.pointer = false; }}
    onFocusCapture={() => { interacting.current.focus = true; }}
    onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) interacting.current.focus = false; }}>
    <header><span><i />{title}</span><button type="button" aria-label={`${label} 자동 스크롤 ${paused ? '재개' : '정지'}`}
      aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? '재개 ▷' : '정지 Ⅱ'}</button></header>
    <div ref={viewport} className={styles.viewport} tabIndex={0} role="region" aria-label={`${label} 목록`}
      onWheel={settle} onTouchStart={settle} onTouchMove={settle} onTouchEnd={settle} onKeyDown={settle}>
      <div className={styles.content}>{children}</div>
    </div>
    <footer>HOLOGRAPHIC FEED / DEMO <span>마우스를 올리면 멈춤 · 직접 스크롤</span></footer>
  </aside>;
}
