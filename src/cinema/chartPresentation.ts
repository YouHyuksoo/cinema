export type ChartDimension = '2d' | '3d';
export type ChartKind = 'bars' | 'pie';
export type ChartStyle = 'auto' | 'bar' | 'line' | 'area' | 'scatter' | 'pie';

export interface ChartPresentation {
  dimension: ChartDimension;
  depthScale: number;
  style?: ChartStyle;
}

export type FilmChartSettings = Record<ChartKind, ChartPresentation>;

export const CHART_DEPTH_RANGE = { min: .4, max: 1.6, step: .1 } as const;
export const CHART_STYLES = [
  { value: 'auto', label: '자동 순환' }, { value: 'bar', label: '막대' }, { value: 'line', label: '선' },
  { value: 'area', label: '영역' }, { value: 'scatter', label: '산포' }, { value: 'pie', label: '파이' },
] as const satisfies readonly { value: ChartStyle; label: string }[];
export const DEFAULT_CHART_PRESENTATION: ChartPresentation = { dimension: '3d', depthScale: 1, style: 'auto' };
export const DEFAULT_FILM_CHARTS: FilmChartSettings = {
  bars: { ...DEFAULT_CHART_PRESENTATION },
  pie: { ...DEFAULT_CHART_PRESENTATION },
};

export function normalizeChartPresentation(value?: Partial<ChartPresentation>): ChartPresentation {
  return {
    dimension: value?.dimension === '2d' ? '2d' : '3d',
    depthScale: typeof value?.depthScale === 'number' && Number.isFinite(value.depthScale)
      ? Math.max(CHART_DEPTH_RANGE.min, Math.min(CHART_DEPTH_RANGE.max, value.depthScale))
      : DEFAULT_CHART_PRESENTATION.depthScale,
    style: CHART_STYLES.some(item => item.value === value?.style) ? value!.style! : DEFAULT_CHART_PRESENTATION.style,
  };
}
