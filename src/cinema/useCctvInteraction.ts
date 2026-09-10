'use client';

import { useCallback, useRef, useState } from 'react';
import {
  CCTV_CAMERA_COUNT, cctvCentred, createCctvInteraction, selectCctv, settleCctv, stepCctv, turnCctv, type CctvInteraction,
} from './cctvScene';

/**
 * Manual CCTV browsing. Heading updates go straight to the render loop through `readState`; React only
 * publishes whether manual mode is on and which camera is centred. Taking control pauses the patrol
 * clock (the feeds keep animating on the live clock the render loop supplies).
 */
export function useCctvInteraction(getTime: () => number, pause: () => void) {
  const stateRef = useRef<CctvInteraction | null>(null);
  const readState = useCallback(() => stateRef.current, []);
  const [status, setStatus] = useState({ manual: false, camera: null as number | null });
  const commit = (value: CctvInteraction | null) => {
    stateRef.current = value;
    const next = { manual: value !== null, camera: value ? cctvCentred(value.turn).camera : null };
    setStatus(previous => previous.manual === next.manual && previous.camera === next.camera ? previous : next);
  };
  const begin = () => {
    if (!stateRef.current) { pause(); commit(createCctvInteraction(getTime())); }
    return stateRef.current!;
  };
  return {
    ...status, readState, begin, count: CCTV_CAMERA_COUNT,
    clear() { commit(null); },
    turn(dx: number) { commit(turnCctv(begin(), dx)); },
    settle() { if (stateRef.current) commit(settleCctv(stateRef.current)); },
    select(index: number) { commit(selectCctv(begin(), index)); },
    step(direction: 1 | -1) { commit(stepCctv(begin(), direction)); },
  };
}

export type CctvInteractionController = ReturnType<typeof useCctvInteraction>;
