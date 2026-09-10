'use client';

import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { filmViewportPoint } from './filmViewport';
import { CCTV_CAMERAS, cctvCentred, cctvPick } from './cctvScene';
import type { CctvInteractionController } from './useCctvInteraction';
import styles from './smtInteraction.module.css';
import { pad2 } from './filmMath';

interface Props {
  canvas: RefObject<HTMLCanvasElement | null>;
  controller: CctvInteractionController;
  onAuto: () => void;
}

/** Use the canvas's exact viewport inverse, so CSS sizing and DPR cannot offset picking. */
function pointerPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  const ratioX = canvas.width / Math.max(1, rect.width), ratioY = canvas.height / Math.max(1, rect.height);
  const dock = Number.parseFloat(getComputedStyle(canvas).getPropertyValue('--film-content-inset')) || 0;
  return filmViewportPoint((clientX - rect.left) * ratioX, (clientY - rect.top) * ratioY,
    canvas.width, canvas.height, { bottomInset: dock * ratioY });
}

/** Drag or wheel to turn the camera wall, click a feed to centre it, arrows to step; a toolbar lists the cameras. */
export function CctvExplorer({ canvas, controller, onAuto }: Props) {
  const surface = useRef<HTMLDivElement>(null);
  const latest = useRef(controller);
  useEffect(() => { latest.current = controller; }, [controller]);
  const gesture = useRef<{ id: number; startX: number; lastX: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const node = surface.current;
    if (!node) return;
    let settle = 0;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientWidth : 1;
      const delta = (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) * unit;
      latest.current.turn(-delta * .6);
      window.clearTimeout(settle); settle = window.setTimeout(() => latest.current.settle(), 160);
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => { node.removeEventListener('wheel', wheel); window.clearTimeout(settle); };
  }, []);

  const cancel = () => { gesture.current = null; setDragging(false); };
  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return;
    if (!active.moved && canvas.current) {
      const state = controller.readState();
      const point = pointerPoint(canvas.current, event.clientX, event.clientY);
      const hit = state ? cctvPick(point, state.turn, () => 0) : null;
      if (hit !== null) controller.select(hit);
    } else controller.settle();
    cancel();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const centred = controller.camera;

  return <>
    <div ref={surface} className={`${styles.surface} ${dragging ? styles.dragging : ''}`}
      role="group" tabIndex={0} aria-label="CCTV 카메라 벽 탐색 영역" aria-describedby="cctv-explore-help"
      onContextMenu={event => event.preventDefault()}
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0 || gesture.current) return;
        event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
        controller.begin();
        gesture.current = { id: event.pointerId, startX: event.clientX, lastX: event.clientX, moved: false };
        event.currentTarget.setPointerCapture(event.pointerId); setDragging(true);
      }}
      onPointerMove={event => {
        const active = gesture.current, node = canvas.current;
        if (!active || active.id !== event.pointerId || !node) return;
        if (!active.moved && Math.abs(event.clientX - active.startX) < 6) return;
        active.moved = true;
        const previous = pointerPoint(node, active.lastX, 0), next = pointerPoint(node, event.clientX, 0);
        controller.turn(next.x - previous.x);
        active.lastX = event.clientX;
      }}
      onPointerUp={pointerUp} onPointerCancel={cancel} onLostPointerCapture={cancel}
      onKeyDown={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); controller.step(event.key === 'ArrowLeft' ? -1 : 1); }
        else if (event.key === 'Home') { event.preventDefault(); controller.select(0); }
        else if (event.key === 'End') { event.preventDefault(); controller.select(CCTV_CAMERAS.length - 1); }
        else if (/^[1-9]$/.test(event.key)) { event.preventDefault(); controller.select(Number(event.key) - 1); }
      }} />
    <section className={styles.toolbar} aria-label="CCTV 카메라 선택" data-cctv-toolbar="true">
      <div className={styles.heading}>
        <span className={styles.status}><span className={styles.statusLight} />{controller.manual ? '직접 감시 중' : '자동 순찰 중'}</span>
        <span className={styles.lineCount}>{CCTV_CAMERAS.length} CAMS</span>
      </div>
      <div className={styles.actions}>
        {controller.manual
          ? <button type="button" className={styles.button} onClick={onAuto}>자동 순찰</button>
          : <button type="button" className={styles.button} onClick={() => controller.begin()}>직접 감시</button>}
        <button type="button" className={styles.button} aria-label="이전 카메라" onClick={() => controller.step(-1)}>‹</button>
        <button type="button" className={styles.button} aria-label="다음 카메라" onClick={() => controller.step(1)}>›</button>
      </div>
      <select className={styles.select} aria-label="카메라 선택" value={centred ?? ''} onChange={event => { if (event.target.value !== '') controller.select(Number(event.target.value)); }}>
        <option value="" disabled>카메라 선택</option>
        {CCTV_CAMERAS.map((camera, index) => <option key={camera.id} value={index}>{pad2(index + 1)} · {camera.zone} · {camera.code}</option>)}
      </select>
      {centred !== null && <p className={styles.selection}>
        <span className={styles.selectionName}>{CCTV_CAMERAS[centred].id} · {CCTV_CAMERAS[centred].zone}</span>
        <span className={styles.selectionDetail}>{CCTV_CAMERAS[centred].note}</span>
      </p>}
      <p id="cctv-explore-help" className={styles.hint}>좌우로 밀거나 휠로 카메라 벽을 돌리고, 영상을 클릭하면 그 카메라가 가운데로 옵니다. 방향키·숫자 1~9로 선택할 수 있습니다.</p>
    </section>
  </>;
}

/** Exposed for tests: the camera the toolbar considers centred for a heading. */
export const cctvCentredCamera = (turn: number) => cctvCentred(turn).camera;
