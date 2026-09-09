import { CORNER_PRODUCTION } from './cornerSequence';
import { RIBBON_NUMBER_GLYPHS, type RibbonGlyphPoint } from './ribbonNumberGeometry';
import { UNFOLD_METRICS } from './unfoldMetrics';
import { finiteUnit as clamp, mix } from './filmMath';

export type MetricMorphId = typeof UNFOLD_METRICS[number]['id'];
export interface MorphPoint { x: number; y: number; heat: number }
export interface MetricMorphCloud {
  source: readonly MorphPoint[];
  target: readonly MorphPoint[];
  contours: readonly (readonly RibbonGlyphPoint[])[];
}

export const METRIC_MORPH_POINT_COUNT = 720;
const STROKE_LANES = 3;
const SOURCE_SAMPLES = METRIC_MORPH_POINT_COUNT / STROKE_LANES;

function numberContours(value: string, layoutValue = value): RibbonGlyphPoint[][] {
  const advances = [...value].map(character => character === '.' ? 31 : 108);
  const width = advances.reduce((sum, advance) => sum + advance, 0) - 20;
  const layoutWidth = [...layoutValue].reduce((sum, character) => sum + (character === '.' ? 31 : 108), 0) - 20;
  // Keep the decimal and units anchored when a count gains another digit.
  let cursor = layoutWidth / 2 - width;
  return [...value].map((character, index) => {
    const glyphWidth = character === '.' ? 23 : 88;
    const contour = (RIBBON_NUMBER_GLYPHS[character] ?? []).map(([x, y]): RibbonGlyphPoint => [
      cursor + x * glyphWidth, -70 + y * 140,
    ]);
    cursor += advances[index];
    return contour;
  });
}

function segmentLengths(contour: readonly RibbonGlyphPoint[]) {
  return contour.slice(1).map(([x, y], index) => Math.hypot(x - contour[index][0], y - contour[index][1]));
}

/** Reserve samples for every glyph, including the small decimal stroke. */
function sampleNumber(contours: readonly (readonly RibbonGlyphPoint[])[], heat: number): MorphPoint[] {
  const lengths = contours.map(segmentLengths);
  const totals = lengths.map(parts => parts.reduce((sum, length) => sum + length, 0));
  const totalLength = totals.reduce((sum, length) => sum + length, 0);
  const minimum = 4;
  const proportional = totals.map(length => length / totalLength * (SOURCE_SAMPLES - minimum * contours.length));
  const counts = proportional.map(count => minimum + Math.floor(count));
  const remainders = proportional.map((count, index) => ({ index, fraction: count - Math.floor(count) }))
    .sort((a, b) => b.fraction - a.fraction);
  for (let left = SOURCE_SAMPLES - counts.reduce((sum, count) => sum + count, 0), index = 0; left > 0; left--, index++) {
    counts[remainders[index].index]++;
  }

  const points: MorphPoint[] = [];
  contours.forEach((contour, contourIndex) => {
    const parts = lengths[contourIndex];
    for (let sample = 0; sample < counts[contourIndex]; sample++) {
      let distance = (sample + .5) / counts[contourIndex] * totals[contourIndex];
      let segment = 0;
      while (segment < parts.length - 1 && distance > parts[segment]) distance -= parts[segment++];
      const [ax, ay] = contour[segment], [bx, by] = contour[segment + 1];
      const length = parts[segment];
      const along = length ? distance / length : 0;
      const nx = length ? -(by - ay) / length : 0, ny = length ? (bx - ax) / length : 0;
      for (let lane = 0; lane < STROKE_LANES; lane++) {
        const offset = (lane - 1) * 2.25;
        points.push({ x: mix(ax, bx, along) + nx * offset,
          y: Math.max(-70, Math.min(70, mix(ay, by, along) + ny * offset)), heat });
      }
    }
  });
  return points;
}

function chartPoints(metricId: MetricMorphId): MorphPoint[] {
  const metric = UNFOLD_METRICS.find(item => item.id === metricId)!;
  const productionRatio = CORNER_PRODUCTION.actual / CORNER_PRODUCTION.target;
  return Array.from({ length: METRIC_MORPH_POINT_COUNT }, (_, index): MorphPoint => {
    const u = (index + .5) / METRIC_MORPH_POINT_COUNT;
    if (metricId === 'quality') {
      const angle = -Math.PI / 2 + Math.PI * 2 * u;
      const radius = 84 + (index % 3) * 8;
      return { x: -90 + Math.cos(angle) * radius, y: 10 + Math.sin(angle) * radius,
        heat: u >= metric.numericValue / 100 ? 1 : 0 };
    }
    if (metricId === 'cycle') {
      const rail = index % 2;
      const along = Math.floor(index / 2) / (METRIC_MORPH_POINT_COUNT / 2 - 1);
      const seconds = along * metric.numericValue;
      return { x: -310 + 620 * seconds / 10, y: rail ? 25 : -25,
        heat: seconds > metric.baseline ? 1 : 0 };
    }
    const y = -30 + (index % 8) / 7 * 60;
    if (metricId === 'remaining') {
      return { x: -310 + u * 620, y, heat: u >= productionRatio ? 1 : 0 };
    }
    // Thirty separated cells form the production track; the final cell stays partial.
    const cellPosition = u * productionRatio * 30;
    const cell = Math.floor(cellPosition), withinCell = cellPosition - cell;
    const filledCell = Math.min(1, productionRatio * 30 - cell);
    const start = Math.min(.1, filledCell / 2), end = Math.min(.9, filledCell);
    const x = -310 + (cell + mix(start, end, withinCell / filledCell)) * 620 / 30;
    return { x, y, heat: 0 };
  });
}

const CLOUDS = new Map<MetricMorphId, MetricMorphCloud>();
const COUNT_CLOUDS = new Map<MetricMorphId, { value: string; cloud: MetricMorphCloud }>();

/** Both representations use the same particles, so no number is swapped for another object. */
export function metricMorphCloud(metricId: MetricMorphId): MetricMorphCloud {
  const cached = CLOUDS.get(metricId);
  if (cached) return cached;
  const metric = UNFOLD_METRICS.find(item => item.id === metricId)!;
  const contours = numberContours(metric.value);
  const cloud = { contours, source: sampleNumber(contours, metric.heat), target: chartPoints(metricId) };
  CLOUDS.set(metricId, cloud);
  return cloud;
}

/** Retain only the latest counted value per metric; its final strokes are the morph source. */
export function metricNumberCloud(metricId: MetricMorphId, displayValue: string): MetricMorphCloud {
  const finalCloud = metricMorphCloud(metricId);
  const metric = UNFOLD_METRICS.find(item => item.id === metricId)!;
  if (displayValue === metric.value) return finalCloud;
  const cached = COUNT_CLOUDS.get(metricId);
  if (cached?.value === displayValue) return cached.cloud;
  const contours = numberContours(displayValue, metric.value);
  const cloud = { contours, source: sampleNumber(contours, metric.heat), target: finalCloud.target };
  COUNT_CLOUDS.set(metricId, { value: displayValue, cloud });
  return cloud;
}

/** Absolute progress reconstructs the same restrained cubic paths on every seek. */
export function morphMetricPoints(metricId: MetricMorphId, progress: number): readonly MorphPoint[] {
  const cloud = metricMorphCloud(metricId), amount = clamp(progress);
  if (amount === 0) return cloud.source;
  if (amount === 1) return cloud.target;
  return cloud.source.map((source, index) => {
    const target = cloud.target[index];
    const delay = (index % 17) / 16 * .1;
    const local = clamp((amount - delay) / (1 - delay));
    const t = local * local * (3 - 2 * local), remaining = 1 - t;
    const dx = target.x - source.x, dy = target.y - source.y;
    const length = Math.hypot(dx, dy);
    const nx = length ? -dy / length : 0, ny = length ? dx / length : 0;
    const bend = Math.sin(index * 2.399963229728653) * Math.min(38, length * .16);
    const first = { x: source.x + dx * .28 + nx * bend, y: source.y + dy * .28 + ny * bend };
    const second = { x: source.x + dx * .74 + nx * bend * .55, y: source.y + dy * .74 + ny * bend * .55 };
    const coordinate = (axis: 'x' | 'y') => remaining ** 3 * source[axis]
      + 3 * remaining ** 2 * t * first[axis] + 3 * remaining * t ** 2 * second[axis] + t ** 3 * target[axis];
    return { x: coordinate('x'), y: coordinate('y'), heat: mix(source.heat, target.heat, t) };
  });
}
