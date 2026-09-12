'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useDriftScroll } from './useDriftScroll';
import { getStreamCardLabel, isCardInteractiveTarget } from './jarvisCardFocusUtils';
import styles from './jarvisStream.module.css';

const lastPose = new WeakMap<HTMLElement, number>();
let reducedMotion: MediaQueryList | undefined;
const prefersReducedMotion = () => (reducedMotion ??= window.matchMedia('(prefers-reduced-motion: reduce)')).matches;

/** A single accessible copy of the content drifts between its ends; reading always takes priority. */
export interface JarvisStreamFocusRequest { source: HTMLElement; label: string; side: 'left' | 'right'; index: number }

export function JarvisStream({ title, label, speed = 16, side = 'left', suspended = false, onFocusCard, children }: {
  title: string; label: string; speed?: number; side?: 'left' | 'right'; suspended?: boolean;
  onFocusCard?: (request: JarvisStreamFocusRequest) => void; children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  // Read layout without transforms, then write one shared holographic pose for every part of each panel.
  const pose = useCallback((now: number, el: HTMLElement) => {
    if (document.hidden || now - (lastPose.get(el) ?? -100) < 32) return;
    lastPose.set(el, now);
    const reduced = prefersReducedMotion();
    const panels = Array.from(el.firstElementChild?.children ?? []) as HTMLElement[];
    const poses = panels.map(panel => {
      const distance = (panel.offsetTop + panel.offsetHeight / 2 - el.scrollTop - el.clientHeight * .48) / Math.max(1, el.clientHeight * .7);
      const focus = Math.max(0, 1 - Math.abs(distance));
      return { panel, distance: Math.max(-1, Math.min(1, distance)), focus };
    });
    for (const { panel, distance, focus } of poses) {
      panel.style.setProperty('--holo-depth', `${reduced ? 0 : -80 + focus * 105}px`);
      panel.style.setProperty('--holo-yaw', `${reduced ? 0 : (side === 'left' ? 1 : -1) * (18 - focus * 12)}deg`);
      panel.style.setProperty('--holo-pitch', `${reduced ? 0 : distance * 7}deg`);
      panel.style.setProperty('--holo-light', `${.5 + focus * .5}`);
    }
  }, [side]);
  const { hostRef, viewportRef, paused, stopped, toggle } = useDriftScroll<HTMLElement>({ axis: 'y', speed, resumeMs: 800, suspended, onFrame: pose });
  const decorateCards = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    Array.from(content.children).forEach((child, index) => {
      if (!(child instanceof HTMLElement) || child.tagName !== 'SECTION') return;
      child.dataset.streamCard = '';
      child.tabIndex = 0;
      child.setAttribute('aria-label', getStreamCardLabel(child, title, index));
      child.setAttribute('aria-haspopup', 'dialog');
    });
  }, [title]);
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    decorateCards();
    const observer = new MutationObserver(decorateCards);
    observer.observe(content, { childList:true });
    return () => observer.disconnect();
  }, [decorateCards]);
  const resolveCard = (target: EventTarget | null) => {
    const content = contentRef.current;
    const card = target instanceof Element ? target.closest<HTMLElement>('section[data-stream-card]') : null;
    return card?.parentElement === content ? card : null;
  };
  const activate = (card: HTMLElement) => {
    const content = contentRef.current;
    const index = content ? Array.from(content.children).indexOf(card) : -1;
    if (index >= 0) onFocusCard?.({ source:card, label:getStreamCardLabel(card, title, index), side, index });
  };
  return <aside ref={hostRef} className={styles.stream} aria-label={label} data-side={side} data-paused={stopped}>
    <header><span><i />{title}</span><button type="button" aria-label={`${label} 자동 스크롤 ${paused ? '재개' : '정지'}`}
      aria-pressed={paused} onClick={toggle}>{paused ? '재개 ▷' : '정지 Ⅱ'}</button></header>
    <div ref={viewportRef} className={styles.viewport} tabIndex={0} role="region" aria-label={`${label} 목록`}>
      <div ref={contentRef} className={styles.content}
        onClick={event => { const card = resolveCard(event.target); if (card && !isCardInteractiveTarget(event.target, card)) activate(card); }}
        onKeyDown={event => { const card = resolveCard(event.target); if (!card || event.target !== card || (event.key !== 'Enter' && event.key !== ' ')) return; event.preventDefault(); activate(card); }}>
        {children}
      </div>
    </div>
    <footer>HOLOGRAPHIC FEED / DEMO <span>마우스를 올리면 멈춤 · 직접 스크롤</span></footer>
  </aside>;
}
