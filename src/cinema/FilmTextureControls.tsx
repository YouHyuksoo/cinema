import { FILM_TEXTURE_STYLES, type FilmTextureSettings, type FilmTextureStyle } from './filmTexture';
import { PercentField, SelectField } from './FilmFields';
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
  return (
    <div className={styles.textureRow}>
      <SelectField label="화면 질감" value={texture.style} options={FILM_TEXTURE_STYLES} disabled={disabled} onChange={onStyleChange} />
      <PercentField label="질감 강도" value={texture.intensity} disabled={disabled} moot={texture.style === 'none'} onChange={onIntensityChange} />
      <span className={styles.textureDescription}>{TEXTURE_DESCRIPTIONS[texture.style]}</span>
    </div>
  );
}
