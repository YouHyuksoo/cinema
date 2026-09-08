import { describe, expect, it } from 'vitest';
import { focusEnvelope, focusProjection, projectFocusPoint } from '@/cinema/filmFocus';
import { drivenGear, mainGear } from '@/cinema/gearGeometry';

describe('cinematic focus depth', () => {
  const timing = { enter: [2, 4], exit: [8, 10] } as const;

  it('approaches, holds for reading, and returns before the scene ends, including backward seeks', () => {
    expect([0, 2, 4, 7, 10, 12].map(time => focusEnvelope(time, timing))).toEqual([0, 0, 1, 1, 0, 0]);
    expect(focusEnvelope(3, timing)).toBeCloseTo(focusEnvelope(9, timing));
    const frameAt = (time: number) => focusProjection({ x: 470, y: 340, focus: focusEnvelope(time, timing) });
    const held = frameAt(6);
    expect(held.scale).toBeGreaterThan(1);
    expect(held.y).toBeLessThan(340);
    expect(frameAt(11)).toEqual(frameAt(0));
    expect(frameAt(6)).toEqual(held);
  });

  it('keeps driven gears engaged and restores attached points after a depth round trip', () => {
    const main = mainGear(.4), follower = drivenGear(main, 24, .8);
    for (const focus of [0, .2, .5, 1, .5, 0]) {
      const view = focusProjection({ x: main.x, y: main.y, focus, depth: 150 });
      const a = projectFocusPoint(view, main), b = projectFocusPoint(view, follower);
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo((main.radius + follower.radius) * view.scale, 8);
      if (focus === 0) expect(a).toEqual({ x: main.x, y: main.y });
    }
  });

  it('bounds the projection away from the eye plane and treats invalid focus as rest', () => {
    expect(focusProjection({ x: 0, y: 0, focus: NaN }).scale).toBe(1);
    for (const depth of [-5000, 0, 500, 1000, 5000]) {
      const view = focusProjection({ x: 470, y: 340, focus: 1, depth });
      expect(Number.isFinite(view.scale)).toBe(true);
      expect(view.scale).toBeGreaterThan(0);
      expect(view.scale).toBeLessThan(3);
    }
  });
});
