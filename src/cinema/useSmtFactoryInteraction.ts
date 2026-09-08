'use client';

import { useCallback, useRef, useState } from 'react';
import { SMT_FACTORY_STATIONS } from './smtFactory';
import {
  createFactoryInteraction, focusFactoryStation, interactionCamera, orbitFactory,
  panFactory, pickFactoryStation, zoomFactory, type FactoryInteraction,
} from './smtFactoryInteraction';

/** Camera updates go straight to the render loop; React publishes mode and selection only. */
export function useSmtFactoryInteraction(getTime: () => number, pause: () => void) {
  const stateRef = useRef<FactoryInteraction | null>(null);
  const readState = useCallback(() => stateRef.current, []);
  const [status, setStatus] = useState({ manual: false, selectedKey: null as string | null });
  const commit = (value: FactoryInteraction | null) => {
    stateRef.current = value;
    const next = { manual: value !== null, selectedKey: value?.selectedKey ?? null };
    setStatus(previous => previous.manual === next.manual && previous.selectedKey === next.selectedKey ? previous : next);
  };
  const begin = () => {
    if (!stateRef.current) { pause(); commit(createFactoryInteraction(getTime())); }
    return stateRef.current!;
  };
  return {
    ...status, readState, begin,
    clear() { commit(null); },
    reset() { pause(); commit(createFactoryInteraction(1.5)); },
    rotate(dx: number, dy: number) {
      const state = begin(); commit({ ...state, orbit: orbitFactory(state.orbit, dx, dy) });
    },
    pan(dx: number, dy: number) {
      const state = begin(); commit({ ...state, orbit: panFactory(state.orbit, dx, dy) });
    },
    zoom(delta: number) {
      const state = begin(); commit({ ...state, orbit: zoomFactory(state.orbit, delta) });
    },
    pick(point: { x: number; y: number }) {
      const state = begin();
      const station = pickFactoryStation(point, interactionCamera(state.orbit));
      commit({ ...state, selectedKey: station?.key ?? null });
    },
    select(key: string) {
      if (!SMT_FACTORY_STATIONS.some(station => station.key === key)) return;
      commit({ ...begin(), selectedKey: key });
    },
    deselect() { if (stateRef.current) commit({ ...stateRef.current, selectedKey: null }); },
    focus() {
      const state = stateRef.current;
      const station = SMT_FACTORY_STATIONS.find(item => item.key === state?.selectedKey);
      if (state && station) commit({ ...state, orbit: focusFactoryStation(station, state.orbit) });
    },
  };
}

export type SmtFactoryInteractionController = ReturnType<typeof useSmtFactoryInteraction>;
