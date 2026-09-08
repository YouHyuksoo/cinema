import { FILM_THEMES, getFilmTheme, type FilmThemeId } from './filmThemes';
import styles from './film.module.css';

interface Props {
  theme: FilmThemeId;
  disabled: boolean;
  onChange: (id: FilmThemeId) => void;
}

export function FilmThemeControls({ theme, disabled, onChange }: Props) {
  return (
    <fieldset className={styles.themeSettings} disabled={disabled}>
      <legend>
        색상 테마
        <span className={styles.themeSelection}>현재 선택: {getFilmTheme(theme).label}</span>
      </legend>
      <div className={styles.themeChoices}>
        {FILM_THEMES.map((option) => (
          <button className={styles.themeButton} type="button" key={option.id}
            aria-label={`${option.label} 테마`} aria-pressed={theme === option.id}
            onClick={() => onChange(option.id)}>
            <span className={styles.themeSwatch} style={{ backgroundColor: option.accent }} aria-hidden="true" />
            <span>{option.label}</span>
            <svg className={styles.themeCheck} viewBox="0 0 12 12" width="12" height="12" fill="none"
              stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true" focusable="false">
              <path d="m2 6 2.5 2.5L10 3" />
            </svg>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
