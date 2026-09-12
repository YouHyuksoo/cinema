export const CENTER_BACKGROUND_KEY = 'cinema.center.background.v1';
export const CENTER_BACKGROUNDS = [
  { id: 'neon-hud', label: '네온 HUD' },
  { id: 'cyan-panel', label: '시안 계기판' },
  { id: 'steel-orbit', label: '스틸 오비트' },
  { id: 'crimson-core', label: '크림슨 코어' },
  { id: 'cyan-hex', label: '시안 헥사' },
  { id: 'blue-diamond', label: '블루 다이아몬드' },
  { id: 'amber-orbit', label: '앰버 오비트' },
] as const;
export type CenterBackground = typeof CENTER_BACKGROUNDS[number]['id'] | 'classic' | 'neon-hud';
const normalize = (value: unknown): CenterBackground => value === 'classic' || value === 'neon-hud'
  ? value : CENTER_BACKGROUNDS.find(option => option.id === value)?.id ?? 'neon-hud';
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Local visual preference only: no camera, microphone, session or server side effects. */
export function createCenterBackgroundPreference(getStorage?: () => PreferenceStorage | undefined) {
  let selected: CenterBackground | null = null;
  const listeners = new Set<() => void>();
  const getSnapshot = (): CenterBackground => {
    if (selected === null) {
      try { selected = normalize(getStorage?.()?.getItem(CENTER_BACKGROUND_KEY)); }
      catch { selected = 'neon-hud'; }
    }
    return selected;
  };
  return {
    getSnapshot,
    getServerSnapshot: (): CenterBackground => 'neon-hud',
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
