'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useDriftScroll } from './useDriftScroll';
import { getStreamCardLabel, isCardInteractiveTarget } from './jarvisCardFocusUtils';
import { useScreenObject } from './ScreenObjectContext';
import styles from './jarvisStream.module.css';
import { isLowPerformance } from './filmPerformanceMode';

const lastPose = new WeakMap<HTMLElement, number>();
let reducedMotion: MediaQueryList | undefined;
const prefersReducedMotion = () => (reducedMotion ??= window.matchMedia('(prefers-reduced-motion: reduce)')).matches;
const STREAM_CARD_IDS = {
  left: ['theme', 'scene', 'session', 'ai', 'voice', 'guide', 'help'],
  right: ['channels', 'production', 'process', 'queue', 'quality', 'energy', 'inspection', 'temperature'],
} as const;

/** A single accessible copy of the content drifts between its ends; reading always takes priority. */
export interface JarvisStreamFocusRequest { source: HTMLElement; label: string; side: 'left' | 'right'; index: number }

export function JarvisStream({ title, label, speed = 16, side = 'left', suspended = false, onFocusCard, children }: {
  title: string; label: string; speed?: number; side?: 'left' | 'right'; suspended?: boolean;
  onFocusCard?: (request: JarvisStreamFocusRequest) => void; children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  // Read layout without transforms, then write one shared holographic pose for every part of each panel.
  const pose = useCallback((now: number, el: HTMLElement) => {
    // Each pose writes four custom properties per panel, a style recalculation for the whole
    // column; a slow machine re-poses at a third of the cadence.
    if (document.hidden || now - (lastPose.get(el) ?? -100) < (isLowPerformance() ? 100 : 32)) return;
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
  const { hostRef, viewportRef, paused, stopped, setPaused } = useDriftScroll<HTMLElement>({ axis: 'y', speed, resumeMs: 800, suspended, onFrame: pose });
  const setAutoScroll = (enabled:boolean) => setPaused(!enabled);
  const decorateCards = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    Array.from(content.children).forEach((child, index) => {
      if (!(child instanceof HTMLElement) || child.tagName !== 'SECTION') return;
      child.dataset.streamCard = '';
      child.dataset.streamSide = side;
      child.dataset.streamCardId = STREAM_CARD_IDS[side][index] ?? String(index);
      child.tabIndex = 0;
      child.setAttribute('aria-label', getStreamCardLabel(child, title, index));
      child.setAttribute('aria-haspopup', 'dialog');
    });
  }, [side, title]);
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
  useScreenObject(() => ({
    id: `stream.${side}`,
    description: `${side === 'left' ? '좌측 설명·설정' : '우측 분석'} 카드 스트림`,
    getState: () => ({ autoScroll: !paused }),
    methods: {
      setAutoScroll: { description: '자동 스크롤을 켜거나 끕니다.', parameters:{enabled:{type:'boolean'}}, execute: args => {
        if (typeof args.enabled !== 'boolean') return { ok:false, message:'enabled 값이 필요합니다.' };
        setAutoScroll(args.enabled); return { ok:true, message:'자동 스크롤 상태를 변경했습니다.' };
      } },
      focusCard: { description: '카드 ID로 중앙 확대 보기를 엽니다.', parameters:{id:{type:'string'}}, execute: args => {
        const card = Array.from(contentRef.current?.children ?? []).find(node => node instanceof HTMLElement && node.dataset.streamCardId === args.id);
        if (!(card instanceof HTMLElement)) return { ok:false, message:'요청한 카드를 현재 스트림에서 찾지 못했습니다.' };
        activate(card); return { ok:true, message:'카드를 확대했습니다.' };
      } },
    },
  }), [side, title, paused, setPaused, onFocusCard]);
  return <aside ref={hostRef} className={styles.stream} aria-label={label} data-side={side} data-paused={stopped}>
    <header><span><i />{title}</span><button type="button" aria-label={`${label} 자동 스크롤 ${paused ? '재개' : '정지'}`}
      aria-pressed={paused} onClick={() => setAutoScroll(paused)}>{paused ? '재개 ▷' : '정지 Ⅱ'}</button></header>
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
