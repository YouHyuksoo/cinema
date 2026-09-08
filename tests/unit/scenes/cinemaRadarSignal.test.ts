import { describe, expect, it } from 'vitest';
import { DEFAULT_RADAR_DATA, RADAR_FILM_SECONDS, RADAR_RADIUS, RADAR_SCAN_START,
  radarBearing, radarPolarPoint, radarSignalState, type RadarSignalData } from '@/cinema/radarSignal';


function frameAt(time: number, data = DEFAULT_RADAR_DATA) {
  const state = radarSignalState(time, data);
  return { elapsed: state.elapsed, scanBearing: state.scanBearing, acquired: state.acquired,
    focus: state.focus, reveal: state.reveal, readout: state.readout, target: state.target?.contact.id,
    contacts: state.contacts, projected: state.contacts.map(contact => state.project(contact.point)) };
}

describe('scanning radar signal', () => {
  it('maps north, east, south and west onto one proportional distance scale', () => {
    for (const ratio of [0, .25, .5, 1]) {
      const radius = RADAR_RADIUS * ratio;
      for (const [bearing, x, y] of [[0, 0, -radius], [90, radius, 0], [180, 0, radius], [270, -radius, 0]]) {
        const point = radarPolarPoint(ratio, bearing);
        expect(point.x).toBeCloseTo(x); expect(point.y).toBeCloseTo(y);
        expect(Math.hypot(point.x, point.y)).toBeCloseTo(radius);
        expect(point.z).toBe(0);
        for (const turns of [-3, -1, 0, 1, 4]) {
          expect(radarBearing(bearing + 360 * turns)).toBe(bearing);
        }
      }
    }
    expect(radarBearing(-90)).toBe(270);
    expect(radarBearing(360)).toBe(0);
  });

  it('excludes invalid and out-of-range contacts instead of placing them at the outer ring', () => {
    const valid = { id: 'valid', label: 'VALID', rangeKm: 5, bearingDeg: -90, strength: .5 };
    const data: RadarSignalData = { ...DEFAULT_RADAR_DATA, rangeKm: 10, contacts: [
      valid, { ...valid, id: 'center', rangeKm: 0 }, { ...valid, id: 'edge', rangeKm: 10 },
      { ...valid, id: 'outside', rangeKm: 10.01, strength: 1 }, { ...valid, id: 'negative', rangeKm: -1 },
      { ...valid, id: 'missing-range', rangeKm: NaN }, { ...valid, id: 'missing-bearing', bearingDeg: Infinity },
      { ...valid, id: 'missing-strength', strength: NaN }, { ...valid, id: 'over-strength', strength: 1.01 },
      { ...valid, id: 'negative-strength', strength: -.1 },
    ] };
    const state = radarSignalState(16, data);
    expect(state.contacts.map(contact => contact.contact.id)).toEqual(['valid', 'center', 'edge']);
    expect(state.contacts[0].bearing).toBe(270);
    expect(Math.hypot(state.contacts[1].base.x, state.contacts[1].base.y)).toBe(0);
    expect(Math.hypot(state.contacts[2].base.x, state.contacts[2].base.y)).toBeCloseTo(RADAR_RADIUS);
    for (const rangeKm of [0, -1, NaN, Infinity]) {
      const empty = radarSignalState(16, { ...data, rangeKm });
      expect(empty.contacts).toEqual([]); expect(empty.target).toBeUndefined(); expect(empty.readout).toBe(0);
    }
    expect(radarSignalState(16, { ...data, contacts: [] }).acquired).toBe(0);
    for (const scanSeconds of [0, -1, NaN, Infinity]) {
      const fallback = radarSignalState(16, { ...data, scanSeconds });
      expect(fallback.period).toBeGreaterThan(0); expect(Number.isFinite(fallback.scanBearing)).toBe(true);
    }
    expect(radarSignalState(NaN).elapsed).toBe(0);
    expect(radarSignalState(Infinity).elapsed).toBe(0);
  });

  it('detects each contact only when the actual sweep reaches its bearing at different scan speeds', () => {
    for (const scanSeconds of [2, 6, 12]) {
      for (const bearingDeg of [0, 42, 128, 278, 359]) {
        const data: RadarSignalData = { ...DEFAULT_RADAR_DATA, scanSeconds,
          contacts: [{ id: 'echo', label: 'ECHO', rangeKm: 7, bearingDeg, strength: .8 }] };
        const crossing = RADAR_SCAN_START + bearingDeg / 360 * scanSeconds;
        const before = radarSignalState(crossing - .0001, data);
        const after = radarSignalState(crossing + .0001, data);
        expect(before.contacts[0].detected).toBe(false);
        expect(before.contacts[0].echo).toBe(0);
        expect(before.acquired).toBe(0);
        expect(after.contacts[0].detected).toBe(true);
        expect(after.contacts[0].age).toBeCloseTo(.0001, 7);
        expect(after.contacts[0].echo).toBeGreaterThan(.99);
        expect(after.acquired).toBe(1);
      }
    }
  });

  it('refreshes north echoes across the 359-to-zero boundary without losing the just-scanned contact', () => {
    for (const scanSeconds of [2, 6, 12]) {
      const data: RadarSignalData = { ...DEFAULT_RADAR_DATA, scanSeconds, contacts: [
        { id: 'north', label: 'NORTH', rangeKm: 4, bearingDeg: 0, strength: .6 },
        { id: 'last', label: 'LAST', rangeKm: 5, bearingDeg: 359, strength: .8 },
      ] };
      const wrap = RADAR_SCAN_START + scanSeconds, epsilon = scanSeconds / 3600;
      const before = radarSignalState(wrap - epsilon, data), after = radarSignalState(wrap + epsilon, data);
      expect(before.scanBearing).toBeGreaterThan(359);
      expect(after.scanBearing).toBeLessThan(1);
      expect(before.contacts[0].age).toBeGreaterThan(scanSeconds * .99);
      expect(after.contacts[0].age).toBeCloseTo(epsilon);
      expect(after.contacts[0].echo).toBeGreaterThan(before.contacts[0].echo);
      expect(before.contacts[1].detected).toBe(true);
      expect(after.contacts[1].detected).toBe(true);
      expect(after.contacts[1].age).toBeGreaterThan(before.contacts[1].age);
      expect(after.acquired).toBe(2);
    }
  });

  it('reconstructs acquisition, persistence and geometry after skipped frames and backwards seeks', () => {
    const data = Object.freeze({ ...DEFAULT_RADAR_DATA,
      contacts: Object.freeze(DEFAULT_RADAR_DATA.contacts.map(contact => Object.freeze({ ...contact }))) });
    const expected = frameAt(16, data), beforeScan = frameAt(1, data);
    for (const time of [23.99, 5.2, 0, 12, 21.7, 2.4]) frameAt(time, data);
    expect(frameAt(16, data)).toEqual(expected);
    expect(frameAt(1, data)).toEqual(beforeScan);
    expect(beforeScan.acquired).toBe(0);
    expect(beforeScan.contacts.every(contact => !contact.detected && contact.echo === 0)).toBe(true);
    expect(data.contacts).toEqual(DEFAULT_RADAR_DATA.contacts);
  });

  it('moves only the selected echo forward and keeps every ground return and measured value unchanged', () => {
    const focused = radarSignalState(16), returned = radarSignalState(21);
    expect(focused.target?.contact.id).toBe('echo-02');
    expect(focused.focus).toBe(1);
    for (const contact of focused.contacts) {
      const ground = focused.project(contact.base), point = focused.project(contact.point);
      expect(Object.values(point).every(Number.isFinite)).toBe(true);
      expect(contact.contact).toEqual(DEFAULT_RADAR_DATA.contacts.find(item => item.id === contact.contact.id));
      expect(Math.hypot(contact.base.x, contact.base.y) / RADAR_RADIUS)
        .toBeCloseTo(contact.contact.rangeKm / DEFAULT_RADAR_DATA.rangeKm);
      if (contact.selected) {
        expect(contact.point.z).toBeLessThan(contact.base.z);
        expect(point.depth).toBeLessThan(ground.depth);
        expect(point.y).toBeLessThan(ground.y);
        expect(point.scale).toBeGreaterThan(ground.scale);
      } else {
        expect(Math.hypot(contact.point.x - contact.base.x, contact.point.y - contact.base.y,
          contact.point.z - contact.base.z)).toBe(0);
        expect(point).toEqual(ground);
      }
    }
    expect(returned.focus).toBe(0);
    expect(returned.contacts.every(contact => contact.point.x === contact.base.x && contact.point.y === contact.base.y
      && contact.point.z === contact.base.z)).toBe(true);
  });

  it('renders the reusable radar preview and fades out at its own 24-second boundary', () => {
    // The wave chapter now displays zone environment data; radar remains a reusable component.
    const preview = radarSignalState(16);
    expect(preview.acquired).toBe(DEFAULT_RADAR_DATA.contacts.length);
    expect(preview.target).toBeDefined(); expect(preview.readout).toBe(1); expect(preview.reveal).toBe(1);
    expect(radarSignalState(22).reveal).toBe(1);
    expect(radarSignalState(23.5).reveal).toBeGreaterThan(0);
    expect(radarSignalState(23.5).reveal).toBeLessThan(1);
    expect(radarSignalState(RADAR_FILM_SECONDS).reveal).toBe(0);
  });

  it('keeps selected rim contacts below the heading and inside the radar reading area at every bearing', () => {
    for (const rangeKm of [0, 7.5, 15]) {
      for (let bearingDeg = 0; bearingDeg < 360; bearingDeg += 5) {
        const state = radarSignalState(16, { ...DEFAULT_RADAR_DATA, scanSeconds: 2, contacts: [
          { id: 'rim', label: 'RIM CONTACT', rangeKm, bearingDeg, strength: 1 },
        ] });
        expect(state.target?.detected).toBe(true);
        expect(state.target?.focus).toBe(1);
        const point = state.project(state.target!.point);
        const context = `selected contact at ${rangeKm} km / ${bearingDeg} degrees`;
        expect(Object.values(point).every(Number.isFinite), context).toBe(true);
        expect(point.x, context).toBeGreaterThanOrEqual(140);
        expect(point.x, context).toBeLessThanOrEqual(830);
        expect(point.y, context).toBeGreaterThanOrEqual(100);
        expect(point.y, context).toBeLessThanOrEqual(600);
      }
    }
  });
});
