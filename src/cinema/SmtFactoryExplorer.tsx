'use client';

import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { filmViewportPoint } from './filmViewport';
import { SmtFactoryControls } from './SmtFactoryControls';
import type { SmtFactoryInteractionController } from './useSmtFactoryInteraction';
import styles from './smtInteraction.module.css';

interface Props {
  canvas: RefObject<HTMLCanvasElement | null>;
  controller: SmtFactoryInteractionController;
  onAuto: () => void;
}

/** Use the canvas's exact viewport inverse, so CSS sizing and DPR cannot offset selection. */
function pointerPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  const ratioX = canvas.width / Math.max(1, rect.width), ratioY = canvas.height / Math.max(1, rect.height);
  const dock = Number.parseFloat(getComputedStyle(canvas).getPropertyValue('--film-dock-space')) || 0;
  return filmViewportPoint((clientX - rect.left) * ratioX, (clientY - rect.top) * ratioY,
    canvas.width, canvas.height, { bottomInset: dock * ratioY });
}

export function SmtFactoryExplorer({ canvas, controller, onAuto }: Props) {
  const surface = useRef<HTMLDivElement>(null);
  const latest = useRef(controller);
  useEffect(() => { latest.current = controller; }, [controller]);
  const gesture = useRef<{
    id: number; startX: number; startY: number; lastX: number; lastY: number; moved: boolean; pan: boolean;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const node = surface.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientHeight : 1;
      latest.current.zoom(event.deltaY * unit);
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, []);

  const cancel = () => { gesture.current = null; setDragging(false); };
  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return;
    if (!active.moved && !active.pan && canvas.current) {
      controller.pick(pointerPoint(canvas.current, event.clientX, event.clientY));
    }
    cancel();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return <>
    <div ref={surface} className={`${styles.surface} ${dragging ? styles.dragging : ''}`}
      role="group" tabIndex={0} aria-label="3D 설비 탐색 영역" aria-describedby="smt-explore-help"
      onContextMenu={event => event.preventDefault()}
      onPointerDown={event => {
        if (!event.isPrimary || (event.button !== 0 && event.button !== 2) || gesture.current) return;
        event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
        controller.begin();
        gesture.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY,
          lastX: event.clientX, lastY: event.clientY, moved: false, pan: event.button === 2 || event.shiftKey };
        event.currentTarget.setPointerCapture(event.pointerId); setDragging(true);
      }}
      onPointerMove={event => {
        const active = gesture.current, node = canvas.current;
        if (!active || active.id !== event.pointerId || !node) return;
        if (!active.moved && Math.hypot(event.clientX - active.startX, event.clientY - active.startY) < 6) return;
        active.moved = true;
        const previous = pointerPoint(node, active.lastX, active.lastY);
        const next = pointerPoint(node, event.clientX, event.clientY);
        (active.pan ? controller.pan : controller.rotate)(next.x - previous.x, next.y - previous.y);
        active.lastX = event.clientX; active.lastY = event.clientY;
      }}
      onPointerUp={pointerUp} onPointerCancel={cancel} onLostPointerCapture={cancel}
      onKeyDown={event => {
        const offsets: Record<string, [number, number]> = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] };
        if (offsets[event.key]) {
          event.preventDefault(); (event.shiftKey ? controller.pan : controller.rotate)(...offsets[event.key]);
        } else if (event.key === '+' || event.key === '=' || event.key === '-') {
          event.preventDefault(); controller.zoom(event.key === '-' ? 120 : -120);
        } else if (event.key === 'Home') { event.preventDefault(); controller.reset(); }
        else if (event.key === 'Escape') { event.preventDefault(); controller.deselect(); }
        else if (event.key.toLowerCase() === 'f') { event.preventDefault(); controller.focus(); }
      }} />
    <SmtFactoryControls manual={controller.manual} selectedKey={controller.selectedKey}
      onExplore={controller.begin} onAuto={onAuto} onReset={controller.reset} onSelect={controller.select}
      onFocus={controller.focus} onZoom={controller.zoom} />
  </>;
}
