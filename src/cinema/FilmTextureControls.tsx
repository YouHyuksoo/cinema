import { FILM_TEXTURE_STYLES, type FilmTextureSettings, type FilmTextureStyle } from './filmTexture';
import styles from './film.module.css';

const TEXTURE_DESCRIPTIONS: Record<FilmTextureStyle, string> = {
  none: '원래 화면 그대로',
  glass: '유리 반사 · 미세한 표면 · 빛 번짐',
  film: '필름 입자 · 부드러운 주변부 음영',
  hologram: '촘촘한 주사선 · 빛의 결',
};

interface Props {
  texture: FilmTextureSettings;
  disabled: boolean;
  onStyleChange: (style: FilmTextureStyle) => void;
  onIntensityChange: (intensity: number) => void;
}

export function FilmTextureControls({ texture, disabled, onStyleChange, onIntensityChange }: Props) {
  const percent = Math.round(texture.intensity * 100);
  return (
    <div className={styles.textureRow}>
      <label className={styles.speedControl}>
        <span>화면 질감</span>
        <select value={texture.style} disabled={disabled}
          onChange={(event) => onStyleChange(event.target.value as FilmTextureStyle)}>
          {FILM_TEXTURE_STYLES.map((style) => <option key={style.value} value={style.value}>{style.label}</option>)}
        </select>
      </label>
      <label className={styles.textureIntensity}>
        <span>질감 강도</span>
        <input type="range" min={0} max={100} step={5} value={percent}
          aria-valuetext={`${percent}%`} disabled={disabled || texture.style === 'none'}
          onChange={(event) => onIntensityChange(Number(event.target.value) / 100)} />
        <span className={styles.textureValue} aria-hidden="true">{texture.style === 'none' ? '—' : `${percent}%`}</span>
      </label>
      <span className={styles.textureDescription}>{TEXTURE_DESCRIPTIONS[texture.style]}</span>
    </div>
  );
}
