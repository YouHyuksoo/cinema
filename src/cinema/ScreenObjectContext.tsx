'use client';

import { createContext, useContext, useEffect, type DependencyList } from 'react';
import type { ScreenObjectRegistration, ScreenObjectRegistry } from './screenObjectRegistry';

const ScreenObjectContext = createContext<ScreenObjectRegistry | null>(null);

export function ScreenObjectProvider({ registry, children }: { registry: ScreenObjectRegistry; children: React.ReactNode }) {
  return <ScreenObjectContext.Provider value={registry}>{children}</ScreenObjectContext.Provider>;
}

export function useScreenObjectRegistry() {
  return useContext(ScreenObjectContext);
}

export function useScreenObject(factory: () => ScreenObjectRegistration, dependencies: DependencyList, enabled = true) {
  const registry = useContext(ScreenObjectContext);
  // A screen object may also be rendered by itself in previews or server markup.
  // Registration is active only inside the live SignalFilm provider.
  // The caller lists every state/function captured by the registration factory.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => enabled && registry ? registry.register(factory()) : undefined, [registry, enabled, ...dependencies]);
}
