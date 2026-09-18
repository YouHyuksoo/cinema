'use client';

import { useSyncExternalStore } from 'react';
import { browserDeviceHints, isLowEndDevice } from './filmRenderBudget';

/** Set on `<html>` so CSS can drop continuous decoration that a slow machine cannot composite. */
export const PERFORMANCE_ATTRIBUTE = 'data-film-perf';
const STORAGE_KEY = 'cinema.performance.v1';
/**
 * Measured pressure stays in force this long after the last over-budget report. Low mode removes
 * the decoration that caused the pressure, so a report-and-release pair would otherwise flip the
 * whole page between the two decoration sets every few seconds on a borderline machine.
 */
export const PRESSURE_HOLD_MS = 45_000;
export type FilmPerformanceMode = 'auto' | 'low' | 'full';
export type ResolvedPerformanceMode = 'low' | 'full';

export function isFilmPerformanceMode(value: unknown): value is FilmPerformanceMode {
  return value === 'auto' || value === 'low' || value === 'full';
}

/** `auto` follows the device hints; the explicit choices let a user override a wrong guess. */
export function readPerformanceMode(storage?: Pick<Storage, 'getItem'>): FilmPerformanceMode {
  try {
    const stored = storage?.getItem(STORAGE_KEY);
    return isFilmPerformanceMode(stored) ? stored : 'auto';
  } catch { return 'auto'; }
}

export function resolvePerformanceMode(mode: FilmPerformanceMode, lowEnd: boolean): ResolvedPerformanceMode {
  return mode === 'auto' ? (lowEnd ? 'low' : 'full') : mode;
}

/**
 * Device hints alone miss many slow machines (an old eight-thread desktop reports the same numbers
 * as a fast one), so the film loop reports what it actually measures: the render budget capping the
 * painting cadence, or animation frames arriving late while the canvas itself is cheap, means this
 * machine is over budget. The report is sticky (see PRESSURE_HOLD_MS) so relief does not undo it at once.
 */
let pressureUntil = -Infinity;
let measuredPressure = false;

export function reportRenderPressure(pressured: boolean, now = Date.now()) {
  if (pressured) pressureUntil = now + PRESSURE_HOLD_MS;
  const next = pressured || now < pressureUntil;
  if (measuredPressure === next) return;
  measuredPressure = next;
  applyPerformanceMode();
}

/** Exposed for tests: the measured pressure and the published mode are process-wide state. */
export function resetPerformanceState() {
  measuredPressure = false; pressureUntil = -Infinity; chosen = null; resolved = 'full';
}

/** True while the document asks for the cheap decoration set. */
export function isLowPerformance() {
  return resolved === 'low';
}

/**
 * True when the bitmap should never exceed 1x: an explicit "low" choice or a device whose hints
 * already mark it slow. Measured pressure is deliberately left out, because a resolution change
 * feeds back into the measurement and the two would chase each other.
 */
export function prefersLowDetail(storage?: Pick<Storage, 'getItem'>) {
  chosen ??= readPerformanceMode(storage ?? safeStorage());
  return chosen === 'low' || (chosen === 'auto' && isLowEndDevice(browserDeviceHints()));
}

let chosen: FilmPerformanceMode | null = null;
let resolved: ResolvedPerformanceMode = 'full';
const listeners = new Set<() => void>();
const resolvedListeners = new Set<() => void>();

/** Publishes the resolved mode on `<html>`; idempotent, so every caller may apply it. */
export function applyPerformanceMode(storage?: Pick<Storage, 'getItem'>) {
  if (typeof document === 'undefined') return 'full' as const;
  chosen ??= readPerformanceMode(storage ?? safeStorage());
  const next = resolvePerformanceMode(chosen, isLowEndDevice(browserDeviceHints()) || measuredPressure);
  document.documentElement.setAttribute(PERFORMANCE_ATTRIBUTE, next);
  if (next !== resolved) {
    resolved = next;
    for (const listener of resolvedListeners) listener();
  }
  return next;
}

function safeStorage() {
  try { return typeof window === 'undefined' ? undefined : window.localStorage; } catch { return undefined; }
}

export const PERFORMANCE_MODES = [
  { value: 'auto', label: '자동' },
  { value: 'low', label: '가볍게' },
  { value: 'full', label: '최대 품질' },
] as const satisfies readonly { value: FilmPerformanceMode; label: string }[];

/** Preference store for the dock select: the choice applies at once and survives a reload. */
export const performancePreference = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  getSnapshot(): FilmPerformanceMode { return chosen ??= readPerformanceMode(safeStorage()); },
  getServerSnapshot(): FilmPerformanceMode { return 'auto'; },
  set(mode: FilmPerformanceMode) {
    if (!isFilmPerformanceMode(mode) || mode === performancePreference.getSnapshot()) return;
    chosen = mode;
    try { window.localStorage.setItem(STORAGE_KEY, mode); } catch { /* Storage may be blocked. */ }
    applyPerformanceMode();
    for (const listener of listeners) listener();
  },
};

/** The mode actually in force (preference + device hints + measured pressure), for components that must react to it. */
export const resolvedPerformance = {
  subscribe(listener: () => void) { resolvedListeners.add(listener); return () => { resolvedListeners.delete(listener); }; },
  getSnapshot(): ResolvedPerformanceMode { return resolved; },
  getServerSnapshot(): ResolvedPerformanceMode { return 'full'; },
};

/** True while the cheap decoration set is in force; re-renders when the mode flips either way. */
export function useLowPerformance() {
  return useSyncExternalStore(resolvedPerformance.subscribe, resolvedPerformance.getSnapshot, resolvedPerformance.getServerSnapshot) === 'low';
}
