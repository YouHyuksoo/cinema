import { smooth } from './filmDrawing';
import { createHoloProjection } from './holoSpace';
import { TEMPERATURE_HOUR_MS, temperatureHistoryDomain, temperatureHistoryPoints, type TemperatureSample } from './temperatureHistory';

export const ENVIRONMENT_FILM_SECONDS = 52;
export const ENVIRONMENT_TIMING = {
  tourStart: 2.5, tourEnd: 21.5,
  chartsStart: 23, chartsEnd: 25.5, chartsOut: 34,
  heatmapStart: 35, heatmapFull: 38, heatmapOut: 50,
  fadeOut: 50,
} as const;
export const ZONE_COUNT = 10;
export interface EnvironmentRange { min: number; max: number }
export interface EnvironmentZone {
  id: string; name: string; temperature: number | null; humidity: number | null;
  temperatureRange: EnvironmentRange; humidityRange: EnvironmentRange;
  temperatureHistory?: readonly TemperatureSample[];
}
export interface ZoneEnvironmentData { title: string; zones: readonly EnvironmentZone[]; historyEnd?: number }
export type ReadingStatus = 'normal' | 'outside' | 'missing';
export const DEFAULT_ENVIRONMENT_DATA: ZoneEnvironmentData = {
  title: '생산 현장 / 환경 모니터링',
  historyEnd: Date.UTC(2026, 8, 7),
  zones: ['자재 입고', '자재 보관', '인쇄 공정', '실장 공정', '리플로우',
    '검사 공정', '조립 공정', '검사 대기', '포장 공정', '완제품 보관'].map((name, index) => ({
    id: `ZONE ${String(index + 1).padStart(2, '0')}`, name,
    temperature: [23.2, 22.8, 24.1, 25.3, 26.7, 29.4, 24.8, 23.9, 23.1, 22.6][index],
    humidity: [46, 44, 48, 51, 43, 47, 52, 64, 49, 45][index],
    temperatureRange: { min: 20, max: 28 }, humidityRange: { min: 40, max: 60 },
    temperatureHistory: Array.from({ length: 25 }, (_, hour) => ({
      at: Date.UTC(2026, 8, 6) + hour * TEMPERATURE_HOUR_MS,
      value: Math.round(([23.2, 22.8, 24.1, 25.3, 26.7, 29.4, 24.8, 23.9, 23.1, 22.6][index]
        + (Math.sin(hour * .34 + index * .8) - Math.sin(24 * .34 + index * .8)) * (1 + index % 3 * .3)
        + Math.sin(hour * .91 + index) * Math.sin((24 - hour) / 24 * Math.PI) * .35) * 10) / 10,
    })),
  })),
};

export function environmentReadingStatus(value: number | null, range: EnvironmentRange,
  humidity = false): ReadingStatus {
  if (value === null || !Number.isFinite(value) || !Number.isFinite(range.min)
    || !Number.isFinite(range.max) || range.min > range.max
    || (humidity && (value < 0 || value > 100))) return 'missing';
  return value < range.min || value > range.max ? 'outside' : 'normal';
}
export function environmentZoneStatus(zone: EnvironmentZone): ReadingStatus {
  const values = [environmentReadingStatus(zone.temperature, zone.temperatureRange),
    environmentReadingStatus(zone.humidity, zone.humidityRange, true)];
  if (values.includes('outside')) return 'outside';
  return values.includes('missing') ? 'missing' : 'normal';
}

/** Absolute scene time keeps pause, reverse seek and every playback speed deterministic. */
export function zoneEnvironmentState(time: number, data: ZoneEnvironmentData = DEFAULT_ENVIRONMENT_DATA) {
  const elapsed = Number.isFinite(time) ? Math.max(0, Math.min(ENVIRONMENT_FILM_SECONDS, time)) : 0;
  const source = data.zones.slice(0, ZONE_COUNT);
  const count = source.length;
  const timing = ENVIRONMENT_TIMING;
  const tourDuration = timing.tourEnd - timing.tourStart;
  const dwell = count ? tourDuration / count : tourDuration;
  const tourTime = elapsed - timing.tourStart;
  const selectedIndex = tourTime >= 0 && elapsed < timing.tourEnd && count ? Math.min(count - 1, Math.floor(tourTime / dwell)) : -1;
  const local = selectedIndex >= 0 ? tourTime - selectedIndex * dwell : 0;
  const focus = selectedIndex >= 0 ? smooth(0, dwell * .24, local) * (1 - smooth(dwell * .73, dwell, local)) : 0;
  const historyEnd = data.historyEnd ?? source.reduce<number | undefined>((end, zone) => {
    for (const sample of zone.temperatureHistory ?? []) if (Number.isFinite(sample.at)) end = Math.max(end ?? sample.at, sample.at);
    return end;
  }, undefined);
  const zones = source.map((zone, index) => {
    const selected = index === selectedIndex;
    const lift = selected ? focus : 0;
    const band = index < 5 ? 'top' : 'bottom';
    const x = 200 + (index % 5) * 220, y = band === 'top' ? 185 : 580;
    const side = index < 5 ? 'left' : 'right';
    const row = index % 5, stagger = row * .16;
    const project = createHoloProjection({ x, y, yaw: (2 - index % 5) * .05,
      pitch: .3, distance: 850, scale: 1 });
    const front = project({ x: 0, y: 0, z: 0 });
    // A different phase/period per station creates gentle suspended motion, not a moving row.
    // Readings stay on their top/bottom anchors; only the separate central instruments enlarge.
    const hover = smooth(.5, 1.8, elapsed) * (1 - smooth(timing.fadeOut, ENVIRONMENT_FILM_SECONDS, elapsed)) * (1 - lift * .7);
    const phase = elapsed * Math.PI * 2 / (6.2 + index % 4 * .45) + index * 2.399;
    const driftX = Math.sin(phase * .73) * 2 * hover;
    const driftY = Math.sin(phase) * 5 * hover;
    const driftDepth = Math.cos(phase * .81) * 4 * hover;
    const anchor = { ...front, x: front.x + driftX, y: front.y + driftY,
      scale: (1 + lift * .06) * (1 - driftDepth / 1000), depth: front.depth + driftDepth };
    const history = temperatureHistoryPoints(zone.temperatureHistory, historyEnd);
    return { zone, index, selected, focus: lift, status: environmentZoneStatus(zone), anchor,
      band, side, row, history,
      cardOpacity: 1 - smooth(timing.chartsOut, timing.heatmapStart + .5, elapsed),
      chartReveal: smooth(timing.chartsStart + stagger, timing.chartsEnd + stagger, elapsed)
        * (1 - smooth(timing.chartsOut, timing.heatmapStart + .5, elapsed)),
      tilt: (2 - index % 5) * .016 + Math.sin(phase * .67) * .012 * hover,
      reveal: smooth(.25 + index * .09, 1.2 + index * .09, elapsed), project };
  });
  const historyDomain = temperatureHistoryDomain(zones.flatMap(z => z.history.map(p => p.value)), source.map(z => z.temperatureRange));
  return { elapsed, zones, selected: zones[selectedIndex], focus, historyEnd, historyDomain,
    focusOpacity: (.5 + focus * .5) * (1 - smooth(timing.tourEnd - .6, timing.tourEnd, elapsed)),
    showIntro: elapsed < timing.tourStart || !count,
    historyPhase: smooth(timing.chartsStart, timing.chartsStart + 1, elapsed)
      * (1 - smooth(timing.chartsOut, timing.heatmapStart + .5, elapsed)),
    heatmapReveal: smooth(timing.heatmapStart, timing.heatmapFull, elapsed)
      * (1 - smooth(timing.heatmapOut, ENVIRONMENT_FILM_SECONDS, elapsed)),
    reveal: smooth(0, 1, elapsed) * (1 - smooth(timing.fadeOut, ENVIRONMENT_FILM_SECONDS, elapsed)),
    normal: zones.filter(z => z.status === 'normal').length,
    outside: zones.filter(z => z.status === 'outside').length,
    missing: zones.filter(z => z.status === 'missing').length };
}
export type ZoneEnvironmentState = ReturnType<typeof zoneEnvironmentState>;
