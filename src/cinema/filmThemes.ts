export const FILM_THEMES = [
  { id: 'cyan', label: '시안', accent: '#5fe3ff', warning: '#ffc168' },
  { id: 'emerald', label: '에메랄드', accent: '#5fffb4', warning: '#ffc168' },
  { id: 'blue', label: '블루', accent: '#5f9fff', warning: '#ffc168' },
  { id: 'amber', label: '앰버', accent: '#ffd15f', warning: '#ff6978' },
  { id: 'rose', label: '로즈', accent: '#ff7bba', warning: '#ffc168' },
  { id: 'white', label: '흰색', accent: '#f5f5f5', warning: '#ffc168' },
] as const;

export type FilmThemeId = (typeof FILM_THEMES)[number]['id'];
export const DEFAULT_FILM_THEME: FilmThemeId = 'cyan';

export function getFilmTheme(id: FilmThemeId) {
  return FILM_THEMES.find(theme => theme.id === id) ?? FILM_THEMES[0];
}
