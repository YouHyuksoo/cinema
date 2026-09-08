'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { dragRingTurn, nearestRingTurn, ringIndex } from './filmMenuRing';

export function useFilmMenuRing(active: number, count: number, disabled: boolean) {
  const stage = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [position, setPosition] = useState({ active, turn: Math.max(0, active) });
  const [dragging, setDragging] = useState(false);
  const pointer = useRef<{ id: number; x: number; start: number; latest: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  if (position.active !== active) {
    const browsing = ringIndex(position.turn, count) !== position.active;
    setPosition({ active, turn: active < 0 || browsing ? position.turn : nearestRingTurn(position.turn, active, count) });
  }
  const turn = position.turn;
  const setTurn = (value: number) => setPosition(current => ({ ...current, turn: value }));
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => { if (entry.contentRect.width > 0) setWidth(entry.contentRect.width); });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const align = (index: number) => { if (!disabled) setTurn(nearestRingTurn(turn, index, count)); };
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    const current = pointer.current;
    if (!current || current.id !== event.pointerId) return;
    suppressClick.current = current.moved;
    setTurn(Math.round(current.latest));
    pointer.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return { stage, turn, width, dragging, front: ringIndex(turn, count), align,
    pointerActive: () => pointer.current !== null,
    blockClick: () => suppressClick.current,
    events: {
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        if (disabled || !event.isPrimary || event.button !== 0 || pointer.current) return;
        suppressClick.current = false;
        pointer.current = { id: event.pointerId, x: event.clientX, start: turn, latest: turn, moved: false };
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        const current = pointer.current;
        if (!current || current.id !== event.pointerId) return;
        const delta = event.clientX - current.x;
        if (!current.moved && Math.abs(delta) < 7) return;
        current.moved = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        current.latest = dragRingTurn(current.start, delta, width, count);
        setDragging(true);
        setTurn(current.latest);
      },
      onPointerUp: finish,
      onPointerCancel: finish,
      onLostPointerCapture: finish,
    },
  };
}
