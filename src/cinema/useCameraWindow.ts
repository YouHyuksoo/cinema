import { useEffect, useRef, useState, type PointerEvent } from 'react';

type Bounds = { left: number; top: number; width: number; height: number };
function fit(bounds: Bounds): Bounds {
  const width = Math.min(Math.max(260, bounds.width), window.innerWidth - 16);
  const height = Math.min(Math.max(260, bounds.height), window.innerHeight - 16);
  return { width, height, left: Math.max(8, Math.min(bounds.left, window.innerWidth - width - 8)),
    top: Math.max(8, Math.min(bounds.top, window.innerHeight - height - 8)) };
}

/** Kept by the launcher so closing and reopening preserves the chosen placement. */
export function useCameraWindow() {
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const gesture = useRef<{ x: number; y: number; bounds: Bounds; resize: boolean } | null>(null);
  useEffect(() => {
    const adjust = () => setBounds(previous => fit(previous ?? {
      left: (window.innerWidth - 480) / 2, top: (window.innerHeight - 460) / 2, width: 480, height: 460,
    }));
    adjust();
    window.addEventListener('resize', adjust);
    return () => window.removeEventListener('resize', adjust);
  }, []);
  const start = (event: PointerEvent<HTMLElement>, resize: boolean) => {
    if (!bounds || event.button !== 0) return;
    if (!resize && (event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { x: event.clientX, y: event.clientY, bounds, resize };
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    const drag = gesture.current;
    if (!drag) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    setBounds(fit(drag.resize ? { ...drag.bounds,
      width: Math.min(drag.bounds.width + dx, window.innerWidth - drag.bounds.left - 8),
      height: Math.min(drag.bounds.height + dy, window.innerHeight - drag.bounds.top - 8),
    } : { ...drag.bounds, left: drag.bounds.left + dx, top: drag.bounds.top + dy }));
  };
  const end = () => { gesture.current = null; };
  return { bounds, start, move, end,
    nudge(dx: number, dy: number, resize = false) {
      setBounds(previous => previous && fit(resize ? { ...previous, width: previous.width + dx, height: previous.height + dy }
        : { ...previous, left: previous.left + dx, top: previous.top + dy }));
    },
  };
}
