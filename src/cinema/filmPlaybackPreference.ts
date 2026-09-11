import { DEFAULT_FILM_TEXTURE, FILM_TEXTURE_STYLES, type FilmTextureSettings } from './filmTexture';
import { normalizeChartPresentation, type FilmChartSettings } from './chartPresentation';
import { DEFAULT_FILM_THEME, FILM_THEMES, type FilmThemeId } from './filmThemes';
import { DEFAULT_MACHINE_SUBJECT, isMachineSubject, type MachineSubject } from './machinePresentation';
import type { PlaybackMode } from './filmProgram';

export const PLAYBACK_PREFERENCE_KEY = 'cinema.playback.preferences.v1';
export interface PlaybackPreference {
  speed: number; mode: PlaybackMode; theme: FilmThemeId; texture: FilmTextureSettings;
  charts: FilmChartSettings; machineSubject: MachineSubject;
}
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
export function normalizePlaybackPreference(value: unknown): PlaybackPreference {
  const input = record(value), texture = record(input.texture), charts = record(input.charts);
  return {
    speed: typeof input.speed === 'number' && [.25, .5, .75, 1, 1.5, 2, 3, 4].includes(input.speed) ? input.speed : 1,
    mode: input.mode === 'chapter' ? 'chapter' : 'sequence',
    theme: FILM_THEMES.find(theme => theme.id === input.theme)?.id ?? DEFAULT_FILM_THEME,
    texture: { style: FILM_TEXTURE_STYLES.find(style => style.value === texture.style)?.value ?? DEFAULT_FILM_TEXTURE.style,
      intensity: typeof texture.intensity === 'number' && Number.isFinite(texture.intensity) ? Math.max(0, Math.min(1, texture.intensity)) : DEFAULT_FILM_TEXTURE.intensity },
    charts: { bars: normalizeChartPresentation(record(charts.bars)), pie: normalizeChartPresentation(record(charts.pie)) },
    machineSubject: isMachineSubject(input.machineSubject) ? input.machineSubject : DEFAULT_MACHINE_SUBJECT,
  };
}
export function readPlaybackPreference(storage: Pick<Storage, 'getItem'>): PlaybackPreference {
  try { return normalizePlaybackPreference(JSON.parse(storage.getItem(PLAYBACK_PREFERENCE_KEY) ?? 'null')); }
  catch { return normalizePlaybackPreference(null); }
}
export function savePlaybackPreference(value: PlaybackPreference) {
  try { window.localStorage.setItem(PLAYBACK_PREFERENCE_KEY, JSON.stringify(normalizePlaybackPreference(value))); }
  catch { /* The live choice still works when browser storage is unavailable. */ }
}
