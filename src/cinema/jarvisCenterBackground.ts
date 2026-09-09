export const CENTER_BACKGROUND_KEY = 'cinema.center.background.v1';
export const CENTER_BACKGROUNDS = [{ id: 'classic', label: '기존 스타일' }, { id: 'neon-hud', label: '네온 HUD' }] as const;
export type CenterBackground = typeof CENTER_BACKGROUNDS[number]['id'];
const normalize = (value: unknown): CenterBackground => value === 'neon-hud' || value === 'red-hud' ? 'neon-hud' : 'classic';
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Local visual preference only: no camera, microphone, session or server side effects. */
export function createCenterBackgroundPreference(getStorage?: () => PreferenceStorage | undefined) {
  let selected: CenterBackground | null = null;
  const listeners = new Set<() => void>();
  const getSnapshot = (): CenterBackground => {
    if (selected === null) {
      try { selected = normalize(getStorage?.()?.getItem(CENTER_BACKGROUND_KEY)); }
      catch { selected = 'classic'; }
    }
    return selected;
  };
  return {
    getSnapshot,
    getServerSnapshot: (): CenterBackground => 'classic',
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    set(value: unknown) {
      const next = normalize(value);
      if (getSnapshot() === next) return;
      selected = next;
      try { getStorage?.()?.setItem(CENTER_BACKGROUND_KEY, next); } catch { /* Keep the selection for this session. */ }
      listeners.forEach(listener => listener());
    },
  };
}

export const centerBackgroundPreference = createCenterBackgroundPreference(() => typeof window === 'undefined' ? undefined : window.localStorage);
