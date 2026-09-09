import { CHART_DEPTH_RANGE, type ChartDimension, type ChartKind, type ChartPresentation } from './chartPresentation';
import { PercentField, SelectField } from './FilmFields';
import styles from './film.module.css';

interface Props {
  kind: ChartKind;
  presentation: ChartPresentation;
  disabled: boolean;
  onChange: (kind: ChartKind, change: Partial<ChartPresentation>) => void;
}

const DIMENSIONS = [
  { value: '2d', label: '2D · 평면' },
  { value: '3d', label: '3D · 입체' },
] as const satisfies readonly { value: ChartDimension; label: string }[];

export function FilmChartControls({ kind, presentation, disabled, onChange }: Props) {
  const name = kind === 'bars' ? '막대그래프' : '파이그래프';
  const flat = presentation.dimension === '2d';
  return (
    <fieldset className={styles.chartSettings} disabled={disabled}>
      <legend>{name} 연출</legend>
      <div className={styles.chartSettingsRow}>
        <SelectField label="형태" ariaLabel={`${name} 형태`} value={presentation.dimension} options={DIMENSIONS}
          onChange={dimension => onChange(kind, { dimension })} />
        <PercentField label="입체 두께" ariaLabel={`${name} 입체 두께`} value={presentation.depthScale}
          min={CHART_DEPTH_RANGE.min} max={CHART_DEPTH_RANGE.max} step={CHART_DEPTH_RANGE.step * 100} moot={flat}
          onChange={depthScale => onChange(kind, { depthScale })} />
        <span className={styles.textureDescription}>{kind === 'bars'
          ? flat ? '발광 눈금 · 정밀 스케일 · 초점 확대' : '발광 눈금 · 투명한 층 · 입체 확대'
          : flat ? '평면 형태 · 초점 확대 유지' : '투명한 면 · 두께 · 초점 확대'}</span>
      </div>
    </fieldset>
  );
}
