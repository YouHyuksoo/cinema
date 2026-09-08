import { describe, expect, it } from 'vitest';
import {
  VISOR_STOP_SECONDS, VISOR_TOUR_SECONDS, VISOR_TOUR_STOPS, visorTourCamera, visorTourState,
} from '@/cinema/visorTour';
import {
  inspectionFocusPoint, inspectionTargetBounds, projectInspectionPoint, type InspectionCamera,
} from '@/cinema/inspectionSpace';
import { advanceFilm, chapterAt, chapterStart, FILM_DURATIONS } from '@/cinema/filmProgram';

describe('three-station visor tour', () => {
  it('visits SMT 03, 04 and 01 in independent sixteen-second intervals', () => {
    expect(VISOR_STOP_SECONDS).toBe(16);
    expect(VISOR_TOUR_SECONDS).toBe(48);
    expect(VISOR_TOUR_STOPS.map(stop => stop.stationId)).toEqual([3, 4, 1]);
    const visits = [
      { start: 0, stationId: 3, kind: 'thermal' },
      { start: 16, stationId: 4, kind: 'quality' },
      { start: 32, stationId: 1, kind: 'production' },
    ];
    visits.forEach((visit, index) => {
      for (const localTime of [0, .5, 8, 15.999]) {
        const state = visorTourState(visit.start + localTime);
        expect(state.station.id).toBe(visit.stationId);
        expect(state.stop.kind).toBe(visit.kind);
        expect(state.index).toBe(index);
        expect(state.localTime).toBeCloseTo(localTime, 8);
      }
    });
  });

  it.each([8, 24, 40])('holds the selected target and its information fully open at %ss', time => {
    const state = visorTourState(time);
    expect(state.focus).toBe(1);
    expect(state.readout).toBe(1);
    expect(state.lock).toBe(1);
    expect(state.reveal).toBe(1);
    expect(state.readoutTime).toBeGreaterThan(3);
  });

  it('closes each readout before pulling away and returns to the aisle before switching targets', () => {
    for (const start of [0, 16, 32]) {
      expect(visorTourState(start + 11.3).readout).toBeCloseTo(1, 8);
      expect(visorTourState(start + 12.5).readout).toBe(0);
      expect(visorTourState(start + 12.5).focus).toBe(1);
      let previousFocus = 1;
      for (const localTime of [12.6, 13, 14, 15, 15.2, 15.6, 16]) {
        const state = visorTourState(start + localTime);
        expect(state.readout).toBe(0);
        expect(state.focus).toBeLessThanOrEqual(previousFocus);
        if (localTime >= 15.2) expect(state.focus).toBe(0);
        previousFocus = state.focus;
      }
    }
  });

  it('keeps the camera continuous across return completion and station handoffs', () => {
    const epsilon = .00001;
    const axes: (keyof InspectionCamera)[] = ['x', 'y', 'z', 'yaw', 'pitch', 'focal', 'near'];
    for (const boundary of [15.2, 16, 31.2, 32, 47.2]) {
      const before = visorTourCamera(boundary - epsilon);
      const at = visorTourCamera(boundary);
      const after = visorTourCamera(boundary + epsilon);
      expect(visorTourState(boundary).focus).toBe(0);
      for (const axis of axes) {
        expect(Number.isFinite(at[axis])).toBe(true);
        expect(Math.abs(before[axis] - at[axis])).toBeLessThan(.001);
        expect(Math.abs(after[axis] - at[axis])).toBeLessThan(.001);
      }
    }
  });

  it('keeps the moving cabinet, lamp and measured feature visible throughout every visit', () => {
    for (let tick = 0; tick <= 480; tick++) {
      const time = tick / 10;
      const state = visorTourState(time), camera = visorTourCamera(time);
      const bounds = inspectionTargetBounds(camera, state.focus, state.station);
      expect(Object.values(camera).every(Number.isFinite), `camera at ${time}s`).toBe(true);
      expect(Object.values(bounds).every(Number.isFinite), `bounds at ${time}s`).toBe(true);
      expect(bounds.x - bounds.width / 2, `left at ${time}s`).toBeGreaterThan(0);
      expect(bounds.x + bounds.width / 2, `right at ${time}s`).toBeLessThan(1280);
      expect(bounds.y - bounds.height / 2, `top at ${time}s`).toBeGreaterThan(0);
      expect(bounds.y + bounds.height / 2, `bottom at ${time}s`).toBeLessThan(720);
      const { station, focus } = state;
      const points = [
        { x: station.x + 25, y: 88, z: station.z - 76.5 },
        ...[station.x - 72, station.x + 72].flatMap(x => [0, 203].flatMap(y =>
          [station.z - 75, station.z + 75].map(z => ({ x, y, z })))),
      ];
      for (const source of points) {
        const point = projectInspectionPoint(camera, inspectionFocusPoint(source, focus));
        expect(point.visible, `surface visibility at ${time}s`).toBe(true);
        expect(point.x).toBeGreaterThanOrEqual(bounds.x - bounds.width / 2);
        expect(point.x).toBeLessThanOrEqual(bounds.x + bounds.width / 2);
        expect(point.y).toBeGreaterThanOrEqual(bounds.y - bounds.height / 2);
        expect(point.y).toBeLessThanOrEqual(bounds.y + bounds.height / 2);
      }
    }
  });

  it('seeks back to the same target and camera without retaining the later visit', () => {
    const first = { state: visorTourState(8), camera: visorTourCamera(8) };
    visorTourState(40); visorTourCamera(40);
    expect({ state: visorTourState(8), camera: visorTourCamera(8) }).toEqual(first);
  });

  it('advances from the forty-eight-second tour to the separate thirty-two-second planar film', () => {
    expect(FILM_DURATIONS.visor).toBe(48);
    expect(FILM_DURATIONS.visorPan).toBe(32);
    const start = chapterStart('visor');
    expect(chapterStart('visorPan') - start).toBe(48);
    expect(chapterAt(start + 47.999).chapter.id).toBe('visor');
    const next = chapterAt(advanceFilm(start + 47.8, .4, 'sequence'));
    expect(next.chapter.id).toBe('visorPan');
    expect(next.localTime).toBeCloseTo(.2, 8);
    const loop = chapterAt(advanceFilm(start + 47.8, .4, 'chapter'));
    expect(loop.chapter.id).toBe('visor');
    expect(loop.localTime).toBeCloseTo(.2, 8);
    expect(visorTourState(loop.localTime).station.id).toBe(3);
  });
});
