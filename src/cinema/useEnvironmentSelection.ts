'use client';

import { useCallback, useRef, useState } from 'react';
import { createEnvironmentSelection } from './environmentSelection';
import type { EnvironmentPoint } from './environmentLayout';
import type { ZoneEnvironmentData } from './zoneEnvironment';

export function useEnvironmentSelection() {
  const [session] = useState(createEnvironmentSelection);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const publishedId = useRef<string | null>(null);
  const publish = useCallback(() => {
    if (publishedId.current === session.selectedId) return;
    publishedId.current = session.selectedId;
    setSelectedId(session.selectedId);
  }, [session]);
  const update = useCallback((time: number | null, data?: ZoneEnvironmentData) => {
    const frame = session.update(time, data); publish(); return frame;
  }, [session, publish]);
  const clear = useCallback(() => { session.clear(); publish(); }, [session, publish]);
  return {
    selectedId, update, clear,
    pick(point: EnvironmentPoint | null) { session.pick(point); publish(); },
    step(direction: number) { session.step(direction); publish(); },
  };
}

export type EnvironmentSelectionController = ReturnType<typeof useEnvironmentSelection>;
