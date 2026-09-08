import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { jarvisMainData, jarvisMainMetrics } from '@/cinema/jarvisMainData';
import { DEFAULT_ENVIRONMENT_DATA } from '@/cinema/zoneEnvironment';
import { JarvisMetricCards } from '@/cinema/JarvisMetricCards';

describe('eight-metric header strip', () => {
  it('has eight unique metrics and keeps the original first four', () => {
    expect(jarvisMainMetrics).toHaveLength(8);
    expect(new Set(jarvisMainMetrics.map(metric => metric.kind)).size).toBe(8);
    expect(jarvisMainMetrics.slice(0, 4).map(metric => metric.kind)).toEqual(['production', 'process', 'quality', 'power']);
  });
  it('derives added values from existing energy, inspection and zone snapshots', () => {
    const find = (kind: string) => jarvisMainMetrics.find(metric => metric.kind === kind)!;
    expect(find('efficiency').value).toBe(jarvisMainData.energy.efficiency.value.toFixed(1));
    expect(find('inspection').value).toBe(String(jarvisMainData.inspection.passed));
    expect(find('inspection').warning).toBe(jarvisMainData.inspection.failed > 0);
    for (const key of ['temperature', 'humidity'] as const) {
      const readings = DEFAULT_ENVIRONMENT_DATA.zones.map(zone => zone[key]).filter((value): value is number => value !== null);
      expect(find(key).value).toBe((readings.reduce((sum, value) => sum + value, 0) / readings.length).toFixed(1));
      expect(find(key).note).toContain('10');
    }
  });
  it('renders eight distinct instruments with pause and keyboard instructions', () => {
    const html = renderToStaticMarkup(createElement(JarvisMetricCards));
    expect(html.match(/<article /g)).toHaveLength(8);
    expect(html).toContain('상단 지표 자동 스크롤 정지');
    expect(html).toContain('방향키');
    for (const metric of jarvisMainMetrics) {
      expect(html).toContain(`data-kind="${metric.kind}"`);
      expect(metric.note).toBeTruthy();
    }
  });
});
