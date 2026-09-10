import { isMenuLayout, type MenuLayout } from './filmMenuRing';

export const MENU_LAYOUT_KEY = 'cinema.menu.layout.v1';
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Save explicit menu choices only; hydration must never overwrite a saved value. */
export function createMenuLayoutPreference(getStorage?: () => PreferenceStorage | undefined) {
  let selected: MenuLayout | undefined;
  const listeners = new Set<() => void>();
  const getSnapshot = (): MenuLayout => {
    if (selected === undefined) {
      try {
        const saved = getStorage?.()?.getItem(MENU_LAYOUT_KEY);
        selected = isMenuLayout(saved) ? saved : 'dock';
      } catch { selected = 'dock'; }
    }
    return selected;
  };
  return {
    getSnapshot,
    getServerSnapshot: (): MenuLayout => 'dock',
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    set(value: unknown) {
      if (!isMenuLayout(value)) return;
      const changed = getSnapshot() !== value;
      selected = value;
      try { getStorage?.()?.setItem(MENU_LAYOUT_KEY, value); } catch { /* Retain the choice for this session when storage is blocked. */ }
      if (changed) listeners.forEach(listener => listener());
    },
  };
}

export const menuLayoutPreference = createMenuLayoutPreference(() => typeof window === 'undefined' ? undefined : window.localStorage);
