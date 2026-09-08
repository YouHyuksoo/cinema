import { describe, expect, it } from 'vitest';
import { CORNER_PRODUCTION } from '@/cinema/cornerSequence';
import { METRIC_MORPH_POINT_COUNT, metricMorphCloud, metricNumberCloud, morphMetricPoints } from '@/cinema/metricMorphGeometry';
import { UNFOLD_METRICS, unfoldMetricsState } from '@/cinema/unfoldMetrics';

describe('numbers becoming metric charts', () => {
  it('counts with numeral strokes while preserving chart data and the final morph source', () => {
    for (const [index, metric] of UNFOLD_METRICS.entries()) {
      const finalCloud = metricMorphCloud(metric.id);
      const halfway = unfoldMetricsState(2 + index * 6 + 1).items[index];
      const counted = metricNumberCloud(metric.id, halfway.displayValue);
      expect(counted.source).toHaveLength(METRIC_MORPH_POINT_COUNT);
      expect(counted.contours).toHaveLength(halfway.displayValue.length);
      expect(counted.source).not.toEqual(finalCloud.source);
      expect(counted.target).toBe(finalCloud.target);
      expect(counted.source.every(point => Object.values(point).every(Number.isFinite))).toBe(true);
      expect(metricNumberCloud(metric.id, metric.value)).toBe(finalCloud);
      expect(metricNumberCloud(metric.id, metric.value).source).toBe(morphMetricPoints(metric.id, 0));
    }
  });

  it('anchors fractional and integer slots when the rising count gains a digit', () => {
    for (const metric of UNFOLD_METRICS) {
      const zero = metric.value.includes('.') ? '0.0' : '0';
      const counted = metricNumberCloud(metric.id, zero);
      const finalCloud = metricMorphCloud(metric.id);
      const rightEdge = (cloud: typeof counted) => Math.max(...cloud.contours.flat().map(point => point[0]));
      expect(rightEdge(counted)).toBe(rightEdge(finalCloud));
      if (metric.value.includes('.')) {
        expect(counted.contours[zero.indexOf('.')]).toEqual(finalCloud.contours[metric.value.indexOf('.')]);
      }
    }
  });

  it('reconstructs the same counted glyph after another reading or a backward seek', () => {
    for (const metric of UNFOLD_METRICS) {
      const zero = metric.value.includes('.') ? '0.0' : '0';
      const first = metricNumberCloud(metric.id, zero);
      expect(metricNumberCloud(metric.id, zero)).toBe(first);
      metricNumberCloud(metric.id, metric.value.includes('.') ? '1.2' : '12');
      expect(metricNumberCloud(metric.id, zero)).toEqual(first);
    }
  });

  it('preserves the same particles from readable number strokes to each chart', () => {
    for (const metric of UNFOLD_METRICS) {
      const cloud = metricMorphCloud(metric.id);
      expect(cloud.source).toHaveLength(METRIC_MORPH_POINT_COUNT);
      expect(cloud.target).toHaveLength(METRIC_MORPH_POINT_COUNT);
      expect(cloud.contours).toHaveLength(metric.value.length);
      expect(morphMetricPoints(metric.id, 0)).toBe(cloud.source);
      expect(morphMetricPoints(metric.id, 1)).toBe(cloud.target);
      const outline = cloud.contours.flat();
      expect(Math.max(...outline.map(point => point[0])) - Math.min(...outline.map(point => point[0]))).toBeLessThanOrEqual(440);
      expect(Math.min(...outline.map(point => point[1]))).toBe(-70);
      expect(Math.max(...outline.map(point => point[1]))).toBe(70);
    }
  });

  it('keeps the decimal present even though its contour is much shorter than a digit', () => {
    for (const metric of UNFOLD_METRICS.filter(item => item.value.includes('.'))) {
      const cloud = metricMorphCloud(metric.id), decimal = cloud.contours[metric.value.indexOf('.')];
      const minX = Math.min(...decimal.map(point => point[0])) - 3;
      const maxX = Math.max(...decimal.map(point => point[0])) + 3;
      expect(cloud.source.filter(point => point.x >= minX && point.x <= maxX && point.y > 60).length).toBeGreaterThanOrEqual(12);
    }
  });

  it('uses exact production counts for the filled cells rather than the rounded headline percentage', () => {
    const points = metricMorphCloud('production').target;
    const actualEnd = -310 + 620 * CORNER_PRODUCTION.actual / CORNER_PRODUCTION.target;
    expect(points.every(point => point.x >= -310 && point.x <= actualEnd + 1e-8 && point.heat === 0)).toBe(true);
    expect(Math.max(...points.map(point => point.x))).toBeGreaterThan(actualEnd - 3);
    expect(points.every(point => Math.abs(point.y) <= 34)).toBe(true);
  });

  it('locates the quality defect fraction at the end of a clockwise ring', () => {
    const points = metricMorphCloud('quality').target;
    const metric = UNFOLD_METRICS.find(item => item.id === 'quality')!;
    points.forEach(point => {
      const radius = Math.hypot(point.x + 90, point.y - 10);
      expect(radius).toBeGreaterThanOrEqual(84 - 1e-8);
      expect(radius).toBeLessThanOrEqual(100 + 1e-8);
      const clockwise = (Math.atan2(point.y - 10, point.x + 90) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
      expect(point.heat).toBe(clockwise / (Math.PI * 2) >= metric.numericValue / 100 ? 1 : 0);
    });
    expect(points.filter(point => point.heat === 1).length / points.length)
      .toBeCloseTo(1 - metric.numericValue / 100, 2);
  });

  it('stops timing rails at the actual cycle and colors only the reference overrun', () => {
    const points = metricMorphCloud('cycle').target;
    const metric = UNFOLD_METRICS.find(item => item.id === 'cycle')!;
    expect(Math.min(...points.map(point => point.x))).toBe(-310);
    expect(Math.max(...points.map(point => point.x))).toBeCloseTo(-310 + 620 * metric.numericValue / 10, 8);
    expect(new Set(points.map(point => point.y))).toEqual(new Set([-25, 25]));
    points.forEach(point => {
      const seconds = (point.x + 310) / 620 * 10;
      expect(point.heat).toBe(seconds > metric.baseline ? 1 : 0);
    });
  });

  it('separates completed and remaining quantities at the same plan boundary', () => {
    const points = metricMorphCloud('remaining').target;
    const boundary = -310 + 620 * CORNER_PRODUCTION.actual / CORNER_PRODUCTION.target;
    expect(points.every(point => point.x >= -310 && point.x <= 310)).toBe(true);
    expect(points.every(point => point.heat === (point.x >= boundary ? 1 : 0))).toBe(true);
    expect(points.filter(point => point.heat === 1).length / points.length)
      .toBeCloseTo(CORNER_PRODUCTION.remaining / CORNER_PRODUCTION.target, 2);
  });

  it('keeps every cubic path finite and within the presentation surface', () => {
    for (const metric of UNFOLD_METRICS) {
      for (const progress of [0, .05, .2, .4, .5, .7, .9, 1]) {
        const points = morphMetricPoints(metric.id, progress);
        expect(points).toHaveLength(METRIC_MORPH_POINT_COUNT);
        expect(points.every(point => Object.values(point).every(Number.isFinite))).toBe(true);
        expect(points.every(point => Math.abs(point.x) <= 340 && Math.abs(point.y) <= 140)).toBe(true);
        expect(points.every(point => point.heat >= 0 && point.heat <= 1)).toBe(true);
      }
    }
  });

  it('reconstructs paused and reverse-seek geometry without changing the source cloud', () => {
    for (const metric of UNFOLD_METRICS) {
      const original = JSON.stringify(metricMorphCloud(metric.id));
      const halfway = morphMetricPoints(metric.id, .5);
      morphMetricPoints(metric.id, .9); morphMetricPoints(metric.id, .1);
      expect(morphMetricPoints(metric.id, .5)).toEqual(halfway);
      expect(JSON.stringify(metricMorphCloud(metric.id))).toBe(original);
      expect(morphMetricPoints(metric.id, -1)).toBe(metricMorphCloud(metric.id).source);
      expect(morphMetricPoints(metric.id, NaN)).toBe(metricMorphCloud(metric.id).source);
      expect(morphMetricPoints(metric.id, 3)).toBe(metricMorphCloud(metric.id).target);
    }
  });
});
