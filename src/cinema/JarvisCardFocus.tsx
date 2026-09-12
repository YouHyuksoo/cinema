'use client';

import { useCallback, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cloneStreamCard, readCardTheme } from './jarvisCardFocusUtils';
import streamStyles from './jarvisStream.module.css';
import styles from './jarvisCardFocus.module.css';

interface JarvisCardFocusProps {
  source: HTMLElement;
  label: string;
  openId: number;
  onClose(): void;
}

type Phase = 'opening' | 'open' | 'closing';
const BLOCKED_CLONE_EVENTS = ['click', 'pointerdown', 'keydown', 'input', 'change', 'toggle', 'submit'] as const;

export function JarvisCardFocus({ source, label, openId, onClose }: JarvisCardFocusProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cloneHostRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const phaseRef = useRef<Phase>('opening');
  const animationRef = useRef<Animation | null>(null);
  const closeRefCallback = useRef(onClose);
  closeRefCallback.current = onClose;

  const finishClose = useCallback(() => closeRefCallback.current(), []);
  const requestClose = useCallback((force = false) => {
    if (force) {
      animationRef.current?.cancel();
      finishClose();
      return;
    }
    if (phaseRef.current !== 'open') return;
    phaseRef.current = 'closing';
    const panel = panelRef.current;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sourceRect = source.isConnected ? source.getBoundingClientRect() : null;
    const panelRect = panel?.getBoundingClientRect();
    if (!panel || !panelRect || !sourceRect || !sourceRect.width || !sourceRect.height || reduced || typeof panel.animate !== 'function') {
      finishClose();
      return;
    }
    const dx = sourceRect.left + sourceRect.width / 2 - (panelRect.left + panelRect.width / 2);
    const dy = sourceRect.top + sourceRect.height / 2 - (panelRect.top + panelRect.height / 2);
    const sx = sourceRect.width / panelRect.width;
    const sy = sourceRect.height / panelRect.height;
    const animation = panel.animate([
      { transform:'translate(0,0) scale(1)', opacity:1 },
      { transform:`translate(${dx}px,${dy}px) scale(${sx},${sy})`, opacity:.25 },
    ], { duration:280, easing:'cubic-bezier(.2,.75,.2,1)', fill:'forwards' });
    animationRef.current = animation;
    void animation.finished.then(finishClose, finishClose);
  }, [finishClose, source]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const cloneHost = cloneHostRef.current;
    const closeButton = closeRef.current;
    const portalRoot = panel?.parentElement;
    if (!panel || !cloneHost || !closeButton || !portalRoot) return;

    const savedInert = new Map<HTMLElement, boolean>();
    for (const child of Array.from(document.body.children)) {
      if (!(child instanceof HTMLElement) || child === portalRoot) continue;
      savedInert.set(child, child.inert);
      child.inert = true;
    }
    const theme = readCardTheme(source);
    for (const [name, value] of Object.entries(theme)) panel.style.setProperty(name, value);
    const clone = cloneStreamCard(source, openId);
    cloneHost.append(clone);

    const blockCloneEvent = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
    for (const type of BLOCKED_CLONE_EVENTS) cloneHost.addEventListener(type, blockCloneEvent, true);

    const sourceRect = source.isConnected ? source.getBoundingClientRect() : null;
    const panelRect = panel.getBoundingClientRect();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (sourceRect?.width && sourceRect.height && panelRect.width && panelRect.height && !reduced && typeof panel.animate === 'function') {
      const dx = sourceRect.left + sourceRect.width / 2 - (panelRect.left + panelRect.width / 2);
      const dy = sourceRect.top + sourceRect.height / 2 - (panelRect.top + panelRect.height / 2);
      const animation = panel.animate([
        { transform:`translate(${dx}px,${dy}px) scale(${sourceRect.width / panelRect.width},${sourceRect.height / panelRect.height})`, opacity:.25 },
        { transform:'translate(0,0) scale(1)', opacity:1 },
      ], { duration:280, easing:'cubic-bezier(.2,.75,.2,1)' });
      animationRef.current = animation;
      void animation.finished.then(() => { if (phaseRef.current === 'opening') phaseRef.current = 'open'; }, () => undefined);
    } else phaseRef.current = 'open';
    closeButton.focus();

    const observer = new MutationObserver(() => { if (!source.isConnected) requestClose(true); });
    observer.observe(source.ownerDocument, { childList:true, subtree:true });
    return () => {
      observer.disconnect();
      animationRef.current?.cancel();
      for (const type of BLOCKED_CLONE_EVENTS) cloneHost.removeEventListener(type, blockCloneEvent, true);
      clone.remove();
      for (const [element, inert] of savedInert) element.inert = inert;
      if (source.isConnected && source.getClientRects().length) source.focus({ preventScroll:true });
    };
  }, [openId, requestClose, source]);

  const onDialogKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); requestClose(); return; }
    if (event.key === 'Tab') { event.preventDefault(); closeRef.current?.focus(); }
  };
  return createPortal(
    <div className={styles.backdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) requestClose(); }}>
      <div ref={panelRef} className={styles.panel} role="dialog" aria-modal="true" aria-label={`${label} 확대 보기`} onKeyDown={onDialogKeyDown}>
        <div className={styles.topbar}><span className={styles.title}>{label}</span><button ref={closeRef} className={styles.close} type="button" aria-label="확대 보기 닫기" onClick={() => requestClose()}>×</button></div>
        <div className={styles.scroll}><div ref={cloneHostRef} className={`${streamStyles.content} ${styles.cloneContent}`} /></div>
      </div>
    </div>,
    document.body,
  );
}
