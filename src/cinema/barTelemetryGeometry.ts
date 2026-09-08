import { smooth } from './filmDrawing';
import { normalizeChartPresentation, type ChartPresentation } from './chartPresentation';
import { focusProjection, projectFocusPoint } from './filmFocus';

export interface BarDatum { label: string; value: number; accent?: boolean }
export interface BarChartOptions {
  x: number; y: number; width: number; height: number; time: number;
  data: readonly BarDatum[];
  maxValue?: number; target?: number; unit?: string; activeIndex?: number;
  focus?: number; opacity?: number; presentation?: ChartPresentation;
}
export interface BarAnchor { x: number; y: number; baseline: number; value: number }
const positive = (value: number | undefined) => Number.isFinite(value) ? Math.max(0, value!) : 0;

/** A partial final light strip ends at the measured value, never at a rounded rung. */
export function telemetrySegments(height: number, filledHeight: number, count = 48) {
  if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(filledHeight)) return [];
  const rows = Math.max(1, Math.min(96, Math.floor(positive(count)) || 48));
  const pitch = height / rows, thickness = pitch * .44;
  const filled = Math.min(height, Math.max(0, filledHeight));
  return Array.from({ length: rows }, (_, index) => {
    const bottom = index * pitch;
    return { bottom, thickness, lit: Math.max(0, Math.min(thickness, filled - bottom)) };
  });
}

/** One scale and clock supply the mesh, local rulers and projected leader anchors. */
export function barTelemetryLayout(options: BarChartOptions) {
  const { x, y, width, height, time, data } = options;
  if (![x, y, width, height, time].every(Number.isFinite) || time < 0 || width <= 0 || height <= 0 || !data.length) return undefined;
  const values = data.map(datum => positive(datum.value));
  const target = Number.isFinite(options.target) && options.target! >= 0 ? options.target : undefined;
  const maximum = values.reduce((max, value) => Math.max(max, value), Math.max(1, positive(options.maxValue), positive(target)));
  const baseline = y + height, slot = width / data.length, barWidth = Math.min(64, slot * .4);
  const selected = Number.isInteger(options.activeIndex) && options.activeIndex! >= 0
    && options.activeIndex! < data.length && values[options.activeIndex!] > 0 ? options.activeIndex : undefined;
  const focus = selected === undefined ? 0 : Math.min(1, positive(options.focus));
  const presentation = normalizeChartPresentation(options.presentation);
  const depth = presentation.dimension === '3d' ? Math.min((slot - barWidth) * .32, 22 * presentation.depthScale) : 0;
  const stagger = Math.min(.25, 3 / Math.max(1, data.length - 1));
  const columns = data.map((datum, index) => {
    const start = .8 + index * stagger, growth = smooth(start, start + 1.2, time);
    const value = values[index], center = x + slot * (index + .5);
    const barHeight = height * value / maximum * growth;
    const top = baseline - barHeight;
    const lens = focusProjection({ x: center, y: baseline, focus: index === selected ? focus : 0, depth: 180, lift: 32 });
    const head = projectFocusPoint(lens, { x: center, y: top });
    const foot = projectFocusPoint(lens, { x: center, y: baseline });
    return { datum, index, start, growth, value, center, left: center - barWidth / 2,
      top, barHeight, heat: datum.accent || selected === index ? 1 : 0, lens,
      anchor: { x: head.x, y: head.y, baseline: foot.y, value } satisfies BarAnchor };
  });
  return { x, y, width, height, baseline, slot, barWidth, target, maximum, selected, focus, depth, columns };
}
export type BarTelemetryLayout = NonNullable<ReturnType<typeof barTelemetryLayout>>;
export type BarTelemetryColumn = BarTelemetryLayout['columns'][number];
