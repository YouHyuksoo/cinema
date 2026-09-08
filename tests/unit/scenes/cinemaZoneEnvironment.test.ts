import { describe, expect, it } from 'vitest';
import { DEFAULT_ENVIRONMENT_DATA, ENVIRONMENT_FILM_SECONDS, ENVIRONMENT_TIMING, environmentReadingStatus,
  environmentZoneStatus, zoneEnvironmentState } from '@/cinema/zoneEnvironment';
import { advanceFilm, chapterAt, FILM_CHAPTERS } from '@/cinema/filmProgram';
import { sensorReading } from '@/cinema/components/drawSensorInstrument';
import { environmentCardPoint, environmentFocusConnection, environmentHistoryLayout } from '@/cinema/environmentLayout';

describe('ten-zone temperature and humidity scene', () => {
  it('uses the same finite physical scale for the number, segmented bars and management band', () => {
    const temp = sensorReading(24, { min: 20, max: 28 }, false);
    expect(temp.number).toBe('24.0'); expect(temp.fraction).toBe(.6);
    expect(temp.min).toBe(0); expect(temp.max).toBe(40);
    const humidity = sensorReading(64, { min: 40, max: 60 }, true);
    expect(humidity.fraction).toBe(.64); expect(humidity.status).toBe('outside');
    for (const value of [null, NaN, Infinity, -Infinity]) {
      const reading = sensorReading(value, { min: 20, max: 28 }, false);
      expect(reading.number).toBe('—'); expect(reading.fraction).toBe(0);
      expect(Number.isFinite(reading.min) && Number.isFinite(reading.max)).toBe(true);
    }
  });
  it('shows all ten snapshots and distinguishes temperature and humidity excursions', () => {
    const state = zoneEnvironmentState(4);
    expect(state.zones).toHaveLength(10);
    expect(new Set(state.zones.map(z => z.zone.id)).size).toBe(10);
    expect(state.normal).toBe(8); expect(state.outside).toBe(2); expect(state.missing).toBe(0);
    expect(environmentReadingStatus(state.zones[5].zone.temperature, { min: 20, max: 28 })).toBe('outside');
    expect(environmentReadingStatus(state.zones[7].zone.humidity, { min: 40, max: 60 }, true)).toBe('outside');
  });

  it('visits all ten zones while the small stations stay in their top and bottom bands', () => {
    for (let index = 0; index < 10; index++) {
      const focused = zoneEnvironmentState(2.5 + index * 1.9 + .9);
      expect(focused.selected?.index).toBe(index);
      expect(focused.focus).toBe(1);
      const station = focused.zones[index], base = station.project({ x: 0, y: 0, z: 0 });
      expect(station.anchor.scale / base.scale).toBeGreaterThan(1);
      expect(station.anchor.scale / base.scale).toBeLessThanOrEqual(1.07);
      expect(Math.abs(station.anchor.x - base.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(station.anchor.y - base.y)).toBeLessThanOrEqual(5);
      expect(focused.zones.filter(z => z.focus > 0)).toHaveLength(1);
      expect(focused.focusOpacity).toBe(1);
      expect(focused.zones.every(z => z.cardOpacity === 1 && z.chartReveal === 0)).toBe(true);
      expect(focused.heatmapReveal).toBe(0);
    }
    for (const time of [0, 2, 21.5, 22, 32, 38]) {
      const state = zoneEnvironmentState(time);
      expect(state.selected).toBeUndefined();
      expect(state.zones.every(z => z.focus === 0)).toBe(true);
    }
    const unfolded = zoneEnvironmentState(32);
    expect(unfolded.zones.filter(z => z.band === 'top')).toHaveLength(5);
    expect(unfolded.zones.filter(z => z.band === 'bottom')).toHaveLength(5);
    for (const item of unfolded.zones) {
      expect(Math.abs(item.anchor.x - (200 + item.index % 5 * 220))).toBeLessThanOrEqual(2);
      expect(Math.abs(item.anchor.y - (item.index < 5 ? 185 : 580))).toBeLessThanOrEqual(5);
      expect(Math.abs(item.anchor.scale - 1)).toBeLessThanOrEqual(.004);
      expect(Math.abs(item.anchor.depth)).toBeLessThanOrEqual(4);
      expect(item.chartReveal).toBe(1);
    }
    expect(zoneEnvironmentState(ENVIRONMENT_FILM_SECONDS).zones.every(z => z.cardOpacity === 0 && z.chartReveal === 0)).toBe(true);
    expect(zoneEnvironmentState(ENVIRONMENT_FILM_SECONDS).reveal).toBe(0);
  });

  it('never classifies unavailable readings or impossible humidity as normal', () => {
    for (const value of [null, NaN, Infinity, -Infinity]) {
      expect(environmentReadingStatus(value, { min: 20, max: 28 })).toBe('missing');
    }
    for (const value of [-.01, 100.01]) {
      expect(environmentReadingStatus(value, { min: 0, max: 100 }, true)).toBe('missing');
    }
    expect(environmentReadingStatus(20, { min: 20, max: 28 })).toBe('normal');
    expect(environmentReadingStatus(28, { min: 20, max: 28 })).toBe('normal');
    expect(environmentReadingStatus(20, { min: 28, max: 20 })).toBe('missing');
    expect(environmentZoneStatus({ ...DEFAULT_ENVIRONMENT_DATA.zones[0], humidity: null })).toBe('missing');
  });

  it('uses supplied snapshots and thresholds without fabricated animation values', () => {
    const custom = Object.freeze({ title: '실제 전달 형식',
      zones: Object.freeze([Object.freeze({ ...DEFAULT_ENVIRONMENT_DATA.zones[0],
        temperature: 31, temperatureRange: { min: 30, max: 32 }, humidity: null })]) });
    for (const time of [4, 15, 30, 42, 7, 4]) {
      const state = zoneEnvironmentState(time, custom);
      expect(state.zones[0].zone.temperature).toBe(31);
      expect(state.zones[0].zone.humidity).toBeNull();
      expect(state.missing).toBe(1);
    }
    const empty = zoneEnvironmentState(10, { title: '', zones: [] });
    expect(empty.zones).toEqual([]); expect(empty.selected).toBeUndefined();
    expect(zoneEnvironmentState(NaN).elapsed).toBe(0);
    const a = zoneEnvironmentState(8), b = zoneEnvironmentState(8);
    expect(a.zones.map(z => z.anchor)).toEqual(b.zones.map(z => z.anchor));
  });

  it('keeps the small stations inside the viewport and leaves the central readout area clear', () => {
    for (let time = 0; time <= ENVIRONMENT_FILM_SECONDS; time += .05) {
      for (const { anchor, band } of zoneEnvironmentState(time).zones) {
        expect(anchor.x - 88 * anchor.scale).toBeGreaterThan(72);
        expect(anchor.x + 88 * anchor.scale).toBeLessThan(1208);
        expect(anchor.y - 48 * anchor.scale).toBeGreaterThan(126);
        expect(anchor.y + 55 * anchor.scale).toBeLessThan(655);
        if (band === 'top') expect(anchor.y + 55 * anchor.scale).toBeLessThan(250);
        else expect(anchor.y - 48 * anchor.scale).toBeGreaterThan(520);
      }
    }
  });

  it('reproduces the same cards, history curves and heatmap phases after reverse seeking', () => {
    const snapshot = (time: number) => {
      const state = zoneEnvironmentState(time);
      return { zones: state.zones.map(({ anchor, cardOpacity, chartReveal, history }) => ({ anchor, cardOpacity, chartReveal, history })),
        historyPhase: state.historyPhase, heatmapReveal: state.heatmapReveal, reveal: state.reveal };
    };
    const charts = snapshot(30), heatmap = snapshot(42);
    for (const time of [0, 30, 42, 51, 5, 42, 30]) {
      if (time === 30) expect(snapshot(time)).toEqual(charts);
      else if (time === 42) expect(snapshot(time)).toEqual(heatmap);
      else snapshot(time);
    }
  });

  it('keeps all ten card reading areas separate during focus and graph transitions', () => {
    for (let time = 0; time <= ENVIRONMENT_TIMING.heatmapFull; time += .1) {
      const items = zoneEnvironmentState(time).zones;
      for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
        const a = items[i].anchor, b = items[j].anchor;
        const separatedX = Math.abs(a.x - b.x) >= 73 * (a.scale + b.scale);
        const separatedY = Math.abs(a.y - b.y) >= 30 * (a.scale + b.scale);
        expect(separatedX || separatedY, `ZONE ${i + 1}/${j + 1} at ${time.toFixed(3)}`).toBe(true);
      }
    }
  });

  it('keeps the ten history plots between their fixed cards without overlapping other plots', () => {
    for (let time = ENVIRONMENT_TIMING.chartsStart; time <= ENVIRONMENT_TIMING.heatmapStart + .5; time += .2) {
      const visible = zoneEnvironmentState(time).zones.filter(item => item.chartReveal > 0);
      const plots = visible.map(item => ({ item, plot: environmentHistoryLayout(item) }));
      for (const { item, plot } of plots) {
        expect(plot.x - 26).toBeGreaterThan(72);
        expect(plot.x + plot.width).toBeLessThan(1208);
        const cardTop = Math.min(...[-84, 84].map(x => environmentCardPoint(item, x, -43).y));
        const cardBottom = Math.max(...[-84, 84].map(x => environmentCardPoint(item, x, 55).y));
        if (item.band === 'top') expect(plot.top - 20).toBeGreaterThan(cardBottom);
        else expect(plot.top + plot.height + 18).toBeLessThan(cardTop);
      }
      for (let i = 0; i < plots.length; i++) for (let j = i + 1; j < plots.length; j++) {
        const a = plots[i].plot, b = plots[j].plot;
        const separatedX = a.x + a.width < b.x - 26 || b.x + b.width < a.x - 26;
        const separatedY = a.top + a.height + 18 < b.top - 20 || b.top + b.height + 18 < a.top - 20;
        expect(separatedX || separatedY).toBe(true);
      }
    }
  });

  it('connects each selected station toward the central instrument without crossing the other card band', () => {
    for (let index = 0; index < 10; index++) {
      const state = zoneEnvironmentState(2.5 + index * 1.9 + .9);
      const path = environmentFocusConnection(state);
      expect(path).toHaveLength(4);
      const start = path[0], end = path.at(-1)!;
      expect(end.x).toBeGreaterThan(222); expect(end.x).toBeLessThan(1058);
      if (index < 5) {
        expect(start.y).toBeLessThan(end.y);
        expect(path.every(point => point.y > 200 && point.y <= 282)).toBe(true);
      } else {
        expect(start.y).toBeGreaterThan(end.y);
        expect(path.every(point => point.y >= 496 && point.y < 570)).toBe(true);
      }
    }
    expect(environmentFocusConnection(zoneEnvironmentState(30))).toEqual([]);
  });

  it('finishes histories before the sensor-space heatmap is fully revealed', () => {
    const readings = zoneEnvironmentState(ENVIRONMENT_TIMING.tourEnd);
    expect(readings.zones.every(z => z.chartReveal === 0 && z.cardOpacity === 1)).toBe(true);
    expect(readings.heatmapReveal).toBe(0);
    const charts = zoneEnvironmentState(30);
    expect(charts.historyPhase).toBe(1);
    expect(charts.zones.every(z => z.chartReveal === 1 && z.cardOpacity === 1)).toBe(true);
    expect(charts.heatmapReveal).toBe(0);
    const transition = zoneEnvironmentState(36);
    expect(transition.zones.every(z => z.chartReveal === 0 && z.cardOpacity === 0)).toBe(true);
    expect(transition.historyPhase).toBe(0);
    expect(transition.heatmapReveal).toBeGreaterThan(0);
    expect(transition.heatmapReveal).toBeLessThan(1);
    const heatmap = zoneEnvironmentState(ENVIRONMENT_TIMING.heatmapFull);
    expect(heatmap.historyPhase).toBe(0);
    expect(heatmap.zones.every(z => z.chartReveal === 0 && z.cardOpacity === 0)).toBe(true);
    expect(heatmap.heatmapReveal).toBe(1);
    expect(zoneEnvironmentState(51).heatmapReveal).toBeCloseTo(.5);
    expect(zoneEnvironmentState(ENVIRONMENT_FILM_SECONDS).heatmapReveal).toBe(0);
  });

  it('extends the full tour to 52 seconds and keeps selection and looping aligned', () => {
    expect(FILM_CHAPTERS[0]).toMatchObject({ id: 'wave', title: '온습도 모니터링', duration: 52, previewAt: 30 });
    expect(chapterAt(51.999).chapter.id).toBe('wave');
    expect(chapterAt(52).chapter.id).toBe('gears');
    expect(chapterAt(advanceFilm(51.9, .2, 'chapter')).localTime).toBeCloseTo(.1);
  });
});
