import { describe, expect, it } from 'vitest';
import { DEFAULT_FILM_SCENE_DATA, mergeFilmSceneData } from '@/cinema/filmSceneData';
import { HATCHERY_METRIC_KINDS, hatcheryMainData, hatcheryMetrics, jarvisMainData, jarvisMainMetrics } from '@/cinema/jarvisMainData';

describe('HATCHERY main metrics derived from scene data', () => {
  it('reproduces the legacy constants when called with the default scene data', () => {
    expect(hatcheryMetrics(DEFAULT_FILM_SCENE_DATA)).toEqual(jarvisMainMetrics);
    expect(hatcheryMainData(DEFAULT_FILM_SCENE_DATA)).toEqual(jarvisMainData);
    expect(jarvisMainMetrics.map(metric => metric.kind)).toEqual([...HATCHERY_METRIC_KINDS]);
  });

  it('reflects injected energy production in the production card', () => {
    const data = mergeFilmSceneData(DEFAULT_FILM_SCENE_DATA, { energy: { ...DEFAULT_FILM_SCENE_DATA.energy,
      production: { value: 42, capacity: 100, unit: 'EA' } } });
    const card = hatcheryMetrics(data).find(metric => metric.kind === 'production')!;
    expect(card.value).toBe('42');
    expect(card.note).toBe('목표 100 EA');
    expect(card.fill).toBeCloseTo(.42);
  });

  it('counts injected environment zones and bottleneck nodes', () => {
    const zones = DEFAULT_FILM_SCENE_DATA.environment.zones.slice(0, 2).map(zone => ({ ...zone, temperature: 40 }));
    const network = { ...DEFAULT_FILM_SCENE_DATA.network, demandPerHour: 10 };
    const data = mergeFilmSceneData(DEFAULT_FILM_SCENE_DATA, { environment: { ...DEFAULT_FILM_SCENE_DATA.environment, zones }, network });
    const metrics = hatcheryMetrics(data);
    const temperature = metrics.find(metric => metric.kind === 'temperature')!;
    expect(temperature.note).toBe('2개 구역 · 이탈 2곳');
    expect(temperature.warning).toBe(true);
    expect(temperature.value).toBe('40.0');
    const process = metrics.find(metric => metric.kind === 'process')!;
    expect(process.value).toBe('00');
    expect(process.note).toBe('병목 없음');
    expect(hatcheryMainData(data).bottlenecks).toHaveLength(0);
  });
});
