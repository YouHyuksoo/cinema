import { CHART_DEPTH_RANGE, type ChartDimension, type ChartKind, type ChartPresentation } from './chartPresentation';
import styles from './film.module.css';

interface Props {
  kind: ChartKind;
  presentation: ChartPresentation;
  disabled: boolean;
  onChange: (kind: ChartKind, change: Partial<ChartPresentation>) => void;
}

export function FilmChartControls({ kind, presentation, disabled, onChange }: Props) {
  const name = kind === 'bars' ? '막대그래프' : '파이그래프';
  const flat = presentation.dimension === '2d';
  const percent = Math.round(presentation.depthScale * 100);
  return (
    <fieldset className={styles.chartSettings} disabled={disabled}>
      <legend>{name} 연출</legend>
      <div className={styles.chartSettingsRow}>
        <label className={styles.speedControl}>
          <span>형태</span>
          <select aria-label={`${name} 형태`} value={presentation.dimension}
            onChange={(event) => onChange(kind, { dimension: event.target.value as ChartDimension })}>
            <option value="2d">2D · 평면</option>
            <option value="3d">3D · 입체</option>
          </select>
        </label>
        <label className={styles.textureIntensity}>
          <span>입체 두께</span>
          <input type="range" aria-label={`${name} 입체 두께`}
            min={CHART_DEPTH_RANGE.min * 100} max={CHART_DEPTH_RANGE.max * 100} step={CHART_DEPTH_RANGE.step * 100}
            value={percent} aria-valuetext={`${percent}%`} disabled={flat}
            onChange={(event) => onChange(kind, { depthScale: Number(event.target.value) / 100 })} />
          <span className={styles.textureValue} aria-hidden="true">{flat ? '—' : `${percent}%`}</span>
        </label>
        <span className={styles.textureDescription}>{kind === 'bars'
          ? flat ? '발광 눈금 · 정밀 스케일 · 초점 확대' : '발광 눈금 · 투명한 층 · 입체 확대'
          : flat ? '평면 형태 · 초점 확대 유지' : '투명한 면 · 두께 · 초점 확대'}</span>
      </div>
    </fieldset>
  );
}
