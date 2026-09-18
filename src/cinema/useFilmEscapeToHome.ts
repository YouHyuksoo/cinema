'use client';

import { useEffect, useRef } from 'react';

export function handleFilmEscape(event: Pick<KeyboardEvent, 'key' | 'repeat' | 'preventDefault'>, stopAndHome: () => void) {
  if (event.key !== 'Escape' || event.repeat) return false;
  event.preventDefault();
  stopAndHome();
  return true;
}

/** Global capture shortcut: scene-local Escape cleanup still receives the event afterwards. */
export function useFilmEscapeToHome(stopAndHome: () => void) {
  const latest = useRef(stopAndHome);
  latest.current = stopAndHome;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { handleFilmEscape(event, latest.current); };
    window.addEventListener('keydown', onKeyDown, { capture:true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture:true });
  }, []);
}
