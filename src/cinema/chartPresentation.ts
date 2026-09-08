export type ChartDimension = '2d' | '3d';
export type ChartKind = 'bars' | 'pie';

export interface ChartPresentation {
  dimension: ChartDimension;
  depthScale: number;
}

export type FilmChartSettings = Record<ChartKind, ChartPresentation>;

export const CHART_DEPTH_RANGE = { min: .4, max: 1.6, step: .1 } as const;
export const DEFAULT_CHART_PRESENTATION: ChartPresentation = { dimension: '3d', depthScale: 1 };
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
  };
}
