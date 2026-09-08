import { describe, expect, it } from 'vitest';
import { cornerHoverOffset, cornerReadingProjection } from '@/cinema/cornerProjection';
import { CORNER_CARD_SIZE, cornerSequenceState } from '@/cinema/cornerSequence';
import { cornerReadoutEdge } from '@/cinema/components/drawCornerReadout';
import { CORE_BOUNDS } from '@/cinema/cornerCoreGeometry';

describe('corner planes in perspective', () => {
  it('presents the selected reading face-on, then moves it back in depth', () => {
    const front = cornerSequenceState(3).items[0];
    const projection = cornerReadingProjection(front);
    expect(projection.yaw).toBe(0);
    expect(Math.abs(projection.pitch)).toBe(0);
    expect(projection.depth).toBeLessThan(0);
    expect(projection.point(120, -60).x).toBeCloseTo(front.x + 120 * front.scale);
    expect(projection.point(120, -60).y).toBeCloseTo(front.y - 60 * front.scale);
    const moving = cornerReadingProjection(cornerSequenceState(6.5).items[0]);
    const parked = cornerReadingProjection(cornerSequenceState(8).items[0]);
    expect(moving.depth).toBeGreaterThan(projection.depth);
    expect(parked.depth).toBeGreaterThan(moving.depth);
    expect(parked.depth).toBeGreaterThan(0);
  });

  it.each([0, 1, 2, 3])('turns corner %s inward with a shorter, farther inner edge', index => {
    const reading = cornerSequenceState(36).items[index];
    const projection = cornerReadingProjection(reading);
    const innerX = reading.item.corner.x < 640 ? 150 : -150;
    const innerTop = projection.point(innerX, -90), innerBottom = projection.point(innerX, 90);
    const outerTop = projection.point(-innerX, -90), outerBottom = projection.point(-innerX, 90);
    expect(innerTop.depth).toBeGreaterThan(outerTop.depth);
    expect(innerBottom.depth).toBeGreaterThan(outerBottom.depth);
    const distance = (a: typeof innerTop, b: typeof innerTop) => Math.hypot(a.x - b.x, a.y - b.y);
    expect(distance(innerTop, innerBottom)).toBeLessThan(distance(outerTop, outerBottom) * .9);
    const anchor = cornerReadoutEdge('reading', innerX > 0 ? 1 : -1);
    const connection = projection.point(anchor.x, anchor.y);
    expect(connection.depth).toBeGreaterThan(projection.depth);
    expect(Math.sign(connection.x - reading.x)).toBe(Math.sign(innerX));
  });

  it('mirrors left and right planes about the same central vanishing point', () => {
    const readings = cornerSequenceState(36).items;
    const right = cornerReadingProjection({ ...readings[0], localTime: 6.5 });
    const left = cornerReadingProjection({ ...readings[2], localTime: 6.5 });
    for (const x of [-170, 0, 170]) {
      for (const y of [-105, 0, 105]) {
        const a = right.point(x, y), b = left.point(-x, y);
        expect(a.x + b.x).toBeCloseTo(1280);
        expect(a.y).toBeCloseTo(b.y);
        expect(a.depth).toBeCloseTo(b.depth);
      }
    }
  });

  it('starts floating gently after parking and gives each reading its own motion', () => {
    const parked = cornerSequenceState(36).items;
    for (const reading of parked) {
      const start = cornerHoverOffset({ ...reading, localTime: 6.5 });
      expect(Object.values(start).every(value => value === 0)).toBe(true);
      const firstMoment = cornerHoverOffset({ ...reading, localTime: 6.501 });
      expect(Object.values(firstMoment).every(value => Math.abs(value) < .001)).toBe(true);
    }
    const centres = parked.map(reading => cornerReadingProjection(reading).point(0, 0));
    const later = cornerSequenceState(37).items.map(reading => cornerReadingProjection(reading).point(0, 0));
    expect(later.every((point, index) => Math.hypot(point.x - centres[index].x, point.y - centres[index].y) > .1)).toBe(true);
    expect(new Set(parked.map(reading => cornerHoverOffset(reading).y)).size).toBe(4);
  });

  it('reconstructs the same hovering pose after pauses and backwards seeks', () => {
    const before = cornerReadingProjection(cornerSequenceState(34).items[2]).point(150, -90);
    cornerReadingProjection(cornerSequenceState(39).items[2]).point(150, -90);
    expect(cornerReadingProjection(cornerSequenceState(34).items[2]).point(150, -90)).toEqual(before);
  });

  it('keeps projected corners finite and within the composition throughout replay', () => {
    const { width, height } = CORNER_CARD_SIZE;
    for (let tick = 0; tick <= 1000; tick++) {
      const state = cornerSequenceState(tick * .04);
      const bounds = state.items.filter(reading => reading.opacity > .001).map(reading => {
        const plane = cornerReadingProjection(reading);
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => plane.point(x * width / 2, y * height / 2));
        for (const point of corners) {
          expect(Object.values(point).every(Number.isFinite)).toBe(true);
          expect(point.x).toBeGreaterThanOrEqual(0);
          expect(point.x).toBeLessThanOrEqual(1280);
          expect(point.y).toBeGreaterThanOrEqual(0);
          expect(point.y).toBeLessThanOrEqual(720);
        }
        return { left: Math.min(...corners.map(p => p.x)), right: Math.max(...corners.map(p => p.x)),
          top: Math.min(...corners.map(p => p.y)), bottom: Math.max(...corners.map(p => p.y)) };
      });
      if (state.finale.opacity > .001) {
        const summary = state.finale;
        bounds.push({ left: summary.x - CORE_BOUNDS.width / 2 * summary.scale, right: summary.x + CORE_BOUNDS.width / 2 * summary.scale,
          top: summary.y - CORE_BOUNDS.height / 2 * summary.scale, bottom: summary.y + CORE_BOUNDS.height / 2 * summary.scale });
      }
      for (let i = 0; i < bounds.length; i++) {
        for (let j = i + 1; j < bounds.length; j++) {
          const a = bounds[i], b = bounds[j];
          const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          expect(overlapX <= 0 || overlapY <= 0, `overlap at ${tick * .04}s`).toBe(true);
        }
      }
    }
  });
});
